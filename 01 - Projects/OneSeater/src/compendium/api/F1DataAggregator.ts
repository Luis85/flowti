// ─────────────────────────────────────────────────────────────
// F1 Data Aggregator
// Orchestrates data fetching from multiple APIs
// Handles merging, enrichment, and parallel loading
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
	Season,
	LapTime
} from "../models/F1Models";
import { JolpicaApiService } from "./JolpicaApiService";
import { OpenF1ApiService } from "./OpenF1ApiService";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AggregatedSeasonData {
	season: string;
	drivers: Driver[];
	constructors: Constructor[];
	circuits: Circuit[];
	races: Race[];
	driverStandings: DriverStanding[];
	constructorStandings: ConstructorStanding[];
	meetings: Meeting[];
	sessions: Session[];
}

export interface AggregatedEventData {
	meeting: Meeting;
	race: Race | null;
	circuit: Circuit | null;
	sessions: Session[];
}

export interface AggregatedSessionData {
	session: Session;
	meeting: Meeting | null;
	drivers: Driver[];  // Session-specific driver data with team colors
}

export interface AggregationProgress {
	total: number;
	completed: number;
	current: string;
	errors: string[];
}

export type ProgressCallback = (progress: AggregationProgress) => void;

// ─────────────────────────────────────────────────────────────
// Aggregator Service
// ─────────────────────────────────────────────────────────────

export class F1DataAggregator {
	private jolpica: JolpicaApiService;
	private openf1: OpenF1ApiService;

	constructor() {
		this.jolpica = new JolpicaApiService();
		this.openf1 = new OpenF1ApiService();
	}

	// ─────────────────────────────────────────────────────────────
	// Season Data Loading
	// ─────────────────────────────────────────────────────────────

	/**
	 * Load all data for a season from both APIs in parallel
	 * This is the main entry point when clicking on a season
	 */
	async loadSeasonData(
		season: string, 
		onProgress?: ProgressCallback
	): Promise<AggregatedSeasonData> {
		const progress: AggregationProgress = {
			total: 8,
			completed: 0,
			current: 'Starting...',
			errors: []
		};

		const report = (current: string) => {
			progress.current = current;
			onProgress?.(progress);
		};

		const complete = () => {
			progress.completed++;
			onProgress?.(progress);
		};

		// Parallel fetch from both APIs
		report('Loading base data from Jolpica...');
		
		const [
			jolpicaDrivers,
			constructors,
			circuits,
			races,
			driverStandings,
			constructorStandings
		] = await Promise.all([
			this.safeCall(() => this.jolpica.fetchDrivers({ season }), [], progress),
			this.safeCall(() => this.jolpica.fetchConstructors({ season }), [], progress),
			this.safeCall(() => this.jolpica.fetchCircuits(), [], progress),
			this.safeCall(() => this.jolpica.fetchRaces({ season }), [], progress),
			this.safeCall(() => this.jolpica.fetchDriverStandings({ season }), [], progress),
			this.safeCall(() => this.jolpica.fetchConstructorStandings({ season }), [], progress)
		]);
		complete();

		report('Loading OpenF1 data...');
		const [openf1Drivers, meetings, sessions] = await Promise.all([
			this.safeCall(() => this.openf1.fetchDrivers({ season }), [], progress),
			this.safeCall(() => this.openf1.fetchMeetings({ season }), [], progress),
			this.safeCall(() => this.openf1.fetchSessions({ season }), [], progress)
		]);
		complete();

		report('Merging driver data...');
		const drivers = this.mergeDrivers(jolpicaDrivers, openf1Drivers);
		complete();

		report('Complete!');

		return {
			season,
			drivers,
			constructors,
			circuits,
			races,
			driverStandings,
			constructorStandings,
			meetings,
			sessions
		};
	}

	// ─────────────────────────────────────────────────────────────
	// Event/Meeting Data Loading
	// ─────────────────────────────────────────────────────────────

	/**
	 * Load all data for a specific event/meeting
	 */
	async loadEventData(
		season: string,
		meetingKey: number,
		onProgress?: ProgressCallback
	): Promise<AggregatedEventData> {
		const progress: AggregationProgress = {
			total: 4,
			completed: 0,
			current: 'Loading event...',
			errors: []
		};

		const report = (current: string) => {
			progress.current = current;
			onProgress?.(progress);
		};

		report('Loading meeting details...');
		const meetings = await this.safeCall(
			() => this.openf1.fetchMeetings({ season }),
			[],
			progress
		);
		const meeting = meetings.find(m => m.meetingKey === meetingKey);
		
		if (!meeting) {
			throw new Error(`Meeting ${meetingKey} not found`);
		}
		progress.completed++;

		report('Loading sessions...');
		const sessions = await this.safeCall(
			() => this.openf1.fetchSessions({ season, meetingKey }),
			[],
			progress
		);
		progress.completed++;

		report('Loading race data...');
		const races = await this.safeCall(
			() => this.jolpica.fetchRaces({ season }),
			[],
			progress
		);
		// Match race by circuit short name
		const race = races.find(r => 
			r.circuitId.toLowerCase().includes(meeting.circuitShortName.toLowerCase()) ||
			meeting.circuitShortName.toLowerCase().includes(r.circuitId.toLowerCase())
		) || null;
		progress.completed++;

		report('Loading circuit data...');
		const circuits = await this.safeCall(
			() => this.jolpica.fetchCircuits(),
			[],
			progress
		);
		const circuit = race 
			? circuits.find(c => c.circuitId === race.circuitId) || null
			: null;
		progress.completed++;

		return {
			meeting,
			race,
			circuit,
			sessions
		};
	}

