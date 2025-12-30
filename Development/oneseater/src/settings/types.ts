import { Path, PathValue } from "./settings.utils";

export interface OneSeaterSettings {
	dataFolderPath: string;
	compendiumFolderPath: string;
	templatesFolderPath: string;
	pluginMode: "GameSimulation" | "Realistic";
	cacheEnabled: boolean;
	exportDateFormat: string; // Export
	includeTimestampInFilename: boolean;
	player: PlayerSettings;
	game: GameSettings;
}

export type GameSettings = {
	slowAfterSleep: boolean;
	maxMessages: number;
	dailyMailChance: number;
	dailySpamChance: number;
	dailyOrderChance: number;
	dailySpam: boolean;
	dailyMail: boolean;
	mailLambda: number;
	mailHardCapPerStep: number;
	paymentDelayDays: number;
	paymentJitterDays: number;
	paymentSuccessChance: number;
};

export type PlayerSettings = {
	name: string;
	organization: string;
	primary_color: string;
	secondary_color: string;
	tertiary_color: string;
	icon: string;
	logo: string;
	characterFile?: string;
};

// ------- That helper stuff for auto build of settings
export type NumericPath<T> = {
	[P in Path<T>]: PathValue<T, P> extends number ? P : never;
}[Path<T>];

export type NumberSettingsItem = NumberItem<NumericPath<OneSeaterSettings>>;

export type SettingKind = "text" | "number" | "toggle" | "dropdown" | "color";

export type BaseItem<P extends Path<OneSeaterSettings>> = {
	category: string;
	name: string;
	desc?: string;
	kind: SettingKind;
	path: P;
	default: PathValue<OneSeaterSettings, P>;
	placeholder?: string;
};

export type TextItem<P extends Path<OneSeaterSettings>> = BaseItem<P> & {
	kind: "text";
};

export type NumberItem<P extends Path<OneSeaterSettings>> = BaseItem<P> & {
	kind: "number";
	min?: number;
	max?: number;
	step?: number;
};

export type ToggleItem<P extends Path<OneSeaterSettings>> = BaseItem<P> & {
	kind: "toggle";
};

export type DropdownItem<P extends Path<OneSeaterSettings>> = BaseItem<P> & {
	kind: "dropdown";
	options: { label: string; value: PathValue<OneSeaterSettings, P> }[];
};

export type ColorItem<P extends Path<OneSeaterSettings>> = BaseItem<P> & {
	kind: "color";
};

export type SettingsItem<
	P extends Path<OneSeaterSettings> = Path<OneSeaterSettings>
> =
	| TextItem<P>
	| NumberItem<P>
	| ToggleItem<P>
	| DropdownItem<P>
	| ColorItem<P>;
