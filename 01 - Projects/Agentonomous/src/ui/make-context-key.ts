import type { InjectionKey } from 'vue';
import type { MakeContext } from '../modules/make/make-context.js';

export const MakeContextKey: InjectionKey<MakeContext> = Symbol('MakeContext');
