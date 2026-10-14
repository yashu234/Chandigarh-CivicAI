import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'sky' | 'outline' | 'danger' | 'ghost' | 'gold';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-lg cursor-pointer';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'btn-gradient-navy text-white focus-visible:ring-slate-700 shadow-sm',
      sky:
        'btn-gradient-sky text-white focus-visible:ring-sky-500 shadow-sm',
      secondary:
        'bg-sky-500 text-white hover:bg-sky-600 focus-visible:ring-sky-500 shadow-sm active:bg-sky-700 transition-colors',
      outline:
        'border-2 border-slate-200 bg-white text-slate-800 hover:border-sky-400 hover:text-sky-700 focus-visible:ring-sky-400 shadow-sm active:bg-slate-50 transition-colors',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600 shadow-sm active:bg-rose-800 transition-colors',
      ghost:
        'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400 transition-colors',
      gold:
        'bg-amber-500 text-slate-950 hover:bg-amber-400 focus-visible:ring-amber-400 shadow-sm font-bold transition-colors',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      xs: 'text-[11px] px-2.5 py-1 gap-1 rounded-md',
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-6 py-2.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
