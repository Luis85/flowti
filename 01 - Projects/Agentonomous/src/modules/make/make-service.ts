import type { ModulePorts } from '../../domain/shared/module.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { trySync } from '../../domain/shared/try-async.js';
import { parseTypeSchema, serializeTypeSchema } from '../../domain/make/type-schema-codec.js';
import type { Field, TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { FieldRename, MakeError, SchemaError } from '../../domain/make/errors.js';
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
	updateType(typeId: string, changes: TypeSchemaPatch, options?: { acknowledgeRenames?: boolean }): Promise<Result<TypeSchema, MakeError>>;
	deleteType(typeId: string, options: DeleteTypeOptions): Promise<Result<DeleteTypeReport, MakeError>>;
	listInstances(typeId: string): Promise<Result<readonly InstanceRef[], MakeError>>;
	createInstance(typeId: string, raw: Record<string, unknown>, explicitFilename: string | null): Promise<Result<InstanceRef, MakeError>>;
	deleteInstance(path: string): Promise<Result<void, MakeError>>;
	regenerateBaseFile(typeId: string, options?: { force?: boolean }): Promise<Result<string, MakeError>>;
	toggleFavorite(typeId: string): Promise<Result<boolean, MakeError>>;
	getKpis(): Promise<KpiSnapshot>;
}

