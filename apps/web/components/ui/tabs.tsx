'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-full border border-[#E5E0D5] bg-[#F4F2EE]/60 p-1 text-xs font-semibold text-[#6B756D]',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-1.5 transition-all cursor-pointer select-none',
              isActive
                ? 'bg-[#163A2B] text-white shadow-xs font-bold'
                : 'hover:text-[#163A2B] hover:bg-white/80',
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[#E8DFD0] text-[#252A25]',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
