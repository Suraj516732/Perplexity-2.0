# Perplexity 2.0 Clone

A modern, AI-powered search and chat application inspired by Perplexity. It features a Next.js 15 frontend and a Python FastAPI backend powered by LangGraph and LangChain.

## Features
- **AI Search**: Integration with Tavily Search and OpenAI models for real-time, cited answers.
- **RAG & Document Upload**: Upload PDF documents to your chats. Uses FAISS for local vector storage and retrieval.
- **Conversational Memory**: Maintains chat history per thread using LangGraph checkpointing.
- **Streaming Responses**: Real-time server-sent events (SSE) for smooth, token-by-token generation.
- **Modern UI**: Next.js React frontend.

## Tech Stack
**Frontend:**
- [Next.js](https://nextjs.org/) (React Framework)
- Tailwind CSS (Styling)

**Backend:**
- [FastAPI](https://fastapi.tiangolo.com/) (Web Framework)
- [LangChain](https://python.langchain.com/) / [LangGraph](https://python.langchain.com/docs/langgraph) (Agent Orchestration)
- [Tavily API](https://tavily.com/) (Web Search)
- OpenAI GPT-4o (LLM and Embeddings)
- FAISS (Vector Database)

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- [OpenAI API Key](https://platform.openai.com/)
- [Tavily API Key](https://tavily.com/)

### Backend Setup
1. Navigate to the `server` directory:
   ```bash
   cd server
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `server` directory and add your API keys:
   ```env
   OPENAI_API_KEY="your-openai-api-key"
   TAVILY_API_KEY="your-tavily-api-key"
   ```
5. Run the FastAPI server:
   ```bash
   uvicorn app:app --reload --port 8000
   ```

### Frontend Setup
1. Navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the `client` directory and set your API base URL if needed:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
5. Open your browser and go to `http://localhost:3000`.

## Architecture
- `server/app.py`: Contains the core LangGraph state machine, tool definitions, and FastAPI routes (`/chat_stream`, `/upload`, etc.).
- `client/src/`: Contains Next.js app router pages, React components (`Sidebar`, `MessageArea`), and API utility functions.

## License
MIT License
