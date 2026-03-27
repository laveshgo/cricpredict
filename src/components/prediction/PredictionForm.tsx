'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Tournament, TournamentPrediction } from '@/types';
import { Search, X, Save, Lock, ChevronUp, ChevronDown, Trophy, Award, Target, Zap, Star, AlertCircle, GripVertical } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DEFAULT_TEAM_COLOR = { bg: 'var(--bg-hover)', text: 'var(--text-primary)', accent: '#666' };

interface Props {
  tournament: Tournament;
  existingPrediction?: TournamentPrediction | null;
  isLocked: boolean;
  onSave: (data: Pick<TournamentPrediction, 'teamRanking' | 'winner' | 'runnerUp' | 'runs' | 'wickets' | 'mvp'>) => void;
}

// ─── Autocomplete Input ───
function PlayerInput({
  value,
  onChange,
  allPlayers,
  placeholder,
  disabled,
  rank,
  accentColor = 'var(--accent)',
}: {
  value: string;
  onChange: (v: string) => void;
  allPlayers: string[];
  placeholder: string;
  disabled: boolean;
  rank?: number;
  accentColor?: string;
}) {
  const [query, setQuery] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? allPlayers.filter((p) =>
        p.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  return (
    <div ref={ref} className="relative flex-1">
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
        }}
      >
        {rank !== undefined && (
          <span className="text-xs font-black w-5 text-center tabular-nums shrink-0" style={{ color: accentColor }}>
            {rank}
          </span>
        )}
        <Search size={13} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => query.trim() && setShowDropdown(true)}
          onBlur={() => {
            // Commit typed value when user tabs/clicks away
            if (query !== value) onChange(query);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none disabled:opacity-40 text-[var(--text-primary)] placeholder-[var(--text-muted)]"
        />
        {query && !disabled && (
          <button onClick={() => { setQuery(''); onChange(''); }} className="shrink-0">
            <X size={13} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" />
          </button>
        )}
      </div>
      {showDropdown && filtered.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-xl"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          {filtered.map((p) => (
            <button
              key={p}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-ghost)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                setQuery(p);
                onChange(p);
                setShowDropdown(false);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PredictionForm({ tournament, existingPrediction, isLocked, onSave }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const teamNames = useMemo(() => tournament.teams.map((t) => t.name), [tournament.teams]);
  const allPlayers = useMemo(() => Object.values(tournament.players).flat().sort(), [tournament.players]);

  const [ranking, setRanking] = useState<string[]>(
    existingPrediction?.teamRanking || [...teamNames]
  );
  const [winner, setWinner] = useState(existingPrediction?.winner || '');
  const [runnerUp, setRunnerUp] = useState(existingPrediction?.runnerUp || '');
  const [runs, setRuns] = useState<string[]>(
    existingPrediction?.runs || ['', '', '', '', '']
  );
  const [wickets, setWickets] = useState<string[]>(
    existingPrediction?.wickets || ['', '', '', '', '']
  );
  const [mvp, setMvp] = useState(existingPrediction?.mvp || '');

  useEffect(() => {
    if (existingPrediction) {
      setRanking(existingPrediction.teamRanking);
      setWinner(existingPrediction.winner);
      setRunnerUp(existingPrediction.runnerUp);
      setRuns(existingPrediction.runs);
      setWickets(existingPrediction.wickets);
      setMvp(existingPrediction.mvp);
    }
  }, [existingPrediction]);

  const moveTeam = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= ranking.length) return;
    const copy = [...ranking];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setRanking(copy);

    const newTop4 = copy.slice(0, 4);
    if (winner && !newTop4.includes(winner)) setWinner('');
    if (runnerUp && !newTop4.includes(runnerUp)) setRunnerUp('');
    setValidationError('');
  };

  // ─── Drag-to-reorder state ───
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const touchStartY = useRef<number>(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
    setDragOverIdx(idx);
  };

  const handleDragOver = (idx: number) => {
    if (dragIdx === null) return;
    setDragOverIdx(idx);
  };

  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const copy = [...ranking];
      const [moved] = copy.splice(dragIdx, 1);
      copy.splice(dragOverIdx, 0, moved);
      setRanking(copy);

      const newTop4 = copy.slice(0, 4);
      if (winner && !newTop4.includes(winner)) setWinner('');
      if (runnerUp && !newTop4.includes(runnerUp)) setRunnerUp('');
      setValidationError('');
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // Touch drag support — long press to activate, row follows finger
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchActiveRef = useRef(false);
  const touchDragIdx = useRef<number | null>(null);
  const touchOverIdx = useRef<number | null>(null);
  const rowStartY = useRef<number>(0); // center Y of dragged row at start
  const rowHeight = useRef<number>(0);

  const clearAllTransforms = () => {
    rowRefs.current.forEach((row) => {
      if (!row) return;
      row.style.transform = '';
      row.style.transition = '';
      row.style.zIndex = '';
      row.style.boxShadow = '';
    });
  };

  const handleTouchStart = (idx: number, e: React.TouchEvent) => {
    if (isLocked) return;
    touchStartY.current = e.touches[0].clientY;
    touchActiveRef.current = false;
    touchDragIdx.current = null;
    touchOverIdx.current = null;

    longPressTimer.current = setTimeout(() => {
      touchActiveRef.current = true;
      touchDragIdx.current = idx;
      touchOverIdx.current = idx;

      const row = rowRefs.current[idx];
      if (row) {
        const rect = row.getBoundingClientRect();
        rowStartY.current = rect.top + rect.height / 2;
        rowHeight.current = rect.height;
        // Subtle drag indicator — green border only
        row.style.zIndex = '20';
        row.style.boxShadow = '0 0 0 2px var(--accent)';
        row.style.transition = 'box-shadow 0.15s ease';
      }
      if (navigator.vibrate) navigator.vibrate(30);
    }, 300);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    if (touchActiveRef.current && touchDragIdx.current !== null) {
      const fromIdx = touchDragIdx.current;
      const toIdx = touchOverIdx.current;
      clearAllTransforms();
      if (toIdx !== null && fromIdx !== toIdx) {
        const copy = [...ranking];
        const [moved] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, moved);
        setRanking(copy);

        const newTop4 = copy.slice(0, 4);
        if (winner && !newTop4.includes(winner)) setWinner('');
        if (runnerUp && !newTop4.includes(runnerUp)) setRunnerUp('');
        setValidationError('');
      }
    } else {
      clearAllTransforms();
    }
    touchActiveRef.current = false;
    touchDragIdx.current = null;
    touchOverIdx.current = null;
  };

  // Non-passive touchmove — moves the dragged row with finger, shifts others
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;

      if (!touchActiveRef.current) {
        if (Math.abs(touchY - touchStartY.current) > 5) {
          cancelLongPress();
        }
        return;
      }

      e.preventDefault();

      const fromIdx = touchDragIdx.current;
      if (fromIdx === null) return;

      // Move the dragged row to follow the finger
      const draggedRow = rowRefs.current[fromIdx];
      if (draggedRow) {
        const offsetY = touchY - touchStartY.current;
        draggedRow.style.transform = `translateY(${offsetY}px)`;
      }

      // Find which slot the finger is over
      let overIdx = fromIdx;
      for (let i = 0; i < rowRefs.current.length; i++) {
        const row = rowRefs.current[i];
        if (!row || i === fromIdx) continue;
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        // Use the original positions (before transform) by checking against finger
        if (i < fromIdx && touchY < midY + rowHeight.current * 0.3) {
          overIdx = i;
          break;
        }
        if (i > fromIdx && touchY > midY - rowHeight.current * 0.3) {
          overIdx = i;
        }
      }

      touchOverIdx.current = overIdx;

      // Shift other rows to make room
      for (let i = 0; i < rowRefs.current.length; i++) {
        const row = rowRefs.current[i];
        if (!row || i === fromIdx) continue;

        row.style.transition = 'transform 0.15s ease';
        if (fromIdx < overIdx && i > fromIdx && i <= overIdx) {
          // Dragging down — shift these rows up
          row.style.transform = `translateY(-${rowHeight.current}px)`;
        } else if (fromIdx > overIdx && i >= overIdx && i < fromIdx) {
          // Dragging up — shift these rows down
          row.style.transform = `translateY(${rowHeight.current}px)`;
        } else {
          row.style.transform = 'translateY(0)';
        }
      }
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [ranking]);

  const updateRuns = (idx: number, val: string) => {
    const copy = [...runs];
    copy[idx] = val;
    setRuns(copy);
  };

  const updateWickets = (idx: number, val: string) => {
    const copy = [...wickets];
    copy[idx] = val;
    setWickets(copy);
  };

  const [validationError, setValidationError] = useState('');

  const top4 = ranking.slice(0, 4);
  const top2 = ranking.slice(0, 2);

  const handleSave = () => {
    setValidationError('');

    if (!winner) {
      setValidationError('Please select a winner before saving.');
      return;
    }
    if (!runnerUp) {
      setValidationError('Please select a runner-up before saving.');
      return;
    }
    if (winner && !top4.includes(winner)) {
      setValidationError(`${winner} is ranked #${ranking.indexOf(winner) + 1} — only top 4 teams qualify for knockouts.`);
      return;
    }
    if (runnerUp && !top4.includes(runnerUp)) {
      setValidationError(`${runnerUp} is ranked #${ranking.indexOf(runnerUp) + 1} — only top 4 teams qualify for knockouts.`);
      return;
    }
    if (winner && runnerUp) {
      if (!top2.includes(winner) && !top2.includes(runnerUp)) {
        setValidationError('At least one finalist must be from your top 2 (they get a direct path to the final via Qualifier 1).');
        return;
      }
      if (winner === runnerUp) {
        setValidationError('Winner and runner-up cannot be the same team.');
        return;
      }
    }

    onSave({ teamRanking: ranking, winner, runnerUp, runs, wickets, mvp });
  };

  // O(1) lookups instead of linear .find() on every call
  const teamMap = useMemo(() => new Map(tournament.teams.map(t => [t.name, t])), [tournament.teams]);
  const getTeamColor = (name: string) => teamMap.get(name)?.color || DEFAULT_TEAM_COLOR;
  const getTeamShort = (name: string) => teamMap.get(name)?.shortName || name;

  // Progress indicator
  const filledFields = [
    winner ? 1 : 0,
    runnerUp ? 1 : 0,
    ...runs.map(r => r ? 1 : 0),
    ...wickets.map(w => w ? 1 : 0),
    mvp ? 1 : 0,
  ] as number[];
  const filled = filledFields.reduce((a, b) => a + b, 0);
  const total = filledFields.length;
  const progress = Math.round((filled / total) * 100);

  return (
    <div className="space-y-5">
      {/* ─── Locked Banner ─── */}
      {isLocked && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(233,69,96,0.08), rgba(233,69,96,0.02))',
            border: '1px solid rgba(233,69,96,0.2)',
          }}
        >
          <Lock size={16} style={{ color: 'var(--error)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--error)' }}>
            Predictions are locked. You can no longer edit.
          </span>
        </div>
      )}

      {/* ─── Progress Bar ─── */}
      {!isLocked && (
        <div
          className="p-4 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Prediction Progress
            </span>
            <span className="text-xs font-bold tabular-nums" style={{ color: progress === 100 ? 'var(--success)' : 'var(--accent)' }}>
              {filled}/{total}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? 'var(--success)'
                  : 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
              }}
            />
          </div>
        </div>
      )}

      {/* ─── Section 1: Points Table Ranking ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Trophy size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Points Table
          </h3>
          <span className="text-[10px] font-medium ml-auto" style={{ color: 'var(--text-muted)' }}>
            Hold to drag · arrows to reorder
          </span>
        </div>

        <div ref={listRef} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {ranking.map((team, idx) => {
            const color = getTeamColor(team);
            const isTopFour = idx < 4;
            const isLast = idx === ranking.length - 1;
            const isDragging = dragIdx === idx;
            const isDragOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx;

            return (
              <div
                key={team}
                ref={(el) => { rowRefs.current[idx] = el; }}
                draggable={!isLocked}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => { e.preventDefault(); handleDragOver(idx); }}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(idx, e)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className={`flex items-center px-3 py-2.5 select-none ${!isLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{
                  background: isTopFour
                    ? `linear-gradient(90deg, ${color.bg}${isLight ? '25' : '10'}, transparent)`
                    : 'var(--bg-card)',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  borderTop: isDragOver ? '2px solid var(--accent)' : '2px solid transparent',
                  position: 'relative',
                }}
              >
                {/* Drag handle */}
                {!isLocked && (
                  <div className="mr-1 shrink-0 p-1 -m-1" style={{ color: 'var(--text-muted)' }}>
                    <GripVertical size={14} />
                  </div>
                )}

                {/* Rank */}
                <span
                  className="w-6 text-center text-sm font-black tabular-nums"
                  style={{ color: isTopFour ? color.bg : 'var(--text-muted)' }}
                >
                  {idx + 1}
                </span>

                {/* Team badge + name */}
                <div className="flex items-center gap-2.5 flex-1 ml-1 min-w-0">
                  <div
                    className="w-9 h-6 rounded-md flex items-center justify-center text-[9px] font-black shrink-0 shadow-sm"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {getTeamShort(team)}
                  </div>
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {team}
                  </span>
                </div>

                {/* Qualifier tag */}
                {isTopFour && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider mr-2 hidden sm:inline-block"
                    style={{
                      background: `${color.bg}${isLight ? '30' : '20'}`,
                      color: isLight ? color.text : color.bg,
                      ...(isLight ? { backgroundColor: color.bg } : {}),
                    }}
                  >
                    {idx < 2 ? 'Q1' : 'Elim'}
                  </span>
                )}

                {/* Move buttons */}
                {!isLocked && (
                  <div className="flex flex-col gap-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveTeam(idx, -1); }}
                      disabled={idx === 0}
                      className="h-5 w-6 flex items-center justify-center rounded-t transition-colors disabled:opacity-15"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveTeam(idx, 1); }}
                      disabled={idx === ranking.length - 1}
                      className="h-5 w-6 flex items-center justify-center rounded-b transition-colors disabled:opacity-15"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Qualification cutoff hint */}
        <div className="flex items-center gap-2 mt-2 px-2">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Top 4 qualify for playoffs
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>
      </div>

      {/* ─── Section 2: Winner & Runner-up ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Award size={16} style={{ color: 'var(--gold)' }} />
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Winner & Runner-up
          </h3>
        </div>

        {/* IPL rule hint */}
        <div
          className="flex items-start gap-2 p-3 rounded-lg mb-3 text-[11px]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <span>
            Top 2 play Qualifier 1 (direct final path). Teams ranked 3rd–4th enter via Eliminators. At least one finalist must be from your top 2.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Winner Selector */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block px-1" style={{ color: 'var(--gold)' }}>
              Champion
            </label>
            <div className="space-y-1.5">
              {(() => {
                const runnerUpIsBottom = runnerUp && !top2.includes(runnerUp);
                const winnerOptions = runnerUpIsBottom ? top2 : top4;
                return winnerOptions.filter((t) => t !== runnerUp).map((t) => {
                  const color = getTeamColor(t);
                  const isSelected = winner === t;
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        if (!isLocked) { setWinner(t); setValidationError(''); }
                      }}
                      disabled={isLocked}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-200 disabled:opacity-50"
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, ${color.bg}25, ${color.bg}10)`
                          : 'var(--bg-card)',
                        border: isSelected
                          ? `2px solid ${color.bg}`
                          : '1px solid var(--border)',
                      }}
                    >
                      <div
                        className="w-9 h-6 rounded-md flex items-center justify-center text-[9px] font-black shrink-0"
                        style={{ background: color.bg, color: color.text }}
                      >
                        {getTeamShort(t)}
                      </div>
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {t}
                      </span>
                      {isSelected && (
                        <div className="ml-auto shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: color.bg }}>
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={color.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Runner-up Selector */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block px-1" style={{ color: 'var(--silver)' }}>
              Runner-up
            </label>
            <div className="space-y-1.5">
              {(() => {
                const winnerIsBottom = winner && !top2.includes(winner);
                const runnerUpOptions = winnerIsBottom ? top2 : top4;
                return runnerUpOptions.filter((t) => t !== winner).map((t) => {
                  const color = getTeamColor(t);
                  const isSelected = runnerUp === t;
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        if (!isLocked) { setRunnerUp(t); setValidationError(''); }
                      }}
                      disabled={isLocked}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-200 disabled:opacity-50"
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, ${color.bg}25, ${color.bg}10)`
                          : 'var(--bg-card)',
                        border: isSelected
                          ? `2px solid ${color.bg}`
                          : '1px solid var(--border)',
                      }}
                    >
                      <div
                        className="w-9 h-6 rounded-md flex items-center justify-center text-[9px] font-black shrink-0"
                        style={{ background: color.bg, color: color.text }}
                      >
                        {getTeamShort(t)}
                      </div>
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {t}
                      </span>
                      {isSelected && (
                        <div className="ml-auto shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: color.bg }}>
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={color.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Section 3: Top Run Scorers ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Target size={16} style={{ color: '#62B4FF' }} />
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Top 5 Run Scorers
          </h3>
        </div>

        <div className="space-y-2">
          {runs.map((player, idx) => (
            <PlayerInput
              key={`run-${idx}`}
              value={player}
              onChange={(v) => updateRuns(idx, v)}
              allPlayers={allPlayers}
              placeholder={`Run scorer #${idx + 1}...`}
              disabled={isLocked}
              rank={idx + 1}
              accentColor="#62B4FF"
            />
          ))}
        </div>
      </div>

      {/* ─── Section 4: Top Wicket Takers ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Zap size={16} style={{ color: '#A78BFA' }} />
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Top 5 Wicket Takers
          </h3>
        </div>

        <div className="space-y-2">
          {wickets.map((player, idx) => (
            <PlayerInput
              key={`wkt-${idx}`}
              value={player}
              onChange={(v) => updateWickets(idx, v)}
              allPlayers={allPlayers}
              placeholder={`Wicket taker #${idx + 1}...`}
              disabled={isLocked}
              rank={idx + 1}
              accentColor="#A78BFA"
            />
          ))}
        </div>
      </div>

      {/* ─── Section 5: MVP ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Star size={16} style={{ color: 'var(--gold)' }} />
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Player of the Tournament
          </h3>
        </div>

        <PlayerInput
          value={mvp}
          onChange={setMvp}
          allPlayers={allPlayers}
          placeholder="Search for MVP..."
          disabled={isLocked}
          accentColor="var(--gold)"
        />
      </div>

      {/* ─── Validation Error ─── */}
      {validationError && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl animate-fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(233,69,96,0.08), rgba(233,69,96,0.02))',
            border: '1px solid rgba(233,69,96,0.2)',
          }}
        >
          <AlertCircle size={16} style={{ color: 'var(--error)' }} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>
            {validationError}
          </p>
        </div>
      )}

      {/* ─── Save Button ─── */}
      {!isLocked && (
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
            color: '#fff',
            boxShadow: '0 4px 20px var(--accent-glow)',
          }}
        >
          <Save size={18} />
          Save Predictions
        </button>
      )}
    </div>
  );
}
