"use client";

interface HeaderProps {
  activeTab: "home" | "chat" | "explore";
  onTabChange: (tab: "home" | "chat" | "explore") => void;
}

const Header = ({ activeTab, onTabChange }: HeaderProps) => (
  <header className="flex items-center justify-between px-6 h-14 bg-white border-b border-gray-100 flex-shrink-0">
    <div className="flex items-center gap-2.5">
      <div className="w-1.5 h-6 bg-violet-500 rounded-full" />
      <span className="font-semibold text-gray-900 text-[15px] tracking-tight">Perplexity 2.0</span>
    </div>
    <nav className="flex items-center gap-1.5">
      {(["home", "chat", "explore"] as const).map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors cursor-pointer
            ${activeTab === tab
              ? "bg-violet-50 text-violet-600"
              : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
            }`}
        >
          {tab}
        </button>
      ))}
    </nav>
  </header>
);

export default Header;