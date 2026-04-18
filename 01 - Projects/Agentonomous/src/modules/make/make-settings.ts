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

export function validateMakeSettings(raw: unknown): Result<MakeSettings, string> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return err('make settings must be an object');
	const r = raw as Record<string, unknown>;
	const enabled = typeof r['enabled'] === 'boolean' ? r['enabled'] : MAKE_DEFAULTS.enabled;
	const typesFolder = r['typesFolder'];
	const basesFolder = r['basesFolder'];
	const defaultInstancesRoot = r['defaultInstancesRoot'];
	if (typesFolder !== undefined && typeof typesFolder !== 'string') return err('typesFolder must be a string');
	if (basesFolder !== undefined && typeof basesFolder !== 'string') return err('basesFolder must be a string');
	if (defaultInstancesRoot !== undefined && typeof defaultInstancesRoot !== 'string') return err('defaultInstancesRoot must be a string');
	const favorites = Array.isArray(r['favorites']) ? r['favorites'].filter((x): x is string => typeof x === 'string') : MAKE_DEFAULTS.favorites;
	return ok({
		enabled,
		typesFolder: typeof typesFolder === 'string' ? typesFolder : MAKE_DEFAULTS.typesFolder,
		basesFolder: typeof basesFolder === 'string' ? basesFolder : MAKE_DEFAULTS.basesFolder,
		defaultInstancesRoot: typeof defaultInstancesRoot === 'string' ? defaultInstancesRoot : MAKE_DEFAULTS.defaultInstancesRoot,
		favorites,
	});
}
