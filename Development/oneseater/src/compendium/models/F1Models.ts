// ─────────────────────────────────────────────────────────────
// F1 Data Models
// Gemeinsame Datenstrukturen für alle F1 APIs
// ─────────────────────────────────────────────────────────────

export interface Season {
	season: string;
	url?: string;
}

export interface Driver {
	driverId: string;
	givenName: string;
	familyName: string;
	dateOfBirth?: string;
	nationality?: string;
	code?: string;
	permanentNumber?: string;
	url?: string;
	// OpenF1 enrichments
	teamName?: string;
	teamColour?: string;
	headshotUrl?: string;
	broadcastName?: string;
}

export interface Constructor {
	constructorId: string;
	name: string;
	nationality?: string;
	url?: string;
}

export interface Circuit {
	circuitId: string;
	circuitName: string;
	locality?: string;
	country?: string;
	lat?: number;
	lng?: number;
	url?: string;
}

export interface Race {
	season: string;
	round: string;
	raceName: string;
	circuitId: string;
	date: string;
	time?: string;
}

export interface DriverStanding {
	position: string;
	points: string;
	wins: string;
	driverId: string;
	constructorId: string;
}

export interface ConstructorStanding {
	position: string;
	points: string;
	wins: string;
	constructorId: string;
}

export interface Session {
	sessionKey: number;
	sessionName: string;
	sessionType: string;
	dateStart: string;
	dateEnd: string;
	circuitKey: number;
	circuitShortName: string;
	year: number;
	// Additional OpenF1 fields
	meetingKey?: number;
	gmtOffset?: string;
	countryKey?: number;
	countryCode?: string;
	countryName?: string;
	location?: string;
}

export interface Meeting {
	meetingKey: number;
	meetingName: string;
	meetingOfficialName?: string;
	year: number;
	circuitKey: number;
	circuitShortName: string;
	countryKey: number;
	countryCode: string;
	countryName: string;
	location: string;
	dateStart: string;
	gmtOffset: string;
}

export interface LapTime {
	driverId: string;
	lap: number;
	position: number;
	time?: string;
	milliseconds?: number;
	// OpenF1 sector times
	sector1?: number;
	sector2?: number;
	sector3?: number;
	// Speed traps
	speedI1?: number;
	speedI2?: number;
	speedST?: number;
	isPitOutLap?: boolean;
	sessionKey?: number;
}

// ─────────────────────────────────────────────────────────────
// API Metadata
// ─────────────────────────────────────────────────────────────

export type F1ApiProvider = 'jolpica' | 'openf1';

export type F1EntityType = 
	| 'seasons'
	| 'drivers' 
	| 'constructors' 
	| 'circuits' 
	| 'races' 
	| 'driverStandings' 
	| 'constructorStandings'
	| 'meetings'
	| 'sessions'
	| 'laps';

// ─────────────────────────────────────────────────────────────
// Data Source Mapping
// Defines which API provides which data
// ─────────────────────────────────────────────────────────────

export type DataSourceType = 'primary' | 'enrichment' | 'manual';

export interface DataSourceMapping {
	entity: F1EntityType;
	jolpica: DataSourceType | null;
	openf1: DataSourceType | null;
	description: string;
}

export const DATA_SOURCE_MAP: DataSourceMapping[] = [
	{ entity: 'seasons', jolpica: 'primary', openf1: null, description: 'Season list from Jolpica' },
	{ entity: 'drivers', jolpica: 'primary', openf1: 'enrichment', description: 'Base from Jolpica, photos/colors from OpenF1' },
	{ entity: 'constructors', jolpica: 'primary', openf1: null, description: 'Teams from Jolpica only' },
	{ entity: 'circuits', jolpica: 'primary', openf1: null, description: 'Circuit details from Jolpica' },
	{ entity: 'races', jolpica: 'primary', openf1: null, description: 'Race schedule from Jolpica' },
	{ entity: 'driverStandings', jolpica: 'primary', openf1: null, description: 'Championship standings from Jolpica' },
	{ entity: 'constructorStandings', jolpica: 'primary', openf1: null, description: 'Constructor standings from Jolpica' },
	{ entity: 'meetings', jolpica: null, openf1: 'primary', description: 'Meeting/Event details from OpenF1' },
	{ entity: 'sessions', jolpica: null, openf1: 'primary', description: 'Session details (FP, Quali, Race) from OpenF1' },
	{ entity: 'laps', jolpica: null, openf1: 'manual', description: 'Lap times - manual trigger due to size' },
];

export interface F1EntityConfig {
	type: F1EntityType;
	displayName: string;
	availableIn: F1ApiProvider[];
	requiresSeason?: boolean;
	requiresRound?: boolean;
	requiresSession?: boolean;
	manualTrigger?: boolean;
}

export const F1_ENTITIES: F1EntityConfig[] = [
	{ type: 'seasons', displayName: 'Saisons', availableIn: ['jolpica'] },
	{ type: 'drivers', displayName: 'Fahrer', availableIn: ['jolpica', 'openf1'] },
	{ type: 'constructors', displayName: 'Teams', availableIn: ['jolpica'] },
	{ type: 'circuits', displayName: 'Strecken', availableIn: ['jolpica'] },
	{ type: 'races', displayName: 'Rennen', availableIn: ['jolpica'], requiresSeason: true },
	{ type: 'driverStandings', displayName: 'Fahrerwertung', availableIn: ['jolpica'], requiresSeason: true },
	{ type: 'constructorStandings', displayName: 'Konstrukteurswertung', availableIn: ['jolpica'], requiresSeason: true },
	{ type: 'meetings', displayName: 'Events', availableIn: ['openf1'], requiresSeason: true },
	{ type: 'sessions', displayName: 'Sessions', availableIn: ['openf1'], requiresSeason: true },
	{ type: 'laps', displayName: 'Rundenzeiten', availableIn: ['openf1'], requiresSession: true, manualTrigger: true },
];
