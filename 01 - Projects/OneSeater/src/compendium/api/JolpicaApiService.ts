// ─────────────────────────────────────────────────────────────
// Jolpica F1 API Service
// https://github.com/jolpica/jolpica-f1
// Ergast-kompatible API für historische F1 Daten
// ─────────────────────────────────────────────────────────────

import { 
	Driver, 
	Constructor, 
	Circuit, 
	Race, 
	DriverStanding, 
	ConstructorStanding,
	Season,
	F1EntityType 
} from "../models/F1Models";
import { BaseF1ApiService, FetchOptions } from "./F1ApiService";

// Jolpica Response Types
interface JolpicaResponse<T> {
	MRData: {
		xmlns: string;
		series: string;
		url: string;
		limit: string;
		offset: string;
		total: string;
	} & T;
}

interface SeasonTable {
	SeasonTable: {
		Seasons: JolpicaSeason[];
	};
}

interface DriverTable {
	DriverTable: {
		Drivers: JolpicaDriver[];
	};
}

interface ConstructorTable {
	ConstructorTable: {
		Constructors: JolpicaConstructor[];
	};
}

interface CircuitTable {
	CircuitTable: {
		Circuits: JolpicaCircuit[];
	};
}

interface RaceTable {
	RaceTable: {
		season: string;
		Races: JolpicaRace[];
	};
}

interface StandingsTable {
	StandingsTable: {
		season: string;
		StandingsLists: JolpicaStandingsList[];
	};
}

interface JolpicaSeason {
	season: string;
	url: string;
}

interface JolpicaDriver {
	driverId: string;
	givenName: string;
	familyName: string;
	dateOfBirth: string;
	nationality: string;
	code?: string;
	permanentNumber?: string;
	url: string;
}

interface JolpicaConstructor {
	constructorId: string;
	name: string;
	nationality: string;
	url: string;
}

interface JolpicaCircuit {
	circuitId: string;
	circuitName: string;
	url: string;
	Location: {
		locality: string;
		country: string;
		lat: string;
		long: string;
	};
}

interface JolpicaRace {
	season: string;
	round: string;
	raceName: string;
	url: string;
	Circuit: JolpicaCircuit;
	date: string;
	time?: string;
}

interface JolpicaStandingsList {
	season: string;
	round: string;
	DriverStandings?: JolpicaDriverStanding[];
	ConstructorStandings?: JolpicaConstructorStanding[];
}

interface JolpicaDriverStanding {
	position: string;
	points: string;
	wins: string;
	Driver: JolpicaDriver;
	Constructors: JolpicaConstructor[];
}

interface JolpicaConstructorStanding {
	position: string;
	points: string;
	wins: string;
	Constructor: JolpicaConstructor;
}

// ─────────────────────────────────────────────────────────────
// Service Implementation
// ─────────────────────────────────────────────────────────────

export class JolpicaApiService extends BaseF1ApiService {
	readonly provider = 'jolpica' as const;
	readonly baseUrl = 'https://api.jolpi.ca/ergast/f1';
	
	protected supportedEntities: F1EntityType[] = [
		'seasons',
		'drivers',
		'constructors', 
		'circuits',
		'races',
		'driverStandings',
		'constructorStandings'
	];

	async fetchSeasons(options?: FetchOptions): Promise<Season[]> {
		const limit = options?.limit || 100;
		
		const url = `${this.baseUrl}/seasons.json?limit=${limit}`;
		const response = await this.fetchJson<JolpicaResponse<SeasonTable>>(url);
		
		return response.MRData.SeasonTable.Seasons.map(s => ({
			season: s.season,
			url: s.url
		}));
	}

	async fetchDrivers(options?: FetchOptions): Promise<Driver[]> {
		const season = options?.season || 'current';
		const limit = options?.limit || 100;
		
		const url = `${this.baseUrl}/${season}/drivers.json?limit=${limit}`;
		const response = await this.fetchJson<JolpicaResponse<DriverTable>>(url);
		
		return response.MRData.DriverTable.Drivers.map(this.mapDriver);
	}

