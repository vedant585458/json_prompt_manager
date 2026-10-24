import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Tabs (TASK-003).
 *
 * Radix provides arrow-key navigation with a single tab stop, automatic
 * activation, and the `tab`/`tabpanel` relationships. Labels are text, never
 * icon-only, and the active state is marked with an underline as well as color.
 */
export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex items-center gap-1 border-b border-line', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium',
        'text-ink-muted transition-colors duration-[var(--pf-duration-fast)]',
        'hover:text-ink',
        'data-[state=active]:border-accent data-[state=active]:text-ink',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('pt-4 text-sm text-ink-secondary', className)}
      {...props}
    />
  );
}

export interface SimpleTabsProps {
  /** Accessible name for the tab list. */
  label: string;
  defaultValue?: string;
  items: readonly { value: string; label: string; content: ReactNode; disabled?: boolean }[];
  className?: string;
}

/** Convenience wrapper for the common "a few labelled tabs" case (TASK-003). */
export function SimpleTabs({ label, defaultValue, items, className }: SimpleTabsProps) {
  return (
    <Tabs defaultValue={defaultValue ?? items[0]?.value} className={className}>
      <TabsList aria-label={label}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value}>
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
