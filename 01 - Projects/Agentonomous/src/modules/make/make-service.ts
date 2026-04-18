import type { ModulePorts } from '../../domain/shared/module.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { trySync } from '../../domain/shared/try-async.js';
import { parseTypeSchema, serializeTypeSchema } from '../../domain/make/type-schema-codec.js';
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { MakeError, SchemaError } from '../../domain/make/errors.js';
import type {
	DeleteTypeOptions, DeleteTypeReport, InstanceRef, KpiSnapshot, NewTypeDraft, NonEmptyArray, TypeSchemaPatch,
} from '../../domain/make/types.js';
import { slugifyTypeName } from '../../domain/make/type-id.js';
import { validateTypeName, validateFieldName, validateInstancesFolder } from '../../domain/make/name-validation.js';
import { generateBaseYaml } from '../../domain/make/base-file.js';
import { FIELD_KINDS } from '../../domain/make/field-kinds/index.js';

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

	async function listInstances(typeId: string): Promise<Result<readonly InstanceRef[], MakeError>> {
		const typeResult = await loadType(typeId);
		if (typeResult.kind === 'err') return typeResult;
		const type = typeResult.value;
		const folder = type.instancesFolder;
		const listResult = await ports.vault.list(folder);
		if (listResult.kind === 'err') return ok([]);
		const prefix = folder.endsWith('/') ? folder : `${folder}/`;
		const mdFiles = listResult.value.filter((p) =>
			p.startsWith(prefix) && !p.slice(prefix.length).includes('/') && p.endsWith('.md'),
		);
		const refs: InstanceRef[] = [];
		for (const path of mdFiles) {
			const read = await ports.vault.read(path);
			if (read.kind === 'err') {
				ports.logger.warn('make', `skipping unreadable instance ${path}: ${read.error}`);
				continue;
			}
			const stem = path.slice(prefix.length, -'.md'.length);
			refs.push({
				typeId,
				path,
				title: stem,
				createdAt: new Date(read.value.stat.ctime).toISOString(),
				updatedAt: new Date(read.value.stat.mtime).toISOString(),
			});
		}
		return ok(refs);
	}

	const notImpl = <T>(): Promise<Result<T, MakeError>> => Promise.resolve(err({ kind: 'not-implemented' }));

	async function uniqueSlug(baseSlug: string): Promise<string | null> {
		const typesFolder = getSettings().typesFolder.replace(/\/$/, '');
		const basesFolder = getSettings().basesFolder.replace(/\/$/, '');
		for (let i = 1; i <= 100; i++) {
			const candidate = i === 1 ? baseSlug : `${baseSlug}-${i}`;
			const jsonPath = `${typesFolder}/${candidate}.json`;
			const basePath = `${basesFolder}/${candidate}.base`;
			const jsonExists = await ports.vault.exists(jsonPath);
			const baseExists = await ports.vault.exists(basePath);
			if (!jsonExists && !baseExists) return candidate;
		}
		return null;
	}

	function validateDraft(draft: NewTypeDraft): SchemaError[] {
		const errors: SchemaError[] = [];
		for (const field of draft.fields) {
			const nameResult = validateFieldName(field.name);
			if (nameResult.kind === 'err') errors.push(nameResult.error);
			errors.push(...FIELD_KINDS[field.kind].validateField(field as never));
		}
		const nameResult = validateTypeName(draft.name);
		if (nameResult.kind === 'err') errors.push(nameResult.error);
		const folderResult = validateInstancesFolder(draft.instancesFolder);
		if (folderResult.kind === 'err') errors.push(folderResult.error);
		return errors;
	}

	async function writeTypeFiles(
		jsonPath: string, basePath: string, schema: TypeSchema, now: string,
	): Promise<Result<TypeSchema, MakeError>> {
		// Step 5: write type JSON.
		const writeJson = await ports.vault.create(jsonPath, serializeTypeSchema(schema));
		if (writeJson.kind === 'err') return err({ kind: 'vault-error', cause: writeJson.error });
		// Step 6: generate + write base YAML (partial success on failure).
		const writeBase = await ports.vault.create(basePath, generateBaseYaml(schema));
		if (writeBase.kind === 'err') {
			ports.notifications.warn(ports.t.t('make.notify.baseFailed'));
			return ok(schema);
		}
		// Step 7: stamp baseFile + re-write JSON (partial success on failure).
		const stamped: TypeSchema = { ...schema, baseFile: { path: basePath, generatedAt: now } };
		const writeStamp = await ports.vault.update(jsonPath, serializeTypeSchema(stamped));
		if (writeStamp.kind === 'err') {
			ports.notifications.warn(ports.t.t('make.error.baseStampFailed'));
			return ok(schema);
		}
		return ok(stamped);
	}

	async function createType(draft: NewTypeDraft): Promise<Result<TypeSchema, MakeError>> {
		// Step 1: validate all fields + type name + folder.
		const schemaErrors = validateDraft(draft);
		if (schemaErrors.length > 0) {
			return err({ kind: 'invalid-schema', issues: schemaErrors as unknown as NonEmptyArray<SchemaError> });
		}
		// Step 2: soft name uniqueness (in-memory cache shortcut).
		const existing = await listTypes();
		if (existing.kind === 'ok') {
			const collision = existing.value.find((t) => t.name.toLowerCase() === draft.name.toLowerCase());
			if (collision !== undefined) return err({ kind: 'duplicate-name', name: draft.name });
		}
		// Step 3: generate id via disk probe (authoritative).
		const slugResult = await uniqueSlug(slugifyTypeName(draft.name));
		if (slugResult === null) return err({ kind: 'vault-error', cause: 'slug-exhaustion' });
		// Step 4: stamp timestamps.
		const now = new Date().toISOString();
		const typesFolder = getSettings().typesFolder.replace(/\/$/, '');
		const basesFolder = getSettings().basesFolder.replace(/\/$/, '');
		const schemaPreStamp: TypeSchema = {
			id: slugResult,
			name: draft.name,
			...(draft.description !== undefined ? { description: draft.description } : {}),
			instancesFolder: draft.instancesFolder,
			titleFieldName: draft.titleFieldName,
			fields: draft.fields,
			createdAt: now,
			updatedAt: now,
		};
		// Steps 5-7: write files.
		const writeResult = await writeTypeFiles(
			`${typesFolder}/${slugResult}.json`,
			`${basesFolder}/${slugResult}.base`,
			schemaPreStamp, now,
		);
		if (writeResult.kind === 'err') return writeResult;
		// Step 8: emit.
		ports.eventBus.emit('make:type-created', { schema: writeResult.value });
		return writeResult;
	}

	return {
		listTypes,
		loadType,
		createType,
		updateType: () => notImpl(),
		deleteType: () => notImpl(),
		listInstances,
		createInstance: () => notImpl(),
		deleteInstance: () => notImpl(),
		regenerateBaseFile: () => notImpl(),
		toggleFavorite: () => Promise.resolve(),
		getKpis: () => Promise.resolve({ typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] }),
	};
}
