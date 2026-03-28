'use client';

import { useState } from 'react';
import type { ScoringConfig } from '@/types';
import { DEFAULT_SCORING } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Save, Trophy, Target, Zap, Award, Calculator } from 'lucide-react';

type LucideIcon = typeof Trophy;

function Field({ label, configKey, icon: Icon, value, onChange, disabled }: {
  label: string; configKey: keyof ScoringConfig; icon?: LucideIcon;
  value: number; onChange: (key: keyof ScoringConfig, val: number) => void; disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {Icon && <Icon size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
        <span className="text-sm text-[var(--text-primary)]">{label}</span>
      </div>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(configKey, parseInt(e.target.value) || 0)}
        disabled={disabled}
        className="w-20 px-3 py-1.5 rounded-lg text-sm text-center font-bold outline-none transition-colors"
        style={{
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--accent-dim)',
        }}
      />
    </div>
  );
}

interface Props {
  scoring: ScoringConfig;
  onSave: (scoring: ScoringConfig) => Promise<void>;
  isTournamentCreator: boolean;
}

export default function ScoringRulesEditor({ scoring, onSave, isTournamentCreator }: Props) {
  const [config, setConfig] = useState<ScoringConfig>({ ...scoring });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (key: keyof ScoringConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_SCORING });
    setSaved(false);
  };

  const maxPossible = (() => {
    const teamCount = 10;
    const rankMax = teamCount * config.rankExact;
    const winnerMax = config.winner;
    const ruMax = config.runnerUp;
    const runsMax = 5 * config.runsExact;
    const wicketsMax = 5 * config.wicketsExact;
    const mvpMax = config.mvp;
    return rankMax + winnerMax + ruMax + runsMax + wicketsMax + mvpMax;
  })();
  
  const disabled = !isTournamentCreator;

  return (
    <div className="space-y-4">
      {/* Max Points Display */}
      <Card className="glass-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[var(--gold)] to-transparent" />
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--gold)', color: '#000' }}>
                <Calculator size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Max Possible Score
                </p>
                <p className="text-2xl font-black" style={{ color: 'var(--gold)' }}>
                  {maxPossible} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>pts</span>
                </p>
              </div>
            </div>
            <div className="text-right text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <p>Rank: {10 * config.rankExact}</p>
              <p>W+RU: {config.winner + config.runnerUp}</p>
              <p>Bat+Bowl: {5 * config.runsExact + 5 * config.wicketsExact}</p>
              <p>MVP: {config.mvp}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Rules */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy size={18} style={{ color: 'var(--accent)' }} />
            Team Rankings
          </CardTitle>
          <CardDescription className="text-xs">Points for predicting correct team positions</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Exact position match" configKey="rankExact" value={config.rankExact ?? 0} onChange={update} disabled={disabled} />
          <Field label="Off by 1 position" configKey="rankOff1" value={config.rankOff1 ?? 0} onChange={update} disabled={disabled} />
          <Field label="Off by 2 positions" configKey="rankOff2" value={config.rankOff2 ?? 0} onChange={update} disabled={disabled} />
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award size={18} style={{ color: 'var(--gold)' }} />
            Winner & Runner-up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Correct Winner" configKey="winner" value={config.winner ?? 0} onChange={update} disabled={disabled} />
          <Field label="Correct Runner-up" configKey="runnerUp" value={config.runnerUp ?? 0} onChange={update} disabled={disabled} />
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target size={18} style={{ color: 'var(--accent)' }} />
            Top Run Scorers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Correct player in exact position" configKey="runsExact" value={config.runsExact ?? 0} onChange={update} disabled={disabled} />
          <Field label="Correct player, wrong position" configKey="runsPartial" value={config.runsPartial ?? 0} onChange={update} disabled={disabled} />
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap size={18} style={{ color: 'var(--accent)' }} />
            Top Wicket Takers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Correct player in exact position" configKey="wicketsExact" value={config.wicketsExact ?? 0} onChange={update} disabled={disabled} />
          <Field label="Correct player, wrong position" configKey="wicketsPartial" value={config.wicketsPartial ?? 0} onChange={update} disabled={disabled} />
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award size={18} style={{ color: 'var(--gold)' }} />
            MVP & Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Correct MVP pick" configKey="mvp" value={config.mvp ?? 0} onChange={update} disabled={disabled} />
          <Field label="Correct match winner (per match)" configKey="matchWinner" value={config.matchWinner ?? 0} onChange={update} disabled={disabled} />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {isTournamentCreator && (
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 gap-2 bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent-hover)]"
          >
            <Save size={16} />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Scoring Rules'}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            className="gap-2 border-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent-ghost)]"
          >
            <RotateCcw size={16} />
            Reset
          </Button>
        </div>
      )}

      {!isTournamentCreator && (
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          Only the tournament creator can modify scoring rules.
        </p>
      )}
    </div>
  );
}
