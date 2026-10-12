import React from 'react';

export function TableContainer({ children, className = '' }) {
  return (
    <div
      className={`w-full overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs ${className}`}
    >
      {children}
    </div>
  );
}

export function Table({ children, className = '', ...props }) {
  return (
    <table className={`w-full text-left border-collapse text-sm ${className}`} {...props}>
      {children}
    </table>
  );
}

export function TableHeader({ children, className = '', ...props }) {
  return (
    <thead
      className={`bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '', ...props }) {
  return (
    <tbody className={`divide-y divide-slate-100 text-slate-700 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', isSelected = false, hover = true, ...props }) {
  return (
    <tr
      className={`transition-colors ${
        hover ? 'hover:bg-slate-50/70' : ''
      } ${isSelected ? 'bg-blue-50/50' : ''} ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '', ...props }) {
  return (
    <th className={`px-4 py-3.5 text-xs font-semibold text-slate-600 ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '', ...props }) {
  return (
    <td className={`px-4 py-3.5 align-middle text-sm ${className}`} {...props}>
      {children}
    </td>
  );
}

export default Table;
