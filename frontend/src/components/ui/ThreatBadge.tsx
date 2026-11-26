import { THREAT_LEVEL_CONFIG } from '../../utils/constants';
import type { ThreatLevel } from '../../types';

interface ThreatBadgeProps {
  level: string;
}

export function ThreatBadge({ level }: ThreatBadgeProps) {
  const normalized = (level?.toLowerCase() || 'normal') as ThreatLevel;
  const cfg = THREAT_LEVEL_CONFIG[normalized] || THREAT_LEVEL_CONFIG.normal;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}
