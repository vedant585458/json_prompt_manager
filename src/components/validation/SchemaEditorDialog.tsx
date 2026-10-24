import { useEffect, useMemo, useState } from 'react';

import { Button, Dialog, DialogContent, Field, Input, Textarea } from '@/components/ui';
import { scanJson } from '@/domain/jsonText';
import { compileSchema, pointerToPath } from '@/domain/validation';
import type { JsonObject, PromptSchema } from '@/domain/types';

/**
 * Create or edit a reusable JSON Schema (TASK-016).
 *
 * The JSON is checked twice before it can be stored: it must parse, and it must
 * be a schema this build can evaluate. A schema with a keyword the validator does
 * not implement is refused here — saving it would let the studio report "valid"
 * for a document nobody actually checked.
 */

export interface SchemaEditorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The schema being edited; `null` creates a new one. */
  readonly schema: PromptSchema | null;
  readonly onSave: (input: {
    readonly name: string;
    readonly description: string;
    readonly schemaContent: JsonObject;
  }) => Promise<void>;
  readonly defaultJson?: string;
}

const BLANK = '{\n  "type": "object",\n  "properties": {}\n}';

export function SchemaEditorDialog({
  open,
  onOpenChange,
  schema,
  onSave,
  defaultJson = BLANK,
}: SchemaEditorDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [json, setJson] = useState(defaultJson);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(schema?.name ?? '');
    setDescription(schema?.description ?? '');
    setJson(schema ? JSON.stringify(schema.schemaContent, null, 2) : defaultJson);
    setFailure(null);
    setSaving(false);
  }, [open, schema, defaultJson]);

  const check = useMemo(() => {
    const scanned = scanJson(json);
    if (!scanned.ok) {
      return {
        ok: false as const,
        problems: [
          {
            where: `line ${scanned.error.line}, column ${scanned.error.column}`,
            message: scanned.error.message,
          },
        ],
      };
    }

    const compiled = compileSchema(scanned.value);
    if (!compiled.ok) {
      return {
        ok: false as const,
        problems: compiled.problems.map((problem) => ({
          where: pointerToPath(problem.pointer),
          message: problem.message,
        })),
      };
    }

    return {
      ok: true as const,
      value: scanned.value as JsonObject,
      warnings: compiled.warnings.map((warning) => warning.message),
    };
  }, [json]);

  const trimmedName = name.trim();
  const canSave = check.ok && trimmedName.length > 0 && !saving;

  async function handleSave() {
    if (!check.ok || trimmedName.length === 0) return;
    setSaving(true);
    setFailure(null);
    try {
      await onSave({
        name: trimmedName,
        description: description.trim(),
        schemaContent: check.value,
      });
      onOpenChange(false);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The schema could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={schema ? `Edit “${schema.name}”` : 'New JSON Schema'}
        description="A schema is stored with this browser and can be attached to any prompt. Only local $ref references are supported."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave}>
              {schema ? 'Save schema' : 'Create schema'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Invoice shape"
              />
            )}
          </Field>

          <Field label="Description" hint="What this schema guarantees, in one sentence.">
            {(control) => (
              <Input
                {...control}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Requires a name, an objective, and a schema version."
              />
            )}
          </Field>

          <Field
            label="Schema JSON"
            hint="Checked before saving: it must parse, and every keyword must be one this validator implements."
          >
            {(control) => (
              <Textarea
                {...control}
                mono
                rows={14}
                value={json}
                spellCheck={false}
                onChange={(event) => setJson(event.target.value)}
              />
            )}
          </Field>

          {!check.ok ? (
            <div
              role="alert"
              className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2"
            >
              <p className="text-xs font-medium text-ink">This is not a usable schema yet.</p>
              <ul className="mt-1 space-y-1 font-mono text-2xs text-ink-secondary">
                {check.problems.slice(0, 5).map((problem) => (
                  <li key={`${problem.where}-${problem.message}`}>
                    <span className="text-ink-muted">{problem.where}:</span> {problem.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : check.warnings.length > 0 ? (
            <div className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2">
              <p className="text-2xs leading-relaxed text-ink-secondary">
                Saved, with {check.warnings.length} note
                {check.warnings.length === 1 ? '' : 's'}: {check.warnings.join(' ')}
              </p>
            </div>
          ) : null}

          {failure ? (
            <p role="alert" className="text-xs text-danger">
              {failure}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
