import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { resolveToastDuration } from '@/components/ui/toast-duration';
import { useToast, type ToastApi } from '@/components/ui/toast-context';

let api: ToastApi;

function CaptureApi() {
  const toast = useToast();
  useEffect(() => {
    api = toast;
  }, [toast]);
  return null;
}

function renderProvider() {
  return render(
    <ToastProvider>
      <CaptureApi />
    </ToastProvider>,
  );
}

describe('resolveToastDuration', () => {
  it('clamps errors to the 8 second accessibility floor', () => {
    expect(resolveToastDuration({ tone: 'error', durationMs: 1000 })).toBe(8000);
    expect(resolveToastDuration({ tone: 'error' })).toBe(8000);
    expect(resolveToastDuration({ tone: 'error', durationMs: 12000 })).toBe(12000);
  });

  it('keeps shorter durations for non-errors', () => {
    expect(resolveToastDuration({ tone: 'success', durationMs: 1500 })).toBe(1500);
    expect(resolveToastDuration({ tone: 'info' })).toBe(5000);
  });
});

describe('ToastProvider', () => {
  it('announces success messages politely and errors assertively', () => {
    const user = userEvent.setup();
    renderProvider();

    act(() => {
      api.success({ title: 'Snapshot saved' });
      api.error({ title: 'Could not save prompt' });
    });

    const politeRegion = document.querySelector('[aria-live="polite"]');
    const assertiveRegion = document.querySelector('[aria-live="assertive"]');

    expect(politeRegion).toHaveTextContent('Snapshot saved');
    expect(assertiveRegion).toHaveTextContent('Could not save prompt');
    expect(politeRegion).not.toHaveTextContent('Could not save prompt');

    // Keep the reference used so lint does not flag the unused binding.
    expect(user).toBeDefined();
  });

  it('deduplicates by id instead of stacking copies', () => {
    renderProvider();

    act(() => {
      api.show({ id: 'save-failed', tone: 'error', title: 'Save failed' });
      api.show({ id: 'save-failed', tone: 'error', title: 'Save failed', description: 'Retrying' });
    });

    expect(screen.getAllByText('Save failed')).toHaveLength(1);
  });

  it('auto-dismisses a success toast but never an error before 8 seconds', () => {
    vi.useFakeTimers();
    renderProvider();

    act(() => {
      api.show({ tone: 'success', title: 'Copied', durationMs: 2000 });
      api.show({ tone: 'error', title: 'Storage blocked', durationMs: 1000 });
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Copied')).not.toBeInTheDocument();
    expect(screen.getByText('Storage blocked')).toBeInTheDocument();

    // 3s + 4s = 7s: still inside the 8s floor.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('Storage blocked')).toBeInTheDocument();

    // 3s + 4s + 1.5s = 8.5s: the floor has passed, so it may dismiss.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText('Storage blocked')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('pauses the countdown while the toast is hovered and resumes after', () => {
    vi.useFakeTimers();
    renderProvider();

    act(() => {
      api.show({ tone: 'info', title: 'Export ready', durationMs: 4000 });
    });

    const toast = screen.getByText('Export ready').closest('[data-tone]') as HTMLElement;

    // Pointer-free interaction: dispatch the same events the component listens for.
    act(() => {
      fireEvent.mouseEnter(toast);
    });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('Export ready')).toBeInTheDocument();

    act(() => {
      fireEvent.mouseLeave(toast);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Export ready')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('lets the user dismiss a toast with a labelled button', async () => {
    const user = userEvent.setup();
    renderProvider();

    act(() => {
      api.show({ tone: 'info', title: 'Dismiss me' });
    });

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('runs the undo action from the keyboard and closes the toast', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    renderProvider();

    act(() => {
      api.show({
        tone: 'success',
        title: 'Prompts archived',
        action: { label: 'Undo', onClick: onUndo },
      });
    });

    const undo = screen.getByRole('button', { name: 'Undo' });
    // Focusing pauses the countdown, so the update belongs inside act().
    act(() => undo.focus());
    expect(undo).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Prompts archived')).not.toBeInTheDocument();
  });

  it('queues notifications beyond three and promotes them on dismissal', () => {
    renderProvider();

    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        api.info({ id: `t${index}`, title: `Notification ${index}` });
      }
    });

    expect(screen.getByText('Notification 1')).toBeInTheDocument();
    expect(screen.getByText('Notification 3')).toBeInTheDocument();
    expect(screen.queryByText('Notification 4')).not.toBeInTheDocument();
    expect(screen.queryByText('Notification 5')).not.toBeInTheDocument();

    act(() => api.dismiss('t1'));

    expect(screen.queryByText('Notification 1')).not.toBeInTheDocument();
    expect(screen.getByText('Notification 4')).toBeInTheDocument();
    expect(screen.queryByText('Notification 5')).not.toBeInTheDocument();
  });

  it('dismisses all notifications at once', () => {
    renderProvider();

    act(() => {
      api.success({ title: 'One' });
      api.error({ title: 'Two' });
      api.dismissAll();
    });

    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
  });

  it('throws a clear error when used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<CaptureApi />)).toThrow(/ToastProvider/);

    consoleError.mockRestore();
  });

  it('keeps the toast region mounted so announcements are never missed', () => {
    renderProvider();
    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(document.querySelector('[aria-live="assertive"]')).not.toBeNull();

    act(() => {
      api.info({ title: 'Ephemeral' });
    });
    act(() => {
      api.dismissAll();
    });
    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
