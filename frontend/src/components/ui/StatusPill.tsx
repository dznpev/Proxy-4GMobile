import type { Tone } from '../../api/types';

interface StatusPillProps {
  tone: Tone;
  label: string;
}

export function StatusPill({ tone, label }: StatusPillProps) {
  return (
    <span className={`status-pill status-${tone}`} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
