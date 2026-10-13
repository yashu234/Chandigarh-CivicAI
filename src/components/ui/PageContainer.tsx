import React from 'react';
import { cn } from '../../utils/cn';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  headerTitle?: string;
  headerDescription?: string;
  headerAction?: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className,
  maxWidth = 'xl',
  headerTitle,
  headerDescription,
  headerAction,
  ...props
}) => {
  const maxWidths = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-7xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };

  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8 py-8', maxWidths[maxWidth], className)} {...props}>
      {(headerTitle || headerAction) && (
        <div className="mb-8 border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {headerTitle && (
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {headerTitle}
              </h1>
            )}
            {headerDescription && (
              <p className="mt-1.5 text-sm text-slate-600">
                {headerDescription}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0 flex items-center gap-3">{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
