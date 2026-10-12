import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    startIcon: StartIcon,
    endIcon: EndIcon,
    className = '',
    containerClassName = '',
    id,
    disabled = false,
    required = false,
    ...props
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-slate-700 flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </span>
        </label>
      )}

      <div className="relative flex items-center">
        {StartIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
            <StartIcon className="w-4 h-4" />
          </div>
        )}

        <input
          id={inputId}
          ref={ref}
          disabled={disabled}
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors
            ${StartIcon ? 'pl-9' : ''}
            ${EndIcon || error ? 'pr-9' : ''}
            ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
            }
            ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}
            focus:outline-hidden ${className}`}
          {...props}
        />

        {error && (
          <div className="absolute right-3 flex items-center pointer-events-none text-rose-500">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}

        {!error && EndIcon && (
          <div className="absolute right-3 flex items-center pointer-events-none text-slate-400">
            <EndIcon className="w-4 h-4" />
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-rose-600 flex items-center gap-1 mt-0.5">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Input;
