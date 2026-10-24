import { describe, expect, it } from 'vitest';

import { StaleWriteError, createInMemoryRepositories, type Repositories } from '@/data';
import { createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { JsonObject } from '@/domain/types';
import { createDataStore, type DataStore } from '@/store/dataStore';

const SCHEMA: JsonObject = {
  type: 'object',
  required: ['name'],
  properties: { name: { type: 'string', minLength: 3 } },
};

function createClock(start = '2026-10-24T09:00:00.000Z', stepMs = 1000) {
  let current = new Date(start).getTime();
  return () => {
    const value = new Date(current);
    current += stepMs;
    return value;
  };
}

async function createHarness() {
  const repositories = await createInMemoryRepositories();
  const store = createDataStore({
    now: createClock(),
    newId: (() => {
      let counter = 0;
      return () => `id-${++counter}`;
    })(),
  });
  store.getState().attach(repositories, 'durable');
  await store.getState().hydrate();

  return { repositories: repositories as Repositories, store: store as DataStore };
}

describe('schema library', () => {
  it('creates a schema, stores it, and exposes it in state', async () => {
    const { repositories, store } = await createHarness();

    const schema = await store.getState().addSchema({
      name: 'Invoice shape',
      description: 'Required by the finance extraction prompts.',
      schemaContent: SCHEMA,
    });

    expect(schema.name).toBe('Invoice shape');
    expect(store.getState().schemas).toHaveLength(1);
    await expect(repositories.schemas.get(schema.id)).resolves.toMatchObject({
      name: 'Invoice shape',
    });
  });

  it('renames and rewrites a schema, moving updatedAt forward', async () => {
    const { repositories, store } = await createHarness();
    const schema = await store.getState().addSchema({ name: 'Old name', schemaContent: SCHEMA });

    const updated = await store.getState().updateSchema(schema.id, {
      name: 'New name',
      schemaContent: { type: 'object' },
    });

    expect(updated.name).toBe('New name');
    expect(updated.updatedAt > schema.updatedAt).toBe(true);
    await expect(repositories.schemas.get(schema.id)).resolves.toMatchObject({
      name: 'New name',
      schemaContent: { type: 'object' },
    });
  });

  it('rejects an update to a schema that no longer exists', async () => {
    const { store } = await createHarness();
    await expect(store.getState().updateSchema('missing', { name: 'x' })).rejects.toBeInstanceOf(
      Error,
    );
  });

  it('refuses to attach a schema that is not stored', async () => {
    const { store } = await createHarness();
    const prompt = createPrompt(
      { title: 'Invoice parser', content: createBlankDocument({ name: 'Invoice parser' }) },
      { now: createClock(), newId: () => 'alpha' },
    );
    await store.getState().addPrompt({ title: prompt.title, content: prompt.content });

    const [stored] = store.getState().prompts;
    if (!stored) throw new Error('prompt missing');

    await expect(store.getState().setPromptSchema(stored.id, 'ghost')).rejects.toThrow(
      /no longer exists/,
    );
  });

  it('attaches and detaches a schema on one prompt', async () => {
    const { repositories, store } = await createHarness();
    const schema = await store
      .getState()
      .addSchema({ name: 'Invoice shape', schemaContent: SCHEMA });
    await store.getState().addPrompt({ title: 'Invoice parser' });

    const [prompt] = store.getState().prompts;
    if (!prompt) throw new Error('prompt missing');

    const attached = await store.getState().setPromptSchema(prompt.id, schema.id);
    expect(attached.schemaId).toBe(schema.id);
    expect(attached.version).toBe(prompt.version + 1);
    await expect(repositories.prompts.get(prompt.id)).resolves.toMatchObject({
      schemaId: schema.id,
    });

    const detached = await store.getState().setPromptSchema(prompt.id, null);
    expect(detached.schemaId).toBeNull();
  });

  it('deletes a schema and detaches it from every prompt that used it, atomically', async () => {
    const { repositories, store } = await createHarness();
    const schema = await store
      .getState()
      .addSchema({ name: 'Invoice shape', schemaContent: SCHEMA });

    await store.getState().addPrompt({ title: 'First' });
    await store.getState().addPrompt({ title: 'Second' });
    for (const prompt of store.getState().prompts) {
      await store.getState().setPromptSchema(prompt.id, schema.id);
    }

    const result = await store.getState().deleteSchema(schema.id);

    expect(result.detachedPrompts).toBe(2);
    expect(store.getState().schemas).toHaveLength(0);
    expect(store.getState().prompts.every((prompt) => prompt.schemaId === null)).toBe(true);
    // Created (1) → schema attached (2) → detached by the delete (3).
    expect(store.getState().prompts.every((prompt) => prompt.version === 3)).toBe(true);
    await expect(repositories.schemas.get(schema.id)).resolves.toBeNull();
    await expect(
      repositories.prompts.get(store.getState().prompts[0]?.id ?? ''),
    ).resolves.toMatchObject({
      schemaId: null,
    });
  });

  it('refuses to delete a schema that is already gone', async () => {
    const { store } = await createHarness();
    await expect(store.getState().deleteSchema('missing')).rejects.toThrow(/no longer exists/);
  });

  it('deletes an unused schema without touching any prompt', async () => {
    const { store } = await createHarness();
    const schema = await store.getState().addSchema({ name: 'Unused', schemaContent: SCHEMA });
    await store.getState().addPrompt({ title: 'Unrelated' });
    const [prompt] = store.getState().prompts;

    const result = await store.getState().deleteSchema(schema.id);

    expect(result.detachedPrompts).toBe(0);
    expect(store.getState().schemas).toHaveLength(0);
    expect(store.getState().prompts[0]?.version).toBe(prompt?.version);
  });

  it('refuses to attach anything to a prompt that does not exist', async () => {
    const { store } = await createHarness();
    const schema = await store.getState().addSchema({ name: 'Shape', schemaContent: SCHEMA });

    await expect(store.getState().setPromptSchema('ghost', schema.id)).rejects.toThrow(
      /Prompt ghost no longer exists/,
    );
  });

  it('leaves the schema in place when detaching cannot be written', async () => {
    const { repositories, store } = await createHarness();
    const schema = await store
      .getState()
      .addSchema({ name: 'Invoice shape', schemaContent: SCHEMA });
    await store.getState().addPrompt({ title: 'First' });

    const [prompt] = store.getState().prompts;
    if (!prompt) throw new Error('prompt missing');
    await store.getState().setPromptSchema(prompt.id, schema.id);

    // Someone else wrote the prompt first: the detach batch is stale.
    const current = await repositories.prompts.get(prompt.id);
    if (!current) throw new Error('prompt missing');
    await repositories.prompts.update(
      { ...current, version: current.version + 1 },
      { expectedVersion: current.version },
    );

    await expect(store.getState().deleteSchema(schema.id)).rejects.toBeInstanceOf(StaleWriteError);
    await expect(repositories.schemas.get(schema.id)).resolves.toMatchObject({
      name: 'Invoice shape',
    });
  });
});
