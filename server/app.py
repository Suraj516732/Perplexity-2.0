from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage
from langchain_core.runnables import RunnableConfig
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastapi import FastAPI, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import ConnectionPool, AsyncConnectionPool
from contextlib import asynccontextmanager
import sqlite3
import shutil
import json
from uuid import uuid4
import os
from datetime import datetime

load_dotenv()

_missing_keys = [k for k in ("OPENAI_API_KEY", "TAVILY_API_KEY") if not os.getenv(k)]
if _missing_keys:
    raise SystemExit(f"Missing {', '.join(_missing_keys)}. Add them to server/.env (see README) and restart.")

class State(TypedDict):
    messages: Annotated[list, add_messages]

# ---------------- DATABASE CONFIG ----------------
DATABASE_URL = os.getenv("DATABASE_URL")
pg_pool = None # Global pool

def init_db():
    global pg_pool
    if DATABASE_URL:
        # PostgreSQL Setup
        try:
            pg_pool = ConnectionPool(conninfo=DATABASE_URL, max_size=20)
            with pg_pool.connection() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS chat_store (
                        checkpoint_id TEXT PRIMARY KEY,
                        title TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
            return "postgres"
        except Exception as e:
            print(f"PostgreSQL connection failed: {e}. Falling back to SQLite.")
    
    # SQLite Fallback
    conn = sqlite3.connect("database.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_store (
            checkpoint_id TEXT PRIMARY KEY,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.close()
    return "sqlite"

DB_TYPE = init_db()

def get_chat_store():
    store = {}
    if DB_TYPE == "postgres" and pg_pool:
        with pg_pool.connection() as conn:
            rows = conn.execute("SELECT checkpoint_id, title FROM chat_store").fetchall()
            for row in rows:
                store[row[0]] = {"title": row[1]}
    else:
        conn = sqlite3.connect("database.db")
        rows = conn.execute("SELECT checkpoint_id, title FROM chat_store").fetchall()
        for row in rows:
            store[row[0]] = {"title": row[1]}
        conn.close()
    return store

def save_chat_to_db(checkpoint_id, title):
    if DB_TYPE == "postgres" and pg_pool:
        with pg_pool.connection() as conn:
            conn.execute(
                "INSERT INTO chat_store (checkpoint_id, title) VALUES (%s, %s) ON CONFLICT (checkpoint_id) DO UPDATE SET title = EXCLUDED.title",
                (checkpoint_id, title)
            )
    else:
        conn = sqlite3.connect("database.db")
        conn.execute(
            "INSERT OR REPLACE INTO chat_store (checkpoint_id, title) VALUES (?, ?)",
            (checkpoint_id, title)
        )
        conn.commit()
        conn.close()

def delete_chat_from_db(checkpoint_id):
    if DB_TYPE == "postgres" and pg_pool:
        with pg_pool.connection() as conn:
            conn.execute("DELETE FROM chat_store WHERE checkpoint_id = %s", (checkpoint_id,))
    else:
        conn = sqlite3.connect("database.db")
        conn.execute("DELETE FROM chat_store WHERE checkpoint_id = ?", (checkpoint_id,))
        conn.commit()
        conn.close()

# chat_store = get_chat_store() # Removed in favor of direct DB access

# ---------------- KNOWLEDGE BASE (per-chat PDFs) ----------------
# vector_dbs[chat_id] = [{"id", "name", "db", "chunks"}], persisted under vector_store/<chat_id>/<doc_id>
VECTOR_DIR = "vector_store"
vector_dbs = {}
embeddings = OpenAIEmbeddings()

def _chat_dir(chat_id):
    return os.path.join(VECTOR_DIR, os.path.basename(chat_id))

def _ordered_chunks(db):
    return [db.docstore.search(db.index_to_docstore_id[i]) for i in range(len(db.index_to_docstore_id))]

def get_chat_docs(chat_id):
    """Return the chat's documents, lazily loading them from disk after a restart."""
    if chat_id not in vector_dbs:
        docs = []
        meta_path = os.path.join(_chat_dir(chat_id), "meta.json")
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                for meta in json.load(f):
                    db = FAISS.load_local(
                        os.path.join(_chat_dir(chat_id), meta["id"]), embeddings,
                        allow_dangerous_deserialization=True,  # files are written only by this server
                    )
                    docs.append({"id": meta["id"], "name": meta["name"], "db": db, "chunks": _ordered_chunks(db)})
        vector_dbs[chat_id] = docs
    return vector_dbs[chat_id]

def _save_chat_meta(chat_id):
    os.makedirs(_chat_dir(chat_id), exist_ok=True)
    meta = [{"id": d["id"], "name": d["name"]} for d in vector_dbs.get(chat_id, [])]
    with open(os.path.join(_chat_dir(chat_id), "meta.json"), "w") as f:
        json.dump(meta, f)

def describe_docs(chat_id):
    return [{"id": d["id"], "name": d["name"], "chunks": len(d["chunks"])} for d in get_chat_docs(chat_id)]

# ---------------- TOOLS ----------------
search_tool = TavilySearchResults(max_results=4)
tools = [search_tool]

# ---------------- LLM ----------------
llm_fast = ChatOpenAI(model="gpt-4o-mini")
llm_pro = ChatOpenAI(model="gpt-4o")

llm_fast_tools = llm_fast.bind_tools(tools=tools)
llm_pro_tools = llm_pro.bind_tools(tools=tools)

SYSTEM_PROMPT = """You are Perplexity 2.0, a highly intelligent and professional AI search assistant.
You have access to conversation history and real-time search tools.
Always refer to the conversation history when the user asks follow-up questions.
Be concise, accurate, and use a premium professional tone.
"""

# ---------------- RAG ----------------
SMALL_DOC_CHUNKS = 8  # PDFs this small are sent whole, so "summarize this PDF" sees everything

def build_doc_context(docs, query, k=6):
    parts = []
    for item in docs:
        chunks = item["chunks"]
        if len(chunks) <= SMALL_DOC_CHUNKS:
            selected = chunks
        else:
            # Opening chunks give generic questions ("extract details") an overview
            hits = [doc for doc, _ in item["db"].similarity_search_with_score(query, k=k)]
            selected = chunks[:2] + [d for d in hits if d not in chunks[:2]]
        text = "\n\n".join(d.page_content for d in selected)
        parts.append(f"### Document: {item['name']}\n{text}")
    return "\n\n".join(parts)

# ---------------- MODEL ----------------
async def model(state: State, config: RunnableConfig):
    messages = state["messages"]

    # ✅ FIXED: get thread_id and deep_research flag from RunnableConfig
    thread_id = config.get("configurable", {}).get("thread_id")
    deep_research = config.get("configurable", {}).get("deep_research", False)

    # Prepare messages with system prompt
    current_date = datetime.now().strftime("%B %d, %Y")
    system_content = f"{SYSTEM_PROMPT}\n\nCurrent Date: {current_date}"

    # 🔥 RAG per chat. Lives in the system prompt (not the user message) so it is still
    # present on the second model pass after a web search.
    last_human = next((m for m in reversed(messages) if isinstance(m, HumanMessage)), None)
    chat_docs = get_chat_docs(thread_id) if thread_id else []
    if chat_docs and last_human:
        doc_context = build_doc_context(chat_docs, last_human.content)
        system_content += (
            "\n\nThe user has uploaded the PDF document(s) below to this chat. When they refer to "
            "'the PDF', 'this file' or 'the document', answer from these excerpts. Never say you "
            "cannot access the PDF or ask them to upload it again. Use web search only for "
            "information that is not in the document.\n\n" + doc_context
        )

    final_messages = [{"role": "system", "content": system_content}] + messages

    if deep_research:
        result = await llm_pro_tools.ainvoke(final_messages)
    else:
        result = await llm_fast_tools.ainvoke(final_messages)
    
    return {"messages": [result]}

# ---------------- ROUTER ----------------
async def tools_router(state: State):
    last_message = state["messages"][-1]

    if hasattr(last_message, "tool_calls") and len(last_message.tool_calls) > 0:
        return "tool_node"
    return END

# ---------------- TOOL NODE ----------------
async def tool_node(state):
    tool_calls = state["messages"][-1].tool_calls
    tool_messages = []

    for tool_call in tool_calls:
        if tool_call["name"] == "tavily_search_results_json":
            result = await search_tool.ainvoke(tool_call["args"])

            tool_messages.append(
                ToolMessage(
                    content=str(result),
                    tool_call_id=tool_call["id"],
                    name=tool_call["name"]
                )
            )

    return {"messages": tool_messages}

# ---------------- GRAPH ----------------
graph_builder = StateGraph(State)

graph_builder.add_node("model", model)
graph_builder.add_node("tool_node", tool_node)
graph_builder.set_entry_point("model")

graph_builder.add_conditional_edges("model", tools_router)
graph_builder.add_edge("tool_node", "model")

# Checkpointer initialization: the graph is driven with async APIs (astream_events,
# aget_state), so it needs an async checkpointer opened inside the event loop.
graph = None

@asynccontextmanager
async def lifespan(_app: FastAPI):
    global graph
    if DB_TYPE == "postgres" and pg_pool:
        async with AsyncConnectionPool(
            conninfo=DATABASE_URL, max_size=20, open=False,
            kwargs={"autocommit": True, "prepare_threshold": 0},
        ) as pool:
            saver = AsyncPostgresSaver(pool)
            await saver.setup()
            graph = graph_builder.compile(checkpointer=saver)
            yield
    else:
        async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as saver:
            graph = graph_builder.compile(checkpointer=saver)
            yield


# ---------------- FASTAPI ----------------
app = FastAPI(redirect_slashes=False, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- SERIALIZER ----------------
def serialise(chunk):
    if isinstance(chunk, AIMessageChunk):
        return chunk.content
    return ""

# ---------------- STREAM ----------------
async def generate_chat_responses(message: str, checkpoint_id: Optional[str] = None, deep_research: bool = False):
    try:
        # 🔥 Instant feedback
        yield f"data: {{\"type\":\"thinking\"}}\n\n"

        is_new = checkpoint_id is None

        if is_new:
            checkpoint_id = str(uuid4())

            # 🔥 FIX: avoid duplicate titles in DB
            save_chat_to_db(checkpoint_id, message[:30])

        config = {"configurable": {"thread_id": checkpoint_id, "deep_research": deep_research}}

        events = graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            version="v2",
            config=config
        )

        # 🔥 send checkpoint
        if is_new:
            yield f"data: {{\"type\":\"checkpoint\",\"checkpoint_id\":\"{checkpoint_id}\"}}\n\n"

        async for event in events:

            if event["event"] == "on_chat_model_stream":
                chunk = serialise(event["data"]["chunk"])
                if chunk:  # skip empty chunks (tool-call chunks)
                    safe = chunk.replace("\n", "\\n").replace('"', '\\"')
                    yield f"data: {{\"type\":\"content\",\"content\":\"{safe}\"}}\n\n"

            elif event["event"] == "on_tool_start":
                # 🔥 Tell frontend we are searching
                tool_input = event.get("data", {}).get("input", {})
                query = tool_input.get("query", "") if isinstance(tool_input, dict) else ""
                safe_query = query.replace('"', '\\"')
                yield f"data: {{\"type\":\"search_start\",\"query\":\"{safe_query}\"}}\n\n"

            elif event["event"] == "on_tool_end":
                output = event["data"].get("output", [])

                if isinstance(output, list):
                    results = []
                    for i in output:
                        if isinstance(i, dict):
                            results.append({
                                "title": i.get("title", "No Title"),
                                "url": i.get("url", ""),
                                "snippet": i.get("content", "")[:150]
                            })
                    yield f"data: {{\"type\":\"search_results\",\"results\":{json.dumps(results)}}}\n\n"

    except Exception as e:
        safe_error = str(e).replace("\n", " ").replace('"', '\\"')
        yield f"data: {{\"type\":\"error\",\"message\":\"{safe_error}\"}}\n\n"
    finally:
        yield f"data: {{\"type\":\"end\"}}\n\n"

# ---------------- CHAT API ----------------
@app.get("/chat_stream/{message:path}")
async def chat_stream(message: str, checkpoint_id: Optional[str] = Query(None), deep_research: bool = Query(False)):
    return StreamingResponse(
        generate_chat_responses(message, checkpoint_id, deep_research),
        media_type="text/event-stream"
    )

# ---------------- HISTORY ----------------
@app.get("/get_history/{checkpoint_id}")
async def get_history(checkpoint_id: str):
    config = {"configurable": {"thread_id": checkpoint_id}}
    state = await graph.aget_state(config)

    messages = []

    if state and "messages" in state.values:
        for msg in state.values["messages"]:
            # Skip raw search results and empty tool-call turns
            if isinstance(msg, ToolMessage) or not isinstance(msg.content, str) or not msg.content.strip():
                continue
            role = "user" if isinstance(msg, HumanMessage) else "assistant"

            messages.append({
                "role": role,
                "content": msg.content
            })

    return {"messages": messages}

# ---------------- SIDEBAR ----------------
@app.get("/chats")
async def get_chats():
    return get_chat_store()

@app.delete("/delete_chat/{checkpoint_id}")
async def delete_chat(checkpoint_id: str):
    delete_chat_from_db(checkpoint_id)
    vector_dbs.pop(checkpoint_id, None)
    shutil.rmtree(_chat_dir(checkpoint_id), ignore_errors=True)
    return {"status": "deleted"}

# ---------------- FILE UPLOAD ----------------
@app.post("/upload/{chat_id}")
async def upload_file(chat_id: str, file: UploadFile = File(...)):
    # Give brand-new chats a title, but never overwrite an existing chat's title
    if chat_id not in get_chat_store():
        save_chat_to_db(chat_id, f"📄 {os.path.splitext(file.filename or 'Document')[0][:26]}")

    file_path = f"temp_{uuid4().hex}.pdf"
    with open(file_path, "wb") as f:
        f.write(await file.read())

    try:
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        
        # Chunking to prevent lag and improve retrieval
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_documents(docs)

        if not chunks:
            raise HTTPException(status_code=400, detail="No text found in this PDF (scanned image?)")

        db = FAISS.from_documents(chunks, embeddings)

        doc_id = uuid4().hex[:12]
        db.save_local(os.path.join(_chat_dir(chat_id), doc_id))
        get_chat_docs(chat_id).append({"id": doc_id, "name": file.filename, "db": db, "chunks": chunks})
        _save_chat_meta(chat_id)
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    return {"status": "uploaded", "documents": describe_docs(chat_id)}

@app.get("/documents/{chat_id}")
async def list_documents(chat_id: str):
    return {"documents": describe_docs(chat_id)}

@app.delete("/documents/{chat_id}/{doc_id}")
async def delete_document(chat_id: str, doc_id: str):
    vector_dbs[chat_id] = [d for d in get_chat_docs(chat_id) if d["id"] != doc_id]
    shutil.rmtree(os.path.join(_chat_dir(chat_id), os.path.basename(doc_id)), ignore_errors=True)
    _save_chat_meta(chat_id)
    return {"documents": describe_docs(chat_id)}