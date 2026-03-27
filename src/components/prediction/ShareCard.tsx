'use client';

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import type { Tournament, TournamentPrediction } from '@/types';
import { Download, Share2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  prediction: TournamentPrediction;
  tournament: Tournament;
  groupName: string;
  onClose: () => void;
}

export default function ShareCard({ prediction, tournament, groupName, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const getTeamColor = (name: string) => {
    const team = tournament.teams.find((t) => t.name === name);
    return team?.color || { bg: '#333', text: '#fff', accent: '#666' };
  };

  const getTeamShort = (name: string) => {
    return tournament.teams.find((t) => t.name === name)?.shortName || name;
  };

  const shareCaption = `Here are my predictions for ${tournament.name}! 🏏\n\nMade on CricPredict`;

  const generateImage = async (action: 'download' | 'share') => {
    if (!cardRef.current) return;
    setGenerating(true);

    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2, // Retina quality
        useCORS: true,
        logging: false,
      });

      if (action === 'download') {
        const link = document.createElement('a');
        link.download = `${prediction.userName}-${tournament.name.replace(/\s+/g, '-')}-prediction.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        // Try native share API
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], 'prediction.png', { type: 'image/png' });

          if (navigator.share && navigator.canShare?.({ files: [file] })) {
            try {
              await navigator.share({
                text: shareCaption,
                files: [file],
              });
            } catch (err) {
              // User cancelled share — no-op
            }
          } else {
            // Fallback: copy caption to clipboard + download image
            try {
              await navigator.clipboard.writeText(shareCaption);
              const link = document.createElement('a');
              link.download = `${prediction.userName}-${tournament.name.replace(/\s+/g, '-')}-prediction.png`;
              link.href = canvas.toDataURL('image/png');
              link.click();
              alert('Image downloaded & caption copied to clipboard — paste it along with the image!');
            } catch {
              // Final fallback: just download
              const link = document.createElement('a');
              link.download = 'prediction.png';
              link.href = canvas.toDataURL('image/png');
              link.click();
            }
          }
        }, 'image/png');
      }
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setGenerating(false);
    }
  };

  const winnerColor = prediction.winner ? getTeamColor(prediction.winner) : null;
  const runnerUpColor = prediction.runnerUp ? getTeamColor(prediction.runnerUp) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md space-y-4 animate-fade-in">
        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: '#fff' }}>Share Prediction</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <X size={16} style={{ color: '#fff' }} />
          </button>
        </div>

        {/* ─── The Card (this gets captured) ─── */}
        <div
          ref={cardRef}
          style={{
            background: 'linear-gradient(160deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)',
            borderRadius: '20px',
            padding: '28px 24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Background decoration */}
          <div style={{
            position: 'absolute', top: '-60px', right: '-60px',
            width: '200px', height: '200px', borderRadius: '50%',
            background: winnerColor ? `${winnerColor.bg}15` : 'rgba(0,212,170,0.05)',
            filter: 'blur(40px)',
          }} />
          <div style={{
            position: 'absolute', bottom: '-40px', left: '-40px',
            width: '150px', height: '150px', borderRadius: '50%',
            background: runnerUpColor ? `${runnerUpColor.bg}10` : 'rgba(99,102,241,0.05)',
            filter: 'blur(30px)',
          }} />

          {/* Header */}
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
                  {prediction.userName}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {groupName}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  CricPredict
                </div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                  {tournament.name}
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', marginBottom: '18px' }} />

          {/* ─── Points Table ─── */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>
              Points Table Prediction
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {prediction.teamRanking.map((team, idx) => {
                const color = getTeamColor(team);
                const isTopFour = idx < 4;
                return (
                  <div
                    key={team}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: isTopFour ? `${color.bg}20` : 'rgba(255,255,255,0.05)',
                      border: isTopFour ? `1px solid ${color.bg}40` : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span style={{
                      fontSize: '10px', fontWeight: 900, color: isTopFour ? color.bg : 'rgba(255,255,255,0.3)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '32px', height: '20px', borderRadius: '4px',
                      background: color.bg, color: color.text,
                      fontSize: '8px', fontWeight: 900,
                    }}>
                      {getTeamShort(team)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Winner & Runner-up ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            {/* Winner */}
            <div style={{
              padding: '14px 12px',
              borderRadius: '14px',
              background: winnerColor ? `linear-gradient(135deg, ${winnerColor.bg}18, ${winnerColor.bg}05)` : 'rgba(255,255,255,0.03)',
              border: winnerColor ? `1px solid ${winnerColor.bg}30` : '1px solid rgba(255,255,255,0.06)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>🏆</div>
              <div style={{ fontSize: '8px', fontWeight: 800, color: '#FFD700', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                Champion
              </div>
              {prediction.winner && (
                <>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: winnerColor!.bg, color: winnerColor!.text,
                    fontSize: '10px', fontWeight: 900,
                    boxShadow: `0 4px 12px ${winnerColor!.bg}40`,
                  }}>
                    {getTeamShort(prediction.winner)}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', marginTop: '6px' }}>
                    {prediction.winner}
                  </div>
                </>
              )}
            </div>

            {/* Runner-up */}
            <div style={{
              padding: '14px 12px',
              borderRadius: '14px',
              background: runnerUpColor ? `linear-gradient(135deg, ${runnerUpColor.bg}10, ${runnerUpColor.bg}03)` : 'rgba(255,255,255,0.03)',
              border: runnerUpColor ? `1px solid ${runnerUpColor.bg}20` : '1px solid rgba(255,255,255,0.06)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>🥈</div>
              <div style={{ fontSize: '8px', fontWeight: 800, color: '#C0C0C0', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                Runner-up
              </div>
              {prediction.runnerUp && (
                <>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: runnerUpColor!.bg, color: runnerUpColor!.text,
                    fontSize: '10px', fontWeight: 900,
                  }}>
                    {getTeamShort(prediction.runnerUp)}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', marginTop: '6px' }}>
                    {prediction.runnerUp}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ─── Players Grid ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            {/* Runs */}
            <div style={{
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(98, 180, 255, 0.06)',
              border: '1px solid rgba(98, 180, 255, 0.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px' }}>🏏</span>
                <span style={{ fontSize: '8px', fontWeight: 800, color: '#62B4FF', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                  Top Runs
                </span>
              </div>
              {prediction.runs.filter(Boolean).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 900, color: '#62B4FF', width: '12px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                    {p}
                  </span>
                </div>
              ))}
            </div>

            {/* Wickets */}
            <div style={{
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(167, 139, 250, 0.06)',
              border: '1px solid rgba(167, 139, 250, 0.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px' }}>⚡</span>
                <span style={{ fontSize: '8px', fontWeight: 800, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                  Top Wickets
                </span>
              </div>
              {prediction.wickets.filter(Boolean).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 900, color: '#A78BFA', width: '12px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                    {p}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── MVP ─── */}
          {prediction.mvp && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02))',
              border: '1px solid rgba(255,215,0,0.15)',
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '16px',
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: '#FFD700', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 900, flexShrink: 0,
              }}>
                ⭐
              </div>
              <div>
                <div style={{ fontSize: '8px', fontWeight: 800, color: '#FFD700', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                  Player of the Tournament
                </div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                  {prediction.mvp}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.25)' }}>
              cricpredict.app
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.25)' }}>
              {new Date(prediction.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* ─── Action Buttons ─── */}
        <div className="flex gap-3">
          <Button
            onClick={() => generateImage('download')}
            disabled={generating}
            className="flex-1 gap-2 bg-white text-black font-bold hover:bg-gray-200"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download
          </Button>
          <Button
            onClick={() => generateImage('share')}
            disabled={generating}
            className="flex-1 gap-2 font-bold"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
