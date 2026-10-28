import type { Tone } from '../../api/types';
import { Icon } from '../Icon';

interface BadgeProps {
  tone: Tone;
  label: string;
  icon?: string;
  id?: string;
  hidden?: boolean;
}

export function Badge({ tone, label, icon, id, hidden }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`} id={id} hidden={hidden}>
      {icon ? <Icon name={icon} /> : null}
      <span>{label}</span>
    </span>
  );
}
