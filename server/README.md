# 🚀 Perplexity 2.0

A modern, full-stack AI-powered search assistant that combines conversational intelligence with real-time web search and document understanding.

Unlike traditional chatbots, **Perplexity 2.0 doesn’t just answer — it thinks, searches, and reasons.**

---

## ✨ Key Features

* ⚡ **Real-time Streaming Responses**
  AI responses are streamed live using Server-Sent Events (SSE)

* 🌐 **Integrated Web Search**
  Fetches real-time data using Tavily API for up-to-date answers

* 🧠 **Multi-step Reasoning (LangGraph)**
  Intelligent agent workflow with tool-calling capability

* 📄 **PDF Intelligence (RAG)**
  Upload documents and ask contextual questions

* 💬 **Conversation Memory**
  Persistent chat sessions with PostgreSQL / SQLite fallback

* 🔍 **Search Transparency**
  Visual indicators: *Thinking → Searching → Responding*

* 📱 **Responsive UI**
  Clean, modern interface inspired by Perplexity AI

---

## 🏗️ Architecture

### 🖥️ Client (Next.js + React)

* Modern React app with Next.js
* Real-time streaming via SSE
* Dynamic UI for chat, search states, and responses

### ⚙️ Server (FastAPI + LangGraph)

* FastAPI backend for high-performance APIs
* LangGraph-powered AI agent system
* Tool integration (Web Search + RAG)
* Streaming responses via SSE

### 🧠 AI Stack

* LLM: GPT-4o
* Search: Tavily API
* Vector DB: FAISS
* Memory: PostgreSQL (with SQLite fallback)

---

## 🔄 How It Works

1. User sends a query
2. AI analyzes intent (search vs direct answer)
3. If needed:

   * Performs real-time web search
   * Retrieves relevant context
4. Applies multi-step reasoning
5. Streams response back in real-time
6. Displays sources and reasoning stages

---

## 🚀 Getting Started

### 📌 Prerequisites

* Node.js 18+
* Python 3.10+
* OpenAI API Key
* Tavily API Key

---

### ⚙️ Installation

```bash
git clone https://github.com/harishneel1/perplexity_2.0.git
cd perplexity_2.0
```

### 🔧 Backend Setup

```bash
cd server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` file:

```
OPENAI_API_KEY=your_key
TAVILY_API_KEY=your_key
DATABASE_URL=your_postgres_url (optional)
```

---

### 💻 Frontend Setup

```bash
cd ../client
npm install
```

---

### ▶️ Run the App

```bash
# Start backend
cd server
uvicorn app:app --reload

# Start frontend
cd client
npm run dev
```

👉 Open: http://localhost:3000

---

## 📸 Demo

*Add screenshots or demo video here*

---

## 🧠 What I Learned

* Building real-world AI agents using LangGraph
* Implementing streaming architectures (SSE)
* Designing RAG pipelines for document understanding
* Managing state and memory in AI systems
* Combining search + reasoning for better AI responses

---

## 🤝 Contributing

Contributions are welcome! Feel free to fork and improve.

---

## 📝 License

MIT License

---

## 🙌 Acknowledgements

Inspired by Perplexity AI
Built using modern AI + web technologies
