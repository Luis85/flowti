// ─────────────────────────────────────────────────────────────
// F1 API Service Interface & Factory
// ─────────────────────────────────────────────────────────────

import { 
	Driver, 
	Constructor, 
	Circuit, 
	Race, 
	DriverStanding, 
	ConstructorStanding,
	Session,
	Meeting,
	LapTime,
	F1ApiProvider,
	F1EntityType, 
	Season
} from "../models/F1Models";

export interface FetchOptions {
	season?: string;
	round?: string;
	sessionKey?: number;
	meetingKey?: number;
	driverId?: string;
	limit?: number;
}

export interface IF1ApiService {
	readonly provider: F1ApiProvider;
	readonly baseUrl: string;
	
	// Verfügbarkeit prüfen
	supportsEntity(entityType: F1EntityType): boolean;
	
	// Daten abrufen
	fetchDrivers(options?: FetchOptions): Promise<Driver[]>;
	fetchConstructors(options?: FetchOptions): Promise<Constructor[]>;
	fetchCircuits(options?: FetchOptions): Promise<Circuit[]>;
	fetchRaces(options: FetchOptions): Promise<Race[]>;
	fetchDriverStandings(options: FetchOptions): Promise<DriverStanding[]>;
	fetchConstructorStandings(options: FetchOptions): Promise<ConstructorStanding[]>;
	fetchSeasons(options?: FetchOptions): Promise<Season[]>;
	fetchMeetings(options?: FetchOptions): Promise<Meeting[]>;
	fetchSessions(options?: FetchOptions): Promise<Session[]>;
	fetchLaps(options: FetchOptions): Promise<LapTime[]>;
	
	// Generischer Fetch
	fetchEntity(entityType: F1EntityType, options?: FetchOptions): Promise<unknown[]>;
}

export abstract class BaseF1ApiService implements IF1ApiService {
	abstract readonly provider: F1ApiProvider;
	abstract readonly baseUrl: string;
	protected abstract supportedEntities: F1EntityType[];

	supportsEntity(entityType: F1EntityType): boolean {
		return this.supportedEntities.includes(entityType);
	}

	async fetchEntity(entityType: F1EntityType, options?: FetchOptions): Promise<unknown[]> {
		if (!this.supportsEntity(entityType)) {
			throw new Error(`Entity "${entityType}" wird von ${this.provider} nicht unterstützt.`);
		}

		switch (entityType) {
			case 'drivers':
				return this.fetchDrivers(options);
			case 'constructors':
				return this.fetchConstructors(options);
			case 'circuits':
				return this.fetchCircuits(options);
			case 'races':
				return this.fetchRaces(options!);
			case 'driverStandings':
				return this.fetchDriverStandings(options!);
			case 'constructorStandings':
				return this.fetchConstructorStandings(options!);
			case 'meetings':
				return this.fetchMeetings(options);
			case 'sessions':
				return this.fetchSessions(options);
			case 'laps':
				return this.fetchLaps(options!);
			default:
				throw new Error(`Unbekannter Entity-Typ: ${entityType}`);
		}
	}

	async fetchDrivers(_options?: FetchOptions): Promise<Driver[]> {
		throw new Error(`fetchDrivers nicht implementiert für ${this.provider}`);
	}

	async fetchConstructors(_options?: FetchOptions): Promise<Constructor[]> {
		throw new Error(`fetchConstructors nicht implementiert für ${this.provider}`);
	}

	async fetchCircuits(_options?: FetchOptions): Promise<Circuit[]> {
		throw new Error(`fetchCircuits nicht implementiert für ${this.provider}`);
	}

	async fetchRaces(_options: FetchOptions): Promise<Race[]> {
		throw new Error(`fetchRaces nicht implementiert für ${this.provider}`);
	}

	async fetchDriverStandings(_options: FetchOptions): Promise<DriverStanding[]> {
		throw new Error(`fetchDriverStandings nicht implementiert für ${this.provider}`);
	}

	async fetchConstructorStandings(_options: FetchOptions): Promise<ConstructorStanding[]> {
		throw new Error(`fetchConstructorStandings nicht implementiert für ${this.provider}`);
	}

	async fetchSeasons(_options?: FetchOptions): Promise<Season[]> {
		throw new Error(`fetchSeasons nicht implementiert für ${this.provider}`);
	}

	async fetchMeetings(_options?: FetchOptions): Promise<Meeting[]> {
		throw new Error(`fetchMeetings nicht implementiert für ${this.provider}`);
	}

	async fetchSessions(_options?: FetchOptions): Promise<Session[]> {
		throw new Error(`fetchSessions nicht implementiert für ${this.provider}`);
	}

	async fetchLaps(_options: FetchOptions): Promise<LapTime[]> {
		throw new Error(`fetchLaps nicht implementiert für ${this.provider}`);
	}

	protected async fetchJson<T>(url: string): Promise<T> {
		console.log(`[${this.provider}] Fetching: ${url}`);
		
		const response = await fetch(url);
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		
		return response.json();
	}
}
