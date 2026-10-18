import { expect, test } from 'vitest';
import { strict } from './assert-shim';

test('throws on a falsy condition and passes on a truthy one', () => {
	expect(() => strict(false, 'boom')).toThrow('boom');
	expect(() => strict(1)).not.toThrow();
});
