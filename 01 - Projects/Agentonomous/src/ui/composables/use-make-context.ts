import { inject } from 'vue';
import type { MakeContext } from '../../modules/make/make-context.js';
import { MakeContextKey } from '../make-context-key.js';

/**
 * Retrieve the MakeContext from the current Vue app's provide chain.
 * Throws if not provided — this indicates a missing provide() call at
 * app mount or a component mounted outside the app (e.g. Storybook
 * without the decorator, or a test without the correct fixture).
 */
export function useMakeContext(): MakeContext {
	const ctx = inject(MakeContextKey);
	if (ctx === undefined) {
		throw new Error(
			'MakeContextKey not provided — either MakeModule was not initialised before createVueApp(), '
			+ 'or provide(MakeContextKey, ...) was not called. See src/ui/make-context-factory.ts.',
		);
	}
	return ctx;
}
