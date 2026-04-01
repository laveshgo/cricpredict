'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Swords, User } from 'lucide-react';

const TABS = [
  { href: '/', label: 'Home', icon: Trophy, match: (p: string) => p === '/' || p.startsWith('/tournament') || p.startsWith('/group') },
  { href: '/fantasy', label: 'Fantasy', icon: Swords, match: (p: string) => p.startsWith('/fantasy') },
  { href: '/profile', label: 'Profile', icon: User, match: (p: string) => p.startsWith('/profile') },
] as const;

export default function BottomTabs() {
  const pathname = usePathname();

  // Hide on auth pages
  if (pathname.startsWith('/auth')) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-[var(--bg-secondary)]/95 backdrop-blur-xl border-t border-[var(--border)]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 w-20 h-full transition-colors ${
                active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-semibold ${active ? 'text-[var(--accent)]' : ''}`}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute top-0 w-8 h-0.5 rounded-full bg-[var(--accent)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
