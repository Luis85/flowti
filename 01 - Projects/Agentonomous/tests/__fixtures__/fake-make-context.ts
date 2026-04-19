import { ref, readonly } from 'vue';
import type { MakeContext } from '../../src/modules/make/make-context.js';
import { MAKE_DEFAULTS, type MakeSettings } from '../../src/modules/make/make-settings.js';
import type { MakeService } from '../../src/modules/make/make-service.js';
import type { MakeEventHandlers } from '../../src/modules/make/make-module.js';
import type { WorkspacePort } from '../../src/domain/shared/workspace-port.js';
import type { LoggerPort } from '../../src/domain/shared/logger-port.js';
import { fakeLogger, fakeWorkspace } from '../__fakes__/fake-ports.js';

export function fakeMakeService(overrides: Partial<MakeService> = {}): MakeService {
	const notImpl = () => Promise.resolve({ kind: 'err' as const, error: { kind: 'not-implemented' as const } });
	return {
		listTypes:           overrides.listTypes           ?? (() => Promise.resolve({ kind: 'ok' as const, value: { types: [], issues: [] } })),
		loadType:            overrides.loadType            ?? ((id) => Promise.resolve({ kind: 'err' as const, error: { kind: 'type-not-found' as const, typeId: id } })),
		createType:          overrides.createType          ?? notImpl,
		updateType:          overrides.updateType          ?? notImpl,
		retryFailedMoves:    overrides.retryFailedMoves    ?? (() => Promise.resolve({ kind: 'ok' as const, value: { oldFolder: '', newFolder: '', movedCount: 0, failedMoves: [] } })),
		deleteType:          overrides.deleteType          ?? notImpl,
		listInstances:       overrides.listInstances       ?? (() => Promise.resolve({ kind: 'ok' as const, value: [] })),
		createInstance:      overrides.createInstance      ?? notImpl,
		deleteInstance:      overrides.deleteInstance      ?? notImpl,
		deleteInstances:     overrides.deleteInstances     ?? (() => Promise.resolve({ kind: 'ok' as const, value: { deletedPaths: [], failures: [] } })),
		deleteCorruptFile:   overrides.deleteCorruptFile   ?? (() => Promise.resolve({ kind: 'ok' as const, value: undefined })),
		regenerateBaseFile:  overrides.regenerateBaseFile  ?? notImpl,
		toggleFavorite:      overrides.toggleFavorite      ?? (() => Promise.resolve({ kind: 'ok' as const, value: true })),
		getKpis:             overrides.getKpis             ?? (() => Promise.resolve({ typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] })),
	} satisfies MakeService;
}

export function createFakeMakeContext(overrides: {
	service?: MakeService;
	settings?: MakeSettings;
	subscribe?: (handlers: MakeEventHandlers) => () => void;
	workspace?: WorkspacePort;
	logger?: LoggerPort;
} = {}): MakeContext {
	const settings$ = ref(overrides.settings ?? { ...MAKE_DEFAULTS });
	return {
		service:   overrides.service   ?? fakeMakeService(),
		settings$: readonly(settings$),
		subscribe: overrides.subscribe ?? (() => () => {}),
		workspace: overrides.workspace ?? fakeWorkspace().port,
		logger:    overrides.logger    ?? fakeLogger(),
	};
}
