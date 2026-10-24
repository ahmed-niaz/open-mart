'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl' | '2xl';
}

export function SlideOver({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'lg',
}: SlideOverProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[width];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#252A25]/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          className={cn(
            'relative w-screen border-l border-[#E5E0D5] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200',
            widthClasses,
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-[#E5E0D5]/70 bg-[#F8F9FA]">
            <div>
              {title && (
                <h3 className="text-lg font-bold text-[#163A2B]">{title}</h3>
              )}
              {description && (
                <p className="mt-1 text-xs text-[#6B756D]">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-[#6B756D] hover:bg-white hover:text-[#163A2B] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-[#E5E0D5]/70 bg-[#FAF7F0]/40 flex flex-col gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
