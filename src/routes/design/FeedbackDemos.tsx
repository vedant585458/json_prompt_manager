import { FileJson2, RotateCcw, SearchX, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import {
  Alert,
  AsyncBoundary,
  Button,
  EmptyState,
  ErrorState,
  InlineError,
  SkeletonCard,
  SkeletonText,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast-context';
import { Example, GallerySection } from '@/routes/design/galleryParts';

/**
 * Feedback and state demos (TASK-004).
 *
 * Toasts demonstrate the real queue and undo path; error states demonstrate the
 * collapsed technical-detail disclosure; empty states always carry an action.
 */
export function FeedbackDemos() {
  const toast = useToast();
  const [asyncDemo, setAsyncDemo] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [dismissedAlert, setDismissedAlert] = useState(false);

  return (
    <GallerySection
      id="feedback"
      title="Feedback and async states"
      description="Notifications are announced politely, errors assertively and never auto-dismiss before 8 seconds. Empty and error states always offer a way forward."
    >
      <div className="space-y-5">
        <Example label="Toast with undo (keyboard reachable)">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                toast.success({
                  title: 'Snapshot saved',
                  description: 'Revision 4 of “Structured extraction”.',
                })
              }
            >
              Success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.show({
                  tone: 'success',
                  title: 'Prompts archived',
                  description: '3 prompts moved to the archive.',
                  action: {
                    label: 'Undo',
                    onClick: () =>
                      toast.info({ title: 'Archive undone', description: '3 prompts restored.' }),
                  },
                })
              }
            >
              Toast with undo
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.error({
                  title: 'Could not save prompt',
                  description:
                    'Storage rejected the write. Your draft is still here — retry when ready.',
                })
              }
            >
              Error toast
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                [1, 2, 3, 4, 5].forEach((index) =>
                  toast.info({
                    id: `queue-${index}`,
                    title: `Queued notification ${index}`,
                    description: 'At most three are visible; the rest wait in order.',
                  }),
                );
              }}
            >
              Queue five
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Hovering or focusing a toast pauses its countdown. Errors wait at least 8 seconds.
          </p>
        </Example>

        <Example label="Alerts">
          <div className="space-y-2">
            <Alert tone="info" title="Local rendering only">
              No model provider is connected. PromptForge renders prompts locally.
            </Alert>
            <Alert tone="success" title="Document is valid JSON">
              Syntax and schema checks passed. This says nothing about prompt quality.
            </Alert>
            {dismissedAlert ? (
              <Button size="sm" variant="ghost" onClick={() => setDismissedAlert(false)}>
                Show dismissed warning again
              </Button>
            ) : (
              <Alert
                tone="warning"
                title="Schema not attached"
                action={
                  <Button size="sm" variant="secondary">
                    Choose a schema
                  </Button>
                }
                onDismiss={() => setDismissedAlert(true)}
              >
                Validation is limited to JSON syntax until a schema is selected.
              </Alert>
            )}
            <Alert tone="danger" title="Storage unavailable">
              IndexedDB is blocked in this browser profile. Changes cannot be persisted.
            </Alert>
          </div>
          <div className="mt-3">
            <InlineError>Snapshot description is required.</InlineError>
          </div>
        </Example>

        <Example label="Empty state (action required by API)">
          <EmptyState
            title="No prompts match these filters"
            description="Try a broader search or clear the tag filter to see the rest of the library."
            icon={SearchX}
            action={
              <Button size="sm" variant="primary">
                Clear filters
              </Button>
            }
            secondaryAction={
              <Button size="sm" variant="ghost">
                Create prompt
              </Button>
            }
            compact
          />
        </Example>

        <Example label="Error state with technical detail">
          <ErrorState
            title="Could not load the library"
            description="The stored index could not be read. Your prompts are still on this device; retrying is safe."
            detail={
              'IndexedDBError: transaction aborted\n  at readPrompts (repositories/prompts.ts:42)'
            }
            action={
              <Button size="sm" variant="primary" leadingIcon={<RotateCcw size={14} />}>
                Retry
              </Button>
            }
            secondaryAction={
              <Button size="sm" variant="secondary">
                Export backup
              </Button>
            }
            compact
          />
        </Example>

        <Example label="Loading skeletons">
          <div className="grid gap-3 sm:grid-cols-2">
            <SkeletonCard />
            <div className="rounded-lg border border-line bg-surface-1 p-4">
              <SkeletonText lines={4} />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xs text-ink-muted" aria-hidden="true">
            skeleton · shimmer disabled under reduced motion
          </p>
        </Example>

        <Example label="AsyncBoundary">
          <div className="flex flex-wrap gap-2">
            {(['loading', 'error', 'success'] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={asyncDemo === status ? 'primary' : 'secondary'}
                onClick={() => setAsyncDemo(status)}
              >
                {status}
              </Button>
            ))}
          </div>
          <div className="mt-3">
            <AsyncBoundary
              status={asyncDemo === 'idle' ? 'loading' : asyncDemo}
              error="The revision list could not be loaded."
              errorDetail="StaleWriteError: version 4 is older than stored version 6"
              onRetry={() => setAsyncDemo('loading')}
              isEmpty={false}
            >
              <p className="text-sm text-ink-secondary">
                Revisions loaded. Pick a state above to see the loading and error treatments.
              </p>
            </AsyncBoundary>
          </div>
        </Example>

        <Example label="Iconography for empty states">
          <div className="flex flex-wrap items-center gap-3 text-ink-muted">
            <FileJson2 aria-hidden="true" size={18} />
            <TriangleAlert aria-hidden="true" size={18} />
            <span className="text-xs">
              Icons are decorative when adjacent text already explains the state.
            </span>
          </div>
        </Example>
      </div>
    </GallerySection>
  );
}
