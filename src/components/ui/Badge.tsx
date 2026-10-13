import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral' | 'critical' | 'high' | 'medium' | 'low';
  size?: 'sm' | 'md';
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
  const baseStyles = 'inline-flex items-center font-medium rounded-full tracking-wide';

  const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
    primary: 'bg-blue-50 text-blue-800 border border-blue-200',
    secondary: 'bg-slate-100 text-slate-800 border border-slate-300',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
    critical: 'bg-red-100 text-red-900 border border-red-300 font-semibold',
    high: 'bg-amber-100 text-amber-900 border border-amber-300 font-medium',
    medium: 'bg-blue-100 text-blue-900 border border-blue-300 font-medium',
    low: 'bg-slate-100 text-slate-800 border border-slate-300',
  };

  const dotColors: Record<NonNullable<BadgeProps['variant']>, string> = {
    primary: 'bg-blue-600',
    secondary: 'bg-slate-600',
    success: 'bg-emerald-600',
    warning: 'bg-amber-600',
    danger: 'bg-rose-600',
    neutral: 'bg-slate-400',
    critical: 'bg-red-600 animate-pulse',
    high: 'bg-amber-600',
    medium: 'bg-blue-600',
    low: 'bg-slate-500',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColors[variant])} />}
      <span>{children}</span>
    </span>
  );
};
