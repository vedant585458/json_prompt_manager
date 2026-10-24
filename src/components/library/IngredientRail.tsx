import { FolderPlus, MoreHorizontal, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { buildFolderTree, flattenFolderTree } from '@/lib/folderTree';
import type { TagCount } from '@/store/selectors';
import type { Collection, Folder } from '@/domain/types';
import type { LibraryState } from '@/routes/library/libraryQuery';

export interface FolderSelection {
  readonly folderId: string | null;
  readonly unfiled: boolean;
}

export interface IngredientRailProps {
  readonly folders: readonly Folder[];
  readonly collections: readonly Collection[];
  readonly tagCounts: readonly TagCount[];
  readonly folderCounts: ReadonlyMap<string, number>;
  readonly collectionCounts: ReadonlyMap<string, number>;
  readonly unfiledCount: number;
  readonly totalCount: number;
  readonly state: LibraryState;
  readonly onSelectFolder: (selection: FolderSelection) => void;
  readonly onSelectCollection: (collectionId: string | null) => void;
  readonly onToggleTag: (tag: string) => void;
  /** Organization management (TASK-012). */
  readonly onNewFolder: (parentId: string | null) => void;
  readonly onEditFolder: (folder: Folder) => void;
  readonly onDeleteFolder: (folder: Folder) => void;
  readonly onNewCollection: () => void;
  readonly onEditCollection: (collection: Collection) => void;
  readonly onDeleteCollection: (collection: Collection) => void;
  /** Opens the library-wide tag manager (TASK-013). */
  readonly onManageTags?: () => void;
}

const VISIBLE_TAGS = 12;

function RailButton({
  active,
  label,
  count,
  depth = 0,
  onClick,
  actions,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly count: number;
  readonly depth?: number;
  readonly onClick: () => void;
  readonly actions?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-0.5">
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        style={depth > 0 ? { paddingLeft: `${0.625 + depth * 0.75}rem` } : undefined}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs',
          'transition-colors duration-[var(--pf-duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          active
            ? 'bg-accent-soft font-medium text-accent'
            : 'text-ink-secondary hover:bg-surface-2 hover:text-ink',
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 font-mono text-2xs text-ink-muted tabular">{count}</span>
      </button>
      {actions}
    </li>
  );
}

function RailMenu({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={label} size="sm" variant="ghost" className="size-6 shrink-0">
          <MoreHorizontal size={13} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function FolderMenu({
  folder,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
}: {
  readonly folder: Folder;
  readonly onNewFolder: (parentId: string | null) => void;
  readonly onEditFolder: (folder: Folder) => void;
  readonly onDeleteFolder: (folder: Folder) => void;
}) {
  return (
    <RailMenu label={`Actions for folder “${folder.name}”`}>
      <DropdownMenuItem onSelect={() => onNewFolder(folder.id)}>
        <FolderPlus aria-hidden="true" size={13} />
        New subfolder
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onEditFolder(folder)}>
        <Pencil aria-hidden="true" size={13} />
        Rename or move…
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem destructive onSelect={() => onDeleteFolder(folder)}>
        <Trash2 aria-hidden="true" size={13} />
        Delete folder…
      </DropdownMenuItem>
    </RailMenu>
  );
}

function CollectionMenu({
  collection,
  onEditCollection,
  onDeleteCollection,
}: {
  readonly collection: Collection;
  readonly onEditCollection: (collection: Collection) => void;
  readonly onDeleteCollection: (collection: Collection) => void;
  /** Opens the library-wide tag manager (TASK-013). */
  readonly onManageTags?: () => void;
}) {
  return (
    <RailMenu label={`Actions for collection “${collection.name}”`}>
      <DropdownMenuItem onSelect={() => onEditCollection(collection)}>
        <Pencil aria-hidden="true" size={13} />
        Rename collection…
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem destructive onSelect={() => onDeleteCollection(collection)}>
        <Trash2 aria-hidden="true" size={13} />
        Delete collection…
      </DropdownMenuItem>
    </RailMenu>
  );
}

/**
 * Organization rail (TASK-011).
 *
 * Folders keep their hierarchy, collections are flat, and tags are ordered by
 * use. Every entry is a toggle button with `aria-pressed`, and each shows the
 * number of prompts it would show so an empty folder is visible before it is
 * clicked. Counts describe the archive scope (live or archived), not the
 * current search, so they do not collapse to zero while typing.
 */
export function IngredientRail({
  folders,
  collections,
  tagCounts,
  folderCounts,
  collectionCounts,
  unfiledCount,
  totalCount,
  state,
  onSelectFolder,
  onSelectCollection,
  onToggleTag,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
  onNewCollection,
  onEditCollection,
  onDeleteCollection,
  onManageTags,
}: IngredientRailProps) {
  const [showAllTags, setShowAllTags] = useState(false);
  const tree = flattenFolderTree(buildFolderTree(folders));
  const visibleTags = showAllTags ? tagCounts : tagCounts.slice(0, VISIBLE_TAGS);
  const hiddenTagCount = tagCounts.length - visibleTags.length;

  return (
    <nav aria-label="Library organization" className="flex flex-col gap-4">
      <section aria-label="Folders" className="rounded-lg border border-line bg-surface-1 p-2">
        <div className="flex items-center justify-between gap-1 pr-0.5">
          <h2 className="px-2.5 pt-1 pb-1.5 metadata-rail">Folders</h2>
          <IconButton
            label="New folder"
            size="sm"
            variant="ghost"
            onClick={() => onNewFolder(null)}
          >
            <Plus size={14} />
          </IconButton>
        </div>
        <ul className="space-y-0.5">
          <RailButton
            active={state.folder === null && !state.unfiled}
            label="All prompts"
            count={totalCount}
            onClick={() => onSelectFolder({ folderId: null, unfiled: false })}
          />
          {tree.map((entry) => (
            <RailButton
              key={entry.folder.id}
              active={state.folder === entry.folder.id}
              label={entry.folder.name}
              count={folderCounts.get(entry.folder.id) ?? 0}
              depth={entry.depth + 1}
              onClick={() => onSelectFolder({ folderId: entry.folder.id, unfiled: false })}
              actions={
                <FolderMenu
                  folder={entry.folder}
                  onNewFolder={onNewFolder}
                  onEditFolder={onEditFolder}
                  onDeleteFolder={onDeleteFolder}
                />
              }
            />
          ))}
          <RailButton
            active={state.unfiled}
            label="Unfiled"
            count={unfiledCount}
            onClick={() => onSelectFolder({ folderId: null, unfiled: true })}
          />
        </ul>
        {tree.length === 0 ? (
          <p className="px-2.5 pb-1 text-2xs leading-relaxed text-ink-muted">
            No folders yet. Create one to group prompts by area of work.
          </p>
        ) : null}
      </section>

      <section aria-label="Collections" className="rounded-lg border border-line bg-surface-1 p-2">
        <div className="flex items-center justify-between gap-1 pr-0.5">
          <h2 className="px-2.5 pt-1 pb-1.5 metadata-rail">Collections</h2>
          <IconButton
            label="New collection"
            size="sm"
            variant="ghost"
            onClick={() => onNewCollection()}
          >
            <Plus size={14} />
          </IconButton>
        </div>
        <ul className="space-y-0.5">
          {collections.map((collection) => (
            <RailButton
              key={collection.id}
              active={state.collection === collection.id}
              label={collection.name}
              count={collectionCounts.get(collection.id) ?? 0}
              onClick={() =>
                onSelectCollection(state.collection === collection.id ? null : collection.id)
              }
              actions={
                <CollectionMenu
                  collection={collection}
                  onEditCollection={onEditCollection}
                  onDeleteCollection={onDeleteCollection}
                />
              }
            />
          ))}
        </ul>
        {collections.length === 0 ? (
          <p className="px-2.5 pb-1 text-2xs leading-relaxed text-ink-muted">
            No collections yet. Create one to group prompts across folders.
          </p>
        ) : null}
      </section>

      <section aria-label="Tags" className="rounded-lg border border-line bg-surface-1 p-2">
        <div className="flex items-center justify-between gap-1 pr-0.5">
          <h2 className="px-2.5 pt-1 pb-1.5 metadata-rail">Tags</h2>
          {onManageTags ? (
            <IconButton label="Manage tags" size="sm" variant="ghost" onClick={onManageTags}>
              <Settings2 size={14} />
            </IconButton>
          ) : null}
        </div>
        <ul className="flex flex-wrap gap-1.5 p-1">
          {visibleTags.map((tag) => {
            const active = state.tags.includes(tag.tag);
            return (
              <li key={tag.tag}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleTag(tag.tag)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-2xs',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    active
                      ? 'border-accent/40 bg-accent-soft text-accent'
                      : 'border-line bg-surface-2 text-ink-secondary hover:border-line-strong hover:text-ink',
                  )}
                >
                  <span>#{tag.tag}</span>
                  <span className="font-mono text-ink-muted tabular">{tag.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {tagCounts.length === 0 ? (
          <p className="px-2.5 pb-1 text-2xs leading-relaxed text-ink-muted">No tags yet.</p>
        ) : null}
        {hiddenTagCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowAllTags(true)}
            className="mt-1 rounded-xs px-2.5 py-1 text-2xs font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Show all {tagCounts.length} tags
          </button>
        ) : null}
        {showAllTags && tagCounts.length > VISIBLE_TAGS ? (
          <button
            type="button"
            onClick={() => setShowAllTags(false)}
            className="mt-1 rounded-xs px-2.5 py-1 text-2xs font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Show fewer tags
          </button>
        ) : null}
      </section>
    </nav>
  );
}
