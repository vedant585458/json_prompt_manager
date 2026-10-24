/**
 * Design-system primitives (TASK-003).
 *
 * These components know nothing about prompts, storage, or routing. They are
 * the vocabulary every later screen composes; adding a new primitive here means
 * every surface can use it consistently.
 */

export { Button, type ButtonProps } from '@/components/ui/Button';
export { buttonVariants } from '@/components/ui/buttonVariants';
export { IconButton, type IconButtonProps } from '@/components/ui/IconButton';
export { Spinner } from '@/components/ui/Spinner';
export { Field, type FieldControlProps, type FieldProps } from '@/components/ui/Field';
export { fieldMessageVariants } from '@/components/ui/fieldVariants';
export { Input, type InputProps } from '@/components/ui/Input';
export { Textarea, type TextareaProps } from '@/components/ui/Textarea';
export { Select, type SelectProps, type SelectOption } from '@/components/ui/Select';
export { Checkbox, type CheckboxProps } from '@/components/ui/Checkbox';
export { Switch, type SwitchProps } from '@/components/ui/Switch';
export { RadioGroup, type RadioGroupProps, type RadioOption } from '@/components/ui/RadioGroup';
export { Badge, StatusPill, type BadgeProps, type StatusPillProps } from '@/components/ui/Badge';
export { badgeVariants } from '@/components/ui/badgeVariants';
export { Card, Surface, type CardProps, type SurfaceProps } from '@/components/ui/Surface';
export { surfaceVariants } from '@/components/ui/surfaceVariants';
export { Separator, type SeparatorProps } from '@/components/ui/Separator';
export { Kbd, ShortcutHint } from '@/components/ui/Kbd';
export { Tooltip, TooltipProvider, type TooltipProps } from '@/components/ui/Tooltip';
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  SimpleTabs,
  type SimpleTabsProps,
} from '@/components/ui/Tabs';
export { CopyButton, CopyIconButton } from '@/components/ui/CopyButton';
export { ProgressBar, type ProgressBarProps } from '@/components/ui/ProgressBar';
export { controlVariants } from '@/components/ui/controlStyles';

/* TASK-004 — overlays, feedback, and async states */
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  type DialogContentProps,
} from '@/components/ui/Dialog';
export { ConfirmDialog, type ConfirmDialogProps } from '@/components/ui/ConfirmDialog';
export { Sheet, SheetContent, type SheetProps, type SheetSide } from '@/components/ui/Sheet';
export { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';
export { Alert, InlineError, type AlertProps, type AlertTone } from '@/components/ui/Alert';
export { alertVariants } from '@/components/ui/alertVariants';
export { EmptyState, type EmptyStateProps } from '@/components/ui/EmptyState';
export { ErrorState, type ErrorStateProps } from '@/components/ui/ErrorState';
export {
  AsyncBoundary,
  type AsyncBoundaryProps,
  type AsyncStatus,
} from '@/components/ui/AsyncBoundary';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuActions,
} from '@/components/ui/DropdownMenu';
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/ContextMenu';
export {
  ToastContext,
  useToast,
  type ToastApi,
  type ToastOptions,
  type ToastTone,
} from '@/components/ui/toast-context';
