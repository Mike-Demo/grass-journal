import type { ReactNode } from 'react';
import { href, navigate, type Route } from '../lib/router';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Save-state indicator: Saving / Saved on this device / Save failed. */
export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`save-indicator save-${state}`}
      data-testid="save-indicator"
    >
      {state === 'saving' && <><span className="dot pulse" aria-hidden="true" /> Saving…</>}
      {state === 'saved' && <><span className="dot ok" aria-hidden="true" /> Saved on this device</>}
      {state === 'error' && <><span className="dot bad" aria-hidden="true" /> Save failed — your text is still in the editor</>}
      {state === 'idle' && <><span className="dot" aria-hidden="true" /> Not saved yet</>}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  ariaLabel,
  testId,
  type,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type ?? 'button'}
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

export function NavLink({ to, children }: { to: Route; children: ReactNode }) {
  return (
    <a className="nav-link" href={href(to)} onClick={(e) => { e.preventDefault(); navigate(to); }}>
      {children}
    </a>
  );
}

export function ScreenHeader({ title, backTo }: { title: string; backTo?: Route }) {
  return (
    <header className="screen-header">
      {backTo && (
        <a className="back-link" href={href(backTo)} onClick={(e) => { e.preventDefault(); navigate(backTo); }} aria-label="Back">
          ← Back
        </a>
      )}
      <h1>{title}</h1>
    </header>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      <p>{body}</p>
      {action}
    </div>
  );
}

/** Visually separates original content from AI-generated metadata. */
export function AiBadge({ model }: { model: string }) {
  return (
    <p className="ai-badge" aria-label={`AI-generated content, model ${model}`}>
      <span aria-hidden="true">✦</span> AI-generated · {model} · editable &amp; deletable
    </p>
  );
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
