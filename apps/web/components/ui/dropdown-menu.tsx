'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
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
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({});

  const triggerRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedHeight = actions.length * 38 + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp =
      spaceBelow < estimatedHeight + 10 && rect.top > estimatedHeight;

    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
    };

    if (openUp) {
      style.bottom = `${Math.max(8, window.innerHeight - rect.top + 4)}px`;
    } else {
      style.top = `${rect.bottom + 4}px`;
    }

    if (align === 'right') {
      style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    } else {
      style.left = `${Math.max(8, rect.left)}px`;
    }

    setMenuStyle(style);
  }, [actions.length, align]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  React.useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleScrollOrResize = () => {
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  const menuContent = (
    <div
      ref={menuRef}
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'min-w-[170px] rounded-xl border border-[#E5E0D5] bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95',
      )}
    >
      {actions.map((action, index) => (
        <button
          key={index}
          type="button"
          disabled={action.disabled}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
            action.onClick();
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-40 text-left',
            action.variant === 'destructive'
              ? 'text-[#C53030] hover:bg-[#C53030]/10'
              : 'text-[#252A25] hover:bg-[#FAF7F0] hover:text-[#163A2B]',
          )}
        >
          {action.icon && (
            <span className="h-4 w-4 shrink-0 flex items-center justify-center">
              {action.icon}
            </span>
          )}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative inline-block text-left" ref={triggerRef}>
      <div onClick={toggleOpen}>
        {trigger || (
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[#6B756D] hover:border-[#E5E0D5] hover:bg-[#FAF7F0] hover:text-[#163A2B] transition-colors cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      {mounted && isOpen && createPortal(menuContent, document.body)}
    </div>
  );
}
