import React from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10'
  };

  return (
    <Loader2
      className={`animate-spin text-blue-600 ${sizeClasses[size] || sizeClasses.md} ${className}`}
    />
  );
}

export function Skeleton({ className = '', variant = 'text' }) {
  const variantClasses = {
    text: 'h-4 w-full rounded-md',
    circle: 'rounded-full',
    rect: 'rounded-lg'
  };

  return (
    <div
      className={`animate-pulse bg-slate-200/80 ${
        variantClasses[variant] || ''
      } ${className}`}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-4 py-2">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              className={`h-4 ${cIdx === 0 ? 'w-1/4' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-28" />
        <Skeleton variant="circle" className="w-8 h-8" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

export default function LoadingState({
  message = 'Loading telemetry & risk data...',
  className = ''
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center rounded-xl bg-white border border-slate-200/80 ${className}`}
    >
      <Spinner size="lg" className="mb-3" />
      <p className="text-sm font-medium text-slate-700">{message}</p>
      <p className="text-xs text-slate-400 mt-1">Synchronizing with threat feeds</p>
    </div>
  );
}
