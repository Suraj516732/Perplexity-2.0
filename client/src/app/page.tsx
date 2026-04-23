"use client";

import { useState, useEffect, useCallback } from "react";
import InputBar from "@/components/InputBar";
import MessageArea from "@/components/MessageArea";
import Sidebar from "@/components/Sidebar";
import API from "@/lib/api";
import { Loader2, Globe, Link as LinkIcon, Menu, X, Plus, Sparkles, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchResult { title: string; url: string; snippet: string; }
interface SearchInfo { stages: string[]; query: string; urls: string[]; results?: SearchResult[]; }
interface Message { id: number; content: string; isUser: boolean; type: string; isLoading?: boolean; searchInfo?: SearchInfo; }
interface ChatItem { title: string; }

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
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Shared states for InputBar
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isHomeView = !checkpointId && messages.length === 0;

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
    setUploadedFiles([]);

    const local = loadLocalMessages(id);
    if (local.length > 0) setMessages(local);
    else setLoadingHistory(true);

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
  const handleDeleteChat = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/delete_chat/${id}`, { method: "DELETE" });
      const updated = loadLocalChats();
      delete updated[id];
      localStorage.setItem("chats_list", JSON.stringify(updated));
      localStorage.removeItem(`messages_${id}`);
      setChats(updated);
      if (id === checkpointId) handleNewChat();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // ── New chat ──
  const handleNewChat = () => {
    localStorage.removeItem("checkpoint_id");
    setCheckpointId(null);
    setMessages([]);
    setUploadedFiles([]);
  };

  const getOrCreateCheckpoint = () => {
    if (checkpointId) return checkpointId;
    const newId = crypto.randomUUID();
    setCheckpointId(newId);
    localStorage.setItem("checkpoint_id", newId);
    return newId;
  };

  // ── Send message (can be triggered by form or manually) ──
  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLInputElement>, manualMessage?: string) => {
    if (e) e.preventDefault();
    const messageToSubmit = manualMessage || currentMessage;
    if (!messageToSubmit.trim()) return;

    const nextId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1;
    const userMsg: Message = { 
      id: nextId, 
      content: messageToSubmit, 
      isUser: true, 
      type: "message",
      files: [...uploadedFiles] // Attach files to the message
    };

    setMessages(p => {
      const updated = [...p, userMsg];
      if (checkpointId) saveLocalMessages(checkpointId, updated);
      return updated;
    });

    const input = messageToSubmit;
    if (!manualMessage) setCurrentMessage("");
    setUploadedFiles([]); // Clear files after sending

    const aiId = nextId + 1;
    setMessages(p => [...p, { id: aiId, content: "", isUser: false, type: "message", isLoading: true, searchInfo: { stages: [], query: "", urls: [] } }]);

    let url = `${API}/chat_stream/${encodeURIComponent(input)}?deep_research=${isDeepResearch}`;
    if (checkpointId) url += `&checkpoint_id=${checkpointId}`;

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

  const handleCategoryClick = (prompt: string) => {
    handleNewChat();
    handleSubmit(undefined, prompt);
  };

  const allSources = messages.flatMap(m => m.searchInfo?.urls || []).filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="flex h-screen bg-black overflow-hidden selection:bg-[#D4C491]/30 selection:text-white">
      
      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <Sidebar
        chats={chats}
        activeId={checkpointId}
        onChatSelect={switchToChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onCategoryClick={handleCategoryClick}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-700`}>
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-5 py-4 bg-black/95 backdrop-blur-xl sticky top-0 z-40 border-b border-white/[0.03]">
          {/* Menu Toggle */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-start text-gray-500 active:text-white transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          {/* Centered Logo */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 group cursor-pointer" onClick={handleNewChat}>
             <Sparkles className="w-4 h-4 text-[#D4C491] drop-shadow-[0_0_10px_rgba(212,196,145,0.4)]" />
             <span className="font-bold text-[15px] text-white tracking-[0.15em] uppercase">Perplexity <span className="text-[#D4C491]">2.0</span></span>
          </div>

          {/* Right Spacer for centering */}
          <div className="w-10" />
        </div>
        {loadingHistory ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-white/50">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs font-bold tracking-[0.3em] uppercase">Loading</span>
            </div>
          </div>
        ) : (
          <div className={`w-full h-full flex flex-col transition-all duration-700 ${isHomeView ? "items-center justify-center max-w-4xl mx-auto px-6" : ""}`}>
            <div className={`flex-1 overflow-hidden flex flex-col w-full ${isHomeView ? "justify-center" : "relative"}`}>
              
              {/* Desktop Back Button */}
              {!isHomeView && (
                <div className="hidden lg:flex absolute top-6 left-8 z-30">
                  <button 
                    onClick={handleNewChat}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 group"
                  >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="text-sm font-medium">Home</span>
                  </button>
                </div>
              )}

              <MessageArea messages={messages} />
            </div>
            
            <div className={`${isHomeView ? "mb-12" : "mt-auto"}`}>
              <InputBar
                currentMessage={currentMessage}
                setCurrentMessage={setCurrentMessage}
                onSubmit={handleSubmit}
                checkpointId={checkpointId}
                hasMessages={messages.length > 0}
                isDeepResearch={isDeepResearch}
                setIsDeepResearch={setIsDeepResearch}
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                getOrCreateCheckpoint={getOrCreateCheckpoint}
                refreshChats={refreshChats}
              />
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANE: Sources Panel (Desktop Only) */}
      <AnimatePresence>
        {messages.length > 0 && allSources.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="hidden lg:flex w-80 border-l border-white/5 bg-black/20 flex-col z-20"
          >
            <div className="p-5 border-b border-white/5 flex items-center gap-2 text-white/70">
              <Globe className="w-4 h-4" />
              <h3 className="font-semibold text-sm">Sources</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {allSources.map((url, i) => {
                let domain = url;
                try { domain = new URL(url).hostname.replace('www.', ''); } catch(e){}
                return (
                  <a 
                    key={i} 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl glass-card hover:bg-white/5 transition-all border border-white/5 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                        <LinkIcon className="w-4 h-4 text-gray-500 group-hover:text-white" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-gray-300 truncate">{domain}</p>
                        <p className="text-[10px] text-gray-600 truncate mt-0.5 uppercase tracking-tighter">{url}</p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
