import { err, ok, type Result } from '../../domain/shared/result.js';

export type MakeSettings = {
	readonly enabled: boolean;
	readonly typesFolder: string;
	readonly basesFolder: string;
	readonly defaultInstancesRoot: string;
	readonly favorites: readonly string[];
};

export const MAKE_DEFAULTS: MakeSettings = {
	enabled: true,
	typesFolder: 'Make/Types',
	basesFolder: 'Make/Bases',
	defaultInstancesRoot: 'Make/Instances',
	favorites: [],
};

function readStringField(r: Record<string, unknown>, key: string, fallback: string): Result<string, string> {
	const v = r[key];
	if (v === undefined) return ok(fallback);
	if (typeof v !== 'string') return err(`${key} must be a string`);
	return ok(v);
}

function readFavorites(r: Record<string, unknown>): readonly string[] {
	const raw = r['favorites'];
	if (!Array.isArray(raw)) return MAKE_DEFAULTS.favorites;
	return raw.filter((x): x is string => typeof x === 'string');
}

export function validateMakeSettings(raw: unknown): Result<MakeSettings, string> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return err('make settings must be an object');
	const r = raw as Record<string, unknown>;
	const typesFolder          = readStringField(r, 'typesFolder',          MAKE_DEFAULTS.typesFolder);
	if (typesFolder.kind === 'err') return typesFolder;
	const basesFolder          = readStringField(r, 'basesFolder',          MAKE_DEFAULTS.basesFolder);
	if (basesFolder.kind === 'err') return basesFolder;
	const defaultInstancesRoot = readStringField(r, 'defaultInstancesRoot', MAKE_DEFAULTS.defaultInstancesRoot);
	if (defaultInstancesRoot.kind === 'err') return defaultInstancesRoot;
	return ok({
		enabled: typeof r['enabled'] === 'boolean' ? r['enabled'] : MAKE_DEFAULTS.enabled,
		typesFolder:          typesFolder.value,
		basesFolder:          basesFolder.value,
		defaultInstancesRoot: defaultInstancesRoot.value,
		favorites: readFavorites(r),
	});
}
