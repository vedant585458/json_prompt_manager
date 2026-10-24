import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Dropdown menu (TASK-004).
 *
 * Radix provides the menu button semantics, roving focus, typeahead, Escape
 * handling, and focus restore. Items are real `menuitem` roles, so they are
 * reachable with the keyboard and by touch — no hover-only affordances.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentPropsWithRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          'z-popover min-w-48 rounded-md border border-line bg-surface-1 p-1 shadow-panel',
          'data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive = false,
  shortcut,
  ...props
}: ComponentPropsWithRef<typeof DropdownMenuPrimitive.Item> & {
  destructive?: boolean;
  /** Purely a hint; the real binding is registered by the shortcut system. */
  shortcut?: string;
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-sm outline-none select-none',
        'data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destructive ? 'text-danger data-[highlighted]:text-danger' : 'text-ink-secondary',
        className,
      )}
      {...props}
    >
      {props.children}
      {shortcut ? (
        <span aria-hidden="true" className="ml-auto font-mono text-2xs text-ink-muted">
          {shortcut}
        </span>
      ) : null}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentPropsWithRef<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-xs py-1.5 pr-2 pl-7 text-sm text-ink-secondary outline-none select-none',
        'data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 inline-flex">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check aria-hidden="true" size={14} className="text-accent" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithRef<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator className={cn('my-1 h-px bg-line', className)} {...props} />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentPropsWithRef<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('metadata-rail px-2 py-1.5', className)}
      {...props}
    />
  );
}

export function DropdownMenuSubTriggerIcon() {
  return <ChevronRight aria-hidden="true" size={14} className="ml-auto text-ink-muted" />;
}

/** Convenience item list for actions that are mostly label + handler pairs. */
export function DropdownMenuActions({
  actions,
}: {
  actions: readonly {
    id: string;
    label: string;
    onSelect: () => void;
    destructive?: boolean;
    disabled?: boolean;
    shortcut?: string;
    icon?: ReactNode;
  }[];
}) {
  return (
    <>
      {actions.map((action) => (
        <DropdownMenuItem
          key={action.id}
          destructive={action.destructive}
          disabled={action.disabled}
          shortcut={action.shortcut}
          onSelect={action.onSelect}
        >
          {action.icon ? (
            <span aria-hidden="true" className="inline-flex text-ink-muted">
              {action.icon}
            </span>
          ) : null}
          {action.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}
