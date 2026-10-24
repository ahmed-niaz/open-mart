import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#163A2B] text-white',
        secondary: 'bg-[#2F855A]/15 text-[#2F855A] border border-[#2F855A]/30',
        success: 'bg-[#267A46]/15 text-[#267A46] border border-[#267A46]/30',
        warning: 'bg-[#B7791F]/15 text-[#B7791F] border border-[#B7791F]/30',
        error: 'bg-[#C53030]/15 text-[#C53030] border border-[#C53030]/30',
        info: 'bg-[#3973AC]/15 text-[#3973AC] border border-[#3973AC]/30',
        outline: 'border border-[#E5E0D5] text-[#252A25] bg-white',
        muted: 'bg-[#E8DFD0] text-[#6B756D]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({
  className,
  variant,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-[#267A46]',
            variant === 'warning' && 'bg-[#B7791F]',
            variant === 'error' && 'bg-[#C53030]',
            variant === 'info' && 'bg-[#3973AC]',
            (!variant || variant === 'default') && 'bg-white',
            variant === 'muted' && 'bg-[#6B756D]',
          )}
        />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case 'delivered':
    case 'completed':
    case 'paid':
    case 'active':
    case 'published':
    case 'healthy':
    case 'in_stock':
      return (
        <Badge variant="success" dot>
          {status}
        </Badge>
      );
    case 'pending':
    case 'processing':
    case 'low_stock':
    case 'refund_pending':
      return (
        <Badge variant="warning" dot>
          {status}
        </Badge>
      );
    case 'cancelled':
    case 'failed':
    case 'refund_failed':
    case 'out_of_stock':
    case 'inactive':
      return (
        <Badge variant="error" dot>
          {status}
        </Badge>
      );
    case 'confirmed':
    case 'shipped':
    case 'in_transit':
    case 'refunded':
      return (
        <Badge variant="info" dot>
          {status}
        </Badge>
      );
    default:
      return <Badge variant="muted">{status}</Badge>;
  }
}
