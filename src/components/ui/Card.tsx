import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'accent' | 'navy' | 'glass' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  lift?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  padding = 'md',
  lift = false,
  ...props
}) => {
  const baseStyles = 'rounded-xl border transition-all duration-200';

  const variants = {
    default:  'bg-white border-slate-200 shadow-sm',
    muted:    'bg-slate-50 border-slate-200',
    accent:   'bg-sky-50/50 border-sky-200/60 shadow-sm',
    navy:     'bg-[#0a1628] border-[#1a3d70] text-white',
    glass:    'glass border-white/10',
    bordered: 'bg-white border-slate-300',
  };

  const paddings = {
    none: '',
    sm:   'p-4',
    md:   'p-5',
    lg:   'p-6 sm:p-8',
  };

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        paddings[padding],
        lift && 'card-lift',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-5',
        className
      )}
      {...props}
    >
      <div>
        {title && (
          <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
        )}
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
