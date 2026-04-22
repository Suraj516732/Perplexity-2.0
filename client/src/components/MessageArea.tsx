import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  <div className="flex items-center gap-2 py-1">
    {[0, 150, 300].map(d => (
      <span key={d} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
        style={{ animationDelay: `${d}ms`, animationDuration: "0.9s" }} />
    ))}
  </div>
);

const SearchBadge = ({ info }: { info: SearchInfo }) => {
  if (!info?.stages?.length) return null;
  return (
    <div className="flex flex-col gap-2 mb-3 text-sm">
      {info.stages.includes("searching") && (
        <div className="flex items-center gap-2 text-violet-500">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span>Searching <em className="not-italic font-medium">"{info.query}"</em></span>
        </div>
      )}
      {info.stages.includes("reading") && info.urls?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {info.urls.slice(0, 3).map((url, i) => (
            <span key={i} className="bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg truncate max-w-[200px] text-xs">
              {url}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const MessageArea = ({ messages }: { messages: Message[] }) => (
  <div className="flex-grow overflow-y-auto bg-[#FAFAF8]" style={{ minHeight: 0 }}>
    {messages.length === 0 ? (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-6 shadow-sm">
          <svg className="w-7 h-7 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2 tracking-tight">What's on your mind?</h2>
        <p className="text-gray-400 text-sm">Ask anything — I'll find the answer.</p>
      </div>
    ) : (
      <div className="h-full flex flex-col">
        <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-6 space-y-5">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}>

              {!msg.isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5 shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              )}

              <div className={`flex flex-col max-w-[72%] ${msg.isUser ? "items-end" : "items-start"}`}>
                {!msg.isUser && msg.searchInfo && <SearchBadge info={msg.searchInfo} />}
                <div className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed
                  ${msg.isUser
                    ? "bg-white border border-gray-200 text-gray-800 rounded-tr-sm shadow-sm"
                    : "text-gray-800 rounded-tl-sm w-full"
                  }`}
                >
                  {msg.isLoading ? (
                    <Dots />
                  ) : msg.content ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ ...props }) => <h1 className="text-xl font-bold mb-3 text-gray-900" {...props} />,
                          h2: ({ ...props }) => <h2 className="text-lg font-bold mb-2 text-gray-900" {...props} />,
                          h3: ({ ...props }) => <h3 className="text-md font-bold mb-2 text-gray-900" {...props} />,
                          p: ({ ...props }) => <p className="mb-3 last:mb-0 text-gray-700 leading-relaxed" {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-gray-700" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-gray-700" {...props} />,
                          li: ({ ...props }) => <li className="pl-1" {...props} />,
                          strong: ({ ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                          blockquote: ({ ...props }) => <blockquote className="border-l-4 border-violet-200 pl-4 italic my-4 text-gray-600" {...props} />,
                          a: ({ ...props }) => <a className="text-violet-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                          code: ({ className, children, ...props }) => {
                            const isInline = !className;
                            return isInline ? (
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[13px] text-violet-600" {...props}>
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-[#1e1e1e] text-gray-100 p-4 rounded-xl overflow-x-auto my-4 font-mono text-[13px] shadow-sm">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            );
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">Thinking…</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default MessageArea;