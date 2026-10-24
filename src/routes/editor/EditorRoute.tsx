import { useCallback, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { PromptSummaryCard } from '@/components/prompts/PromptSummaryCard';
import {
  Button,
  EmptyState,
  ErrorState,
  SkeletonCard,
  buttonVariants,
  useToast,
} from '@/components/ui';
import { registerPromptFavoriteToggle } from '@/lib/commands/promptActions';
import { cn } from '@/lib/cn';
import { describeDataError } from '@/store/dataStore';
import { useDataStoreApi } from '@/store/dataStoreContext';

/**
 * Prompt workspace route (TASK-008 shell; header from TASK-013).
 *
 * The editor itself arrives in TASK-014. What is here is real: the stored
 * prompt is resolved by id, its folder and collections are named, and its
 * favorite, pin, and archive state can be changed. Every write goes through the
 * store, so a failure is reported and nothing is optimistically shown.
 */
export function EditorRoute() {
  const { promptId } = useParams<{ promptId: string }>();
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const folders = store((state) => state.folders);
  const collections = store((state) => state.collections);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);
  const toggleFavorite = store((state) => state.toggleFavorite);
  const togglePin = store((state) => state.togglePin);
  const archivePrompt = store((state) => state.archivePrompt);
  const unarchivePrompt = store((state) => state.unarchivePrompt);

  const toast = useToast();
  const now = useMemo(() => new Date(), []);
  const prompt = promptId ? (prompts.find((candidate) => candidate.id === promptId) ?? null) : null;

  const handleFavorite = useCallback(() => {
    if (!prompt) return;
    void (async () => {
      try {
        const saved = await toggleFavorite(prompt.id);
        toast.success({
          title: saved.favorite ? 'Added to favorites' : 'Removed from favorites',
          description: saved.title,
        });
      } catch (caught) {
        toast.error({
          title: 'The favorite was not changed',
          description: describeDataError(caught),
        });
      }
    })();
  }, [prompt, toggleFavorite, toast]);

  const handlePin = useCallback(() => {
    if (!prompt) return;
    void (async () => {
      try {
        const saved = await togglePin(prompt.id);
        toast.success({
          title: saved.pinned ? 'Pinned' : 'Unpinned',
          description: saved.title,
        });
      } catch (caught) {
        toast.error({ title: 'The pin was not changed', description: describeDataError(caught) });
      }
    })();
  }, [prompt, togglePin, toast]);

  const handleArchive = useCallback(() => {
    if (!prompt) return;
    void (async () => {
      const archiving = !prompt.archived;
      try {
        if (archiving) await archivePrompt(prompt.id);
        else await unarchivePrompt(prompt.id);
        toast.success({
          title: archiving ? 'Prompt archived' : 'Prompt restored',
          description: prompt.title,
          action: {
            label: 'Undo',
            onClick: () => {
              void (async () => {
                try {
                  if (archiving) await unarchivePrompt(prompt.id);
                  else await archivePrompt(prompt.id);
                } catch (caught) {
                  toast.error({
                    title: 'That change could not be undone',
                    description: describeDataError(caught),
                  });
                }
              })();
            },
          },
        });
      } catch (caught) {
        toast.error({
          title: 'The prompt was not updated',
          description: describeDataError(caught),
        });
      }
    })();
  }, [prompt, archivePrompt, unarchivePrompt, toast]);

  // The palette command asks the mounted workspace; nothing is registered when
  // the prompt is missing, so the command cannot act on stale data.
  useEffect(
    () => registerPromptFavoriteToggle(prompt ? handleFavorite : null),
    [prompt, handleFavorite],
  );

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="mx-auto w-full max-w-3xl" aria-busy="true">
        <SkeletonCard />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="This prompt could not be read"
        description="The prompt could not be loaded from this browser. Nothing was changed."
        action={
          <Button variant="primary" onClick={() => void hydrate()}>
            Try again
          </Button>
        }
        detail={error ?? undefined}
      />
    );
  }

  if (!prompt) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="font-display text-3xl leading-tight text-ink">Prompt workspace</h1>
        <EmptyState
          title="This prompt is not in your library"
          description={
            promptId
              ? `No stored prompt has the id “${promptId}”. It may have been deleted, or the link may point at another browser’s library.`
              : 'No prompt id was given, so there is nothing to open.'
          }
          action={
            <Link to="/library" className={cn(buttonVariants({ variant: 'primary' }))}>
              Go to the library
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PromptSummaryCard
        prompt={prompt}
        folderName={folders.find((folder) => folder.id === prompt.folderId)?.name ?? null}
        collectionNames={collections
          .filter((collection) => prompt.collectionIds.includes(collection.id))
          .map((collection) => collection.name)}
        now={now}
        onToggleFavorite={handleFavorite}
        onTogglePin={handlePin}
        onToggleArchive={handleArchive}
      />
    </div>
  );
}
