import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#214D3A] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-[#163A2B] text-white shadow-sm hover:bg-[#214D3A] active:bg-[#112a20]',
        secondary:
          'bg-[#2F855A] text-white shadow-sm hover:bg-[#276749] active:bg-[#1e4e37]',
        outline:
          'border border-[#E5E0D5] bg-white text-[#252A25] shadow-xs hover:bg-[#FAF7F0] hover:text-[#163A2B]',
        ghost: 'text-[#252A25] hover:bg-[#E8DFD0]/50 hover:text-[#163A2B]',
        destructive:
          'bg-[#C53030] text-white shadow-sm hover:bg-[#9B2C2C] active:bg-[#742A2A]',
        surface: 'bg-[#E8DFD0] text-[#252A25] hover:bg-[#ded1bd]',
      },
      size: {
        sm: 'h-8 px-4 text-xs rounded-full',
        md: 'h-10 px-5 py-2 text-sm rounded-full',
        lg: 'h-11 px-7 text-base rounded-full',
        icon: 'h-9 w-9 p-0 rounded-full',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: true, // Default to full width per directive, easily overridden with fullWidth={false}
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!loading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
