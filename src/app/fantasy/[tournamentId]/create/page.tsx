'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createFantasyLeague } from '@/lib/fantasy-firestore';
import { DEFAULT_FANTASY_LEAGUE_SETTINGS, DEFAULT_AUCTION_RULES } from '@/types/fantasy';
import type { AuctionRules, FantasyLeagueSettings } from '@/types/fantasy';
import {
  ArrowLeft,
  ArrowRight,
  Swords,
  Loader2,
  Trophy,
  Users,
  Zap,
  Clock,
  Settings,
  Check,
  Hand,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function CreateLeaguePage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.tournamentId as string;
  const { user, profile, loading: authLoading } = useAuth();

  // ─── Step state ───
  const [step, setStep] = useState(1);

  // ─── Step 1: Basic info ───
  const [leagueName, setLeagueName] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // ─── Step 2: Auction settings ───
  const [squadSize, setSquadSize] = useState(15);
  const [budget, setBudget] = useState(100);
  const [bidInc, setBidInc] = useState(0.25);
  const [timerDur, setTimerDur] = useState(15);
  const [rules, setRules] = useState<AuctionRules>({ ...DEFAULT_AUCTION_RULES });

  // ─── Shared ───
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (!leagueName.trim()) {
      setError('Please enter a league name');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleCreate = async () => {
    if (!user || !profile) return;

    setCreating(true);
    setError(null);

    try {
      const settings: FantasyLeagueSettings = {
        ...DEFAULT_FANTASY_LEAGUE_SETTINGS,
        maxSquadSize: squadSize,
        totalBudget: budget,
        bidIncrement: bidInc,
        timerDuration: timerDur,
        auctionRules: rules,
      };

      const leagueId = await createFantasyLeague({
        tournamentId,
        name: leagueName.trim(),
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        isPublic,
        memberUids: [user.uid],
        members: {
          [user.uid]: {
            displayName: profile.displayName || profile.username || 'User',
            username: profile.username || 'user',
            joinedAt: new Date().toISOString(),
          },
        },
        auctionStatus: 'lobby',
        settings,
      });

      router.push(`/fantasy/${tournamentId}/league/${leagueId}`);
    } catch (err: any) {
      console.error('Failed to create league:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Swords size={40} className="text-[var(--accent)] mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2 text-[var(--text-primary)]">Sign in to create a league</h2>
        <Link href="/auth/signin">
          <Button className="bg-[var(--accent)] hover:bg-[var(--accent)] text-white">Sign in</Button>
        </Link>
      </div>
    );
  }

  // Role min total validation
  const roleMinTotal = rules.minWK + rules.minBAT + rules.minAR + rules.minBOWL;
  const roleMinValid = roleMinTotal <= squadSize;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/tournament/${tournamentId}?tab=fantasy`}>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
            <ArrowLeft size={16} className="text-[var(--text-muted)]" />
          </button>
        </Link>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Create Fantasy League</h1>
      </div>

      {/* Step indicator: 1 ———— 2 */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          step >= 1
            ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/30'
            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
        }`}>
          {step > 1 ? <Check size={16} /> : '1'}
        </div>
        <div className="flex-1 max-w-[80px] h-0.5 rounded-full overflow-hidden bg-[var(--bg-elevated)]">
          <div className={`h-full rounded-full bg-[var(--accent)] transition-all duration-500 ${step >= 2 ? 'w-full' : 'w-0'}`} />
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          step >= 2
            ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/30'
            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
        }`}>
          2
        </div>
      </div>

      {/* Step labels */}
      <div className="flex items-center justify-center gap-3 mb-5">
        <span className={`text-[10px] font-semibold uppercase tracking-wider w-8 text-center ${step === 1 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
          Basics
        </span>
        <div className="flex-1 max-w-[80px]" />
        <span className={`text-[10px] font-semibold uppercase tracking-wider w-8 text-center ${step === 2 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
          Rules
        </span>
      </div>

      <Card className="glass-card border border-[var(--bg-elevated)]">
        <CardContent className="p-5">

          {/* ═══════ STEP 1: Basic Info ═══════ */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                  League Name
                </label>
                <Input
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  placeholder="e.g., Office Auction League"
                  className="bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]"
                  maxLength={40}
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`w-10 h-6 rounded-full transition-all relative ${
                    isPublic ? 'bg-[var(--accent)]' : 'bg-[var(--bg-elevated)]'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    isPublic ? 'left-5' : 'left-1'
                  }`} />
                </button>
                <span className="text-sm text-[var(--text-secondary)]">
                  {isPublic ? 'Public — anyone can find and join' : 'Private — invite only'}
                </span>
              </div>

              <p className="text-xs text-[var(--text-muted)]">
                Share the invite link after creating. You start the auction when ready.
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <Button
                onClick={handleNext}
                className="w-full bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-2 h-12 text-base shadow-lg shadow-[var(--accent)]/30"
              >
                Next: Auction Rules
                <ArrowRight size={18} />
              </Button>
            </div>
          )}

          {/* ═══════ STEP 2: Auction Settings ═══════ */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">

              {/* General settings grid */}
              <div>
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Settings size={11} />
                  General Settings
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Squad Size */}
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">
                    <div className="text-[10px] text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
                      <Users size={10} />
                      Squad Size
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setSquadSize(s => Math.max(5, s - 1))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">-</button>
                      <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{squadSize}</span>
                      <button onClick={() => setSquadSize(s => Math.min(25, s + 1))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">+</button>
                    </div>
                  </div>

                  {/* Budget */}
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">
                    <div className="text-[10px] text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
                      <Zap size={10} />
                      Budget (Cr)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setBudget(b => Math.max(10, b - 10))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">-</button>
                      <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{budget}</span>
                      <button onClick={() => setBudget(b => Math.min(500, b + 10))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">+</button>
                    </div>
                  </div>

                  {/* Bid Increment */}
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">
                    <div className="text-[10px] text-[var(--text-muted)] mb-1.5">Bid Increment (Cr)</div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setBidInc(b => Math.max(0.25, +(b - 0.25).toFixed(2)))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">-</button>
                      <span className="w-10 text-center text-sm font-bold text-[var(--text-primary)]">{bidInc}</span>
                      <button onClick={() => setBidInc(b => Math.min(5, +(b + 0.25).toFixed(2)))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">+</button>
                    </div>
                  </div>

                  {/* Timer Duration */}
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">
                    <div className="text-[10px] text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
                      <Clock size={10} />
                      Bid Timer (sec)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setTimerDur(t => Math.max(5, t - 5))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">-</button>
                      <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{timerDur}</span>
                      <button onClick={() => setTimerDur(t => Math.min(60, t + 5))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Squad composition rules */}
              <div>
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Squad Rules</div>
                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 space-y-2.5">
                  {/* Foreign limit */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Max Overseas ✈</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setRules(r => ({ ...r, maxForeignPlayers: Math.max(0, r.maxForeignPlayers - 1) }))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">-</button>
                      <span className="w-6 text-center text-xs font-bold text-[var(--text-primary)]">{rules.maxForeignPlayers}</span>
                      <button onClick={() => setRules(r => ({ ...r, maxForeignPlayers: Math.min(11, r.maxForeignPlayers + 1) }))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">+</button>
                    </div>
                  </div>

                  {/* Role minimums */}
                  {([
                    ['minWK', 'Min WK'] as const,
                    ['minBAT', 'Min BAT'] as const,
                    ['minAR', 'Min AR'] as const,
                    ['minBOWL', 'Min BOWL'] as const,
                  ]).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setRules(r => ({ ...r, [key]: Math.max(0, r[key] - 1) }))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">-</button>
                        <span className="w-6 text-center text-xs font-bold text-[var(--text-primary)]">{rules[key]}</span>
                        <button onClick={() => setRules(r => ({ ...r, [key]: Math.min(squadSize, r[key] + 1) }))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">+</button>
                      </div>
                    </div>
                  ))}

                  {/* Validation */}
                  <div className={`text-[10px] pt-1 border-t border-[var(--border)] ${roleMinValid ? 'text-[var(--text-muted)]' : 'text-red-400 font-semibold'}`}>
                    Total minimum: {roleMinTotal} / {squadSize} slots
                    {!roleMinValid && ' — exceeds squad size!'}
                  </div>
                </div>
              </div>

              {/* Hold settings */}
              <div>
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Hand size={11} />
                  Thinking Time (Holds)
                </div>
                <div className="rounded-lg bg-[var(--bg-elevated)] p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] mb-1">Per Player</div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setRules(r => ({ ...r, holdsPerPlayer: Math.max(0, r.holdsPerPlayer - 1) }))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">-</button>
                        <span className="w-6 text-center text-xs font-bold text-[var(--text-primary)]">{rules.holdsPerPlayer}</span>
                        <button onClick={() => setRules(r => ({ ...r, holdsPerPlayer: Math.min(20, r.holdsPerPlayer + 1) }))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">+</button>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] mb-1">Duration (sec)</div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setRules(r => ({ ...r, holdDuration: Math.max(5, r.holdDuration - 5) }))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">-</button>
                        <span className="w-6 text-center text-xs font-bold text-[var(--text-primary)]">{rules.holdDuration}</span>
                        <button onClick={() => setRules(r => ({ ...r, holdDuration: Math.min(120, r.holdDuration + 5) }))} className="w-8 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]">+</button>
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] mt-2">
                    {rules.holdsPerPlayer} hold{rules.holdsPerPlayer !== 1 ? 's' : ''} of {rules.holdDuration}s extra thinking time per player
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => { setStep(1); setError(null); }}
                  variant="outline"
                  className="border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] gap-1.5 h-12 px-4"
                >
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !roleMinValid}
                  className="flex-1 bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-2 h-12 text-base shadow-lg shadow-[var(--accent)]/30 disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Trophy size={18} />
                      Create League
                    </>
                  )}
                </Button>
              </div>

              <p className="text-[9px] text-[var(--text-muted)] text-center">
                Settings can be changed later in the lobby.
              </p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
