/**
 * Doc path delegation methods for DataExchangeService.
 *
 * Extracted from DataExchangeService.ts to stay under max-lines.
 * These are thin pass-throughs to ConfigDocService.
 */

import type { ConfigDocService } from "./ConfigDocService";

export interface DocDelegationDeps {
	configDocService: ConfigDocService;
}

/** Mixin that adds doc delegation methods to the service. */
export function createDocDelegation(deps: DocDelegationDeps) {
	const { configDocService } = deps;
	return {
		getCsvDocPath: (csvPath: string): string => configDocService.getCsvDocPath(csvPath),
		resolveCsvDocPath: (csvPath: string, fileExists: (path: string) => boolean): string => configDocService.resolveCsvDocPath(csvPath, fileExists),
		createCsvDoc: (csvPath: string, headers: string[], rowCount: number, delimiter?: string): Promise<string> => configDocService.createCsvDoc(csvPath, headers, rowCount, delimiter),
		getConfigDocPath: (configName: string, configType: "import" | "export"): string => configDocService.getConfigDocPath(configName, configType),
		ensureConfigDoc: (configName: string, configType: "import" | "export"): Promise<string> => configDocService.ensureConfigDoc(configName, configType),
		ensurePipelineDoc: (pipelineId: string): Promise<string> => configDocService.ensurePipelineDoc(pipelineId),
		getConfigsFolderPath: (): string => configDocService.getConfigsFolderPath(),
		getReportsFolderPath: (): string => configDocService.getReportsFolderPath(),
		getPropertiesFolderPath: (): string => configDocService.getPropertiesFolderPath(),
		getPropertyDocPath: (propertyName: string): string => configDocService.getPropertyDocPath(propertyName),
		createPropertyDoc: (propertyName: string): Promise<string> => configDocService.createPropertyDoc(propertyName),
		getTypesFolderPath: (): string => configDocService.getTypesFolderPath(),
		getEventDocPath: (eventType: string): string => configDocService.getEventDocPath(eventType),
		getTypeDocPath: (typeName: string): string => configDocService.getTypeDocPath(typeName),
		getPipelineDocPath: (pipelineName: string): string => configDocService.getPipelineDocPath(pipelineName),
		createOrUpdateTypeDoc: (typeName: string): Promise<void> => configDocService.createOrUpdateTypeDoc(typeName),
	};
}
