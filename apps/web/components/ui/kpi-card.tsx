import * as React from 'react';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number; // e.g. +14.2 or -3.5
  changeLabel?: string; // e.g. "vs previous period"
  icon: LucideIcon;
  subtitle?: string;
  className?: string;
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  icon: Icon,
  subtitle,
  className,
}: KpiCardProps) {
  const isPositive = change !== undefined ? change >= 0 : null;

  return (
    <Card className={cn('hover:shadow-md transition-all', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
              {title}
            </p>
            <h3 className="text-2xl font-bold tracking-tight text-[#163A2B]">
              {value}
            </h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#163A2B]/10 text-[#163A2B]">
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {(change !== undefined || subtitle) && (
          <div className="mt-4 flex items-center gap-2 pt-2 border-t border-[#E5E0D5]/50 text-xs">
            {change !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold text-xs',
                  isPositive
                    ? 'bg-[#267A46]/15 text-[#267A46]'
                    : 'bg-[#C53030]/15 text-[#C53030]',
                )}
              >
                {isPositive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(change)}%
              </span>
            )}
            <span className="text-[#6B756D]">{subtitle || changeLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
