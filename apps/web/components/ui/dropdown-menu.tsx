'use client';

import * as React from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropdownAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export interface DropdownMenuProps {
  actions: DropdownAction[];
  trigger?: React.ReactNode;
  align?: 'left' | 'right';
}

export function DropdownMenu({
  actions,
  trigger,
  align = 'right',
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <div onClick={() => setIsOpen((prev) => !prev)}>
        {trigger || (
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[#6B756D] hover:border-[#E5E0D5] hover:bg-[#FAF7F0] hover:text-[#163A2B] transition-colors cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-30 mt-1 min-w-[160px] rounded-xl border border-[#E5E0D5] bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {actions.map((action, index) => (
            <button
              key={index}
              disabled={action.disabled}
              onClick={() => {
                setIsOpen(false);
                action.onClick();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-40 text-left',
                action.variant === 'destructive'
                  ? 'text-[#C53030] hover:bg-[#C53030]/10'
                  : 'text-[#252A25] hover:bg-[#FAF7F0] hover:text-[#163A2B]',
              )}
            >
              {action.icon && (
                <span className="h-3.5 w-3.5">{action.icon}</span>
              )}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
