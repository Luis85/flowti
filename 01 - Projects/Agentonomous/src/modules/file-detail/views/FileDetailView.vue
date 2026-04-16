<script setup lang="ts">
import PanelLayout from '../../../ui/layouts/PanelLayout.vue';

type FileAnalysisSummary = Record<string, string | number>;

const props = defineProps<{
	analysis: { fileName: string; extension: string; sizeBytes: number; summary: FileAnalysisSummary } | null;
	error: string | null;
	onOpenInEditor?: () => void;
}>();
</script>

<template>
	<PanelLayout>
		<template #header>File Detail</template>

		<div class="file-detail">
			<div v-if="props.error !== null" class="file-detail__error">
				{{ props.error }}
			</div>

			<div v-else-if="props.analysis === null" class="file-detail__empty">
				No file selected.
			</div>

			<div v-else class="file-detail__card">
				<div class="file-detail__header">
					<span class="file-detail__name">{{ props.analysis.fileName }}</span>
					<span class="file-detail__size">{{ props.analysis.sizeBytes }} bytes</span>
				</div>

				<table class="file-detail__summary">
					<tbody>
						<tr
							v-for="(value, key) in props.analysis.summary"
							:key="key"
						>
							<th>{{ key }}</th>
							<td>{{ value }}</td>
						</tr>
					</tbody>
				</table>

				<button
					v-if="props.onOpenInEditor !== undefined"
					class="file-detail__open-btn"
					@click="props.onOpenInEditor()"
				>
					Open in editor
				</button>
			</div>
		</div>
	</PanelLayout>
</template>

<style scoped>
.file-detail {
	font-size: 13px;
}

.file-detail__error,
.file-detail__empty {
	color: var(--text-muted);
	text-align: center;
	padding-top: 16px;
}

.file-detail__card {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.file-detail__header {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 8px;
}

.file-detail__name {
	font-weight: 600;
	word-break: break-all;
}

.file-detail__size {
	color: var(--text-muted);
	white-space: nowrap;
}

.file-detail__summary {
	width: 100%;
	border-collapse: collapse;
}

.file-detail__summary th,
.file-detail__summary td {
	text-align: left;
	padding: 3px 6px;
	border-bottom: 1px solid var(--background-modifier-border);
}

.file-detail__summary th {
	color: var(--text-muted);
	font-weight: normal;
	width: 40%;
}

.file-detail__open-btn {
	align-self: flex-start;
	margin-top: 4px;
}
</style>
