import React from 'react';
import { SEVERITY_CONFIG, STATUS_CONFIG } from '../../utils/constants';

export default function Badge({
  children,
  variant,
  severity,
  status,
  size = 'sm',
  withDot = false,
  pulse = false,
  className = ''
}) {
  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  if (severity && SEVERITY_CONFIG[severity]) {
    colorClasses = SEVERITY_CONFIG[severity].badgeClass;
    dotColor = SEVERITY_CONFIG[severity].dotClass;
  } else if (status && STATUS_CONFIG[status]) {
    colorClasses = STATUS_CONFIG[status].badgeClass;
    dotColor = STATUS_CONFIG[status].dotClass;
  } else if (variant) {
    const customVariants = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      navy: 'bg-slate-900 text-white border-slate-800',
      indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber: 'bg-amber-50 text-amber-800 border-amber-200',
      rose: 'bg-rose-50 text-rose-700 border-rose-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      neutral: 'bg-slate-100 text-slate-700 border-slate-200'
    };
    colorClasses = customVariants[variant] || colorClasses;
  }

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px] gap-1',
    sm: 'px-2.5 py-0.5 text-xs gap-1.5',
    md: 'px-3 py-1 text-xs font-semibold gap-1.5'
  };

  const displayText =
    children ||
    (severity && SEVERITY_CONFIG[severity]?.label) ||
    (status && STATUS_CONFIG[status]?.label) ||
    '';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shrink-0 transition-colors ${
        sizeClasses[size] || sizeClasses.sm
      } ${colorClasses} ${className}`}
    >
      {(withDot || severity === 'critical' || pulse) && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}
      <span>{displayText}</span>
    </span>
  );
}
