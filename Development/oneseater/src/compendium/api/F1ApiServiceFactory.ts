// ─────────────────────────────────────────────────────────────
// F1 API Service Factory
// ─────────────────────────────────────────────────────────────

import { F1ApiProvider } from "../models/F1Models";
import { IF1ApiService } from "./F1ApiService";
import { JolpicaApiService } from "./JolpicaApiService";
import { OpenF1ApiService } from "./OpenF1ApiService";

export class F1ApiServiceFactory {
	private static instances: Map<F1ApiProvider, IF1ApiService> = new Map();

	static getService(provider: F1ApiProvider): IF1ApiService {
		if (!this.instances.has(provider)) {
			switch (provider) {
				case 'jolpica':
					this.instances.set(provider, new JolpicaApiService());
					break;
				case 'openf1':
					this.instances.set(provider, new OpenF1ApiService());
					break;
				default:
					throw new Error(`Unbekannter API Provider: ${provider}`);
			}
		}
		const providerInstance = this.instances.get(provider);
		if(!providerInstance) {
			throw new Error(`Unbekannter API Provider: ${provider}`);
		} else {
			return providerInstance
		}
	}

	static getAllProviders(): F1ApiProvider[] {
		return ['jolpica', 'openf1'];
	}
}
