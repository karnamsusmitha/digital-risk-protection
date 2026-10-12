import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X, RefreshCw } from 'lucide-react';
import Button from './Button';

export default function ErrorMessage({
  title,
  message,
  variant = 'error',
  onDismiss,
  className = ''
}) {
  const configs = {
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      icon: AlertCircle,
      iconColor: 'text-rose-500'
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: AlertTriangle,
      iconColor: 'text-amber-500'
    },
    info: {
      bg: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: Info,
      iconColor: 'text-blue-500'
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: CheckCircle,
      iconColor: 'text-emerald-500'
    }
  };

  const { bg, icon: IconComponent, iconColor } = configs[variant] || configs.error;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition-all ${bg} ${className}`}
      role="alert"
    >
      <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold mb-0.5 leading-snug">{title}</h4>}
        <p className="text-xs leading-relaxed opacity-90">{message || 'An unexpected error occurred.'}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          aria-label="Dismiss message"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Failed to load telemetry',
  message = 'There was an issue retrieving the latest security findings. Please try again.',
  onRetry,
  className = ''
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center rounded-xl bg-white border border-rose-100 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-500">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mb-5 leading-normal">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={RefreshCw}>
          Retry Connection
        </Button>
      )}
    </div>
  );
}
