<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
	label:    string;
	value:    number;
	testid?:  string;
	loading?: boolean;
}>(), { testid: 'kpi-card', loading: false });

const displayValue = computed<string>(() => props.loading ? '—' : String(props.value));
</script>

<template>
	<div :data-testid="testid" class="kpi-card">
		<span :data-testid="`${testid}-value`" class="kpi-card__value">{{ displayValue }}</span>
		<span :data-testid="`${testid}-label`" class="kpi-card__label">{{ label }}</span>
	</div>
</template>

<style scoped>
.kpi-card {
	display: flex;
	flex-direction: column;
	gap: 0.125rem;
	padding: 0.75rem 1rem;
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	min-width: 6rem;
	text-align: center;
}
.kpi-card__value { font-size: 1.75rem; font-weight: 600; color: var(--text-normal); line-height: 1.1; }
.kpi-card__label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
</style>
