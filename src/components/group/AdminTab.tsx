'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  Calendar,
  Lock,
  Unlock,
  UserX,
  UserCheck,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type {
  Group,
  Tournament,
  ActualResults,
  Match,
  TournamentPrediction,
  MatchPrediction,
  ScoringConfig,
  UserProfile,
} from '@/types';
import { saveActualResults, updateGroupSettings, updateTournamentScoring, getTournament, leaveGroup } from '@/lib/firestore';
import dynamic from 'next/dynamic';

const ScoringRulesEditor = dynamic(() => import('@/components/admin/ScoringRulesEditor'));

interface AdminTabProps {
  group: Group | null;
  tournament: Tournament | null;
  actualResults: ActualResults | null;
  matches: Match[];
  allPredictions: TournamentPrediction[];
  allMatchPredictions: MatchPrediction[];
  members: Pick<UserProfile, 'uid' | 'username' | 'firstName' | 'lastName' | 'displayName' | 'photoURL'>[];
  isGroupAdmin: boolean;
  user: any;
  setSaveMsg: (msg: string) => void;
  setTournament: (tournament: Tournament | null) => void;
  fetchCricbuzzData: () => Promise<{
    teamRanking: string[];
    runs: string[];
    wickets: string[];
    noData: boolean;
    teamQualifyStatus: Record<string, 'Q' | 'E'>;
  } | null>;
  groupId: string;
}

