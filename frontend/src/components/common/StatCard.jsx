import React from 'react';
import Card, { CardContent } from './Card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({
  title,
  value,
  trend,
  trendPositive = true,
  subtitle,
  icon: IconComponent,
  iconColor = 'text-blue-600',
  iconBg = 'bg-blue-50',
  className = '',
  onClick
}) {
  return (
    <Card
      onClick={onClick}
      hoverEffect={!!onClick}
      className={`relative border-slate-200/90 ${className}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {title}
            </span>
            <div className="text-2xl font-bold tracking-tight text-slate-900 leading-none pt-1">
              {value}
            </div>
          </div>
          {IconComponent && (
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 ${iconBg} ${iconColor}`}
            >
              <IconComponent className="w-5 h-5" />
            </div>
          )}
        </div>

        {(trend || subtitle) && (
          <div className="mt-3.5 pt-2 border-t border-slate-100 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              {trend && (
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    trendPositive ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {trendPositive ? (
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{trend}</span>
                </span>
              )}
            </div>
            {subtitle && (
              <span className="text-slate-400 text-[11px] leading-tight block">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
