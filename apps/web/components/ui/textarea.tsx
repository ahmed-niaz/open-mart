import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]"
          >
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#252A25] placeholder:text-[#6B756D]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#214D3A] focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-[#C53030] focus-visible:ring-[#C53030]',
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-[#C53030] mt-0.5">{error}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
