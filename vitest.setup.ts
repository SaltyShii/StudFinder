// Node 25+ has its own global localStorage, undefined without --localstorage-file, and it hides jsdom's.
if (typeof document !== 'undefined' && !globalThis.localStorage) {
	const items = new Map<string, string>();
	const storage: Storage = {
		get length() { return items.size; },
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => { items.delete(key); },
		setItem: (key, value) => { items.set(key, String(value)); },
	};
	Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}
