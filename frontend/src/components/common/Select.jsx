import React, { forwardRef } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

const Select = forwardRef(function Select(
  {
    label,
    error,
    helperText,
    options = [],
    className = '',
    containerClassName = '',
    id,
    disabled = false,
    required = false,
    placeholder,
    children,
    ...props
  },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-semibold text-slate-700 flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </span>
        </label>
      )}

      <div className="relative flex items-center">
        <select
          id={selectId}
          ref={ref}
          disabled={disabled}
          className={`w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-9 text-sm text-slate-900 transition-colors
            ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
            }
            ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}
            focus:outline-hidden ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.length > 0
            ? options.map((opt) => (
                <option key={opt.value ?? opt.id ?? opt} value={opt.value ?? opt.id ?? opt}>
                  {opt.label ?? opt.name ?? opt}
                </option>
              ))
            : children}
        </select>

        <div className="absolute right-3 flex items-center pointer-events-none text-slate-400">
          {error ? <AlertCircle className="w-4 h-4 text-rose-500" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {error ? (
        <p className="text-xs text-rose-600 mt-0.5">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Select;
