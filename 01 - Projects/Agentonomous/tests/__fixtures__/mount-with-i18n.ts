import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { Component } from 'vue';
import type { Router } from 'vue-router';
import enMessages from '../../src/modules/make/locales/en.json' with { type: 'json' };

export function mountWithI18n<T extends Component>(
	component: T,
	options: {
		router?: Router;
		props?: Record<string, unknown>;
		attachTo?: Element;
		provide?: Record<PropertyKey, unknown>;
		plugins?: ReadonlyArray<unknown>;
	} = {},
): VueWrapper<InstanceType<T>> {
	const i18n = createI18n({
		legacy: false,
		locale: 'en',
		fallbackLocale: 'en',
		messages: { en: enMessages },
	});
	const plugins: unknown[] = [i18n];
	if (options.router) plugins.push(options.router);
	if (options.plugins) plugins.push(...options.plugins);
	return mount(component, {
		global: {
			plugins,
			provide: options.provide ?? {},
		},
		props: options.props,
		attachTo: options.attachTo,
	}) as VueWrapper<InstanceType<T>>;
}
