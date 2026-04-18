<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	state: 'missing' | 'stale';
	generatedAt?: string;
	regenerateLoading: boolean;
	regenerateError: string | null;
}>();

const emit = defineEmits<{ regenerate: [] }>();
const { t } = useI18n();

const title = computed(() => t(`make.type.basefile.${props.state}.title`));
const body = computed(() => {
	if (props.state === 'stale') {
		const date = props.generatedAt?.slice(0, 10) ?? '';
		return t('make.type.basefile.stale.body', { date });
	}
	return t('make.type.basefile.missing.body');
});
const buttonLabel = computed(() => props.regenerateLoading
	? t('make.type.basefile.regenerating')
	: t('make.type.basefile.regenerateCta'));
</script>

<template>
	<div role="status" data-testid="base-file-banner" class="base-banner">
		<div class="base-banner__text">
			<strong data-testid="base-file-banner-title">⚠ {{ title }}</strong>
			<p>{{ body }}</p>
			<p v-if="regenerateError" data-testid="base-file-banner-error" class="base-banner__error">{{ regenerateError }}</p>
		</div>
		<button
			type="button"
			data-testid="base-file-banner-regenerate"
			:disabled="regenerateLoading"
			:aria-busy="regenerateLoading ? 'true' : 'false'"
			:aria-label="t('make.type.basefile.regenerateCta')"
			@click="emit('regenerate')"
		>
			{{ buttonLabel }}
		</button>
	</div>
</template>

<style scoped>
.base-banner { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 0.75rem 1rem; background: var(--background-modifier-hover); border-left: 3px solid var(--text-warning); border-radius: 3px; }
.base-banner__text strong { display: block; margin-bottom: 0.25rem; }
.base-banner__text p { margin: 0; color: var(--text-muted); font-size: 0.875rem; }
.base-banner__error { color: var(--text-error); margin-top: 0.5rem !important; }
.base-banner button[aria-busy="true"] { opacity: 0.7; cursor: wait; }
</style>
