import React from 'react';
import type { PriorityLevel } from '../../types';
import { PRIORITY_METADATA } from '../../constants';
import { Badge } from '../ui/Badge';
import { AlertCircle, AlertTriangle, Info, Clock } from 'lucide-react';

interface PriorityIndicatorProps {
  priority: PriorityLevel;
  score?: number;
  className?: string;
}

export const PriorityIndicator: React.FC<PriorityIndicatorProps> = ({
  priority,
  score,
  className,
}) => {
  const meta = PRIORITY_METADATA[priority] || PRIORITY_METADATA.low;

  const icons: Record<PriorityLevel, React.ReactNode> = {
    critical: <AlertCircle className="h-3.5 w-3.5 text-red-600" />,
    high: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
    medium: <Clock className="h-3.5 w-3.5 text-blue-600" />,
    low: <Info className="h-3.5 w-3.5 text-slate-500" />,
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Badge variant={meta.badgeVariant} className={className}>
        <span className="inline-flex mr-1">{icons[priority]}</span>
        {meta.label}
        {typeof score === 'number' && (
          <span className="ml-1 opacity-75 font-mono text-[10px]">({score.toFixed(0)})</span>
        )}
      </Badge>
    </div>
  );
};