	async fetchConstructors(options?: FetchOptions): Promise<Constructor[]> {
		const season = options?.season || 'current';
		const limit = options?.limit || 100;
		
		const url = `${this.baseUrl}/${season}/constructors.json?limit=${limit}`;
		const response = await this.fetchJson<JolpicaResponse<ConstructorTable>>(url);
		
		return response.MRData.ConstructorTable.Constructors.map(this.mapConstructor);
	}

	async fetchCircuits(options?: FetchOptions): Promise<Circuit[]> {
		const limit = options?.limit || 100;
		
		const url = `${this.baseUrl}/circuits.json?limit=${limit}`;
		const response = await this.fetchJson<JolpicaResponse<CircuitTable>>(url);
		
		return response.MRData.CircuitTable.Circuits.map(this.mapCircuit);
	}

	async fetchRaces(options: FetchOptions): Promise<Race[]> {
		const season = options.season || 'current';
		const limit = options.limit || 30;
		
		const url = `${this.baseUrl}/${season}.json?limit=${limit}`;
		const response = await this.fetchJson<JolpicaResponse<RaceTable>>(url);
		
		return response.MRData.RaceTable.Races.map(this.mapRace);
	}

	async fetchDriverStandings(options: FetchOptions): Promise<DriverStanding[]> {
		const season = options.season || 'current';
		
		const url = `${this.baseUrl}/${season}/driverStandings.json`;
		const response = await this.fetchJson<JolpicaResponse<StandingsTable>>(url);
		
		const standingsList = response.MRData.StandingsTable.StandingsLists[0];
		if (!standingsList?.DriverStandings) {
			return [];
		}
		
		return standingsList.DriverStandings.map(this.mapDriverStanding);
	}

	async fetchConstructorStandings(options: FetchOptions): Promise<ConstructorStanding[]> {
		const season = options.season || 'current';
		
		const url = `${this.baseUrl}/${season}/constructorStandings.json`;
		const response = await this.fetchJson<JolpicaResponse<StandingsTable>>(url);
		
		const standingsList = response.MRData.StandingsTable.StandingsLists[0];
		if (!standingsList?.ConstructorStandings) {
			return [];
		}
		
		return standingsList.ConstructorStandings.map(this.mapConstructorStanding);
	}

	// ─────────────────────────────────────────────────────────────
	// Mapper Functions
	// ─────────────────────────────────────────────────────────────

	private mapDriver(d: JolpicaDriver): Driver {
		return {
			driverId: d.driverId,
			givenName: d.givenName,
			familyName: d.familyName,
			dateOfBirth: d.dateOfBirth,
			nationality: d.nationality,
			code: d.code,
			permanentNumber: d.permanentNumber,
			url: d.url
		};
	}

	private mapConstructor(c: JolpicaConstructor): Constructor {
		return {
			constructorId: c.constructorId,
			name: c.name,
			nationality: c.nationality,
			url: c.url
		};
	}

	private mapCircuit(c: JolpicaCircuit): Circuit {
		return {
			circuitId: c.circuitId,
			circuitName: c.circuitName,
			locality: c.Location.locality,
			country: c.Location.country,
			lat: parseFloat(c.Location.lat),
			lng: parseFloat(c.Location.long),
			url: c.url
		};
	}

	private mapRace(r: JolpicaRace): Race {
		return {
			season: r.season,
			round: r.round,
			raceName: r.raceName,
			circuitId: r.Circuit.circuitId,
			date: r.date,
			time: r.time
		};
	}

	private mapDriverStanding(s: JolpicaDriverStanding): DriverStanding {
		return {
			position: s.position,
			points: s.points,
			wins: s.wins,
			driverId: s.Driver.driverId,
			constructorId: s.Constructors[0]?.constructorId || ''
		};
	}

	private mapConstructorStanding(s: JolpicaConstructorStanding): ConstructorStanding {
		return {
			position: s.position,
			points: s.points,
			wins: s.wins,
			constructorId: s.Constructor.constructorId
		};
	}
}
