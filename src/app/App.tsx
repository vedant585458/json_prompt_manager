const stackSummary = [
  'React 19 + TypeScript (strict)',
  'Vite with Vitest test runner',
  'Tailwind CSS v4 token pipeline',
  'ESLint + Prettier quality gates',
] as const;

/**
 * Temporary foundation smoke screen.
 *
 * TASK-001 intentionally renders no product UI. Routing, the application shell,
 * and every PromptForge feature arrive in later, explicitly authorized tasks.
 */
export function App() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <section
        aria-labelledby="app-title"
        className="w-full max-w-xl rounded-lg border border-neutral-800 bg-neutral-900/60 p-8"
      >
        <p className="font-mono text-[11px] tracking-[0.18em] text-neutral-500 uppercase">
          TASK-001 · Foundation
        </p>
        <h1 id="app-title" className="mt-3 text-4xl font-semibold tracking-tight text-neutral-50">
          PromptForge
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          The toolchain is ready. Product features are implemented only in later, explicitly
          authorized tasks.
        </p>
        <ul className="mt-6 space-y-2 border-t border-neutral-800 pt-5 font-mono text-xs text-neutral-400">
          {stackSummary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
