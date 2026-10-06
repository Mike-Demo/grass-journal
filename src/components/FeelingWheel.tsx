import { useState } from 'react';
import type { CSSProperties } from 'react';

export interface FeelingDef {
  emoji: string;
  label: string;
  c1: string;
  c2: string;
}

export const FEELINGS: FeelingDef[] = [
  { emoji: '😊', label: 'Joyful', c1: '#ffcf5c', c2: '#ff8a3d' },
  { emoji: '😌', label: 'Calm', c1: '#8fd694', c2: '#3fa46a' },
  { emoji: '🌟', label: 'Hopeful', c1: '#ffe97a', c2: '#ffb63d' },
  { emoji: '🙏', label: 'Grateful', c1: '#d1a6ff', c2: '#9a6ee8' },
  { emoji: '😴', label: 'Tired', c1: '#b0a89c', c2: '#7d766a' },
  { emoji: '😢', label: 'Sad', c1: '#7ec8f7', c2: '#5a7de0' },
  { emoji: '😟', label: 'Anxious', c1: '#ffab7a', c2: '#e86a6a' },
  { emoji: '😠', label: 'Angry', c1: '#ff7a6b', c2: '#d63d3d' },
];

/**
 * Feeling wheel — the same check-in as /watch/, reimplemented for React.
 * The standalone /watch/ page must stay zero-framework, so the two mirror
 * each other's behavior instead of sharing code. Tap-only: on watchOS the
 * web viewer's long-press opens a new tab, so press-and-hold is unusable.
 */
export default function FeelingWheel({
  onPick,
  disabled,
}: {
  onPick: (index: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [status, setStatus] = useState('How are you feeling?');

  const openWheel = () => {
    setClosing(false);
    setOpen(true);
    setStatus('Choose a feeling');
  };
  const closeWheel = () => {
    setOpen(false);
    setClosing(true);
    setPicked(null);
    setStatus('How are you feeling?');
    window.setTimeout(() => setClosing(false), 450);
  };
  const toggle = () => {
    if (disabled) return;
    if (open) closeWheel();
    else openWheel();
  };
  const pick = (i: number) => {
    if (disabled || picked !== null || !open) return;
    setPicked(i);
    setStatus(`${FEELINGS[i].emoji} ${FEELINGS[i].label}`);
    // Pulse first, then hand the save to the parent and close — same beat as /watch/.
    window.setTimeout(() => {
      onPick(i);
      closeWheel();
    }, 280);
  };

  return (
    <>
      <p className="fw-status" aria-live="polite">
        {status}
      </p>
      <div
        className={`fw-wheel${open ? ' open' : ''}${closing ? ' closing' : ''}`}
        role="group"
        aria-label="Feeling wheel"
      >
        <button
          className="fw-hub"
          onClick={toggle}
          aria-label="Check in: tap to open the feeling wheel"
          data-testid="compact-wheel-hub"
        >
          💭
        </button>
        {FEELINGS.map((f, i) => (
          <button
            key={f.label}
            className={`fw-orb${picked === i ? ' pick' : ''}`}
            style={{ '--a': `${i * 45}deg`, '--i': i, '--c1': f.c1, '--c2': f.c2 } as CSSProperties}
            onClick={() => pick(i)}
            aria-label={`I feel ${f.label}`}
            tabIndex={open ? 0 : -1}
          >
            {f.emoji}
          </button>
        ))}
      </div>
    </>
  );
}
