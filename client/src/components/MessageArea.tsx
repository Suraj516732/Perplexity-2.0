import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Search, CheckCircle2, Globe, Link as LinkIcon, FileText, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchInfo {
  stages: string[];
  query: string;
  urls: string[];
  error?: string;
}
interface Message {
  id: number;
  content: string;
  isUser: boolean;
  type: string;
  isLoading?: boolean;
  searchInfo?: SearchInfo;
}

const Dots = () => (
  <div className="flex items-center gap-1.5 py-2 px-1">
    {[0, 150, 300].map(d => (
      <motion.span 
        key={d} 
        className="w-2 h-2 bg-purple-500 rounded-full"
        animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1, delay: d / 1000 }}
      />
    ))}
  </div>
);

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-gray-500 hover:text-white transition-colors cursor-pointer p-1">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const SearchBadge = ({ info }: { info: SearchInfo }) => {
  if (!info?.stages?.length) return null;
  return (
    <div className="flex flex-col gap-2 mb-3 mt-1">
      {info.stages.includes("searching") && !info.stages.includes("reading") && (
        <div className="flex items-center gap-2 text-purple-400 text-xs font-medium bg-purple-500/10 px-3 py-1.5 rounded-full w-fit border border-purple-500/20">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Searching for <em className="not-italic text-purple-300">"{info.query}"</em></span>
        </div>
      )}
      {info.stages.includes("reading") && (
        <div className="flex items-center gap-2 text-blue-400 text-xs font-medium bg-blue-500/10 px-3 py-1.5 rounded-full w-fit border border-blue-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Analyzed {info.urls?.length || 0} sources</span>
        </div>
      )}
    </div>
  );
};

// Extracted Loader2 to avoid missing import
const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

const MessageArea = ({ messages }: { messages: Message[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar scroll-smooth bg-transparent relative z-10">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
             <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative group overflow-hidden">
                <Sparkles className="w-8 h-8 text-white/80 group-hover:text-white transition-colors" />
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
          </motion.div>
          
          <motion.h2 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
            className="text-4xl md:text-5xl font-semibold text-white mb-6 tracking-tight"
          >
            What do you want to <span className="text-gray-400">know?</span>
          </motion.h2>
          
          <motion.p 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
            className="text-gray-500 text-lg md:text-xl max-w-2xl font-normal leading-relaxed"
          >
            Experience the future of search. Real-time answers, accurate sources, and deep reasoning.
          </motion.p>

          <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
             className="mt-12 flex gap-10 items-center opacity-40 grayscale"
          >
             <div className="flex items-center gap-2"><Globe className="w-4 h-4"/> <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Global Web</span></div>
             <div className="flex items-center gap-2"><FileText className="w-4 h-4"/> <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Contextual PDF</span></div>
             <div className="flex items-center gap-2"><Search className="w-4 h-4"/> <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Neural Search</span></div>
          </motion.div>
        </div>
      ) : (
        <div className="w-full max-w-3xl mx-auto space-y-8 pb-10">
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div 
                key={msg.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
              >
                {!msg.isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mr-4 flex-shrink-0 mt-1 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`flex flex-col max-w-[85%] ${msg.isUser ? "items-end" : "items-start"}`}>
                  
                  {!msg.isUser && msg.searchInfo && <SearchBadge info={msg.searchInfo} />}
                  
                  <div className={`group relative rounded-2xl px-5 py-4 text-[15px] leading-relaxed
                    ${msg.isUser
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-tr-sm shadow-lg shadow-purple-500/20"
                      : "glass-card text-gray-100 rounded-tl-sm w-full"
                    }`}
                  >
                    {msg.isUser && msg.files && msg.files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {msg.files.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/90 shadow-sm backdrop-blur-sm">
                            <FileText className="w-3 h-3" />
                            <span className="max-w-[120px] truncate">{file}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.isLoading ? (
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm font-medium">Thinking</span>
                        <Dots />
                      </div>
                    ) : msg.content ? (
                      <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ ...props }) => <a className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
                            code: ({ className, children, ...props }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-[13px] text-purple-300 border border-white/5" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <pre className="relative bg-[#0d0d0d] text-gray-200 p-4 rounded-xl overflow-x-auto my-4 font-mono text-[13px] border border-white/10 shadow-inner">
                                  <div className="absolute top-2 right-2"><CopyButton text={String(children)} /></div>
                                  <code className={className} {...props}>{children}</code>
                                </pre>
                              );
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">Processing...</span>
                    )}

                    {/* Message Actions (Copy) */}
                    {!msg.isUser && !msg.isLoading && msg.content && (
                      <div className="absolute -bottom-8 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                        <CopyButton text={msg.content} />
                      </div>
                    )}

                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default MessageArea;