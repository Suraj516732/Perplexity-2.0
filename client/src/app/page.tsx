"use client";

import { useState, useEffect, useCallback } from "react";
import InputBar from "@/components/InputBar";
import MessageArea from "@/components/MessageArea";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import API from "@/lib/api";

interface SearchInfo { stages: string[]; query: string; urls: string[]; }
interface Message { id: number; content: string; isUser: boolean; type: string; isLoading?: boolean; searchInfo?: SearchInfo; }
interface ChatItem { title: string; }
type Tab = "home" | "chat" | "explore";

// ── LocalStorage helpers ──
const loadLocalChats = (): Record<string, ChatItem> => {
  try { return JSON.parse(localStorage.getItem("chats_list") || "{}"); }
  catch { return {}; }
};
const saveLocalChat = (id: string, title: string) => {
  const existing = loadLocalChats();
  existing[id] = { title };
  localStorage.setItem("chats_list", JSON.stringify(existing));
};
const saveLocalMessages = (id: string, messages: Message[]) => {
  // Only save user + ai text (not loading state)
  const clean = messages.filter(m => !m.isLoading && m.content);
  localStorage.setItem(`messages_${id}`, JSON.stringify(clean));
};
const loadLocalMessages = (id: string): Message[] => {
  try { return JSON.parse(localStorage.getItem(`messages_${id}`) || "[]"); }
  catch { return []; }
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [chats, setChats] = useState<Record<string, ChatItem>>(() => loadLocalChats());
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Load active checkpoint on mount ──
  useEffect(() => {
    const saved = localStorage.getItem("checkpoint_id");
    if (saved) switchToChat(saved);
  }, []);

  // ── Refresh sidebar from backend (merge with localStorage) ──
  const refreshChats = useCallback(() => {
    fetch(`${API}/chats`)
      .then(r => r.json())
      .then((serverChats: Record<string, ChatItem>) => {
        const merged = { ...loadLocalChats(), ...serverChats };
        setChats(merged);
        localStorage.setItem("chats_list", JSON.stringify(merged));
      })
      .catch(() => setChats(loadLocalChats()));
  }, []);

  useEffect(() => { refreshChats(); }, []);

  // ── Switch to a chat: load from localStorage instantly, then try backend ──
  const switchToChat = (id: string) => {
    localStorage.setItem("checkpoint_id", id);
    setCheckpointId(id);

    // 1. Show localStorage messages immediately (no flicker)
    const local = loadLocalMessages(id);
    if (local.length > 0) setMessages(local);
    else setLoadingHistory(true);

    // 2. Try to fetch fresh history from backend
    fetch(`${API}/get_history/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.messages && d.messages.length > 0) {
          const formatted: Message[] = d.messages
            .filter((m: any) => typeof m.content === "string" && m.content.trim())
            .map((m: any, i: number) => ({
              id: i + 1,
              content: m.content,
              isUser: m.role === "user",
              type: "message",
            }));
          setMessages(formatted);
          saveLocalMessages(id, formatted);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  };

  // ── Delete chat ──
  const handleDeleteChat = (id: string) => {
    // Remove from localStorage
    const updated = loadLocalChats();
    delete updated[id];
    localStorage.setItem("chats_list", JSON.stringify(updated));
    localStorage.removeItem(`messages_${id}`);
    setChats(updated);

    // If deleting active chat → go to new chat
    if (id === checkpointId) handleNewChat();
  };

  // ── New chat ──
  const handleNewChat = () => {
    localStorage.removeItem("checkpoint_id");
    setCheckpointId(null);
    setMessages([]);
    setActiveTab("chat");
  };

  // ── Tab change ──
  const handleTabChange = (tab: Tab) => {
    if (tab === "home") handleNewChat();
    else setActiveTab(tab);
  };

  // ── Send message ──
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const nextId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1;
    const userMsg: Message = { id: nextId, content: currentMessage, isUser: true, type: "message" };

    setMessages(p => {
      const updated = [...p, userMsg];
      if (checkpointId) saveLocalMessages(checkpointId, updated);
      return updated;
    });

    const input = currentMessage;
    setCurrentMessage("");

    const aiId = nextId + 1;
    setMessages(p => [...p, { id: aiId, content: "", isUser: false, type: "message", isLoading: true, searchInfo: { stages: [], query: "", urls: [] } }]);

    let url = `${API}/chat_stream/${encodeURIComponent(input)}`;
    if (checkpointId) url += `?checkpoint_id=${checkpointId}`;

    const es = new EventSource(url);
    let streamed = "";
    let search: SearchInfo | null = null;
    let activeId = checkpointId;

    es.onmessage = ev => {
      const d = JSON.parse(ev.data);

      if (d.type === "checkpoint") {
        activeId = d.checkpoint_id;
        setCheckpointId(d.checkpoint_id);
        localStorage.setItem("checkpoint_id", d.checkpoint_id);
        saveLocalChat(d.checkpoint_id, input.slice(0, 40));
        refreshChats();
      }
      else if (d.type === "content") {
        streamed += d.content;
        setMessages(p => {
          const updated = p.map(m => m.id === aiId ? { ...m, content: streamed, isLoading: false } : m);
          if (activeId) saveLocalMessages(activeId, updated.filter(m => !m.isLoading && m.content));
          return updated;
        });
      }
      else if (d.type === "search_start") {
        search = { stages: ["searching"], query: d.query, urls: [] };
        setMessages(p => p.map(m => m.id === aiId ? { ...m, searchInfo: search! } : m));
      }
      else if (d.type === "search_results") {
        const urls = typeof d.urls === "string" ? JSON.parse(d.urls) : d.urls;
        search = { stages: [...(search?.stages || []), "reading"], query: search?.query || "", urls };
        setMessages(p => p.map(m => m.id === aiId ? { ...m, searchInfo: search! } : m));
      }
      else if (d.type === "end") es.close();
    };
    es.onerror = () => es.close();
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      <Sidebar
        chats={chats}
        activeId={checkpointId}
        onChatSelect={switchToChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col bg-white border-l border-gray-100 overflow-hidden">
          <Header activeTab={activeTab} onTabChange={handleTabChange} />

          {activeTab === "explore" ? (
            <div className="flex-1 flex flex-col items-center justify-center px-8 bg-[#FAFAF8]">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Explore Topics</h2>
              <p className="text-gray-400 text-sm mb-8 text-center">Pick a topic to start exploring with AI.</p>
              <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                {["🌍 World News", "💻 Technology", "🔬 Science", "📈 Finance", "🎨 Art & Design", "🧬 Health"].map(topic => (
                  <button key={topic}
                    onClick={() => { handleNewChat(); setCurrentMessage(topic.slice(3)); setActiveTab("chat"); }}
                    className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all text-left font-medium">
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          ) : loadingHistory ? (
            <div className="flex-1 flex items-center justify-center bg-[#FAFAF8]">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm">Loading chat history…</span>
              </div>
            </div>
          ) : (
            <>
              <MessageArea messages={messages} />
              <InputBar
                currentMessage={currentMessage}
                setCurrentMessage={setCurrentMessage}
                onSubmit={handleSubmit}
                checkpointId={checkpointId}
                hasMessages={messages.length > 0}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
