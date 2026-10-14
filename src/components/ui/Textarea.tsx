import React from 'react';
import { cn } from '../../utils/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ id, label, error, helperText, className, disabled, required, rows = 4, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5"
          >
            {label}{' '}
            {required && <span className="text-rose-500 font-bold normal-case">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${textareaId}-error` : helperText ? `${textareaId}-desc` : undefined
          }
          className={cn(
            'block w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 resize-y',
            'transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-3 focus:ring-sky-500/15',
            'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
            error
              ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-500/15'
              : '',
            className
          )}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="mt-1.5 text-xs text-rose-600 font-medium">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${textareaId}-desc`} className="mt-1.5 text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
