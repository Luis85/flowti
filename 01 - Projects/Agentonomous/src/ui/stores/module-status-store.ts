import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ModuleStatus } from '../../plugin.js';

export const useModuleStatusStore = defineStore('module-status', () => {
	const modules = ref<readonly ModuleStatus[]>([]);

	function setModules(list: readonly ModuleStatus[]): void {
		modules.value = list;
	}

	return { modules, setModules };
});
