export type EntityConfig = {
  key: string;                 // "drivers", "circuits", ...
  folder: string;              // relativ zum compendiumFolderPath
  templateFile: string;        // relativ zum templatesFolderPath
  idField: string;             // z.B. "driverId" oder "circuitId"
  titleField?: string;         // z.B. "givenName" oder "circuitName"
  // optional: derived tokens
  mapRow?: (row: Record<string, any>) => Record<string, any>;
};

export class EntityRegistry {
  private configs = new Map<string, EntityConfig>();

  register(config: EntityConfig) {
    this.configs.set(config.key, config);
  }

  get(key: string): EntityConfig | undefined {
    const cfg = this.configs.get(key);
    return cfg;
  }

  tryGet(key: string) {
	return this.configs.get(key);
	}
}
