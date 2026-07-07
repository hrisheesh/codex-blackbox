import Link from "next/link";
import { Activity } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-border/40">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4 mx-auto">
        <Link href="/" className="flex items-center space-x-2 mr-6 transition-opacity hover:opacity-80">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-bold tracking-tight text-foreground">
            Codex <span className="text-primary font-mono tracking-tighter">Blackbox</span>
          </span>
        </Link>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">Home</Link>
          <Link href="/compare" className="transition-colors hover:text-foreground/80 text-foreground/60">Compare</Link>
        </nav>
      </div>
    </header>
  );
}
