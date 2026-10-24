import { RenderedPreview } from '@/components/playground/RenderedPreview';
import { VariableForm } from '@/components/playground/VariableForm';
import { Card, useToast } from '@/components/ui';
import type { PromptDocument } from '@/domain/types';
import { usePlayground } from '@/features/playground/usePlayground';

export interface PlaygroundPanelProps {
  readonly promptId: string;
  readonly document: PromptDocument;
  /** Storage override for tests; omit to use this tab's session storage. */
  readonly storage?: Storage | null;
  readonly debounceMs?: number;
}

/**
 * The variable form and the rendered preview (TASK-021).
 *
 * One component serves both surfaces — the playground route and the editor's
 * Preview tab — so the two can never disagree about what "the rendered prompt"
 * means. It owns nothing but the inputs: the document comes from the caller,
 * which in the editor is the *draft*, not the saved prompt.
 */
export function PlaygroundPanel({ promptId, document, storage, debounceMs }: PlaygroundPanelProps) {
  const toast = useToast();
  const playground = usePlayground(promptId, document, {
    ...(storage === undefined ? {} : { storage }),
    ...(debounceMs === undefined ? {} : { debounceMs }),
  });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-2xs leading-relaxed text-ink-muted">
        {playground.restored ? 'These inputs were restored from earlier in this tab. ' : ''}
        They are kept in this tab only — not in the prompt, not in its history, and they never leave
        this browser.
      </p>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <VariableForm
            variables={playground.variables}
            inputs={playground.inputs}
            parsed={playground.parsed}
            reconciliation={playground.reconciliation}
            problemCount={playground.scan.problems.length}
            onChange={playground.setInput}
            onReset={playground.resetVariable}
            onResetAll={playground.resetAll}
          />
        </Card>

        <Card className="min-w-0">
          <RenderedPreview
            rendered={playground.rendered}
            pending={playground.pending}
            onCopied={() => toast.success({ title: 'Rendered prompt copied' })}
          />
        </Card>
      </div>
    </div>
  );
}
