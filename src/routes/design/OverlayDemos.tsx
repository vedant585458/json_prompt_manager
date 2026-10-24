import { Copy, MoreHorizontal, Pencil, Plus, ShieldX, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  ConfirmDialog,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuActions,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  Input,
  Sheet,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast-context';
import { Example, GallerySection } from '@/routes/design/galleryParts';

/**
 * Overlay demos (TASK-004).
 *
 * Every demo is real: dialogs trap and restore focus, the destructive
 * confirmation refuses to close on an accidental overlay click, the sheet
 * becomes a bottom sheet on phones, and the menus open from the keyboard.
 */
export function OverlayDemos() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastAction, setLastAction] = useState('No action yet');
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const toast = useToast();

  function handleDestructiveConfirm() {
    const previous = lastAction;
    setLastAction('Library cleared (demo only — nothing was stored)');

    toast.show({
      tone: 'error',
      title: 'Library cleared',
      description: 'Demo action. No stored data exists yet.',
      action: {
        label: 'Undo',
        onClick: () => setLastAction(`Restored: ${previous}`),
      },
    });
  }

  return (
    <GallerySection
      id="overlays"
      title="Overlays and menus"
      description="Dialogs trap focus and restore it on close; destructive confirmations ignore stray overlay clicks; menus open by keyboard, pointer, and touch."
    >
      <div className="space-y-5">
        <Example label="Dialog">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent
              title="New prompt"
              description="Dialogs are for focused, short tasks. Long editing happens in the workspace."
              footer={
                <>
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setLastAction(`Created “${title || 'Untitled prompt'}” (demo)`);
                      setTitle('');
                      setDialogOpen(false);
                    }}
                  >
                    Create prompt
                  </Button>
                </>
              }
            >
              <Field label="Prompt name" hint="You can rename it later.">
                {(control) => (
                  <Input
                    {...control}
                    value={title}
                    placeholder="Structured extraction"
                    onChange={(event) => setTitle(event.target.value)}
                  />
                )}
              </Field>
            </DialogContent>
          </Dialog>
        </Example>

        <Example label="Confirmation">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Confirm archive
            </Button>
            <Button
              variant="danger"
              leadingIcon={<ShieldX size={14} />}
              onClick={() => setDestructiveOpen(true)}
            >
              Clear library (requires typing)
            </Button>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Archive this prompt?"
            description="Archived prompts stay in the library but are hidden from the default view. You can restore them at any time."
            confirmLabel="Archive prompt"
            pending={pending}
            onConfirm={() => {
              setPending(true);
              window.setTimeout(() => {
                setPending(false);
                setConfirmOpen(false);
                setLastAction('Prompt archived (demo)');
                toast.success({
                  title: 'Prompt archived',
                  description: 'Restore it from the archive.',
                });
              }, 250);
            }}
          />

          <ConfirmDialog
            open={destructiveOpen}
            onOpenChange={setDestructiveOpen}
            tone="destructive"
            title="Clear the entire library?"
            description="Every prompt, revision, and saved test case would be removed from this device."
            confirmationPhrase="delete library"
            confirmLabel="Clear library"
            onConfirm={() => {
              setDestructiveOpen(false);
              handleDestructiveConfirm();
            }}
          />
        </Example>

        <Example label="Sheet (bottom sheet under 640px)">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open inspector sheet
          </Button>
          <Sheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title="Inspector"
            description="Panels collapse instead of permanently consuming width."
            footer={
              <>
                <Button variant="ghost" onClick={() => setSheetOpen(false)}>
                  Close
                </Button>
                <Button variant="primary" onClick={() => setSheetOpen(false)}>
                  Apply
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <p className="text-sm text-ink-secondary">
                A sheet is the mobile and secondary-panel surface. It scrolls independently, keeps
                its own header, and returns focus to the trigger on close.
              </p>
              <div className="rounded-sm border border-line bg-surface-2 p-3">
                <p className="metadata-rail">Example field</p>
                <p className="mt-1 text-sm text-ink">Output format: JSON</p>
              </div>
              <p className="text-xs text-ink-muted">
                Escape closes the sheet. The close button is a labelled icon button, not a
                hover-only affordance.
              </p>
            </div>
          </Sheet>
        </Example>

        <Example label="Menus">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" trailingIcon={<MoreHorizontal size={14} />}>
                  Row actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Prompt</DropdownMenuLabel>
                <DropdownMenuActions
                  actions={[
                    {
                      id: 'open',
                      label: 'Open in editor',
                      icon: <Pencil size={14} />,
                      onSelect: () => setLastAction('Open in editor'),
                    },
                    {
                      id: 'duplicate',
                      label: 'Duplicate',
                      icon: <Copy size={14} />,
                      shortcut: '⌘D',
                      onSelect: () => setLastAction('Duplicated'),
                    },
                    {
                      id: 'new',
                      label: 'New prompt',
                      icon: <Plus size={14} />,
                      onSelect: () => setLastAction('New prompt'),
                    },
                    {
                      id: 'disabled',
                      label: 'Unavailable action',
                      disabled: true,
                      onSelect: () => undefined,
                    },
                  ]}
                />
                <DropdownMenuSeparator />
                <DropdownMenuActions
                  actions={[
                    {
                      id: 'delete',
                      label: 'Delete prompt',
                      destructive: true,
                      icon: <Trash2 size={14} />,
                      onSelect: () => setDestructiveOpen(true),
                    },
                  ]}
                />
              </DropdownMenuContent>
            </DropdownMenu>

            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  tabIndex={0}
                  className="rounded-sm border border-dashed border-line-control px-3 py-2 text-xs text-ink-muted"
                >
                  Right-click, long-press, or press Menu / Shift+F10 here
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel>Card</ContextMenuLabel>
                <ContextMenuItem onSelect={() => setLastAction('Copied path')} shortcut="⌘C">
                  <Copy aria-hidden="true" size={14} className="text-ink-muted" />
                  Copy JSON path
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => setLastAction('Renamed')}>
                  <Pencil aria-hidden="true" size={14} className="text-ink-muted" />
                  Rename
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem destructive onSelect={() => setDestructiveOpen(true)}>
                  <Trash2 aria-hidden="true" size={14} />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </Example>

        <p className="text-xs text-ink-muted" aria-live="polite">
          Last demo action: <span className="text-ink-secondary">{lastAction}</span>
        </p>
      </div>
    </GallerySection>
  );
}
