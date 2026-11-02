"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, MessageSquare, Trash2, Globe, Code2, BookOpen, ChevronLeft, ChevronRight, Sparkles, FileText, Upload, Loader2, X, Database } from "lucide-react";
import { motion } from "framer-motion";

interface ChatItem { title: string; }
export interface KbDocument { id: string; name: string; chunks: number; }
interface SidebarProps {
  chats: Record<string, ChatItem>;
  activeId: string | null;
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onCategoryClick: (prompt: string) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  documents: KbDocument[];
  onUploadPdf: (file: File) => Promise<void>;
  onRemoveDocument: (docId: string) => void;
}

export default function Sidebar({ 
  chats, activeId, onChatSelect, onNewChat, onDeleteChat, onCategoryClick,
  isOpen, setIsOpen, documents, onUploadPdf, onRemoveDocument
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [kbUploading, setKbUploading] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);
  const kbFileRef = useRef<HTMLInputElement>(null);

  const handleKbFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKbError(null);
    setKbUploading(true);
    try {
      await onUploadPdf(file);
    } catch (err: any) {
      setKbError(err.message || "Upload failed");
    } finally {
      setKbUploading(false);
      if (kbFileRef.current) kbFileRef.current.value = "";
    }
  };

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const showLabels = !isCollapsed || !isDesktop;

  const categories = [
    { name: "News", icon: Globe, prompt: "What are the latest tech news today?" },
    { name: "Coding", icon: Code2, prompt: "Best practices for React development" },
    { name: "Study", icon: BookOpen, prompt: "Explain quantum mechanics simply" },
  ];

  return (
    <motion.div 
      initial={false}
      animate={{ 
        width: isDesktop ? (isCollapsed ? 80 : 280) : 280,
        x: isDesktop ? 0 : (isOpen ? 0 : -320)
      }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`fixed lg:relative h-screen flex flex-col bg-black border-r border-white/5 flex-shrink-0 z-50 lg:translate-x-0 shadow-2xl shadow-black`}
    >
      {/* Collapse Toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-slate-800 border border-white/10 hidden lg:flex items-center justify-center hover:bg-slate-700 transition-colors z-30 cursor-pointer"
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronLeft className="w-3 h-3 text-gray-400" />}
      </button>

      {/* Brand / Home Button */}
      <div 
        onClick={() => { onNewChat(); if (!isDesktop) setIsOpen(false); }}
        className="flex items-center gap-3 px-5 h-20 border-b border-white/5 shrink-0 overflow-hidden cursor-pointer hover:bg-white/5 transition-colors group"
      >
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
          <Sparkles className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
        </div>
        {showLabels && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col whitespace-nowrap">
            <span className="font-semibold text-white/90 text-[15px] tracking-tight text-white">Perplexity 2.0</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold">Pro Edition</span>
          </motion.div>
        )}
      </div>

      {/* New Chat Button */}
      <div className="px-4 pt-6 shrink-0">
        <button
          onClick={() => { onNewChat(); if (!isDesktop) setIsOpen(false); }}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white/80 transition-all cursor-pointer border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-[0.98]
            ${isCollapsed ? "px-0" : "px-4"} 
            bg-white/5`}
        >
          <Plus className="w-5 h-5 shrink-0" />
          {showLabels && <span>New Chat</span>}
        </button>
      </div>

      {/* Knowledge Base (PDFs for the active chat) */}
      <div className="px-4 pt-6 shrink-0">
        <input type="file" ref={kbFileRef} onChange={handleKbFile} className="hidden" accept=".pdf" />
        {showLabels ? (
          <div className="rounded-xl border border-[#D4C491]/15 bg-[#D4C491]/[0.03] p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#D4C491]/80 uppercase tracking-[0.2em]">
                <Database className="w-3 h-3" /> Knowledge Base
              </p>
              {documents.length > 0 && <span className="text-[10px] text-gray-500">{documents.length} PDF</span>}
            </div>

            {documents.length > 0 ? (
              <div className="space-y-1 mb-2 max-h-36 overflow-y-auto">
                {documents.map(doc => (
                  <div key={doc.id} className="group/doc flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] text-[12px] text-gray-300">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-[#D4C491]/70" />
                    <span className="truncate flex-1" title={doc.name}>{doc.name}</span>
                    <button
                      onClick={() => onRemoveDocument(doc.id)}
                      className="opacity-60 lg:opacity-0 lg:group-hover/doc:opacity-100 text-gray-500 hover:text-red-400 transition-all cursor-pointer"
                      title="Remove from knowledge base"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-1 mb-2 text-[11px] leading-relaxed text-gray-500">
                {activeId ? "Add PDFs to answer questions in this chat from your documents." : "Upload a PDF to start a document chat."}
              </p>
            )}

            <button
              onClick={() => kbFileRef.current?.click()}
              disabled={kbUploading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-[#D4C491]/30 text-[12px] font-medium text-[#D4C491]/90 hover:bg-[#D4C491]/10 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {kbUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {kbUploading ? "Reading PDF..." : "Upload PDF"}
            </button>
            {kbError && <p className="mt-2 px-1 text-[11px] text-red-400">{kbError}</p>}
          </div>
        ) : (
          <button
            onClick={() => kbFileRef.current?.click()}
            title="Upload PDF to knowledge base"
            className="w-full flex items-center justify-center py-3 rounded-xl border border-[#D4C491]/20 text-[#D4C491]/80 hover:bg-[#D4C491]/10 transition-all cursor-pointer relative"
          >
            {kbUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
            {documents.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D4C491] text-black text-[9px] font-bold flex items-center justify-center">{documents.length}</span>
            )}
          </button>
        )}
      </div>

      {/* Categories */}
      {showLabels && (
        <div className="px-4 pt-8 shrink-0">
          <p className="px-2 text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-4">Categories</p>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button 
                key={cat.name}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer text-left group"
                onClick={() => { onCategoryClick(cat.prompt); if (!isDesktop) setIsOpen(false); }}
              >
                <cat.icon className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recents */}
      <div className="flex-1 overflow-y-auto px-4 mt-10 pb-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
        {showLabels && Object.keys(chats).length > 0 && (
          <p className="px-2 text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-4">Recent</p>
        )}
        
        <div className="space-y-1">
          {Object.entries(chats)
            .reverse()
            .map(([id, chat]) => {
              const isActive = activeId === id;
              return (
                <div
                  key={id}
                  onClick={() => { onChatSelect(id); if (!isDesktop) setIsOpen(false); }}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 text-[13px]
                    ${isActive
                      ? "bg-white/5 text-white border border-white/10"
                      : "text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent"
                    }`}
                >
                  <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "opacity-30"}`} />
                  
                  {showLabels && (
                    <>
                      <span className="truncate flex-1 font-medium">{chat.title || "Untitled"}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${chat.title || "Untitled"}"?`)) {
                            onDeleteChat(id);
                          }
                        }}
                        className={`p-1.5 rounded-lg transition-all
                          ${isActive 
                            ? "opacity-100 text-red-400 bg-red-400/10" 
                            : "opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 hover:bg-red-500/20"
                          }
                          lg:opacity-0 lg:group-hover:opacity-100`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </motion.div>
  );
}