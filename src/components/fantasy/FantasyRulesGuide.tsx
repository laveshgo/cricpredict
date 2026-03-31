'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, Shield, Trophy, Swords, Users, Clock, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FantasyLeague, AuctionState, AuctionRules } from '@/types/fantasy';
import { DEFAULT_FANTASY_SCORING } from '@/types/fantasy';

interface FantasyRulesGuideProps {
  league: FantasyLeague;
  auctionState: AuctionState | null;
  isLight: boolean;
}

function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-elevated)]/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent)]/10 shrink-0">
          <Icon size={16} className="text-[var(--accent)]" />
        </div>
        <span className="text-sm font-bold text-[var(--text-primary)] flex-1 text-left">{title}</span>
        {open ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
      </button>
      {open && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="border-t border-[var(--border)] pt-3">
            {children}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function RuleRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <span className={`text-xs font-bold ${highlight ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{value}</span>
    </div>
  );
}

function ScoringRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const numVal = typeof value === 'number' ? value : parseFloat(value);
  const isPositive = !isNaN(numVal) && numVal > 0;
  const isNegative = !isNaN(numVal) && numVal < 0;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <span className={`text-xs font-bold ${
        color ? color
        : isPositive ? 'text-emerald-400'
        : isNegative ? 'text-red-400'
        : 'text-[var(--text-primary)]'
      }`}>
        {isPositive ? '+' : ''}{value}
      </span>
    </div>
  );
}

export default function FantasyRulesGuide({ league, auctionState, isLight }: FantasyRulesGuideProps) {
  const settings = league.settings;
  const rules: AuctionRules = settings?.auctionRules || {
    maxForeignPlayers: 4,
    minWK: 1, minBAT: 3, minAR: 1, minBOWL: 3,
    holdsPerPlayer: 5, holdDuration: 30,
  };
  const scoring = { ...DEFAULT_FANTASY_SCORING, ...settings?.scoringOverrides };
  const squadSize = settings?.maxSquadSize || 15;
  const budget = settings?.totalBudget || 100;
  const bidInc = settings?.bidIncrement || 0.25;
  const timerDur = settings?.timerDuration || 15;

  return (
    <div className="space-y-2">
      {/* How It Works */}
      <Section title="How It Works" icon={Swords} defaultOpen={true}>
        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p>
            This is a fantasy cricket league where you build your squad through a live auction,
            then earn points based on your players&apos; real IPL match performances throughout the tournament.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px] mt-0.5 shrink-0">1</Badge>
              <span><strong className="text-[var(--text-primary)]">Join the League</strong> — Get the invite link from the admin and join before the auction starts.</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px] mt-0.5 shrink-0">2</Badge>
              <span><strong className="text-[var(--text-primary)]">Live Auction</strong> — Players appear one by one. Bid in real-time against other members. Highest bidder gets the player.</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px] mt-0.5 shrink-0">3</Badge>
              <span><strong className="text-[var(--text-primary)]">Build Your Squad</strong> — Use your budget wisely to fill all {squadSize} squad slots across different roles.</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px] mt-0.5 shrink-0">4</Badge>
              <span><strong className="text-[var(--text-primary)]">Earn Points</strong> — Every player in your squad earns fantasy points based on their real IPL performance.</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px] mt-0.5 shrink-0">5</Badge>
              <span><strong className="text-[var(--text-primary)]">Win!</strong> — The team with the most points at the end of the tournament wins the league.</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Auction Rules */}
      <Section title="Auction Rules" icon={Shield}>
        <div className="space-y-1">
          <RuleRow label="Budget per team" value={`${budget} Cr`} highlight />
          <RuleRow label="Max squad size" value={`${squadSize} players`} />
          <RuleRow label="Bid increment" value={`${bidInc} Cr`} />
          <RuleRow label="Timer per bid" value={`${timerDur} seconds`} />
          <RuleRow label="Max overseas players" value={rules.maxForeignPlayers} />
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Role Minimums</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <RuleRow label="🧤 Wicket-keepers" value={`min ${rules.minWK}`} />
            <RuleRow label="🏏 Batters" value={`min ${rules.minBAT}`} />
            <RuleRow label="⭐ All-rounders" value={`min ${rules.minAR}`} />
            <RuleRow label="🎯 Bowlers" value={`min ${rules.minBOWL}`} />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Auction Sets</p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Players are organized into sets by role and tier. Marquee players (top tier) are auctioned first
            at higher base prices, followed by Set 2 and Set 3 players. Players within each set appear in random order.
          </p>
          <div className="mt-2 space-y-1">
            <RuleRow label="Marquee base price" value="2 Cr" />
            <RuleRow label="Set 2 base price" value="1 Cr" />
            <RuleRow label="Set 3 base price" value="0.5 Cr" />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Bidding</p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            When a player comes up, all members can bid. Each bid must be at least {bidInc} Cr higher than the current bid.
            You have {timerDur} seconds to bid after the last bid. If no one bids, the current highest bidder wins the player.
            You can pass on a player if you&apos;re not interested.
          </p>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Re-Auction</p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            After the main auction, players who went unsold are pooled for re-auction.
            Members with unfilled squad spots nominate unsold players they want (up to 4 per open slot).
            Nominated players enter re-auction at 0.5 Cr base price. This repeats until all squads are full or no unsold players remain.
          </p>
        </div>
      </Section>

      {/* Scoring System */}
      <Section title="Scoring System" icon={Target}>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">General</p>
          <ScoringRow label="Playing XI" value={scoring.playingXIPoints} />
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Batting</p>
          <ScoringRow label="Per run scored" value={scoring.runPoints} />
          <ScoringRow label="Boundary bonus (4s)" value={scoring.fourBonus} />
          <ScoringRow label="Six bonus" value={scoring.sixBonus} />
          <ScoringRow label="25 runs milestone" value={scoring.milestone25} />
          <ScoringRow label="Half-century (50)" value={scoring.milestone50} />
          <ScoringRow label="75 runs milestone" value={scoring.milestone75} />
          <ScoringRow label="Century (100)" value={scoring.milestone100} />
          <ScoringRow label="Duck penalty (out for 0)" value={scoring.duckPenalty} />
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Strike Rate (min 10 balls or 20 runs)</p>
          <ScoringRow label="SR > 190" value={scoring.srAbove190} />
          <ScoringRow label="SR 170–190" value={scoring.sr170to190} />
          <ScoringRow label="SR 150–170" value={scoring.sr150to170} />
          <ScoringRow label="SR 130–150" value={scoring.sr130to150} />
          <ScoringRow label="SR 70–100" value={scoring.sr70to100} />
          <ScoringRow label="SR 60–70" value={scoring.sr60to70} />
          <ScoringRow label="SR 50–60" value={scoring.sr50to60} />
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Bowling</p>
          <ScoringRow label="Per wicket" value={scoring.wicketPoints} />
          <ScoringRow label="Dot ball" value={scoring.dotBallPoints} />
          <ScoringRow label="LBW / Bowled bonus" value={scoring.lbwBowledBonus} />
          <ScoringRow label="Maiden over" value={scoring.maidenPoints} />
          <ScoringRow label="3-wicket haul" value={scoring.wickets3Bonus} />
          <ScoringRow label="4-wicket haul" value={scoring.wickets4Bonus} />
          <ScoringRow label="5-wicket haul" value={scoring.wickets5Bonus} />
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Economy Rate (min 2 overs)</p>
          <ScoringRow label="Econ < 5" value={scoring.econBelow5} />
          <ScoringRow label="Econ 5–6" value={scoring.econ5to6} />
          <ScoringRow label="Econ 6–7" value={scoring.econ6to7} />
          <ScoringRow label="Econ 7–8" value={scoring.econ7to8} />
          <ScoringRow label="Econ 10–11" value={scoring.econ10to11} />
          <ScoringRow label="Econ 11–12" value={scoring.econ11to12} />
          <ScoringRow label="Econ > 12" value={scoring.econAbove12} />
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Fielding</p>
          <ScoringRow label="Catch" value={scoring.catchPoints} />
          <ScoringRow label="3+ catches bonus" value={scoring.threeCatchBonus} />
          <ScoringRow label="Stumping" value={scoring.stumpingPoints} />
          <ScoringRow label="Run out" value={scoring.runOutPoints} />
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Captain / Vice-Captain</p>
          <ScoringRow label="Captain multiplier" value={`${scoring.captainMultiplier}x`} />
          <ScoringRow label="Vice-Captain multiplier" value={`${scoring.vcMultiplier}x`} />
        </div>
      </Section>

      {/* Points Calculation */}
      <Section title="How Points Work" icon={Zap}>
        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p>
            Every player in your squad earns fantasy points based on their real IPL match performance.
            Points are calculated automatically after each match is processed.
          </p>
          <p>
            Your total score is the sum of all your players&apos; points across all matches.
            The leaderboard ranks teams by total accumulated points throughout the tournament.
          </p>
          <p>
            Negative points are possible — for example, a batsman scoring a duck or a bowler with a poor economy rate
            will cost your team points.
          </p>
        </div>
      </Section>

      {/* Fair Play */}
      <Section title="Fair Play" icon={Users}>
        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p>
            All bids during an auction must be made in good faith. The admin&apos;s decisions are final.
          </p>
          <p>
            Collusion between teams (secret pre-agreements on bidding) is against the spirit of the game.
          </p>
          <p>
            The admin should remain neutral if they own a team — using admin controls to unfairly advantage their own squad is not permitted.
          </p>
          <p>
            All auction actions are logged for transparency. The admin can remove a player from a team if a mistake was made,
            with the action recorded in the audit log visible to all members.
          </p>
        </div>
      </Section>
    </div>
  );
}
