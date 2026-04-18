import type { ModulePorts } from '../../domain/shared/module.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { trySync } from '../../domain/shared/try-async.js';
import { parseTypeSchema } from '../../domain/make/type-schema-codec.js';
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { MakeError } from '../../domain/make/errors.js';
import type {
	DeleteTypeOptions, DeleteTypeReport, InstanceRef, KpiSnapshot, NewTypeDraft, TypeSchemaPatch,
} from '../../domain/make/types.js';

export interface MakeService {
	listTypes(): Promise<Result<readonly TypeSchema[], MakeError>>;
	loadType(typeId: string): Promise<Result<TypeSchema, MakeError>>;
	createType(draft: NewTypeDraft): Promise<Result<TypeSchema, MakeError>>;
	updateType(typeId: string, changes: TypeSchemaPatch): Promise<Result<TypeSchema, MakeError>>;
	deleteType(typeId: string, options: DeleteTypeOptions): Promise<Result<DeleteTypeReport, MakeError>>;
	listInstances(typeId: string): Promise<Result<readonly InstanceRef[], MakeError>>;
	createInstance(typeId: string, raw: Record<string, unknown>, explicitFilename: string | null): Promise<Result<InstanceRef, MakeError>>;
	deleteInstance(path: string): Promise<Result<void, MakeError>>;
	regenerateBaseFile(typeId: string): Promise<Result<string, MakeError>>;
	toggleFavorite(typeId: string): Promise<void>;
	getKpis(): Promise<KpiSnapshot>;
}

export function createMakeService(ports: ModulePorts, getSettings: () => MakeSettings): MakeService {
	async function listTypes(): Promise<Result<readonly TypeSchema[], MakeError>> {
		const settings = getSettings();
		const listResult = await ports.vault.list(settings.typesFolder);
		if (listResult.kind === 'err') {
			// The fake and real adapters return an err when the folder does not exist.
			// Treat that as "no types yet" — an empty result, not an error. Any other vault
			// error would also collapse to empty here; this is a known trade-off. If users
			// report confusion from mis-configured folders, revisit: we can read the error
			// and surface vault-error when the folder *exists but is unreadable*.
			return ok([]);
		}
		const prefix = settings.typesFolder.endsWith('/') ? settings.typesFolder : `${settings.typesFolder}/`;
		const children = listResult.value.filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/') && p.endsWith('.json'));
		const schemas: TypeSchema[] = [];
		for (const path of children) {
			const read = await ports.vault.read(path);
			if (read.kind === 'err') continue;
			const parsed = trySync(() => JSON.parse(read.value.content) as unknown, { code: 'MAKE_JSON_PARSE', source: 'make' });
			if (parsed.kind === 'err') continue;
			const schema = parseTypeSchema(parsed.value);
			if (schema.kind === 'ok') schemas.push(schema.value);
		}
		return ok(schemas);
	}

	async function loadType(typeId: string): Promise<Result<TypeSchema, MakeError>> {
		const settings = getSettings();
		const path = `${settings.typesFolder.replace(/\/$/, '')}/${typeId}.json`;
		const exists = await ports.vault.exists(path);
		if (!exists) return err({ kind: 'type-not-found', typeId });
		const read = await ports.vault.read(path);
		if (read.kind === 'err') return err({ kind: 'vault-error', cause: read.error });
		const parsed = trySync(() => JSON.parse(read.value.content) as unknown, { code: 'MAKE_JSON_PARSE', source: 'make' });
		if (parsed.kind === 'err') return err({ kind: 'invalid-schema', issues: [{ kind: 'invalid-json', reason: parsed.error.message }] });
		const schemaResult = parseTypeSchema(parsed.value);
		if (schemaResult.kind === 'err') return err({ kind: 'invalid-schema', issues: [schemaResult.error] });
		return ok(schemaResult.value);
	}

	const notImpl = <T>(): Promise<Result<T, MakeError>> => Promise.resolve(err({ kind: 'not-implemented' }));

	return {
		listTypes,
		loadType,
		createType: () => notImpl(),
		updateType: () => notImpl(),
		deleteType: () => notImpl(),
		listInstances: () => notImpl(),
		createInstance: () => notImpl(),
		deleteInstance: () => notImpl(),
		regenerateBaseFile: () => notImpl(),
		toggleFavorite: () => Promise.resolve(),
		getKpis: () => Promise.resolve({ typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] }),
	};
}
