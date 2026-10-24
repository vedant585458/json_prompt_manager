import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Stable id: reusing one updates the existing toast instead of duplicating it. */
  id?: string;
  tone?: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
  /**
   * Milliseconds before auto-dismiss. Errors are clamped to a minimum of
   * 8000 ms so a failure can always be read and acted on.
   */
  durationMs?: number;
}

export interface ToastRecord extends ToastOptions {
  id: string;
  tone: ToastTone;
  createdAt: number;
}

export interface ToastApi {
  show: (options: ToastOptions) => string;
  success: (options: Omit<ToastOptions, 'tone'>) => string;
  error: (options: Omit<ToastOptions, 'tone'>) => string;
  info: (options: Omit<ToastOptions, 'tone'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export const TOAST_MIN_ERROR_DURATION_MS = 8000;
export const TOAST_DEFAULT_DURATION_MS = 5000;

export const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast API. Throws when used outside the provider. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast must be used inside a ToastProvider.');
  }
  return api;
}
