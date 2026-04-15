import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
	const greeting = ref<string>('Hello from Agentonomous');
	const pluginVersion = ref<string>('0.0.0');

	function setVersion(next: string): void {
		pluginVersion.value = next;
	}

	return { greeting, pluginVersion, setVersion };
});
