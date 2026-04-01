'use client';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Trophy, Sun, Moon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

/** Compact app-style top bar — just logo + theme toggle. Navigation lives in bottom tabs. */
export default function AppHeader() {
  const { user } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  const pathname = usePathname();

  // Hide on auth pages — they have their own headers
  if (pathname.startsWith('/auth')) return null;

  return (
    <header
      className="sticky top-0 z-50 bg-[var(--bg-secondary)]/95 backdrop-blur-xl border-b border-[var(--border)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between px-4 h-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-cyan-500 flex items-center justify-center">
            <Trophy size={16} className="text-white" />
          </div>
          <span className="text-base font-bold text-[var(--text-primary)]">
            CricPredict
          </span>
        </Link>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)] active:scale-90 transition-transform"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}
      </div>
    </header>
  );
}
