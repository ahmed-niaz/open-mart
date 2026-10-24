'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}: ModalProps) {
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

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#252A25]/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Dialog box */}
      <div
        className={cn(
          'relative z-10 w-full rounded-2xl border border-[#E5E0D5] bg-white p-6 shadow-xl transition-all animate-in zoom-in-95',
          maxWidthClasses,
        )}
      >
        <div className="flex items-start justify-between pb-4 border-b border-[#E5E0D5]/70">
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
            className="rounded-full p-1.5 text-[#6B756D] hover:bg-neutral-100 hover:text-[#163A2B] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-4 max-h-[75vh] overflow-y-auto">{children}</div>

        {footer && (
          <div className="pt-4 border-t border-[#E5E0D5]/70 flex flex-col sm:flex-row items-center gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
