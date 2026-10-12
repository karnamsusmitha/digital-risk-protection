import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import Button from '../common/Button';

export default function LogoUploader({
  value,
  onChange,
  error,
  disabled = false
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, SVG, WebP).');
      return;
    }

    // Convert file to base64 data URL for preview and local persistence
    const reader = new FileReader();
    reader.onload = (event) => {
      onChange(event.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
        <span>Official Brand Logo</span>
        <span className="text-[11px] text-slate-400 font-normal">
          Upload file or paste image URL
        </span>
      </label>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
        {/* Preview Frame */}
        <div className="relative w-20 h-20 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center overflow-hidden shrink-0 group">
          {value ? (
            <>
              <img
                src={value}
                alt="Brand Logo Preview"
                className="w-full h-full object-contain p-1.5"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                  title="Remove logo"
                  aria-label="Remove logo"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300">
              <ImageIcon className="w-7 h-7 mb-1" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                No Logo
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-2 min-w-0 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/svg+xml, image/webp"
              className="hidden"
              disabled={disabled}
            />

            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              leftIcon={Upload}
            >
              Choose Image File
            </Button>

            {value && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleRemove}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                Remove
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">or URL:</span>
            <input
              type="url"
              placeholder="https://example.com/logo.png"
              value={value && value.startsWith('http') ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="flex-1 text-xs px-2.5 py-1 rounded-md border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <p className="text-[10px] text-slate-400">
            Recommended: Transparent PNG or SVG on square ratio (min 200x200px).
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 mt-0.5">{error}</p>}
    </div>
  );
}