	// ─────────────────────────────────────────────────────────────
	// Session Data Loading
	// ─────────────────────────────────────────────────────────────

	/**
	 * Load all data for a specific session
	 */
	async loadSessionData(
		sessionKey: number,
		onProgress?: ProgressCallback
	): Promise<AggregatedSessionData> {
		const progress: AggregationProgress = {
			total: 3,
			completed: 0,
			current: 'Loading session...',
			errors: []
		};

		const report = (current: string) => {
			progress.current = current;
			onProgress?.(progress);
		};

		report('Loading session details...');
		const sessions = await this.openf1.fetchSessions({});
		const session = sessions.find(s => s.sessionKey === sessionKey);
		
		if (!session) {
			throw new Error(`Session ${sessionKey} not found`);
		}
		progress.completed++;

		report('Loading meeting...');
		let meeting: Meeting | null = null;
		if (session.meetingKey) {
			const meetings = await this.safeCall(
				() => this.openf1.fetchMeetings({ season: session.year.toString() }),
				[],
				progress
			);
			meeting = meetings.find(m => m.meetingKey === session.meetingKey) || null;
		}
		progress.completed++;

		report('Loading drivers for session...');
		const drivers = await this.safeCall(
			() => this.openf1.fetchDrivers({ sessionKey }),
			[],
			progress
		);
		progress.completed++;

		return {
			session,
			meeting,
			drivers
		};
	}

	// ─────────────────────────────────────────────────────────────
	// Manual Trigger Methods (for heavy data)
	// ─────────────────────────────────────────────────────────────

	/**
	 * Manually load lap times for a session
	 * This is intentionally separate as it can be a large dataset
	 */
	async loadSessionLaps(
		sessionKey: number,
		driverId?: string,
		onProgress?: ProgressCallback
	): Promise<LapTime[]> {
		const progress: AggregationProgress = {
			total: 1,
			completed: 0,
			current: 'Loading lap times...',
			errors: []
		};

		onProgress?.(progress);

		const laps = await this.openf1.fetchLaps({ sessionKey, driverId });
		
		progress.completed = 1;
		progress.current = `Loaded ${laps.length} laps`;
		onProgress?.(progress);

		return laps;
	}

	// ─────────────────────────────────────────────────────────────
	// Individual Entity Methods (for cache/repository)
	// ─────────────────────────────────────────────────────────────

	async fetchSeasons(): Promise<Season[]> {
		return this.jolpica.fetchSeasons({ limit: 100 });
	}

	async fetchDrivers(season: string): Promise<Driver[]> {
		const [jolpicaDrivers, openf1Drivers] = await Promise.all([
			this.jolpica.fetchDrivers({ season }),
			this.openf1.fetchDrivers({ season }).catch(() => [])
		]);
		return this.mergeDrivers(jolpicaDrivers, openf1Drivers);
	}

	async fetchConstructors(season: string): Promise<Constructor[]> {
		return this.jolpica.fetchConstructors({ season });
	}

	async fetchCircuits(): Promise<Circuit[]> {
		return this.jolpica.fetchCircuits();
	}

	async fetchRaces(season: string): Promise<Race[]> {
		return this.jolpica.fetchRaces({ season });
	}

	async fetchDriverStandings(season: string): Promise<DriverStanding[]> {
		return this.jolpica.fetchDriverStandings({ season });
	}

	async fetchConstructorStandings(season: string): Promise<ConstructorStanding[]> {
		return this.jolpica.fetchConstructorStandings({ season });
	}

	async fetchMeetings(season: string): Promise<Meeting[]> {
		return this.openf1.fetchMeetings({ season });
	}

	async fetchSessions(season: string, meetingKey?: number): Promise<Session[]> {
		return this.openf1.fetchSessions({ season, meetingKey });
	}

	// ─────────────────────────────────────────────────────────────
	// Data Merging
	// ─────────────────────────────────────────────────────────────

	/**
	 * Merge driver data from Jolpica (base) with OpenF1 (enrichments)
	 * Matches by driver number or code
	 */
	private mergeDrivers(jolpicaDrivers: Driver[], openf1Drivers: Driver[]): Driver[] {
		// Create lookup map by permanent number
		const openf1Map = new Map<string, Driver>();
		for (const d of openf1Drivers) {
			if (d.permanentNumber) {
				openf1Map.set(d.permanentNumber, d);
			}
			if (d.code) {
				openf1Map.set(d.code.toUpperCase(), d);
			}
		}

		return jolpicaDrivers.map(jDriver => {
			// Try to find matching OpenF1 driver
			const openf1Driver = 
				openf1Map.get(jDriver.permanentNumber || '') ||
				openf1Map.get(jDriver.code?.toUpperCase() || '');

			if (openf1Driver) {
				// Enrich with OpenF1 data
				return {
					...jDriver,
					teamName: openf1Driver.teamName,
					teamColour: openf1Driver.teamColour,
					headshotUrl: openf1Driver.headshotUrl,
					broadcastName: openf1Driver.broadcastName
				};
			}

			return jDriver;
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────

	/**
	 * Safe API call wrapper that catches errors and records them
	 */
	private async safeCall<T>(
		fn: () => Promise<T>,
		fallback: T,
		progress: AggregationProgress
	): Promise<T> {
		try {
			return await fn();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			progress.errors.push(message);
			console.error('[Aggregator] Error:', message);
			return fallback;
		}
	}
}
