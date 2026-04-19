import type { ModulePorts } from '../../domain/shared/module.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { FieldError, MakeError } from '../../domain/make/errors.js';
import type { CreateInstanceOptions, InstanceRef, NonEmptyArray } from '../../domain/make/types.js';
import {
	renderInstanceContent, resolveInstancePath, validateInstanceValues,
} from '../../domain/make/instance-ops.js';
import type { MakeService } from './make-service.js';

export type InstanceServiceMethods = Pick<MakeService, 'listInstances' | 'createInstance' | 'deleteInstance'>;

export interface InstanceOpsPeers {
	loadType: (typeId: string) => Promise<Result<TypeSchema, MakeError>>;
}

function basename(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? path : path.slice(idx + 1);
}

export function createInstanceOps(
	ports: ModulePorts,
	_getSettings: () => MakeSettings,
	peers: InstanceOpsPeers,
): InstanceServiceMethods {
	const notImpl = <T>(): Promise<Result<T, MakeError>> => Promise.resolve(err({ kind: 'not-implemented' }));

	async function listInstances(typeId: string): Promise<Result<readonly InstanceRef[], MakeError>> {
		const typeResult = await peers.loadType(typeId);
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

	function mapPathError(reason: 'no-title-field-and-no-filename' | 'invalid-filename'): MakeError {
		if (reason === 'no-title-field-and-no-filename') return { kind: 'no-title-field' };
		const filenameIssue: FieldError = { kind: 'invalid-text', fieldName: '__filename__' };
		return { kind: 'invalid-values', issues: [filenameIssue] as unknown as NonEmptyArray<FieldError> };
	}

	async function buildInstanceRef(typeId: string, path: string): Promise<InstanceRef> {
		const stat = await ports.vault.read(path);
		const createdAt = stat.kind === 'ok' ? new Date(stat.value.stat.ctime).toISOString() : new Date().toISOString();
		const updatedAt = stat.kind === 'ok' ? new Date(stat.value.stat.mtime).toISOString() : createdAt;
		return { typeId, path, title: basename(path).replace(/\.md$/, ''), createdAt, updatedAt };
	}

	async function createInstance(
		typeId: string,
		raw: Record<string, unknown>,
		explicitFilename: string | null,
		options?: CreateInstanceOptions,
	): Promise<Result<InstanceRef, MakeError>> {
		const loaded = await peers.loadType(typeId);
		if (loaded.kind === 'err') return loaded;
		const schema = loaded.value;

		const validated = validateInstanceValues(schema, raw);
		if (validated.kind === 'err') return err({ kind: 'invalid-values', issues: validated.error });

		const resolved = resolveInstancePath(schema, validated.value, explicitFilename);
		if (resolved.kind === 'err') return err(mapPathError(resolved.error));
		const path = resolved.value;

		const exists = await ports.vault.exists(path);
		if (exists && options?.overwrite !== true) return err({ kind: 'instance-exists', path });

		const rendered = renderInstanceContent(schema, validated.value);
		const writeResult = exists
			? await ports.vault.update(path, rendered.fullMarkdown)
			: await ports.vault.create(path, rendered.fullMarkdown);
		if (writeResult.kind === 'err') return err({ kind: 'vault-error', cause: String(writeResult.error) });

		const ref = await buildInstanceRef(typeId, path);
		ports.eventBus.emit('make:instance-created', { typeId, path });
		return ok(ref);
	}

	return {
		listInstances,
		createInstance,
		deleteInstance: () => notImpl(),
	};
}
