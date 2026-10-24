import type { ReactNode } from 'react';

/** Shared gallery chrome so every demo section reads the same (TASK-003/004). */
export function GallerySection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="surface-panel p-5 sm:p-6">
      <p className="metadata-rail">Primitives</p>
      <h2 id={`${id}-title`} className="mt-2 text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 font-mono text-2xs tracking-wide text-ink-muted uppercase">{label}</p>
      {children}
    </div>
  );
}
