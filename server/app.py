from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage
from langchain_core.runnables import RunnableConfig
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastapi import FastAPI, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
import sqlite3
import json
from uuid import uuid4
import os

load_dotenv()

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

# chat_store = get_chat_store() # Removed in favor of direct DB access
vector_dbs = {}

# ---------------- TOOLS ----------------
search_tool = TavilySearchResults(max_results=4)
tools = [search_tool]

# ---------------- LLM ----------------
llm = ChatOpenAI(model="gpt-4o")
llm_with_tools = llm.bind_tools(tools=tools)

SYSTEM_PROMPT = """You are Perplexity 2.0, a highly intelligent and professional AI search assistant.
You have access to conversation history and real-time search tools.
Always refer to the conversation history when the user asks follow-up questions.
Be concise, accurate, and use a premium professional tone.
"""

# ---------------- MODEL ----------------
async def model(state: State, config: RunnableConfig):
    messages = state["messages"]

    # ✅ FIXED: get thread_id and deep_research flag from RunnableConfig
    thread_id = config.get("configurable", {}).get("thread_id")
    deep_research = config.get("configurable", {}).get("deep_research", False)

    # 🔥 RAG per chat
    if thread_id and thread_id in vector_dbs:
        query = messages[-1].content

        all_docs = []
        for db in vector_dbs[thread_id]:
            # Retrieve top 4 results with scores
            docs_with_scores = db.similarity_search_with_score(query, k=4)
            # Filter results by score threshold (< 0.8)
            filtered_docs = [doc for doc, score in docs_with_scores if score < 0.8]
            all_docs.extend(filtered_docs)

        context = "\n\n".join([doc.page_content for doc in all_docs])

        messages = list(messages) + [
            HumanMessage(content=f"Context:\n{context}\n\nQuestion:\n{query}")
        ]

    # Prepare messages with system prompt
    final_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    if deep_research:
        result = await llm_with_tools.ainvoke(final_messages)
    else:
        result = await llm.ainvoke(final_messages)
    
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

# Checkpointer initialization
if DB_TYPE == "postgres" and pg_pool:
    # 🔥 Schema setup requires a connection NOT in a transaction block
    import psycopg
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        temp_saver = PostgresSaver(conn)
        temp_saver.setup()
    
    # Now use the global pool for the actual saver
    memory = PostgresSaver(pg_pool)
else:
    memory = SqliteSaver.from_conn_string("checkpoints.db")

graph = graph_builder.compile(checkpointer=memory)


# ---------------- FASTAPI ----------------
app = FastAPI(redirect_slashes=False)

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
@app.get("/chat_stream/{message}")
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
            role = "assistant"
            if msg.__class__.__name__ == "HumanMessage":
                role = "user"

            messages.append({
                "role": role,
                "content": msg.content
            })

    return {"messages": messages}

# ---------------- SIDEBAR ----------------
@app.get("/chats")
async def get_chats():
    return get_chat_store()

# ---------------- FILE UPLOAD ----------------
@app.post("/upload/{chat_id}")
async def upload_file(chat_id: str, file: UploadFile = File(...)):
    # If chat doesn't exist, we can still upload, but usually we should have a chat.
    # For now, we'll just ensure it has a title in the DB if it's new to this endpoint.
    save_chat_to_db(chat_id, "Document Chat")

    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())

    try:
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        
        # Chunking to prevent lag and improve retrieval
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_documents(docs)

        db = FAISS.from_documents(chunks, OpenAIEmbeddings())

        if chat_id not in vector_dbs:
            vector_dbs[chat_id] = []
        vector_dbs[chat_id].append(db)
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    return {"status": "uploaded"}