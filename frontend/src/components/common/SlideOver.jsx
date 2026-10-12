import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function SlideOver({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-2xl',
  className = ''
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={`w-screen ${width} bg-white shadow-2xl border-l border-slate-200 flex flex-col z-10 transition-transform ${className}`}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200/90 flex items-center justify-between bg-slate-50/50">
            <div className="min-w-0 pr-4">
              <h2 className="text-base font-semibold text-slate-900 leading-snug truncate">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-slate-200/90 bg-slate-50/70 flex items-center justify-between gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
