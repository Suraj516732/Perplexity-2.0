"use client";

import { useState } from "react";
import { Plus, MessageSquare, Trash2, Globe, Code2, BookOpen, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface ChatItem { title: string; }
interface SidebarProps {
  chats: Record<string, ChatItem>;
  activeId: string | null;
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onCategoryClick: (prompt: string) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export default function Sidebar({ 
  chats, activeId, onChatSelect, onNewChat, onDeleteChat, onCategoryClick,
  isOpen, setIsOpen
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const categories = [
    { name: "News", icon: Globe, prompt: "What are the latest tech news today?" },
    { name: "Coding", icon: Code2, prompt: "Best practices for React development" },
    { name: "Study", icon: BookOpen, prompt: "Explain quantum mechanics simply" },
  ];

  return (
    <motion.div 
      initial={false}
      animate={{ 
        width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? (isCollapsed ? 80 : 280) : 280,
        x: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 0 : (isOpen ? 0 : -320)
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
        onClick={() => { onNewChat(); if (window.innerWidth < 1024) setIsOpen(false); }}
        className="flex items-center gap-3 px-5 h-20 border-b border-white/5 shrink-0 overflow-hidden cursor-pointer hover:bg-white/5 transition-colors group"
      >
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
          <Sparkles className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
        </div>
        {(!isCollapsed || (typeof window !== 'undefined' && window.innerWidth < 1024)) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col whitespace-nowrap">
            <span className="font-semibold text-white/90 text-[15px] tracking-tight text-white">Perplexity 2.0</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold">Pro Edition</span>
          </motion.div>
        )}
      </div>

      {/* New Chat Button */}
      <div className="px-4 pt-6 shrink-0">
        <button
          onClick={() => { onNewChat(); if (window.innerWidth < 1024) setIsOpen(false); }}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white/80 transition-all cursor-pointer border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-[0.98]
            ${isCollapsed ? "px-0" : "px-4"} 
            bg-white/5`}
        >
          <Plus className="w-5 h-5 shrink-0" />
          {(!isCollapsed || (typeof window !== 'undefined' && window.innerWidth < 1024)) && <span>New Chat</span>}
        </button>
      </div>

      {/* Categories */}
      {(!isCollapsed || (typeof window !== 'undefined' && window.innerWidth < 1024)) && (
        <div className="px-4 pt-8 shrink-0">
          <p className="px-2 text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-4">Categories</p>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button 
                key={cat.name}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer text-left group"
                onClick={() => { onCategoryClick(cat.prompt); if (window.innerWidth < 1024) setIsOpen(false); }}
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
        {(!isCollapsed || (typeof window !== 'undefined' && window.innerWidth < 1024)) && Object.keys(chats).length > 0 && (
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
                  onClick={() => { onChatSelect(id); if (window.innerWidth < 1024) setIsOpen(false); }}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 text-[13px]
                    ${isActive
                      ? "bg-white/5 text-white border border-white/10"
                      : "text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent"
                    }`}
                >
                  <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "opacity-30"}`} />
                  
                  {(!isCollapsed || (typeof window !== 'undefined' && window.innerWidth < 1024)) && (
                    <>
                      <span className="truncate flex-1 font-medium">{chat.title || "Untitled"}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${chat.title || "Untitled"}"?`)) {
                            onDeleteChat(id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
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