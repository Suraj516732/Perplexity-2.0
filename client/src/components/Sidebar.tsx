"use client";

interface ChatItem { title: string; }
interface SidebarProps {
  chats: Record<string, ChatItem>;
  activeId: string | null;
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}

export default function Sidebar({ chats, activeId, onChatSelect, onNewChat, onDeleteChat }: SidebarProps) {
  return (
    <div className="w-72 h-screen flex flex-col bg-white border-r border-gray-100 flex-shrink-0">

      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-gray-100">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="font-semibold text-gray-900 text-[15px] tracking-tight">Perplexity</span>
        <span className="text-xs font-semibold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded-md">2.0</span>
      </div>

      {/* New Chat */}
      <div className="px-4 pt-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-150 group"
        >
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          New chat
        </button>
      </div>

      {/* Recents */}
      {Object.keys(chats).length > 0 && (
        <>
          <p className="px-5 pt-5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Recents
          </p>
          <div className="flex-1 overflow-y-auto px-4 space-y-0.5 pb-4">
            {Object.entries(chats)
              .reverse()
              .map(([id, chat]) => (
                <div
                  key={id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors duration-150 text-[13px]
                    ${activeId === id
                      ? "bg-violet-50 text-violet-700 font-medium border border-violet-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                >
                  {/* Chat icon + title — clickable to open */}
                  <div
                    className="flex items-center gap-2 flex-1 min-w-0"
                    onClick={() => onChatSelect(id)}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="truncate">{chat.title || "Untitled"}</span>
                  </div>

                  {/* Delete button — appears on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${chat.title || "Untitled"}"?`)) {
                        onDeleteChat(id);
                      }
                    }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded-md hover:bg-red-50 hover:text-red-500 text-gray-400"
                    title="Delete chat"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      {!Object.keys(chats).length && <div className="flex-1" />}
    </div>
  );
}