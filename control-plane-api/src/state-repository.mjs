import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { createInitialControlPlaneState } from './store.mjs';

export async function createControlPlaneStateRepository(options = {}) {
  const resolvedPath = options.filePath ? resolve(process.cwd(), options.filePath) : null;
  let state = createInitialControlPlaneState();
  let writeQueue = Promise.resolve();

  async function persistToDisk() {
    if (!resolvedPath) {
      return;
    }

    await mkdir(dirname(resolvedPath), { recursive: true });
    const tempPath = `${resolvedPath}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempPath, resolvedPath);
  }

  async function queuePersist() {
    writeQueue = writeQueue.then(() => persistToDisk());
    await writeQueue;
  }

  if (resolvedPath) {
    try {
      const raw = await readFile(resolvedPath, 'utf8');
      state = JSON.parse(raw);
    } catch {
      await persistToDisk();
    }
  }

  return {
    getState() {
      return state;
    },
    async persist() {
      await queuePersist();
    },
    async reset(options = {}) {
      state = createInitialControlPlaneState();

      if (!resolvedPath) {
        return;
      }

      if (options.preservePersistedState) {
        return;
      }

      await rm(resolvedPath, { force: true });
    },
  };
}