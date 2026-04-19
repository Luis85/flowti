import type { ModulePorts } from '../../domain/shared/module.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { MakeError } from '../../domain/make/errors.js';
import type { InstanceRef } from '../../domain/make/types.js';
import type { MakeService } from './make-service.js';

export type InstanceServiceMethods = Pick<MakeService, 'listInstances' | 'createInstance' | 'deleteInstance'>;

export interface InstanceOpsPeers {
	loadType: (typeId: string) => Promise<Result<TypeSchema, MakeError>>;
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

	return {
		listInstances,
		createInstance: () => notImpl(),
		deleteInstance: () => notImpl(),
	};
}