function AdminTabComponent({
  group,
  tournament,
  actualResults,
  matches,
  allPredictions,
  allMatchPredictions,
  members,
  isGroupAdmin,
  user,
  setSaveMsg,
  setTournament,
  fetchCricbuzzData,
  groupId,
}: AdminTabProps) {
  // Admin state
  const [adminRanking, setAdminRanking] = useState<string[]>([]);
  const [adminWinner, setAdminWinner] = useState('');
  const [adminRunnerUp, setAdminRunnerUp] = useState('');
  const [adminRuns, setAdminRuns] = useState<string[]>(['', '', '', '', '']);
  const [adminWickets, setAdminWickets] = useState<string[]>(['', '', '', '', '']);
  const [adminMvp, setAdminMvp] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [fetchingCricbuzz, setFetchingCricbuzz] = useState(false);

  // Drag-to-reorder state
  const [adminDragIdx, setAdminDragIdx] = useState<number | null>(null);
  const [adminDragOverIdx, setAdminDragOverIdx] = useState<number | null>(null);

  // Settings state
  const [editDeadline, setEditDeadline] = useState('');
  const [editForceLocked, setEditForceLocked] = useState(false);
  const [editAddLocked, setEditAddLocked] = useState(false);
  const [editMemberLimit, setEditMemberLimit] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Initialize actual results state from props
  useEffect(() => {
    if (actualResults) {
      setAdminRanking(actualResults.teamRanking);
      setAdminWinner(actualResults.winner);
      setAdminRunnerUp(actualResults.runnerUp);
      setAdminRuns(actualResults.runs.length ? actualResults.runs : ['', '', '', '', '']);
      setAdminWickets(actualResults.wickets.length ? actualResults.wickets : ['', '', '', '', '']);
      setAdminMvp(actualResults.mvp);
    }
  }, [actualResults]);

  // Initialize settings state from group
  useEffect(() => {
    if (!group) return;
    const d = new Date(group.settings.deadline);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditDeadline(local);
    setEditForceLocked(group.settings.forceLocked);
    setEditAddLocked(group.settings.addLocked ?? false);
    setEditMemberLimit(group.settings.memberLimit ? String(group.settings.memberLimit) : '');
  }, [group?.id, group?.settings.deadline, group?.settings.forceLocked, group?.settings.addLocked, group?.settings.memberLimit]);

  // O(1) team lookup map
  const teamMap = useMemo(() => new Map(tournament?.teams.map(t => [t.name, t]) || []), [tournament?.teams]);

  // Initialize adminRanking from tournament teams if not set
  useEffect(() => {
    if (tournament && adminRanking.length === 0) {
      setAdminRanking(tournament.teams.map((tm) => tm.name));
    }
  }, [tournament]);

  const handleFetchCricbuzz = useCallback(async () => {
    setFetchingCricbuzz(true);
    try {
      const data = await fetchCricbuzzData();
      if (!data) return;
      if (data.noData) {
        setSaveMsg('Tournament has not started yet.');
        setTimeout(() => setSaveMsg(''), 4000);
        return;
      }
      if (data.teamRanking.length > 0) setAdminRanking(data.teamRanking);
      if (data.runs.length > 0) setAdminRuns(data.runs);
      if (data.wickets.length > 0) setAdminWickets(data.wickets);
      setSaveMsg('Cricbuzz data fetched! Review and save.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg('Error fetching: ' + (err.message || 'Failed'));
    } finally {
      setFetchingCricbuzz(false);
    }
  }, [fetchCricbuzzData, setSaveMsg]);

  const handleSaveActualResults = async () => {
    if (!group || !tournament) return;
    setAdminSaving(true);
    try {
      const results: ActualResults = {
        groupId,
        tournamentId: group.tournamentId,
        teamRanking: adminRanking,
        winner: adminWinner,
        runnerUp: adminRunnerUp,
        runs: adminRuns.filter(Boolean),
        wickets: adminWickets.filter(Boolean),
        mvp: adminMvp,
        lastUpdated: new Date().toISOString(),
        ...(actualResults?.teamQualifyStatus ? { teamQualifyStatus: actualResults.teamQualifyStatus } : {}),
      };
      await saveActualResults(results);
      setSaveMsg('Actual results saved! Leaderboard updated.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg('Error: ' + (err.message || 'Failed to save results'));
    } finally {
      setAdminSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!group) return;
    // Validate member limit
    const parsedLimit = editMemberLimit ? Number(editMemberLimit) : null;
    if (parsedLimit !== null && (isNaN(parsedLimit) || parsedLimit < 2)) {
      setSaveMsg('Error: Member limit must be at least 2');
      setTimeout(() => setSaveMsg(''), 3000);
      return;
    }
    if (parsedLimit !== null && group.memberUids.length > parsedLimit) {
      setSaveMsg(`Error: Group already has ${group.memberUids.length} members, can't set limit to ${parsedLimit}`);
      setTimeout(() => setSaveMsg(''), 4000);
      return;
    }
    setSavingSettings(true);
    try {
      const deadlineISO = new Date(editDeadline).toISOString();
      await updateGroupSettings(groupId, {
        deadline: deadlineISO,
        forceLocked: editForceLocked,
        addLocked: editAddLocked,
        memberLimit: parsedLimit,
      });
      setSaveMsg('Settings saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg('Error: ' + (err.message || 'Failed to save settings'));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actual Results Card */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Actual Results</CardTitle>
          <CardDescription className="text-sm">
            Enter or fetch the real tournament results. Saving will immediately update the leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tournament?.cricbuzzSeriesId && (
            <Button
              onClick={handleFetchCricbuzz}
              disabled={fetchingCricbuzz}
              className="gap-2 bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)]"
            >
              <RefreshCw size={16} className={fetchingCricbuzz ? 'animate-spin' : ''} />
              {fetchingCricbuzz ? 'Fetching...' : 'Fetch from Cricbuzz'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Prediction Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar size={18} className="text-[var(--accent)]" />
            Prediction Settings
          </CardTitle>
          <CardDescription className="text-sm">
            Set the prediction deadline and lock status for this group.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Deadline picker */}
          <div>
            <label className="text-xs block mb-2 font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Prediction Deadline
            </label>
            <input
              type="datetime-local"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--accent-dim)] hover:border-[var(--accent)] focus:border-[var(--accent)] transition-colors"
            />
            <p className="text-xs mt-1.5 text-[var(--text-muted)]">
              Predictions will auto-lock after this time.
            </p>
          </div>

          {/* Force Lock toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              {editForceLocked ? (
                <Lock size={18} className="text-red-400" />
              ) : (
                <Unlock size={18} className="text-green-400" />
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Force Lock Predictions
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {editForceLocked
                    ? 'Predictions are locked regardless of deadline'
                    : 'Predictions follow the deadline above'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditForceLocked(!editForceLocked)}
              className="relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none"
              style={{
                background: editForceLocked ? 'var(--accent)' : 'var(--bg-elevated)',
                border: '1px solid var(--border)',
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                style={{
                  transform: editForceLocked ? 'translateX(24px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>

          {/* Member Limit */}
          <div>
            <label className="text-xs block mb-2 font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Member Limit <span className="normal-case font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              type="number"
              min={2}
              value={editMemberLimit}
              onChange={(e) => setEditMemberLimit(e.target.value)}
              placeholder="Leave blank for unlimited"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--accent-dim)] hover:border-[var(--accent)] focus:border-[var(--accent)] transition-colors"
            />
            <p className="text-xs mt-1.5 text-[var(--text-muted)]">
              Minimum 2. Leave blank for no limit.
              {group && group.settings.memberLimit && (
                <> Currently {group.memberUids.length}/{group.settings.memberLimit} members.</>
              )}
            </p>
          </div>

          {/* Close Group toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              {editAddLocked ? (
                <UserX size={18} className="text-red-400" />
              ) : (
                <UserCheck size={18} className="text-green-400" />
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Close Group
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {editAddLocked
                    ? 'No new members can join this group'
                    : 'Anyone with the link can join'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditAddLocked(!editAddLocked)}
              className="relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none"
              style={{
                background: editAddLocked ? 'var(--accent)' : 'var(--bg-elevated)',
                border: '1px solid var(--border)',
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                style={{
                  transform: editAddLocked ? 'translateX(24px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>

          {/* Save button */}
          <Button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="w-full bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent-hover)] transition-all"
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Team Ranking */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Points Table Ranking</CardTitle>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Drag or use arrows to reorder</p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {adminRanking.map((team, idx) => {
              const tm = teamMap.get(team);
              const color = tm?.color;
              const shortName = tm?.shortName || team;
              const isDragging = adminDragIdx === idx;
              const isDragOver = adminDragOverIdx === idx && adminDragIdx !== null && adminDragIdx !== idx;
              const isLast = idx === adminRanking.length - 1;
              return (
                <div
                  key={team}
                  draggable
                  onDragStart={() => { setAdminDragIdx(idx); setAdminDragOverIdx(idx); }}
                  onDragOver={(e) => { e.preventDefault(); setAdminDragOverIdx(idx); }}
                  onDragEnd={() => {
                    if (adminDragIdx !== null && adminDragOverIdx !== null && adminDragIdx !== adminDragOverIdx) {
                      const copy = [...adminRanking];
                      const [moved] = copy.splice(adminDragIdx, 1);
                      copy.splice(adminDragOverIdx, 0, moved);
                      setAdminRanking(copy);
                    }
                    setAdminDragIdx(null);
                    setAdminDragOverIdx(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-all duration-150"
                  style={{
                    background: isDragging ? 'var(--accent-ghost)' : 'var(--bg-card)',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    opacity: isDragging ? 0.5 : 1,
                    borderTop: isDragOver ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <GripVertical size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                  <span className="text-sm font-bold w-6 text-[var(--accent)] tabular-nums">{idx + 1}</span>
                  <div
                    className="w-9 h-6 rounded-md flex items-center justify-center text-[9px] font-black shrink-0 shadow-sm"
                    style={{ background: color?.bg || '#333', color: color?.text || '#fff' }}
                  >
                    {shortName}
                  </div>
                  <span className="flex-1 text-sm font-medium text-[var(--text-primary)] truncate">{team}</span>
                  <div className="flex gap-0.5">
                    <Button
                      onClick={() => {
                        if (idx === 0) return;
                        const copy = [...adminRanking];
                        [copy[idx], copy[idx - 1]] = [copy[idx - 1], copy[idx]];
                        setAdminRanking(copy);
                      }}
                      disabled={idx === 0}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-ghost)] disabled:opacity-20"
                    ><ChevronUp size={14} /></Button>
                    <Button
                      onClick={() => {
                        if (idx === adminRanking.length - 1) return;
                        const copy = [...adminRanking];
                        [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
                        setAdminRanking(copy);
                      }}
                      disabled={idx === adminRanking.length - 1}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-ghost)] disabled:opacity-20"
                    ><ChevronDown size={14} /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Winner / Runner-up / MVP */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Finals & MVP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Winner', value: adminWinner, set: setAdminWinner },
              { label: 'Runner-up', value: adminRunnerUp, set: setAdminRunnerUp },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="text-xs block mb-2 font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label}</label>
                <select
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--accent-dim)] hover:border-[var(--accent)] transition-colors"
                >
                  <option value="">Select...</option>
                  {tournament?.teams.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            ))}
            <div>
              <label className="text-xs block mb-2 font-semibold uppercase tracking-wide text-[var(--text-secondary)]">MVP</label>
              <Input
                type="text"
                value={adminMvp}
                onChange={(e) => setAdminMvp(e.target.value)}
                placeholder="Player name"
                className="bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--accent-dim)] hover:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Run Scorers */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Top Run Scorers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 stagger-children">
          {adminRuns.map((player, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2">
              <span className="text-sm font-bold w-6 text-[var(--accent)]">#{idx + 1}</span>
              <Input
                type="text"
                value={player}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const copy = [...adminRuns];
                  copy[idx] = e.target.value;
                  setAdminRuns(copy);
                }}
                placeholder={`Run scorer #${idx + 1}`}
                className="flex-1 bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--accent-dim)] hover:border-[var(--accent)] transition-colors"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top Wicket Takers */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Top Wicket Takers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 stagger-children">
          {adminWickets.map((player, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2">
              <span className="text-sm font-bold w-6 text-[var(--accent)]">#{idx + 1}</span>
              <Input
                type="text"
                value={player}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const copy = [...adminWickets];
                  copy[idx] = e.target.value;
                  setAdminWickets(copy);
                }}
                placeholder={`Wicket taker #${idx + 1}`}
                className="flex-1 bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--accent-dim)] hover:border-[var(--accent)] transition-colors"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSaveActualResults}
        disabled={adminSaving}
        size="lg"
        className="w-full bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent-hover)] shadow-lg hover:shadow-xl transition-all"
      >
        {adminSaving ? 'Saving...' : 'Save Actual Results'}
      </Button>

      {/* Scoring Rules Editor */}
      <Separator className="my-8 bg-[var(--bg-elevated)]" />
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Scoring Rules</CardTitle>
          <CardDescription className="text-sm">
            Configure how points are calculated. Changes apply to all group members.
          </CardDescription>
        </CardHeader>
      </Card>
      {tournament && (
        <ScoringRulesEditor
          scoring={tournament.scoring}
          onSave={async (newScoring: ScoringConfig) => {
            await updateTournamentScoring(tournament.id, newScoring);
            // Refresh tournament data
            const t = await getTournament(group?.tournamentId || '');
            if (t) setTournament(t);
            setSaveMsg('Scoring rules updated!');
            setTimeout(() => setSaveMsg(''), 3000);
          }}
          isTournamentCreator={tournament.createdBy === user?.uid}
        />
      )}
    </div>
  );
}

export default React.memo(AdminTabComponent);
