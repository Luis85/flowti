// ─────────────────────────────────────────────────────────────
// F1 Data Repository
// Cache-First Strategie: Erst lokal prüfen, dann API
// ─────────────────────────────────────────────────────────────

import { App } from "obsidian";
import { F1DataAggregator, AggregatedSeasonData, AggregatedEventData, AggregatedSessionData, ProgressCallback } from "../api/F1DataAggregator";
import { DataCacheService } from "./DataCacheService";
import { IngestService } from "./IngestService";
import { EntityNoteService } from "./EntityNoteService";
import { 
	Season, 
	Driver, 
	Constructor, 
	Circuit, 
	Race, 
	DriverStanding, 
	ConstructorStanding,
	Meeting,
	Session,
	LapTime
} from "../models/F1Models";
import { ENTITY_REGISTRY } from "src/utils/entities";
import { OneSeaterSettings } from "src/settings/types";

export interface RepositoryOptions {
	forceRefresh?: boolean;  // Cache ignorieren und neu laden
	saveToCache?: boolean;   // Nach API-Fetch in Cache speichern (default: true)
}

export interface DataResult<T> {
	data: T;
	source: 'cache' | 'api';
	cachedAt?: string;
}

export class F1DataRepository {
	private aggregator: F1DataAggregator;
	private cacheService: DataCacheService;
	private ingestService: IngestService;

