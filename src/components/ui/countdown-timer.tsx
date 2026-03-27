'use client';

import { useEffect, useState } from 'react';
import { Clock, Lock, Unlock } from 'lucide-react';

interface Props {
  deadline: string; // ISO datetime
  isLocked: boolean;
  forceLocked?: boolean;
}

function getTimeLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

export default function CountdownTimer({ deadline, isLocked, forceLocked }: Props) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(deadline));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(deadline));
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const { days, hours, minutes, seconds, expired } = timeLeft;

  const isOpen = !isLocked;
  const statusColor = isOpen ? 'var(--success)' : 'var(--error)';
  const statusBg = isOpen
    ? 'linear-gradient(135deg, rgba(46,204,113,0.08), rgba(46,204,113,0.02))'
    : 'linear-gradient(135deg, rgba(233,69,96,0.08), rgba(233,69,96,0.02))';
  const statusBorder = isOpen
    ? 'rgba(46, 204, 113, 0.2)'
    : 'rgba(233, 69, 96, 0.2)';

  const TimeBox = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div
        className="w-11 h-11 sm:w-13 sm:h-13 rounded-lg flex items-center justify-center text-lg sm:text-xl font-black tabular-nums"
        style={{
          background: 'var(--bg-primary)',
          color: isOpen ? 'var(--text-primary)' : 'var(--error)',
          border: `1px solid ${statusBorder}`,
        }}
      >
        {String(value).padStart(2, '0')}
      </div>
      <span className="text-[9px] mt-1 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );

  const Colon = () => (
    <span className="text-base font-bold pb-4" style={{ color: statusColor, opacity: 0.5 }}>:</span>
  );

  return (
    <div
      className="rounded-xl p-4 transition-all duration-300"
      style={{
        background: statusBg,
        border: `1px solid ${statusBorder}`,
      }}
    >
      {/* Top row: Status + deadline */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
            }}
          />
          {isLocked ? (
            <Lock size={12} style={{ color: 'var(--error)' }} />
          ) : (
            <Unlock size={12} style={{ color: 'var(--success)' }} />
          )}
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: statusColor }}
          >
            {forceLocked
              ? 'Locked by Admin'
              : expired
              ? 'Predictions Closed'
              : 'Predictions Open'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={11} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {new Date(deadline).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Countdown boxes */}
      {!forceLocked && !expired && (
        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
          {days > 0 && (
            <>
              <TimeBox value={days} label="days" />
              <Colon />
            </>
          )}
          <TimeBox value={hours} label="hrs" />
          <Colon />
          <TimeBox value={minutes} label="min" />
          <Colon />
          <TimeBox value={seconds} label="sec" />
        </div>
      )}

      {/* Messaging */}
      {isOpen && !expired && (
        <p className="text-center text-[10px] mt-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
          You can edit your prediction anytime before the deadline
        </p>
      )}
      {expired && !forceLocked && (
        <p className="text-center text-[10px] mt-2 font-medium" style={{ color: 'var(--error)', opacity: 0.8 }}>
          The deadline has passed. Predictions are now locked.
        </p>
      )}
    </div>
  );
}