export function createMakeService(ports: ModulePorts, getSettings: () => MakeSettings): MakeService {
	async function listTypes(): Promise<Result<readonly TypeSchema[], MakeError>> {
		const settings = getSettings();
		const folderExists = await ports.vault.exists(settings.typesFolder);
		if (!folderExists) return ok([]);
		const listResult = await ports.vault.list(settings.typesFolder);
		if (listResult.kind === 'err') {
			return err({ kind: 'vault-error', cause: String(listResult.error) });
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
		// Orphan-base reconciliation: if the loaded schema has no baseFile stamp but a
		// .base file exists at the conventional path, adopt it as the baseFile. This
		// self-heals after a crash between createType steps 6 and 7 (see Chunk 3 spec §3).
		let schemaWithBase = schemaResult.value;
		if (schemaWithBase.baseFile === undefined) {
			const basesFolder = settings.basesFolder.replace(/\/$/, '');
			const conventionalPath = `${basesFolder}/${schemaWithBase.id}.base`;
			const baseExists = await ports.vault.exists(conventionalPath);
			if (baseExists) {
				const baseRead = await ports.vault.read(conventionalPath);
				if (baseRead.kind === 'ok') {
					const mtimeIso = new Date(baseRead.value.stat.mtime).toISOString();
					schemaWithBase = { ...schemaWithBase, baseFile: { path: conventionalPath, generatedAt: mtimeIso } };
				}
			}
		}
		return ok(schemaWithBase);
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

	function validateSchema(schema: {
		readonly name: string;
		readonly instancesFolder: string;
		readonly fields: readonly (Field)[];
	}): SchemaError[] {
		const errors: SchemaError[] = [];
		for (const field of schema.fields) {
			const nameResult = validateFieldName(field.name);
			if (nameResult.kind === 'err') errors.push(nameResult.error);
			errors.push(...FIELD_KINDS[field.kind].validateField(field as never));
		}
		const nameResult = validateTypeName(schema.name);
		if (nameResult.kind === 'err') errors.push(nameResult.error);
		const folderResult = validateInstancesFolder(schema.instancesFolder);
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
		const schemaErrors = validateSchema(draft);
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

	async function updateType(
		typeId: string,
		changes: TypeSchemaPatch,
		options: { acknowledgeRenames?: boolean } = {},
	): Promise<Result<TypeSchema, MakeError>> {
		const current = await loadType(typeId);
		if (current.kind === 'err') return current;
		const next: TypeSchema = {
			...current.value,
			...changes,
			updatedAt: new Date().toISOString(),
		};
		// Detect field renames (position-wise, same kind, different name, old name not elsewhere).
		if (options.acknowledgeRenames !== true && changes.fields !== undefined) {
			const renames: FieldRename[] = [];
			const currentFields = current.value.fields;
			for (let i = 0; i < Math.min(currentFields.length, next.fields.length); i++) {
				const before = currentFields[i]!;
				const after = next.fields[i]!;
				if (before.kind === after.kind && before.name !== after.name && !next.fields.some((f) => f.name === before.name)) {
					renames.push({ oldName: before.name, newName: after.name, position: i });
				}
			}
			if (renames.length > 0) {
				const instanceList = await listInstances(typeId);
				const affectedCount = instanceList.kind === 'ok' ? instanceList.value.length : 0;
				return err({
					kind: 'invalid-schema',
					issues: [{ kind: 'field-rename-warning', renames, affectedCount }] as unknown as NonEmptyArray<SchemaError>,
				});
			}
		}
		// Re-validate merged schema via the same rules createType uses.
		const schemaErrors = validateSchema(next);
		if (schemaErrors.length > 0) {
			return err({ kind: 'invalid-schema', issues: schemaErrors as unknown as NonEmptyArray<SchemaError> });
		}
		// Name uniqueness only if name changed.
		if (changes.name !== undefined && changes.name !== current.value.name) {
			const existing = await listTypes();
			if (existing.kind === 'ok') {
				const collision = existing.value.find(
					(t) => t.id !== current.value.id && t.name.toLowerCase() === next.name.toLowerCase(),
				);
				if (collision !== undefined) return err({ kind: 'duplicate-name', name: next.name });
			}
		}
		// Write — use update (file exists).
		const jsonPath = `${getSettings().typesFolder.replace(/\/$/, '')}/${next.id}.json`;
		const writeResult = await ports.vault.update(jsonPath, serializeTypeSchema(next));
		if (writeResult.kind === 'err') return err({ kind: 'vault-error', cause: writeResult.error });
		ports.eventBus.emit('make:type-updated', { schema: next });
		return ok(next);
	}

	async function deleteType(
		typeId: string,
		options: DeleteTypeOptions,
	): Promise<Result<DeleteTypeReport, MakeError>> {
		if (options.alsoDeleteInstances === true) {
			return err({ kind: 'not-implemented', feature: 'instance-cascade' });
		}
		const current = await loadType(typeId);
		if (current.kind === 'err') return current;
		const schema = current.value;
		const typesFolder = getSettings().typesFolder.replace(/\/$/, '');
		const basesFolder = getSettings().basesFolder.replace(/\/$/, '');
		const jsonPath = `${typesFolder}/${schema.id}.json`;
		const deleteJson = await ports.vault.delete(jsonPath);
		if (deleteJson.kind === 'err') return err({ kind: 'vault-error', cause: deleteJson.error });
		let baseFileDeleted = false;
		if (options.alsoDeleteBaseFile && schema.baseFile !== undefined) {
			// Safety: only delete if path lives under current basesFolder.
			const expectedPrefix = `${basesFolder}/`;
			if (schema.baseFile.path.startsWith(expectedPrefix)) {
				const deleteBase = await ports.vault.delete(schema.baseFile.path);
				if (deleteBase.kind === 'ok') {
					baseFileDeleted = true;
				} else {
					ports.notifications.warn(ports.t.t('make.notify.baseDeleteFailed'));
				}
			} else {
				ports.logger.warn('make', `base file at '${schema.baseFile.path}' lives outside configured basesFolder '${basesFolder}' — not deleted`);
				ports.notifications.info(ports.t.t('make.notify.baseLeftAlone'));
			}
		}
		ports.eventBus.emit('make:type-deleted', { typeId: schema.id, name: schema.name });
		return ok({ instancesDeleted: 0, instanceFailures: [], baseFileDeleted });
	}

	async function regenerateBaseFile(
		typeId: string,
		options: { force?: boolean } = {},
	): Promise<Result<string, MakeError>> {
		const current = await loadType(typeId);
		if (current.kind === 'err') return current;
		const schema = current.value;
		const basesFolder = getSettings().basesFolder.replace(/\/$/, '');
		const path = `${basesFolder}/${schema.id}.base`;
		const yaml = generateBaseYaml(schema);
		// User-edit check (skipped when force: true).
		if (options.force !== true) {
			const existsAtPath = await ports.vault.exists(path);
			if (existsAtPath) {
				const read = await ports.vault.read(path);
				if (read.kind === 'ok' && read.value.content !== yaml) {
					return err({ kind: 'base-generation-failed', cause: 'user-edited' });
				}
			}
		}
		// Write (exists → update, else → create).
		const existsFinal = await ports.vault.exists(path);
		const writeResult = existsFinal
			? await ports.vault.update(path, yaml)
			: await ports.vault.create(path, yaml);
		if (writeResult.kind === 'err') return err({ kind: 'vault-error', cause: writeResult.error });
		// Stamp schema.baseFile.generatedAt.
		const now = new Date().toISOString();
		const stamped: TypeSchema = { ...schema, baseFile: { path, generatedAt: now } };
		const typesFolder = getSettings().typesFolder.replace(/\/$/, '');
		const writeStamp = await ports.vault.update(`${typesFolder}/${schema.id}.json`, serializeTypeSchema(stamped));
		if (writeStamp.kind === 'err') return err({ kind: 'vault-error', cause: writeStamp.error });
		ports.eventBus.emit('make:base-regenerated', { typeId: schema.id, basePath: path });
		return ok(path);
	}

	async function toggleFavorite(typeId: string): Promise<Result<boolean, MakeError>> {
		const current = getSettings();
		const wasFavorited = current.favorites.includes(typeId);
		const nextFavorites = wasFavorited
			? current.favorites.filter((id) => id !== typeId)
			: [...current.favorites, typeId];
		const saveResult = await ports.settings.saveSection('make', { ...current, favorites: nextFavorites });
		if (saveResult.kind === 'err') {
			ports.notifications.warn(ports.t.t('make.error.favoriteFailed'));
			return err({ kind: 'vault-error', cause: saveResult.error });
		}
		const favorited = !wasFavorited;
		ports.eventBus.emit('make:favorite-toggled', { typeId, favorited });
		return ok(favorited);
	}

	return {
		listTypes,
		loadType,
		createType,
		updateType,
		deleteType,
		listInstances,
		createInstance: () => notImpl(),
		deleteInstance: () => notImpl(),
		regenerateBaseFile,
		toggleFavorite,
		getKpis: () => Promise.resolve({ typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] }),
	};
}
