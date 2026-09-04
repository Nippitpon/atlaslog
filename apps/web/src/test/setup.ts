// Vitest runs in the node environment (no DOM), but both stores are wrapped in
// zustand's `persist`, which reaches for localStorage the moment the module is
// imported. An in-memory stand-in keeps persistence on the same code path the
// browser takes instead of leaving the middleware in its "storage unavailable"
// fallback.
const mem = new Map<string, string>()

const storage: Storage = {
  get length() { return mem.size },
  key: (i: number) => [...mem.keys()][i] ?? null,
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
  clear: () => { mem.clear() },
}

Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true })
