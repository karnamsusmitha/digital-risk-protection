import React from 'react';

export default function Card({
  children,
  className = '',
  hoverEffect = false,
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/90 shadow-2xs transition-all overflow-hidden ${
        hoverEffect ? 'hover:border-slate-300 hover:shadow-sm cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  action,
  ...props
}) {
  return (
    <div
      className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 ${className}`}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
  ...props
}) {
  return (
    <h3
      className={`text-base font-semibold text-slate-900 tracking-tight leading-snug ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = '',
  ...props
}) {
  return (
    <p
      className={`text-xs text-slate-500 mt-1 leading-normal ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = '',
  ...props
}) {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className = '',
  ...props
}) {
  return (
    <div
      className={`px-5 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
