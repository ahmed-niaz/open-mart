'use client';

import * as React from 'react';
import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { cn } from '@/lib/utils';

type DrawerDirection = 'top' | 'bottom' | 'left' | 'right';

interface DrawerContextValue {
  direction: DrawerDirection;
}

const DrawerContext = React.createContext<DrawerContextValue>({
  direction: 'bottom',
});

const swipeDirectionMap: Record<
  DrawerDirection,
  'up' | 'down' | 'left' | 'right'
> = {
  top: 'up',
  bottom: 'down',
  left: 'left',
  right: 'right',
};

export type DrawerProps = React.ComponentProps<typeof DrawerPrimitive.Root> & {
  direction?: DrawerDirection;
};

/**
 * Shadcn Base UI Drawer root with directional swipe-to-dismiss support.
 */
function Drawer({
  direction = 'bottom',
  swipeDirection,
  ...props
}: DrawerProps) {
  return (
    <DrawerContext.Provider value={{ direction }}>
      <DrawerPrimitive.Root
        swipeDirection={swipeDirection ?? swipeDirectionMap[direction]}
        {...props}
      />
    </DrawerContext.Provider>
  );
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Backdrop>) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        'fixed inset-0 z-50 min-h-dvh bg-black/55 backdrop-blur-[1px] transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute',
        className,
      )}
      {...props}
    />
  );
}

function DrawerViewport({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Viewport>) {
  const { direction } = React.useContext(DrawerContext);

  const alignmentClass = {
    left: 'items-stretch justify-start',
    right: 'items-stretch justify-end',
    top: 'items-start justify-stretch',
    bottom: 'items-end justify-stretch',
  }[direction];

  return (
    <DrawerPrimitive.Viewport
      data-slot="drawer-viewport"
      className={cn('fixed inset-0 z-50 flex', alignmentClass, className)}
      {...props}
    />
  );
}

function DrawerSwipeHandle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="drawer-swipe-handle"
      aria-hidden="true"
      className={cn(
        'mx-auto mt-3 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-[#E5E0D5]',
        className,
      )}
      {...props}
    />
  );
}

export interface DrawerContentProps extends React.ComponentProps<
  typeof DrawerPrimitive.Popup
> {
  showHandle?: boolean;
  overlayClassName?: string;
  viewportClassName?: string;
  contentClassName?: string;
}

function DrawerContent({
  className,
  children,
  showHandle,
  overlayClassName,
  viewportClassName,
  contentClassName,
  ...props
}: DrawerContentProps) {
  const { direction } = React.useContext(DrawerContext);

  const directionClasses: Record<DrawerDirection, string> = {
    left: [
      'h-dvh w-[86vw] max-w-[365px] border-r border-[#E5E0D5]',
      '[transform:translateX(var(--drawer-swipe-movement-x))]',
      'data-starting-style:-translate-x-full data-ending-style:-translate-x-full',
    ].join(' '),
    right: [
      'h-dvh w-[86vw] max-w-[365px] border-l border-[#E5E0D5]',
      '[transform:translateX(var(--drawer-swipe-movement-x))]',
      'data-starting-style:translate-x-full data-ending-style:translate-x-full',
    ].join(' '),
    bottom: [
      'max-h-[calc(100dvh-4rem)] w-full rounded-t-2xl border-t border-[#E5E0D5]',
      '[transform:translateY(var(--drawer-swipe-movement-y))]',
      'data-starting-style:translate-y-full data-ending-style:translate-y-full',
    ].join(' '),
    top: [
      'max-h-[calc(100dvh-4rem)] w-full rounded-b-2xl border-b border-[#E5E0D5]',
      '[transform:translateY(var(--drawer-swipe-movement-y))]',
      'data-starting-style:-translate-y-full data-ending-style:-translate-y-full',
    ].join(' '),
  };

  const shouldShowHandle =
    showHandle ?? (direction === 'bottom' || direction === 'top');

  return (
    <DrawerPortal>
      <DrawerOverlay className={overlayClassName} />
      <DrawerViewport className={viewportClassName}>
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          data-direction={direction}
          className={cn(
            'relative z-50 flex flex-col bg-white text-[#252A25] shadow-2xl outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-swiping:duration-0',
            directionClasses[direction],
            className,
          )}
          {...props}
        >
          {shouldShowHandle && direction === 'bottom' && <DrawerSwipeHandle />}
          <DrawerPrimitive.Content
            className={cn('flex min-h-0 flex-1 flex-col', contentClassName)}
          >
            {children}
          </DrawerPrimitive.Content>
          {shouldShowHandle && direction === 'top' && <DrawerSwipeHandle />}
        </DrawerPrimitive.Popup>
      </DrawerViewport>
    </DrawerPortal>
  );
}

function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="drawer-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  );
}

function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn('text-base font-semibold text-[#252A25]', className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn('text-sm text-[#6B756D]', className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerViewport,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerSwipeHandle,
};
