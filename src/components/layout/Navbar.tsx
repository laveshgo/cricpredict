'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Trophy, LogOut, Menu, X, AtSign, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

export default function Navbar() {
  const router = useRouter();
  const { user, profile, loading, needsUsername, signOut } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[var(--bg-secondary)] border-b border-[var(--border)] backdrop-blur-xl bg-opacity-95">
      {/* Subtle gradient accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-20" />

      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        {/* Logo - Large and Confident */}
        <Link
          href="/"
          className="flex items-center gap-3 group hover:opacity-90 transition-opacity duration-200"
        >
          <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--accent)] to-cyan-500 group-hover:shadow-lg group-hover:shadow-[var(--accent)]/30 transition-all duration-200">
            <Trophy size={28} className="text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-[var(--accent)] via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            CricPredict
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          {/* Theme Toggle - only after mount to avoid hydration mismatch */}
          {mounted ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all duration-200 rounded-lg p-2"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[var(--bg-hover)] animate-pulse" />
          )}
          {loading ? (
            <div className="h-10 w-32 rounded-lg bg-[var(--bg-hover)] animate-pulse" />
          ) : user && profile?.username && profile?.firstName ? (
            <>
              {/* Tournaments Button */}
              <Button
                variant="ghost"
                asChild
                className="text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-200 rounded-lg px-4 py-2"
              >
                <Link href="/">Tournaments</Link>
              </Button>

              {/* Visual Separator */}
              <Separator orientation="vertical" className="h-6 bg-[var(--border)] opacity-30 mx-2" />

              {/* Avatar with Profile Link */}
              <Link
                href="/profile"
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-200 group"
              >
                <Avatar className="h-9 w-9 border-2 border-[var(--border)] group-hover:border-[var(--accent)] group-hover:shadow-lg group-hover:shadow-[var(--accent)]/20 transition-all duration-200">
                  <AvatarImage
                    src={profile.photoURL || ''}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-[var(--accent)] to-cyan-500 text-white text-xs font-bold">
                    {profile.displayName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {profile.displayName}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] leading-none">
                    @{profile.username}
                  </span>
                </div>
              </Link>

              {/* Sign Out Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="text-[var(--text-muted)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-200 rounded-lg ml-1"
              >
                <LogOut size={16} className="mr-1.5" />
                Sign out
              </Button>
            </>
          ) : user && needsUsername ? (
            <Button
              asChild
              className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold rounded-lg px-4 py-2 shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 transition-all duration-200"
            >
              <Link href="/auth/setup-username">
                <AtSign size={16} className="mr-1.5" />
                Complete signup
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold rounded-lg px-5 py-2 shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 transition-all duration-200"
            >
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-200 rounded-lg p-2"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
      </div>

      {/* Mobile Menu - Slide Down */}
      {menuOpen && (
        <div className="md:hidden bg-[var(--bg-card)] border-t border-[var(--border)] px-6 py-5 animate-in fade-in slide-in-from-top-2 duration-300">
          {loading ? (
            <div className="h-10 w-full rounded-lg bg-[var(--bg-hover)] animate-pulse" />
          ) : user && profile?.username && profile?.firstName ? (
            <div className="flex flex-col gap-5">
              {/* Mobile Avatar Section */}
              <Link
                href="/profile"
                className="flex items-center gap-3 pb-5 border-b border-[var(--border)] hover:opacity-90 transition-opacity duration-200 group"
                onClick={() => setMenuOpen(false)}
              >
                <Avatar className="h-12 w-12 border-2 border-[var(--border)] group-hover:border-[var(--accent)] group-hover:shadow-lg group-hover:shadow-[var(--accent)]/20 transition-all duration-200">
                  <AvatarImage
                    src={profile.photoURL || ''}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-[var(--accent)] to-cyan-500 text-white font-bold">
                    {profile.displayName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {profile.displayName}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    @{profile.username}
                  </span>
                </div>
              </Link>

              {/* Mobile Links */}
              <Button
                variant="ghost"
                asChild
                className="justify-start text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-200 rounded-lg px-3 py-2 h-auto"
              >
                <Link href="/" onClick={() => setMenuOpen(false)}>
                  Tournaments
                </Link>
              </Button>

              <Button
                variant="ghost"
                asChild
                className="justify-start text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-200 rounded-lg px-3 py-2 h-auto"
              >
                <Link href="/profile" onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
              </Button>

              <Separator className="bg-[var(--border)] opacity-30 my-1" />

              {/* Sign Out Button */}
              <Button
                variant="ghost"
                className="justify-start text-[var(--text-muted)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-200 rounded-lg px-3 py-2 h-auto"
                onClick={async () => {
                  await signOut();
                  setMenuOpen(false);
                  router.push('/');
                }}
              >
                <LogOut size={16} className="mr-2" />
                Sign out
              </Button>
            </div>
          ) : user && needsUsername ? (
            <Button
              asChild
              className="w-full bg-[var(--warning)] hover:bg-[var(--warning)]/90 text-white font-semibold rounded-lg py-2.5 shadow-lg shadow-[var(--warning)]/20 transition-all duration-200"
              onClick={() => setMenuOpen(false)}
            >
              <Link href="/auth/setup-username">
                <AtSign size={16} className="mr-1.5" />
                Complete signup
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold rounded-lg py-2.5 shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 transition-all duration-200"
              onClick={() => setMenuOpen(false)}
            >
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          )}
          {/* Mobile Theme Toggle - only after mount */}
          {mounted && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] border-opacity-30">
              <Button
                variant="ghost"
                className="w-full justify-start text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-200 rounded-lg px-3 py-2 h-auto"
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun size={16} className="mr-2" /> : <Moon size={16} className="mr-2" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </Button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
