import Link from "next/link";
import { Activity } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#000000]/80 backdrop-blur-xl border-b border-white/10 h-14">
      <div className="container mx-auto px-8 h-full flex items-center justify-between max-w-[1200px]">
        
        <Link href="/" className="flex items-center gap-2 group">
          <Activity className="w-4 h-4 text-ink transition-transform group-hover:scale-110" />
          <span className="font-medium text-ink text-[14px] tracking-tight">Codex Blackbox</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link href="/" className="btn-tertiary hidden sm:inline-flex text-[13px] hover:bg-white/10 px-3 py-1">
            Overview
          </Link>
          <a 
            href="https://github.com/hrisheesh/codex-blackbox" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-secondary text-[13px] px-4 py-1"
          >
            GitHub
          </a>
        </div>

      </div>
    </header>
  );
}
