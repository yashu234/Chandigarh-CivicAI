import React from 'react';
import type { EvidenceSupportLevel } from '../../types';
import { EVIDENCE_SUPPORT_METADATA } from '../../constants';
import { Badge } from '../ui/Badge';
import { ShieldCheck, ShieldAlert, Shield, ShieldX } from 'lucide-react';

interface EvidenceSupportBadgeProps {
  level: EvidenceSupportLevel;
  showIcon?: boolean;
  className?: string;
}

export const EvidenceSupportBadge: React.FC<EvidenceSupportBadgeProps> = ({
  level,
  showIcon = true,
  className,
}) => {
  const meta = EVIDENCE_SUPPORT_METADATA[level] || EVIDENCE_SUPPORT_METADATA.unsupported;

  const iconMap: Record<EvidenceSupportLevel, React.ReactNode> = {
    strong: <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />,
    moderate: <Shield className="h-3.5 w-3.5 text-amber-600" />,
    weak: <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />,
    unsupported: <ShieldX className="h-3.5 w-3.5 text-rose-600" />,
  };

  return (
    <span className="inline-flex items-center gap-1.5" title={meta.description}>
      <Badge variant={meta.badgeVariant} className={className}>
        {showIcon && <span className="inline-flex mr-1">{iconMap[level]}</span>}
        {meta.label}
      </Badge>
    </span>
  );
};
