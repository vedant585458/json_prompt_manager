import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { Check } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * Context menu (TASK-004).
 *
 * Opened by right-click, by the keyboard Menu key / Shift+F10, and by long-press
 * on touch — Radix handles all three. It is therefore never the only way to
 * reach an action: rows also expose the same actions in a visible overflow menu.
 */
export const ContextMenu = ContextMenuPrimitive.Root;

/**
 * Trigger with explicit keyboard support.
 *
 * Browsers fire a `contextmenu` event when the user presses Shift+F10 or the
 * dedicated Menu key, but not every engine (and no test environment) does, so
 * the shortcut is handled here and forwarded as a `contextmenu` event anchored
 * to the element's centre.
 */
export function ContextMenuTrigger({
  onKeyDown,
  ...props
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger
      onKeyDown={(event) => {
        onKeyDown?.(event);
        const isKeyboardMenuKey = event.key === 'F10' && event.shiftKey;
        const isContextMenuKey = event.key === 'ContextMenu';
        if (event.defaultPrevented || !(isKeyboardMenuKey || isContextMenuKey)) return;

        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          }),
        );
      }}
      {...props}
    />
  );
}

export function ContextMenuContent({
  className,
  ...props
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        collisionPadding={8}
        className={cn(
          'z-popover min-w-48 rounded-md border border-line bg-surface-1 p-1 shadow-panel',
          'data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

export function ContextMenuItem({
  className,
  destructive = false,
  shortcut,
  ...props
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.Item> & {
  destructive?: boolean;
  shortcut?: string;
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-sm text-ink-secondary outline-none select-none',
        'data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-70',
        destructive && 'text-danger',
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
    </ContextMenuPrimitive.Item>
  );
}

export function ContextMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-xs py-1.5 pr-2 pl-7 text-sm text-ink-secondary outline-none select-none',
        'data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 inline-flex">
        <ContextMenuPrimitive.ItemIndicator>
          <Check aria-hidden="true" size={14} className="text-accent" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator className={cn('my-1 h-px bg-line', className)} {...props} />
  );
}

export function ContextMenuLabel({
  className,
  ...props
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.Label>) {
  return (
    <ContextMenuPrimitive.Label className={cn('metadata-rail px-2 py-1.5', className)} {...props} />
  );
}
