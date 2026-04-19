import type { ModulePorts } from '../../domain/shared/module.js';
import type { Result } from '../../domain/shared/result.js';
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { MakeError } from '../../domain/make/errors.js';
import type {
	CreateInstanceOptions, DeleteTypeOptions, DeleteTypeReport, InstanceRef, KpiSnapshot, ListTypesResult, NewTypeDraft, TypeSchemaPatch,
} from '../../domain/make/types.js';
import { createTypeOps, type TypeServiceMethods } from './make-service-types.js';
import { createInstanceOps, type InstanceServiceMethods } from './make-service-instances.js';
import { createMaintenanceOps } from './make-service-maintenance.js';

export interface MakeService {
	listTypes(): Promise<Result<ListTypesResult, MakeError>>;
	loadType(typeId: string): Promise<Result<TypeSchema, MakeError>>;
	createType(draft: NewTypeDraft): Promise<Result<TypeSchema, MakeError>>;
	updateType(typeId: string, changes: TypeSchemaPatch, options?: { acknowledgeRenames?: boolean }): Promise<Result<TypeSchema, MakeError>>;
	deleteType(typeId: string, options: DeleteTypeOptions): Promise<Result<DeleteTypeReport, MakeError>>;
	listInstances(typeId: string): Promise<Result<readonly InstanceRef[], MakeError>>;
	createInstance(typeId: string, raw: Record<string, unknown>, explicitFilename: string | null, options?: CreateInstanceOptions): Promise<Result<InstanceRef, MakeError>>;
	deleteInstance(path: string): Promise<Result<void, MakeError>>;
	deleteCorruptFile(path: string): Promise<Result<void, MakeError>>;
	regenerateBaseFile(typeId: string, options?: { force?: boolean }): Promise<Result<string, MakeError>>;
	toggleFavorite(typeId: string): Promise<Result<boolean, MakeError>>;
	getKpis(): Promise<KpiSnapshot>;
}

export function createMakeService(ports: ModulePorts, getSettings: () => MakeSettings): MakeService {
	// Forward-declared peer refs: the three sub-modules cross-reference each other,
	// so each peer wrapper reads from a ref that is assigned after construction.
	// The non-null `!` is safe because callers can only reach methods after the
	// facade returns, by which point all refs have been assigned.
	const typesRef: { current: TypeServiceMethods | null } = { current: null };
	const instancesRef: { current: InstanceServiceMethods | null } = { current: null };

	const types = createTypeOps(ports, getSettings, {
		listInstances: (typeId) => instancesRef.current!.listInstances(typeId),
	});
	typesRef.current = types;

	const instances = createInstanceOps(ports, getSettings, {
		loadType:  (typeId) => typesRef.current!.loadType(typeId),
		listTypes: () => typesRef.current!.listTypes(),
	});
	instancesRef.current = instances;

	const maintenance = createMaintenanceOps(ports, getSettings, {
		loadType: (typeId) => typesRef.current!.loadType(typeId),
	});

	return { ...types, ...instances, ...maintenance };
}
