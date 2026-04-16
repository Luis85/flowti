import type { InjectionKey } from 'vue';
import type { PluginContext } from '../plugin.js';

export const PluginContextKey: InjectionKey<PluginContext> = Symbol('AgentonomousPluginContext');
