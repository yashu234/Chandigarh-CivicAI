import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
    | 'neutral' | 'critical' | 'high' | 'medium' | 'low' | 'sky' | 'gold';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'neutral',
  size = 'md',
  dot = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full tracking-wide';

  const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
    primary:   'bg-sky-100 text-sky-800 border border-sky-200',
    secondary: 'bg-slate-100 text-slate-700 border border-slate-200',
    success:   'bg-emerald-100 text-emerald-800 border border-emerald-200',
    warning:   'bg-amber-100 text-amber-800 border border-amber-300',
    danger:    'bg-rose-100 text-rose-800 border border-rose-200',
    neutral:   'bg-slate-100 text-slate-600 border border-slate-200',
    critical:  'bg-rose-100 text-rose-900 border border-rose-300 font-bold',
    high:      'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
    medium:    'bg-sky-100 text-sky-900 border border-sky-300 font-semibold',
    low:       'bg-slate-100 text-slate-700 border border-slate-200',
    sky:       'bg-sky-500 text-white border border-sky-400',
    gold:      'bg-amber-400 text-slate-950 border border-amber-500 font-bold',
  };

  const dotColors: Record<NonNullable<BadgeProps['variant']>, string> = {
    primary:   'bg-sky-600',
    secondary: 'bg-slate-500',
    success:   'bg-emerald-600',
    warning:   'bg-amber-600',
    danger:    'bg-rose-600',
    neutral:   'bg-slate-400',
    critical:  'bg-rose-600 animate-pulse',
    high:      'bg-amber-600',
    medium:    'bg-sky-500',
    low:       'bg-slate-400',
    sky:       'bg-white',
    gold:      'bg-slate-900',
  };

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColors[variant])} />
      )}
      <span>{children}</span>
    </span>
  );
};
