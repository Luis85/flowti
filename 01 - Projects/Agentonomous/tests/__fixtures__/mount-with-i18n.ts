import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { Component } from 'vue';
import type { Router } from 'vue-router';
import enMessages from '../../src/modules/make/locales/en.json' with { type: 'json' };

export function mountWithI18n<T extends Component>(
	component: T,
	options: { router?: Router; props?: Record<string, unknown>; attachTo?: Element } = {},
): VueWrapper<InstanceType<T>> {
	const i18n = createI18n({
		legacy: false,
		locale: 'en',
		fallbackLocale: 'en',
		messages: { en: enMessages },
	});
	const plugins = [i18n];
	if (options.router) plugins.push(options.router);
	return mount(component, {
		global: { plugins },
		props: options.props,
		attachTo: options.attachTo,
	}) as VueWrapper<InstanceType<T>>;
}
