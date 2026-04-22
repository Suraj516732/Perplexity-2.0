"use client";
import { useRef, useState } from "react";
import API from "@/lib/api";

interface InputBarProps {
  currentMessage: string;
  setCurrentMessage: (v: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLInputElement>) => void;
  checkpointId: string | null;
  hasMessages: boolean;
}

export default function InputBar({ currentMessage, setCurrentMessage, onSubmit, checkpointId, hasMessages }: InputBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (currentMessage.trim()) onSubmit(e); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!checkpointId) {
      alert("⚠️ Send a message first to start a chat, then upload.");
      return;
    }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `${API}/upload/${checkpointId}`,
        { method: "POST", body: fd }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      alert("✅ PDF uploaded successfully! You can now ask questions about it.");
    } catch (err: any) {
      console.error("Upload error:", err);
      alert(`❌ Upload failed — ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";   // reset file input
    }
  };

  return (
    <div className="bg-white border-t border-gray-100 px-5 py-3">
      <div className="w-full max-w-3xl mx-auto">

        {/* Quick chips — welcome only */}
        {!hasMessages && (
          <div className="flex gap-2 mb-2.5 flex-wrap justify-center">
            {["Search the web", "Summarise a topic", "Upload a PDF"].map(chip => (
              <button key={chip} type="button" onClick={() => setCurrentMessage(chip)}
                className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all duration-150">
                {chip}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit as React.FormEventHandler<HTMLFormElement>}>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:border-violet-300 focus-within:bg-white transition-all duration-200 shadow-sm">

            {/* Attach */}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex-shrink-0 text-gray-400 hover:text-violet-500 transition-colors" title="Attach PDF">
              {uploading
                ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              }
            </button>
            <input type="file" ref={fileRef} onChange={handleFile} className="hidden" accept=".pdf" />

            {/* Input */}
            <input type="text" placeholder="Ask anything…"
              value={currentMessage} onChange={e => setCurrentMessage(e.target.value)} onKeyDown={handleKeyDown}
              className="flex-grow bg-transparent outline-none text-[14px] text-gray-800 placeholder-gray-400" />

            {/* Send */}
            <button type="submit" disabled={!currentMessage.trim()}
              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
                ${currentMessage.trim() ? "bg-violet-600 hover:bg-violet-700 shadow-sm text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}