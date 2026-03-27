'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  onGroup,
  getTournament,
  getPrediction,
  savePrediction,
  saveActualResults,
  getMatches,
  leaveGroup,
  getGroupMembers,
  onGroupPredictions,
  onActualResults,
  getAllMatchPredictionsForGroup,
} from '@/lib/firestore';
import { calculateScore } from '@/lib/scoring';
import dynamic from 'next/dynamic';
import CountdownTimer from '@/components/ui/countdown-timer';

// Lazy-loaded heavy components — only loaded when their tab/section is active
const PredictionForm = dynamic(() => import('@/components/prediction/PredictionForm'));
const ConsensusView = dynamic(() => import('@/components/prediction/ConsensusView'));
const LiveData = dynamic(() => import('@/components/prediction/LiveData'));
const Leaderboard = dynamic(() => import('@/components/leaderboard/Leaderboard'));
const ScoreBreakdownView = dynamic(() => import('@/components/leaderboard/ScoreBreakdown'));
const CompareView = dynamic(() => import('@/components/leaderboard/CompareView'));
const AdminTab = dynamic(() => import('@/components/group/AdminTab'));
const AllPicksTab = dynamic(() => import('@/components/group/AllPicksTab'));
const ShareCard = dynamic(() => import('@/components/prediction/ShareCard'));
import { joinGroupApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type {
  Group,
  Tournament,
  TournamentPrediction,
  ActualResults,
  LeaderboardEntry,
  Match,
  MatchPrediction,
} from '@/types';
import {
  Trophy,
  ClipboardList,
  BarChart3,
  Users,
  Clock,
  Copy,
  Check,
  Eye,
  PieChart,
  Shield,
  UserPlus,
  X,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  ArrowLeftRight,
  Share2,
  MessageCircle,
  Link,
  Lock,
} from 'lucide-react';
import type { UserProfile } from '@/types';

type Tab = 'predict' | 'predictions' | 'consensus' | 'leaderboard' | 'live' | 'admin';

export default function GroupPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const { user, profile, loading: authLoading, reloadProfile } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [myPrediction, setMyPrediction] = useState<TournamentPrediction | null>(null);
  const [allPredictions, setAllPredictions] = useState<TournamentPrediction[]>([]);
  const [actualResults, setActualResults] = useState<ActualResults | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allMatchPredictions, setAllMatchPredictions] = useState<MatchPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('predict');
  const [copied, setCopied] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [fetchingCricbuzz, setFetchingCricbuzz] = useState(false);

  // Members state
  const [members, setMembers] = useState<Pick<UserProfile, 'uid' | 'username' | 'firstName' | 'lastName' | 'displayName' | 'photoURL'>[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [joining, setJoining] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  // Leaderboard detail/compare state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [compareUserIds, setCompareUserIds] = useState<[string, string] | null>(null);

  // Share state
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareCardPrediction, setShareCardPrediction] = useState<TournamentPrediction | null>(null);

  // Load group — only after auth is ready
  useEffect(() => {
    if (authLoading || !user) return;
    const unsub = onGroup(groupId, (g) => setGroup(g));
    return () => unsub();
  }, [groupId, authLoading, user]);

  // Load tournament + initial data (once per group)
  const loadData = async () => {
    if (!group || !user) return;
    setLoading(true);
    try {
      const t = await getTournament(group.tournamentId);
      setTournament(t);

      const pred = await getPrediction(groupId, group.tournamentId, user.uid);
      setMyPrediction(pred);

      const m = await getMatches(group.tournamentId);
      setMatches(m);

      const allMatchPreds = await getAllMatchPredictionsForGroup(groupId);
      setAllMatchPredictions(allMatchPreds);

      const memberList = await getGroupMembers(groupId);
      setMembers(memberList);

      // Admin ranking is now managed inside AdminTab
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadedGroupRef = useRef<string | null>(null);
  useEffect(() => {
    if (group && user && loadedGroupRef.current !== group.id) {
      loadedGroupRef.current = group.id;
      loadData();
    }
  }, [group, user]);

  // Real-time listeners for predictions and actual results
  useEffect(() => {
    if (!group || !user) return;

    const unsubPreds = onGroupPredictions(groupId, group.tournamentId, (preds) => {
      setAllPredictions(preds);
    });

    const unsubResults = onActualResults(groupId, (results) => {
      setActualResults(results);
    });

    return () => {
      unsubPreds();
      unsubResults();
    };
  }, [group?.id, group?.tournamentId, user]);

  // Check if predictions are locked — auto-lock when deadline passes mid-session
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  useEffect(() => {
    if (!group) return;
    const deadline = new Date(group.settings.deadline).getTime();
    const now = Date.now();
    if (now >= deadline) {
      setDeadlinePassed(true);
      return;
    }
    setDeadlinePassed(false);
    const timer = setTimeout(() => setDeadlinePassed(true), deadline - now);
    return () => clearTimeout(timer);
  }, [group?.settings.deadline]);

  const isLocked = !group || group.settings.forceLocked || deadlinePassed;

  const isGroupAdmin = group?.createdBy === user?.uid;
  const isAdmin = isGroupAdmin;
  const canEditResults = isGroupAdmin;
  const isMember = group?.memberUids?.includes(user?.uid || '') || false;

  const handleJoinGroup = async () => {
    if (!user || isMember) return;
    setJoining(true);
    try {
      await joinGroupApi(groupId);
      const memberList = await getGroupMembers(groupId);
      setMembers(memberList);
    } catch (err: any) {
      setSaveMsg('Error: ' + (err.message || 'Failed to join'));
    } finally {
      setJoining(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin || memberId === user?.uid) return;
    const member = members.find((m) => m.uid === memberId);
    const displayName = member?.displayName || member?.username || 'this member';
    if (!window.confirm(`Remove ${displayName} from the group? This cannot be undone.`)) return;
    setRemovingMember(memberId);
    try {
      await leaveGroup(groupId, memberId);
      setMembers((prev) => prev.filter((m) => m.uid !== memberId));
    } catch (err: any) {
      setSaveMsg('Error: ' + (err.message || 'Failed to remove member'));
    } finally {
      setRemovingMember(null);
    }
  };

  // Calculate leaderboard (memoized)
  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    if (!actualResults || !tournament) return [];
    return allPredictions.map((pred) => {
      const userMatchPreds = allMatchPredictions.filter(mp => mp.userId === pred.userId);
      return {
        userId: pred.userId,
        userName: pred.userName,
        photoURL: undefined,
        score: calculateScore(pred, actualResults, tournament.scoring, userMatchPreds, matches),
      };
    });
  }, [actualResults, tournament, allPredictions, allMatchPredictions, matches]);

  const handleSavePrediction = async (
    data: Pick<TournamentPrediction, 'teamRanking' | 'winner' | 'runnerUp' | 'runs' | 'wickets' | 'mvp'>
  ) => {
    if (!user || !group || !tournament) return;
    setSaveMsg('');
    try {
      const predId = myPrediction?.id || `${groupId}_${user.uid}`;
      const fullPred: TournamentPrediction = {
        id: predId,
        groupId,
        tournamentId: group.tournamentId,
        userId: user.uid,
        userName: profile?.displayName || 'Anonymous',
        submittedAt: new Date().toISOString(),
        isLocked: false,
        ...data,
      };
      if (!group?.memberUids?.includes(user.uid)) {
        throw new Error('You must join this group before saving predictions');
      }

      await savePrediction(fullPred);
      setMyPrediction(fullPred);
      setSaveMsg('Predictions saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg('Error: ' + (err.message || 'Failed to save'));
    }
  };

  // Cricbuzz fetch — returns parsed data so callers can use it directly
  interface CricbuzzParsed {
    teamRanking: string[];
    runs: string[];
    wickets: string[];
    noData: boolean;
    teamQualifyStatus: Record<string, 'Q' | 'E'>;
  }

  const fetchCricbuzzData = useCallback(async (): Promise<CricbuzzParsed | null> => {
    if (!tournament?.cricbuzzSeriesId || !user) return null;
    const sid = tournament.cricbuzzSeriesId;
    const token = await user.getIdToken();

    const [ptRes, runsRes, wktsRes] = await Promise.all([
      fetch(`/api/cricbuzz?type=points-table&seriesId=${sid}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/cricbuzz?type=most-runs&seriesId=${sid}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/cricbuzz?type=most-wickets&seriesId=${sid}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const [ptData, runsData, wktsData] = await Promise.all([ptRes.json(), runsRes.json(), wktsRes.json()]);

    if (ptData?.noData && runsData?.noData && wktsData?.noData) {
      return { teamRanking: [], runs: [], wickets: [], noData: true, teamQualifyStatus: {} };
    }

    let teamRanking: string[] = [];
    const teamQualifyStatus: Record<string, 'Q' | 'E'> = {};
    if (ptData?.pointsTable?.[0]?.pointsTableInfo) {
      teamRanking = ptData.pointsTable[0].pointsTableInfo.map((t: any) => {
        const shortCode = t.teamName;
        const match = tournament.teams.find((tm) => tm.shortName === shortCode);
        const fullName = match?.name || t.teamFullName || shortCode;
        if (t.teamQualifyStatus === 'Q' || t.teamQualifyStatus === 'E') {
          teamQualifyStatus[fullName] = t.teamQualifyStatus;
        }
        return fullName;
      });
    }

    let runs: string[] = [];
    if (runsData?.t20StatsList?.values) {
      const topBatters = runsData.t20StatsList.values.slice(0, 5).map((p: any) => p.values?.[1] || '');
      if (topBatters.some((b: string) => b)) {
        runs = [...topBatters, '', '', '', '', ''].slice(0, 5);
      }
    }

    let wickets: string[] = [];
    if (wktsData?.t20StatsList?.values) {
      const topBowlers = wktsData.t20StatsList.values.slice(0, 5).map((p: any) => p.values?.[1] || '');
      if (topBowlers.some((b: string) => b)) {
        wickets = [...topBowlers, '', '', '', '', ''].slice(0, 5);
      }
    }

    return { teamRanking, runs, wickets, noData: false, teamQualifyStatus };
  }, [tournament, user]);

  // Live tab: fetch, then auto-save to Firestore if admin
  const handleLiveRefresh = useCallback(async () => {
    if (!group || !tournament) return;
    setFetchingCricbuzz(true);
    try {
      const data = await fetchCricbuzzData();
      if (!data) return;
      if (data.noData) {
        setSaveMsg('Tournament has not started yet.');
        setTimeout(() => setSaveMsg(''), 4000);
        return;
      }

      // Auto-save directly using the returned data
      if (canEditResults) {
        const existing = actualResults;
        const results: ActualResults = {
          groupId,
          tournamentId: group.tournamentId,
          teamRanking: data.teamRanking.length > 0 ? data.teamRanking : (existing?.teamRanking || []),
          winner: existing?.winner || '',
          runnerUp: existing?.runnerUp || '',
          runs: data.runs.length > 0 ? data.runs.filter(Boolean) : (existing?.runs || []),
          wickets: data.wickets.length > 0 ? data.wickets.filter(Boolean) : (existing?.wickets || []),
          mvp: existing?.mvp || '',
          lastUpdated: new Date().toISOString(),
          ...(Object.keys(data.teamQualifyStatus).length > 0
            ? { teamQualifyStatus: data.teamQualifyStatus }
            : existing?.teamQualifyStatus
              ? { teamQualifyStatus: existing.teamQualifyStatus }
              : {}),
        };
        await saveActualResults(results);
        setActualResults(results);
        setSaveMsg('Live data fetched and saved!');
      } else {
        setSaveMsg('Live data fetched! Admin will save results.');
      }
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg('Error fetching: ' + (err.message || 'Failed'));
    } finally {
      setFetchingCricbuzz(false);
    }
  }, [fetchCricbuzzData, canEditResults, group, tournament, actualResults, groupId]);

  const copyGroupLink = () => {
    const url = `${window.location.origin}/group/${groupId}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const url = `${window.location.origin}/group/${groupId}`;
    const text = `Join my ${tournament?.name || 'cricket'} prediction group "${group?.name}" on CricPredict!\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyGroupId = () => {
    navigator.clipboard.writeText(groupId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export leaderboard to clipboard
  const exportLeaderboard = () => {
    const sorted = [...leaderboard].sort((a, b) => b.score.total - a.score.total);
    const lines = sorted.map((e, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} ${e.userName}: ${e.score.total} pts`;
    });
    const text = `🏏 ${group?.name} — ${tournament?.name} Leaderboard\n\n${lines.join('\n')}\n\nPowered by CricPredict`;
    navigator.clipboard.writeText(text);
    setSaveMsg('Leaderboard copied to clipboard!');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  // Sign-in prompt for unauthenticated visitors
  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--accent-glow)] glow-pulse">
          <Users size={48} className="text-[var(--accent)]" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-3 gradient-text">
          Sign in to view this group
        </h2>
        <p className="text-base mb-8 text-[var(--text-secondary)] max-w-xs mx-auto">
          Sign in to continue.
        </p>
        <a
          href="/auth/signin"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (loading || !group || !tournament) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Card className="glow-card bg-[var(--bg-card)]">
          <CardContent className="h-48 animate-shimmer" />
        </Card>
      </div>
    );
  }

  // ─── Non-member gate: show a clean join page ───────────────────────
  if (!isMember) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center animate-fade-in">
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="h-1.5 bg-gradient-to-r from-[var(--accent)] via-[var(--accent-hover)] to-transparent" />
          <div className="px-6 py-10">
            {/* Icon */}
            <div className="mb-5 inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--accent-glow)] glow-pulse">
              <Trophy size={40} className="text-[var(--accent)]" />
            </div>

            {/* Group name */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight gradient-text mb-2">
              {group.name}
            </h1>

            {/* Tournament badge */}
            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4" style={{ background: 'var(--accent-ghost)', color: 'var(--accent)' }}>
              {tournament.name}
            </span>

            {/* Stats row */}
            <div className="flex justify-center gap-6 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{group.memberUids?.length || 0}</div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Members</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border)' }} />
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{allPredictions.length}</div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Predictions</div>
              </div>
            </div>

            {/* Join button or closed/full message */}
            {group.settings.addLocked ? (
              <div className="w-full py-5 rounded-xl flex flex-col items-center gap-2" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <Lock size={24} className="text-red-400" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">This group is closed</p>
                <p className="text-xs text-[var(--text-muted)]">The admin has closed this group to new members.</p>
              </div>
            ) : group.settings.memberLimit && group.memberUids.length >= group.settings.memberLimit ? (
              <div className="w-full py-5 rounded-xl flex flex-col items-center gap-2" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <Users size={24} className="text-orange-400" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">This group is full</p>
                <p className="text-xs text-[var(--text-muted)]">{group.memberUids.length}/{group.settings.memberLimit} members</p>
              </div>
            ) : (
              <>
                {(() => {
                  const limit = group.settings.memberLimit;
                  const spotsLeft = limit ? limit - group.memberUids.length : null;
                  if (spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 9) {
                    return (
                      <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg mb-2 animate-pulse" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <Clock size={14} className="text-red-400" />
                        <span className="text-sm font-bold text-red-400">
                          Hurry! Only {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} remaining
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                <Button
                  onClick={handleJoinGroup}
                  disabled={joining}
                  className="w-full py-6 text-base font-bold rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/30 gap-2"
                >
                  {joining ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <UserPlus size={20} />
                      Join This Group
                    </>
                  )}
                </Button>
                <p className="mt-5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Join to make your predictions, compete on the leaderboard, and see how your picks compare with others.
                </p>
              </>
            )}

            {/* Error message */}
            {saveMsg && (
              <div className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--error)] bg-opacity-90">
                {saveMsg}
              </div>
            )}
          </div>
        </div>

        {/* Countdown teaser */}
        <div className="mt-6 rounded-xl px-5 py-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {isLocked ? 'Predictions are locked' : 'Predictions close soon'}
            </span>
          </div>
          <CountdownTimer
            deadline={group.settings.deadline}
            isLocked={isLocked}
            forceLocked={group.settings.forceLocked}
          />
        </div>
      </div>
    );
  }

  const allTabs: { key: Tab; label: string; icon: typeof Trophy; show: boolean }[] = [
    { key: 'predict', label: 'Predict', icon: ClipboardList, show: true },
    { key: 'predictions', label: 'All Picks', icon: Eye, show: allPredictions.length > 0 },
    { key: 'consensus', label: 'Consensus', icon: PieChart, show: allPredictions.length > 0 },
    { key: 'leaderboard', label: 'Leaderboard', icon: BarChart3, show: true },
    { key: 'live', label: 'Live', icon: TrendingUp, show: true },
    { key: 'admin', label: 'Admin', icon: Shield, show: canEditResults },
  ];

  const visibleTabs = allTabs.filter((t) => t.show);

  // For leaderboard breakdown
  const selectedPrediction = selectedUserId ? allPredictions.find(p => p.userId === selectedUserId) : null;
  const selectedScore = selectedUserId ? leaderboard.find(e => e.userId === selectedUserId)?.score : null;

  // For compare
  const comparePredictions = compareUserIds
    ? [allPredictions.find(p => p.userId === compareUserIds[0])!, allPredictions.find(p => p.userId === compareUserIds[1])!]
    : null;
  const compareScores = compareUserIds
    ? [leaderboard.find(e => e.userId === compareUserIds[0])?.score!, leaderboard.find(e => e.userId === compareUserIds[1])?.score!]
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-fade-in">
      {/* Group Header Card */}
      <div className="mb-6 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--accent-hover)] to-transparent" />
        <div className="px-5 pt-6 pb-5">
          {/* Title Row */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight gradient-text">
                {group.name}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-ghost)', color: 'var(--accent)' }}>
                  {tournament.name}
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {allPredictions.length} prediction{allPredictions.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {!isMember && (
                <Button
                  onClick={handleJoinGroup}
                  disabled={joining}
                  size="sm"
                  className="gap-1.5 bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)]"
                >
                  {joining ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {joining ? 'Joining...' : 'Join Group'}
                </Button>
              )}
              <Button
                onClick={copyGroupLink}
                variant="ghost"
                size="sm"
                className="gap-1 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-ghost)]"
              >
                {linkCopied ? <Check size={13} /> : <Link size={13} />}
                <span className="hidden sm:inline text-xs">{linkCopied ? 'Copied!' : 'Share'}</span>
              </Button>
              <Button
                onClick={shareWhatsApp}
                variant="ghost"
                size="sm"
                className="gap-1 text-[var(--text-muted)] hover:text-green-400 hover:bg-green-500/10"
              >
                <MessageCircle size={13} />
                <span className="hidden sm:inline text-xs">WhatsApp</span>
              </Button>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className="mt-5">
            <CountdownTimer
              deadline={group.settings.deadline}
              isLocked={isLocked}
              forceLocked={group.settings.forceLocked}
            />
          </div>

          {/* Members Section */}
          <div className="mt-5">
            <Button
              onClick={() => setShowMembers(!showMembers)}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-[var(--text-secondary)] px-0 hover:text-[var(--text-primary)]"
            >
              <Users size={16} />
              <span className="font-medium">{members.length} member{members.length !== 1 ? 's' : ''}</span>
              {showMembers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>

            {showMembers && (
              <div className="mt-3 space-y-2 animate-fade-in stagger-children">
                {members.map((member) => (
                  <div
                    key={member.uid}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-200"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      {member.photoURL && (
                        <AvatarImage src={member.photoURL} alt={member.displayName} referrerPolicy="no-referrer" />
                      )}
                      <AvatarFallback className="bg-[var(--accent)] text-white text-xs font-bold">
                        <User size={14} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {member.displayName}
                        </p>
                        {member.uid === user?.uid && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent-ghost)] text-[var(--accent)]">(you)</span>
                        )}
                        {member.uid === group.createdBy && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--gold)] bg-opacity-20 text-[var(--gold)]">Admin</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        @{member.username}
                      </p>
                    </div>
                    {isAdmin && member.uid !== user?.uid && member.uid !== group.createdBy && (
                      <Button
                        onClick={() => handleRemoveMember(member.uid)}
                        disabled={removingMember === member.uid}
                        variant="ghost"
                        size="sm"
                        className="h-auto p-2 text-[var(--error)] hover:bg-[var(--error)] hover:bg-opacity-20 rounded-md transition-colors"
                        title="Remove member"
                      >
                        {removingMember === member.uid ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-xs px-4 py-3 text-[var(--text-muted)]">
                    No members yet. Be the first to join!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {saveMsg && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium animate-fade-in text-white border backdrop-blur-sm ${
            saveMsg.startsWith('Error')
              ? 'bg-[var(--error)] bg-opacity-90 border-[var(--error)] border-opacity-50 shadow-lg shadow-[var(--error)]/20'
              : 'bg-[var(--success)] bg-opacity-90 border-[var(--success)] border-opacity-50 shadow-lg shadow-[var(--success)]/20'
          }`}
        >
          {saveMsg}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(value: string) => setTab(value as Tab)} className="w-full">
        <TabsList className="w-full h-auto bg-[var(--bg-elevated)] p-1 rounded-full flex gap-1 overflow-x-auto scrollbar-none border-0 shadow-none">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              className="flex-1 min-w-0 flex items-center justify-center gap-1 rounded-full py-2.5 text-xs font-semibold transition-all duration-200 data-[state=active]:bg-[var(--accent)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[var(--accent)]/30 data-[state=inactive]:text-[var(--text-secondary)] data-[state=inactive]:hover:text-[var(--text-primary)]"
            >
              <Icon size={14} className="shrink-0" />
              <span className="hidden sm:inline truncate">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ===================== PREDICT TAB ===================== */}
        <TabsContent value="predict">
          <PredictionForm
            tournament={tournament}
            existingPrediction={myPrediction}
            isLocked={isLocked}
            onSave={handleSavePrediction}
          />
          {/* Share as Image button — only when prediction exists */}
          {myPrediction && myPrediction.winner && (
            <div className="mt-4">
              <Button
                onClick={() => setShareCardPrediction(myPrediction)}
                variant="outline"
                className="w-full gap-2 border-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent-ghost)] font-semibold"
              >
                <Share2 size={16} />
                Share Prediction as Image
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ===================== ALL PREDICTIONS TAB ===================== */}
        <TabsContent value="predictions">
          <AllPicksTab
            allPredictions={allPredictions}
            tournament={tournament}
            currentUserId={user?.uid}
            groupName={group.name}
          />
        </TabsContent>

        {/* ===================== CONSENSUS TAB ===================== */}
        <TabsContent value="consensus">
          <ConsensusView predictions={allPredictions} tournament={tournament} />
        </TabsContent>

        {/* ===================== LEADERBOARD TAB ===================== */}
        <TabsContent value="leaderboard">
          {actualResults ? (
            <div className="space-y-4">
              {/* Action Bar */}
              <Card className="glass-card">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <p className="text-xs text-[var(--text-secondary)]">
                      Last updated: {new Date(actualResults.lastUpdated).toLocaleString('en-IN')}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={exportLeaderboard}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs border-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent-ghost)]"
                      >
                        <Copy size={12} />
                        Copy Leaderboard
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Compare Selector */}
              {leaderboard.length >= 2 && !selectedUserId && !compareUserIds && (
                <Card className="glass-card">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[var(--text-secondary)]">
                        Click a user for breakdown, or select two to compare
                      </p>
                      <Button
                        onClick={() => {
                          const sorted = [...leaderboard].sort((a, b) => b.score.total - a.score.total);
                          if (sorted.length >= 2) {
                            setCompareUserIds([sorted[0].userId, sorted[1].userId]);
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs border-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent-ghost)]"
                      >
                        <ArrowLeftRight size={12} />
                        Compare Top 2
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Compare View */}
              {compareUserIds && comparePredictions?.[0] && comparePredictions?.[1] && compareScores?.[0] && compareScores?.[1] && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Compare</h3>
                    <Button
                      onClick={() => setCompareUserIds(null)}
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <X size={12} /> Close
                    </Button>
                  </div>
                  <CompareView
                    predictions={comparePredictions as [TournamentPrediction, TournamentPrediction]}
                    scores={compareScores as any}
                    actualResults={actualResults}
                    tournament={tournament}
                  />
                </div>
              )}

              {/* Selected User Breakdown */}
              {selectedUserId && selectedPrediction && selectedScore && !compareUserIds && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {selectedPrediction.userName}&apos;s Breakdown
                    </h3>
                    <Button
                      onClick={() => setSelectedUserId(null)}
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <X size={12} /> Close
                    </Button>
                  </div>
                  <ScoreBreakdownView
                    prediction={selectedPrediction}
                    actualResults={actualResults}
                    tournament={tournament}
                    score={selectedScore}
                  />
                </div>
              )}

              {/* Main Leaderboard */}
              {!compareUserIds && !selectedUserId && (
                <Leaderboard
                  entries={leaderboard}
                  currentUserId={user?.uid}
                  onUserClick={(userId) => setSelectedUserId(userId)}
                />
              )}
            </div>
          ) : (
            <Card className="glow-card">
              <CardContent className="pt-12 pb-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent-glow)] mb-4">
                  <BarChart3 size={32} className="text-[var(--accent)]" />
                </div>
                <p className="text-base font-semibold text-[var(--text-primary)]">
                  Leaderboard will appear once actual results are entered
                </p>
                <p className="text-xs mt-3 text-[var(--text-secondary)]">
                  {canEditResults
                    ? 'Go to the Admin tab to enter or fetch results from Cricbuzz.'
                    : 'The group admin will update results as the tournament progresses.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===================== LIVE DATA TAB ===================== */}
        <TabsContent value="live">
          <LiveData
            tournament={tournament}
            actualResults={actualResults}
            onRefresh={handleLiveRefresh}
            isRefreshing={fetchingCricbuzz}
          />
        </TabsContent>

        {/* ===================== ADMIN TAB ===================== */}
        {canEditResults && (
          <TabsContent value="admin">
            <AdminTab
              group={group}
              tournament={tournament}
              actualResults={actualResults}
              matches={matches}
              allPredictions={allPredictions}
              allMatchPredictions={allMatchPredictions}
              members={members}
              isGroupAdmin={isGroupAdmin}
              user={user}
              setSaveMsg={setSaveMsg}
              setTournament={setTournament}
              fetchCricbuzzData={fetchCricbuzzData}
              groupId={groupId}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Share Card Modal */}
      {shareCardPrediction && tournament && group && (
        <ShareCard
          prediction={shareCardPrediction}
          tournament={tournament}
          groupName={group.name}
          onClose={() => setShareCardPrediction(null)}
        />
      )}
    </div>
  );
}