	constructor(app: App, settings: OneSeaterSettings) {
		this.aggregator = new F1DataAggregator();
		this.cacheService = new DataCacheService(app, settings);
		this.ingestService = new IngestService(
			this.cacheService, 
			new EntityNoteService(app, settings, ENTITY_REGISTRY)
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Generic Cache-First Fetch
	// ─────────────────────────────────────────────────────────────

	private async fetchWithCache<T>(
		cacheKey: string,
		apiFetch: () => Promise<T[]>,
		options: RepositoryOptions = {}
	): Promise<DataResult<T[]>> {
		const { forceRefresh = false, saveToCache = true } = options;

		// 1. Try Cache first (unless forceRefresh)
		if (!forceRefresh) {
			const cached = await this.cacheService.loadFromCache(cacheKey);
			if (cached && cached.data.length > 0) {
				console.log(`[Repository] Cache hit: ${cacheKey}`);
				return {
					data: cached.data as T[],
					source: 'cache',
					cachedAt: cached.cachedAt
				};
			}
		}

		// 2. Fetch from API
		console.log(`[Repository] Fetching from API: ${cacheKey}`);
		const data = await apiFetch();

		// 3. Ingest, save to cache and markdown
		if (saveToCache && data.length > 0) {
			await this.ingestService.ingest(cacheKey, data as unknown as Record<string, unknown>[])
			console.log(`[Repository] Saved to cache: ${cacheKey} (${data.length} items)`);
		}

		return {
			data,
			source: 'api'
		};
	}

	// ─────────────────────────────────────────────────────────────
	// Seasons
	// ─────────────────────────────────────────────────────────────

	async getSeasons(options?: RepositoryOptions): Promise<DataResult<Season[]>> {
		return this.fetchWithCache<Season>(
			'seasons',
			() => this.aggregator.fetchSeasons(),
			options
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Circuits
	// ─────────────────────────────────────────────────────────────

	async getCircuits(options?: RepositoryOptions): Promise<DataResult<Circuit[]>> {
		return this.fetchWithCache<Circuit>(
			'circuits',
			() => this.aggregator.fetchCircuits(),
			options
		);
	}

	async getCircuit(circuitId: string, options?: RepositoryOptions): Promise<Circuit | null> {
		const result = await this.getCircuits(options);
		return result.data.find(c => c.circuitId === circuitId) || null;
	}

	// ─────────────────────────────────────────────────────────────
	// Drivers
	// ─────────────────────────────────────────────────────────────

	async getDrivers(season: string, options?: RepositoryOptions): Promise<DataResult<Driver[]>> {
		return this.fetchWithCache<Driver>(
			`drivers_${season}`,
			() => this.aggregator.fetchDrivers(season),
			options
		);
	}

	async getDriver(season: string, driverId: string, options?: RepositoryOptions): Promise<Driver | null> {
		const result = await this.getDrivers(season, options);
		return result.data.find(d => d.driverId === driverId) || null;
	}

	// ─────────────────────────────────────────────────────────────
	// Constructors
	// ─────────────────────────────────────────────────────────────

	async getConstructors(season: string, options?: RepositoryOptions): Promise<DataResult<Constructor[]>> {
		return this.fetchWithCache<Constructor>(
			`constructors_${season}`,
			() => this.aggregator.fetchConstructors(season),
			options
		);
	}

	async getConstructor(season: string, constructorId: string, options?: RepositoryOptions): Promise<Constructor | null> {
		const result = await this.getConstructors(season, options);
		return result.data.find(c => c.constructorId === constructorId) || null;
	}

	// ─────────────────────────────────────────────────────────────
	// Races
	// ─────────────────────────────────────────────────────────────

	async getRaces(season: string, options?: RepositoryOptions): Promise<DataResult<Race[]>> {
		return this.fetchWithCache<Race>(
			`races_${season}`,
			() => this.aggregator.fetchRaces(season),
			options
		);
	}

	async getRace(season: string, round: string, options?: RepositoryOptions): Promise<Race | null> {
		const result = await this.getRaces(season, options);
		return result.data.find(r => r.round === round) || null;
	}

	// ─────────────────────────────────────────────────────────────
	// Standings
	// ─────────────────────────────────────────────────────────────

	async getDriverStandings(season: string, options?: RepositoryOptions): Promise<DataResult<DriverStanding[]>> {
		return this.fetchWithCache<DriverStanding>(
			`driverstandings_${season}`,
			() => this.aggregator.fetchDriverStandings(season),
			options
		);
	}

	async getConstructorStandings(season: string, options?: RepositoryOptions): Promise<DataResult<ConstructorStanding[]>> {
		return this.fetchWithCache<ConstructorStanding>(
			`constructorstandings_${season}`,
			() => this.aggregator.fetchConstructorStandings(season),
			options
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Meetings & Sessions (OpenF1)
	// ─────────────────────────────────────────────────────────────

	async getMeetings(season: string, options?: RepositoryOptions): Promise<DataResult<Meeting[]>> {
		return this.fetchWithCache<Meeting>(
			`meetings_${season}`,
			() => this.aggregator.fetchMeetings(season),
			options
		);
	}

	async getMeeting(season: string, meetingKey: number, options?: RepositoryOptions): Promise<Meeting | null> {
		const result = await this.getMeetings(season, options);
		return result.data.find(m => m.meetingKey === meetingKey) || null;
	}

	async getSessions(season: string, options?: RepositoryOptions): Promise<DataResult<Session[]>> {
		return this.fetchWithCache<Session>(
			`sessions_${season}`,
			() => this.aggregator.fetchSessions(season),
			options
		);
	}

	async getSessionsForMeeting(season: string, meetingKey: number, options?: RepositoryOptions): Promise<Session[]> {
		const result = await this.getSessions(season, options);
		return result.data.filter(s => s.meetingKey === meetingKey);
	}

	// ─────────────────────────────────────────────────────────────
	// Lap Times (Manual Trigger)
	// ─────────────────────────────────────────────────────────────

	async getLaps(sessionKey: number, options?: RepositoryOptions): Promise<DataResult<LapTime[]>> {
		return this.fetchWithCache<LapTime>(
			`laps_${sessionKey}`,
			() => this.aggregator.loadSessionLaps(sessionKey),
			options
		);
	}

	async getLapsForDriver(sessionKey: number, driverId: string, options?: RepositoryOptions): Promise<DataResult<LapTime[]>> {
		return this.fetchWithCache<LapTime>(
			`laps_${sessionKey}_${driverId}`,
			() => this.aggregator.loadSessionLaps(sessionKey, driverId),
			options
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Bulk Loading (Load all data for a context)
	// ─────────────────────────────────────────────────────────────

	/**
	 * Load all season data from both APIs and cache everything
	 * Called when entering a season view
	 */
	async loadAndCacheSeasonData(
		season: string,
		onProgress?: ProgressCallback
	): Promise<AggregatedSeasonData> {
		// Use aggregator to load everything in parallel
		const data = await this.aggregator.loadSeasonData(season, onProgress);

		// Cache each entity type
		await Promise.all([
			this.ingestService.ingest(`drivers_${season}`, data.drivers as unknown as Record<string, unknown>[]),
			this.ingestService.ingest(`constructors_${season}`, data.constructors as unknown as Record<string, unknown>[]),
			this.ingestService.ingest('circuits', data.circuits as unknown as Record<string, unknown>[]),
			this.ingestService.ingest(`races_${season}`, data.races as unknown as Record<string, unknown>[]),
			this.ingestService.ingest(`driverstandings_${season}`, data.driverStandings as unknown as Record<string, unknown>[]),
			this.ingestService.ingest(`constructorstandings_${season}`, data.constructorStandings as unknown as Record<string, unknown>[]),
			this.ingestService.ingest(`meetings_${season}`, data.meetings as unknown as Record<string, unknown>[]),
			this.ingestService.ingest(`sessions_${season}`, data.sessions as unknown as Record<string, unknown>[])
		]);

		return data;
	}

	/**
	 * Load event/meeting data and cache it
	 * Called when entering an event view
	 */
	async loadAndCacheEventData(
		season: string,
		meetingKey: number,
		onProgress?: ProgressCallback
	): Promise<AggregatedEventData> {
		const data = await this.aggregator.loadEventData(season, meetingKey, onProgress);
		
		// Sessions for this meeting are already in the season cache
		// We could cache meeting-specific data here if needed
		
		return data;
	}

	/**
	 * Load session data and cache it
	 * Called when entering a session view
	 */
	async loadAndCacheSessionData(
		sessionKey: number,
		onProgress?: ProgressCallback
	): Promise<AggregatedSessionData> {
		const data = await this.aggregator.loadSessionData(sessionKey, onProgress);
		return data;
	}

	// ─────────────────────────────────────────────────────────────
	// Combined Data Fetches (für Detail Views)
	// ─────────────────────────────────────────────────────────────

	async getDriverWithStanding(season: string, driverId: string, options?: RepositoryOptions): Promise<{
		driver: Driver | null;
		standing: DriverStanding | null;
		constructor: Constructor | null;
	}> {
		const [driversResult, standingsResult, constructorsResult] = await Promise.all([
			this.getDrivers(season, options),
			this.getDriverStandings(season, options),
			this.getConstructors(season, options)
		]);

		const driver = driversResult.data.find(d => d.driverId === driverId) || null;
		const standing = standingsResult.data.find(s => s.driverId === driverId) || null;
		const constructor = standing 
			? constructorsResult.data.find(c => c.constructorId === standing.constructorId) || null
			: null;

		return { driver, standing, constructor };
	}

	async getConstructorWithStanding(season: string, constructorId: string, options?: RepositoryOptions): Promise<{
		constructor: Constructor | null;
		standing: ConstructorStanding | null;
		drivers: Driver[];
	}> {
		const [constructorsResult, standingsResult, driversResult, driverStandingsResult] = await Promise.all([
			this.getConstructors(season, options),
			this.getConstructorStandings(season, options),
			this.getDrivers(season, options),
			this.getDriverStandings(season, options)
		]);

		const constructor = constructorsResult.data.find(c => c.constructorId === constructorId) || null;
		const standing = standingsResult.data.find(s => s.constructorId === constructorId) || null;
		
		// Finde alle Fahrer dieses Teams
		const teamDriverIds = driverStandingsResult.data
			.filter(ds => ds.constructorId === constructorId)
			.map(ds => ds.driverId);
		
		const drivers = driversResult.data.filter(d => teamDriverIds.includes(d.driverId));

		return { constructor, standing, drivers };
	}

	async getRaceWithDetails(season: string, round: string, options?: RepositoryOptions): Promise<{
		race: Race | null;
		circuit: Circuit | null;
	}> {
		const [racesResult, circuitsResult] = await Promise.all([
			this.getRaces(season, options),
			this.getCircuits(options)
		]);

		const race = racesResult.data.find(r => r.round === round) || null;
		const circuit = race 
			? circuitsResult.data.find(c => c.circuitId === race.circuitId) || null
			: null;

		return { race, circuit };
	}

	async getCircuitWithRaces(season: string, circuitId: string, options?: RepositoryOptions): Promise<{
		circuit: Circuit | null;
		races: Race[];
	}> {
		const [circuitsResult, racesResult] = await Promise.all([
			this.getCircuits(options),
			this.getRaces(season, options)
		]);

		const circuit = circuitsResult.data.find(c => c.circuitId === circuitId) || null;
		const races = racesResult.data.filter(r => r.circuitId === circuitId);

		return { circuit, races };
	}

	// ─────────────────────────────────────────────────────────────
	// Cache Management
	// ─────────────────────────────────────────────────────────────

	async clearCache(): Promise<void> {
		await this.cacheService.clearAllCache();
	}

	async getCacheInfo() {
		return this.cacheService.getCacheInfo();
	}

	async refreshAll(season: string): Promise<{ success: number; errors: string[] }> {
		const entities = [
			{ name: 'seasons', fetch: () => this.getSeasons({ forceRefresh: true }) },
			{ name: 'circuits', fetch: () => this.getCircuits({ forceRefresh: true }) },
			{ name: 'drivers', fetch: () => this.getDrivers(season, { forceRefresh: true }) },
			{ name: 'constructors', fetch: () => this.getConstructors(season, { forceRefresh: true }) },
			{ name: 'races', fetch: () => this.getRaces(season, { forceRefresh: true }) },
			{ name: 'driverStandings', fetch: () => this.getDriverStandings(season, { forceRefresh: true }) },
			{ name: 'constructorStandings', fetch: () => this.getConstructorStandings(season, { forceRefresh: true }) },
			{ name: 'meetings', fetch: () => this.getMeetings(season, { forceRefresh: true }) },
			{ name: 'sessions', fetch: () => this.getSessions(season, { forceRefresh: true }) },
		];

		let success = 0;
		const errors: string[] = [];

		for (const entity of entities) {
			try {
				await entity.fetch();
				success++;
			} catch (error) {
				errors.push(`${entity.name}: ${(error as Error).message}`);
			}
		}

		return { success, errors };
	}
}
