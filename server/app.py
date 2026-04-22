from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage
from langchain_core.runnables import RunnableConfig
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from fastapi import FastAPI, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langgraph.checkpoint.memory import MemorySaver
import json
from uuid import uuid4
import os

load_dotenv()

# ---------------- MEMORY ----------------
memory = MemorySaver()

class State(TypedDict):
    messages: Annotated[list, add_messages]

# ---------------- GLOBAL STORES ----------------
chat_store = {}        # sidebar chats
vector_dbs = {}        # per chat RAG

# ---------------- TOOLS ----------------
search_tool = TavilySearchResults(max_results=4)
tools = [search_tool]

# ---------------- LLM ----------------
llm = ChatOpenAI(model="gpt-4o")
llm_with_tools = llm.bind_tools(tools=tools)

# ---------------- MODEL ----------------
async def model(state: State, config: RunnableConfig):
    messages = state["messages"]

    # ✅ FIXED: get thread_id from RunnableConfig (correct LangGraph way)
    thread_id = config.get("configurable", {}).get("thread_id")

    # 🔥 RAG per chat
    if thread_id and thread_id in vector_dbs:
        query = messages[-1].content

        all_docs = []
        for db in vector_dbs[thread_id]:
            docs = db.similarity_search(query, k=2)
            all_docs.extend(docs)

        context = "\n\n".join([doc.page_content for doc in all_docs])

        messages = list(messages) + [
            HumanMessage(content=f"Context:\n{context}\n\nQuestion:\n{query}")
        ]

    result = await llm_with_tools.ainvoke(messages)
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
async def generate_chat_responses(message: str, checkpoint_id: Optional[str] = None):

    is_new = checkpoint_id is None

    if is_new:
        checkpoint_id = str(uuid4())

        # 🔥 FIX: avoid overwrite
        if checkpoint_id not in chat_store:
            chat_store[checkpoint_id] = {
                "title": message[:30]
            }

    config = {"configurable": {"thread_id": checkpoint_id}}

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
                urls = [i.get("url") for i in output if isinstance(i, dict)]
                yield f"data: {{\"type\":\"search_results\",\"urls\":{json.dumps(urls)}}}\n\n"

    yield f"data: {{\"type\":\"end\"}}\n\n"

# ---------------- CHAT API ----------------
@app.get("/chat_stream/{message}")
async def chat_stream(message: str, checkpoint_id: Optional[str] = Query(None)):
    return StreamingResponse(
        generate_chat_responses(message, checkpoint_id),
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
    return chat_store

# ---------------- FILE UPLOAD ----------------
@app.post("/upload/{chat_id}")
async def upload_file(chat_id: str, file: UploadFile = File(...)):

    file_path = f"temp_{file.filename}"

    with open(file_path, "wb") as f:
        f.write(await file.read())

    loader = PyPDFLoader(file_path)
    docs = loader.load()

    db = FAISS.from_documents(docs, OpenAIEmbeddings())

    if chat_id not in vector_dbs:
        vector_dbs[chat_id] = []

    vector_dbs[chat_id].append(db)

    os.remove(file_path)

    return {"status": "uploaded"}