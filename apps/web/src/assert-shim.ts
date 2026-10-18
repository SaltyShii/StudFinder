// The vendored sim imports node:assert; the browser needs a stand-in with the same throw-on-false contract.
export function strict(condition: unknown, message?: string): asserts condition {
	if (!condition) throw new Error(message ?? 'Assertion failed');
}
