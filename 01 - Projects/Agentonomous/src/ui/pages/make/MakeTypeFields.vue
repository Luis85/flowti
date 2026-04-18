<script setup lang="ts">
import type { TypeSchema } from '../../../domain/make/type-schema.js';

defineProps<{ type: TypeSchema }>();
</script>

<template>
	<div class="make-type-fields">
		<p v-if="type.fields.length === 0" data-testid="make-type-fields-empty" class="empty">
			No fields defined on this type.
		</p>
		<table v-else class="fields-table">
			<thead>
				<tr>
					<th>Kind</th><th>Name</th><th>Label</th><th>Required</th><th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="f in type.fields" :key="f.name" :data-testid="`field-row-${f.name}`">
					<td>{{ f.kind }}</td>
					<td>
						{{ f.name }}
						<span
							v-if="f.name === type.titleFieldName"
							:data-testid="`field-title-badge-${f.name}`"
							class="badge badge--title"
						>
							title field
						</span>
					</td>
					<td>{{ f.label ?? '' }}</td>
					<td>{{ f.required ? 'yes' : '' }}</td>
					<td>{{ f.description ?? '' }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style scoped>
.make-type-fields { padding: 0.5rem 0; }
.empty { color: var(--text-muted); }
.fields-table { width: 100%; border-collapse: collapse; }
.fields-table th,
.fields-table td { padding: 0.375rem 0.5rem; border-bottom: 1px solid var(--background-modifier-border); text-align: left; vertical-align: top; }
.fields-table th { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
.badge { display: inline-block; margin-left: 0.5rem; padding: 0.125rem 0.375rem; border-radius: 3px; font-size: 0.6875rem; background: var(--background-modifier-hover); color: var(--text-muted); }
.badge--title { background: var(--interactive-accent); color: var(--text-on-accent); }
</style>
