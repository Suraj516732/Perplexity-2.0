import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Search, CheckCircle2, Globe, Link as LinkIcon, FileText, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}
interface SearchInfo {
  stages: string[];
  query: string;
  urls: string[];
  results?: SearchResult[];
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
        className="w-2 h-2 bg-[#D4C491] rounded-full"
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
        <div className="flex items-center gap-2 text-[#D4C491] text-xs font-medium bg-[#D4C491]/10 px-3 py-1.5 rounded-full w-fit border border-[#D4C491]/20">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Searching for <em className="not-italic text-[#D4C491]/80">"{info.query}"</em></span>
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

const SourcesList = ({ results }: { results: SearchResult[] }) => {
  if (!results || results.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1 ml-1">
        <LinkIcon className="w-3 h-3" />
        <span>Sources</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((res, i) => {
          let hostname = "";
          try { hostname = new URL(res.url).hostname.replace('www.', ''); } catch { hostname = "link"; }
          return (
            <a 
              key={i} 
              href={res.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:border-[#D4C491]/30 hover:bg-[#D4C491]/5 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-[#D4C491] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center p-0.5 flex-shrink-0">
                   <img src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`} className="w-full h-full rounded-sm" alt="" />
                </div>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-tight truncate">{hostname}</span>
              </div>
              <span className="text-[13px] font-semibold text-white/90 line-clamp-1 group-hover:text-[#D4C491] transition-colors">{res.title}</span>
              <span className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{res.snippet}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
};

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
            className="mb-4 md:mb-8"
          >
             <div className="w-16 h-16 md:w-24 md:h-24 rounded-[28px] bg-white/5 border border-[#D4C491]/20 flex items-center justify-center relative group overflow-hidden shadow-[0_0_50px_rgba(212,196,145,0.1)]">
                <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-[#D4C491] group-hover:scale-110 transition-transform drop-shadow-[0_0_15px_rgba(212,196,145,0.4)]" />
                <div className="absolute inset-0 bg-[#D4C491]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
          </motion.div>
          
          <motion.h2 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
            className="text-2xl md:text-5xl font-semibold text-white mb-3 md:mb-6 tracking-tight leading-tight"
          >
            What do you want to <span className="text-[#D4C491]">know?</span>
          </motion.h2>
          
          <motion.p 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
            className="text-gray-500 text-sm md:text-xl max-w-xl font-normal leading-relaxed"
          >
            Experience the future of search. Real-time answers, accurate sources, and deep reasoning.
          </motion.p>

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
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mr-4 flex-shrink-0 mt-1">
                    <Sparkles className="w-4 h-4 text-white/70" />
                  </div>
                )}

                <div className={`flex flex-col max-w-[85%] ${msg.isUser ? "items-end" : "items-start"}`}>
                  
                  {!msg.isUser && msg.searchInfo && <SearchBadge info={msg.searchInfo} />}
                  
                  <div className={`group relative rounded-2xl px-4 md:px-5 py-3 md:py-4 text-[14px] md:text-[15px] leading-relaxed
                    ${msg.isUser
                      ? "bg-white/10 text-white border border-white/10 rounded-tr-sm"
                      : "bg-[#0A0A0A] border border-white/5 text-gray-100 rounded-tl-sm w-full"
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
                    {!msg.isUser && msg.searchInfo?.results && <SourcesList results={msg.searchInfo.results} />}
                    
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
                            h1: ({ ...props }) => <h1 className="text-2xl md:text-3xl font-bold text-white mt-8 mb-4 tracking-tight border-b border-white/5 pb-2" {...props} />,
                            h2: ({ ...props }) => <h2 className="text-xl md:text-2xl font-bold text-white mt-8 mb-3 tracking-tight" {...props} />,
                            h3: ({ ...props }) => <h3 className="text-lg md:text-xl font-bold text-white mt-6 mb-2 tracking-tight" {...props} />,
                            p: ({ ...props }) => <p className="mb-4 last:mb-0 leading-relaxed text-gray-300" {...props} />,
                            strong: ({ ...props }) => <strong className="font-bold text-white" {...props} />,
                            ul: ({ ...props }) => <ul className="list-disc pl-5 mb-4 space-y-2 text-gray-300" {...props} />,
                            ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-gray-300" {...props} />,
                            li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
                            a: ({ ...props }) => <a className="text-[#D4C491] hover:text-[#E5D5A2] underline decoration-[#D4C491]/30 underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                            code: ({ className, children, ...props }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-[13px] text-purple-300 border border-white/5" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <pre className="relative bg-[#0d0d0d] text-gray-200 p-4 rounded-xl overflow-x-auto my-6 font-mono text-[13px] border border-white/10 shadow-inner">
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