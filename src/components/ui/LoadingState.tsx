import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface LoadingStateProps {
  message?: string;
  subtext?: string;
  className?: string;
  minHeight?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading civic records...',
  subtext,
  className,
  minHeight = 'min-h-[240px]',
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 rounded-lg border border-slate-200 bg-white/50',
        minHeight,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 text-blue-700 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-800">{message}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1 max-w-sm">{subtext}</p>}
    </div>
  );
};
