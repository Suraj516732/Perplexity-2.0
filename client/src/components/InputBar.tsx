"use client";
import { useRef, useState } from "react";
import API from "@/lib/api";
import { Search, Paperclip, Zap, ArrowUp, Loader2, Globe, FileText, Lightbulb, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InputBarProps {
  currentMessage: string;
  setCurrentMessage: (v: string | ((p: string) => string)) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLInputElement>) => void;
  checkpointId: string | null;
  hasMessages: boolean;
  isDeepResearch: boolean;
  setIsDeepResearch: (v: boolean) => void;
  uploadedFiles: string[];
  setUploadedFiles: (v: string[] | ((p: string[]) => string[])) => void;
  getOrCreateCheckpoint: () => string;
  refreshChats: () => void;
}

export default function InputBar({ 
  currentMessage, setCurrentMessage, onSubmit, checkpointId, hasMessages,
  isDeepResearch, setIsDeepResearch, uploadedFiles, setUploadedFiles,
  getOrCreateCheckpoint, refreshChats
}: InputBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { 
      e.preventDefault(); 
      if (currentMessage.trim()) onSubmit(e); 
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const activeId = getOrCreateCheckpoint();

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      
      const res = await fetch(`${API}/upload/${activeId}`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      setUploadedFiles(prev => [...prev, file.name]);
      showToast("✅ PDF uploaded successfully!");
      refreshChats();
    } catch (err: any) {
      showToast(`Upload failed — ${err.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const chips = [
    { label: "Search Web", icon: Globe, color: "text-gray-400", bg: "bg-white/5" },
    { label: "Summarize PDF", icon: FileText, color: "text-gray-400", bg: "bg-white/5" },
    { label: "Explain Topic", icon: Lightbulb, color: "text-gray-400", bg: "bg-white/5" }
  ];

  return (
    <div className="w-full flex justify-center pb-6 pt-2 px-4 relative z-10">
      <div className="w-full max-w-3xl relative">
        
        {/* Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900/90 border border-white/10 text-white px-5 py-2.5 rounded-full text-sm font-medium backdrop-blur-md whitespace-nowrap shadow-xl z-50 flex items-center gap-2"
            >
              {!toastMessage.includes("✅") && <span className="text-red-400 text-lg leading-none mb-0.5">⚠️</span>}
              {toastMessage.replace("✅ ", "")}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Uploaded Files Chips */}
        <AnimatePresence>
          {uploadedFiles.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex gap-2 mb-3 px-2 overflow-x-auto no-scrollbar"
            >
              {uploadedFiles.map((name, i) => (
                <motion.div 
                  key={i} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[12px] text-gray-300 whitespace-nowrap shadow-sm backdrop-blur-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="max-w-[150px] truncate">{name}</span>
                  <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-white transition-colors cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Chips (Above Input) */}
        <AnimatePresence>
          {!hasMessages && uploadedFiles.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex gap-4 mb-5 flex-wrap justify-center"
            >
              {chips.map(chip => (
                <motion.button 
                  key={chip.label} 
                  whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.08)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCurrentMessage(chip.label)}
                  className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border border-white/5 ${chip.bg} transition-all cursor-pointer`}
                >
                  <chip.icon className={`w-4 h-4 ${chip.color}`} />
                  <span className="text-[13px] font-medium text-gray-400 group-hover:text-gray-200 transition-colors">{chip.label}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Bar */}
        <motion.form 
          onSubmit={onSubmit}
          animate={{ 
            boxShadow: isFocused 
              ? "0 0 30px rgba(168, 85, 247, 0.2), 0 0 0 1px rgba(168, 85, 247, 0.5)" 
              : "0 8px 32px 0 rgba(0,0,0,0.37), 0 0 0 1px rgba(255,255,255,0.1)"
          }}
          transition={{ duration: 0.2 }}
          className="glass-card rounded-2xl p-2 flex flex-col gap-2 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 opacity-50 pointer-events-none" />

          {/* Top row: Input */}
          <div className="flex items-center px-2">
            <Search className="w-5 h-5 text-gray-400 shrink-0 mr-3" />
            <input 
              type="text" 
              placeholder="Ask anything or paste a link..."
              value={currentMessage} 
              onChange={e => setCurrentMessage(e.target.value)} 
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="flex-grow bg-transparent outline-none text-base text-gray-100 placeholder-gray-500 py-3 relative z-10" 
            />
          </div>

          {/* Bottom row: Actions & Send */}
          <div className="flex items-center justify-between px-2 pb-1 relative z-10">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => fileRef.current?.click()} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> : <Paperclip className="w-4 h-4" />}
              </button>
              <input type="file" ref={fileRef} onChange={handleFile} className="hidden" accept=".pdf" />

              {/* Mode Toggle */}
              <button 
                type="button" 
                onClick={() => setIsDeepResearch(!isDeepResearch)}
                className={`ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer border
                  ${isDeepResearch ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-white/5 text-gray-400 border-transparent hover:bg-white/10"}`}
              >
                <Zap className={`w-3.5 h-3.5 ${isDeepResearch ? "fill-purple-400 text-purple-400" : ""}`} />
                {isDeepResearch ? "Deep Research" : "Fast Search"}
              </button>
            </div>

            <motion.button 
              type="submit" 
              disabled={!currentMessage.trim()}
              whileHover={currentMessage.trim() ? { scale: 1.05 } : {}}
              whileTap={currentMessage.trim() ? { scale: 0.95 } : {}}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer
                ${currentMessage.trim() 
                  ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_20px_rgba(255,255,255,0.5)]" 
                  : "bg-white/10 text-gray-500 cursor-not-allowed"}`}
            >
              <ArrowUp className="w-5 h-5" strokeWidth={3} />
            </motion.button>
          </div>
        </motion.form>

        <div className="text-center mt-3">
          <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1">
            Powered by Multi-step AI Reasoning <Sparkles className="w-3 h-3 text-purple-400" />
          </p>
        </div>

      </div>
    </div>
  );
}