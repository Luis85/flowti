// ─────────────────────────────────────────────────────────────
// OpenF1 API Service
// https://openf1.org
// Live und Telemetrie-Daten für aktuelle F1 Sessions
// ─────────────────────────────────────────────────────────────

import { 
	Driver, 
	Session,
	Meeting,
	LapTime,
	F1EntityType 
} from "../models/F1Models";
import { BaseF1ApiService, FetchOptions } from "./F1ApiService";

// OpenF1 Response Types
interface OpenF1Driver {
	driver_number: number;
	broadcast_name: string;
	full_name: string;
	name_acronym: string;
	team_name: string;
	team_colour: string;
	first_name: string;
	last_name: string;
	headshot_url: string;
	country_code: string;
	session_key: number;
	meeting_key: number;
}

interface OpenF1Session {
	session_key: number;
	session_name: string;
	session_type: string;
	date_start: string;
	date_end: string;
	gmt_offset: string;
	circuit_key: number;
	circuit_short_name: string;
	country_key: number;
	country_code: string;
	country_name: string;
	location: string;
	year: number;
	meeting_key: number;
}

interface OpenF1Meeting {
	meeting_key: number;
	meeting_name: string;
	meeting_official_name: string;
	year: number;
	circuit_key: number;
	circuit_short_name: string;
	country_key: number;
	country_code: string;
	country_name: string;
	location: string;
	date_start: string;
	gmt_offset: string;
}

interface OpenF1Lap {
	driver_number: number;
	lap_number: number;
	lap_duration: number | null;
	duration_sector_1: number | null;
	duration_sector_2: number | null;
	duration_sector_3: number | null;
	i1_speed: number | null;
	i2_speed: number | null;
	st_speed: number | null;
	is_pit_out_lap: boolean;
	session_key: number;
	meeting_key: number;
	date_start: string;
}

// ─────────────────────────────────────────────────────────────
// Service Implementation
// ─────────────────────────────────────────────────────────────

export class OpenF1ApiService extends BaseF1ApiService {
	readonly provider = 'openf1' as const;
	readonly baseUrl = 'https://api.openf1.org/v1';
	
	protected supportedEntities: F1EntityType[] = [
		'drivers',
		'meetings',
		'sessions',
		'laps'
	];

	async fetchDrivers(options?: FetchOptions): Promise<Driver[]> {
		let url = `${this.baseUrl}/drivers`;
		const params: string[] = [];
		
		if (options?.sessionKey) {
			params.push(`session_key=${options.sessionKey}`);
		}
		if (options?.season) {
			// Get latest session of the year to get current driver data
			params.push(`session_key>=${options.season}0101`);
		}
		
		if (params.length > 0) {
			url += '?' + params.join('&');
		}
		
		const response = await this.fetchJson<OpenF1Driver[]>(url);
		
		// OpenF1 kann Duplikate zurückgeben, deduplizieren nach driver_number
		const uniqueDrivers = this.deduplicateByKey(response, 'driver_number');
		
		return uniqueDrivers.map(this.mapDriver);
	}

	async fetchMeetings(options?: FetchOptions): Promise<Meeting[]> {
		let url = `${this.baseUrl}/meetings`;
		const params: string[] = [];
		
		if (options?.season) {
			params.push(`year=${options.season}`);
		}
		
		if (params.length > 0) {
			url += '?' + params.join('&');
		}
		
		const response = await this.fetchJson<OpenF1Meeting[]>(url);
		return response.map(this.mapMeeting);
	}

	async fetchSessions(options?: FetchOptions): Promise<Session[]> {
		let url = `${this.baseUrl}/sessions`;
		const params: string[] = [];
		
		if (options?.season) {
			params.push(`year=${options.season}`);
		}
		if (options?.meetingKey) {
			params.push(`meeting_key=${options.meetingKey}`);
		}
		
		if (params.length > 0) {
			url += '?' + params.join('&');
		}
		
		const response = await this.fetchJson<OpenF1Session[]>(url);
		
		return response.map(this.mapSession);
	}

	async fetchLaps(options: FetchOptions): Promise<LapTime[]> {
		if (!options.sessionKey) {
			throw new Error('sessionKey ist erforderlich für fetchLaps');
		}
		
		let url = `${this.baseUrl}/laps?session_key=${options.sessionKey}`;
		
		if (options.driverId) {
			url += `&driver_number=${options.driverId}`;
		}
		
		const response = await this.fetchJson<OpenF1Lap[]>(url);
		
		return response.map(this.mapLap);
	}

	// ─────────────────────────────────────────────────────────────
	// Mapper Functions
	// ─────────────────────────────────────────────────────────────

	private mapDriver(d: OpenF1Driver): Driver {
		return {
			driverId: d.driver_number.toString(),
			givenName: d.first_name,
			familyName: d.last_name,
			nationality: d.country_code,
			code: d.name_acronym,
			permanentNumber: d.driver_number.toString(),
			// OpenF1 enrichments
			teamName: d.team_name,
			teamColour: d.team_colour,
			headshotUrl: d.headshot_url,
			broadcastName: d.broadcast_name
		};
	}

	private mapMeeting(m: OpenF1Meeting): Meeting {
		return {
			meetingKey: m.meeting_key,
			meetingName: m.meeting_name,
			meetingOfficialName: m.meeting_official_name,
			year: m.year,
			circuitKey: m.circuit_key,
			circuitShortName: m.circuit_short_name,
			countryKey: m.country_key,
			countryCode: m.country_code,
			countryName: m.country_name,
			location: m.location,
			dateStart: m.date_start,
			gmtOffset: m.gmt_offset
		};
	}

	private mapSession(s: OpenF1Session): Session {
		return {
			sessionKey: s.session_key,
			sessionName: s.session_name,
			sessionType: s.session_type,
			dateStart: s.date_start,
			dateEnd: s.date_end,
			circuitKey: s.circuit_key,
			circuitShortName: s.circuit_short_name,
			year: s.year,
			// Additional fields
			meetingKey: s.meeting_key,
			gmtOffset: s.gmt_offset,
			countryKey: s.country_key,
			countryCode: s.country_code,
			countryName: s.country_name,
			location: s.location
		};
	}

	private mapLap(l: OpenF1Lap): LapTime {
		return {
			driverId: l.driver_number.toString(),
			lap: l.lap_number,
			position: 0, // OpenF1 liefert keine Position pro Runde
			time: l.lap_duration ? `${l.lap_duration}` : "",
			milliseconds: l.lap_duration ? Math.round(l.lap_duration * 1000) : undefined,
			// Sector times
			sector1: l.duration_sector_1 ?? undefined,
			sector2: l.duration_sector_2 ?? undefined,
			sector3: l.duration_sector_3 ?? undefined,
			// Speed traps
			speedI1: l.i1_speed ?? undefined,
			speedI2: l.i2_speed ?? undefined,
			speedST: l.st_speed ?? undefined,
			isPitOutLap: l.is_pit_out_lap,
			sessionKey: l.session_key
		};
	}

	// ─────────────────────────────────────────────────────────────
	// Helper Functions
	// ─────────────────────────────────────────────────────────────

	private deduplicateByKey<T, K extends keyof T>(array: T[], key: K): T[] {
		const seen = new Set<T[K]>();
		return array.filter(item => {
			if (seen.has(item[key])) {
				return false;
			}
			seen.add(item[key]);
			return true;
		});
	}

	private formatLapTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		
		if (mins > 0) {
			return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
		}
		return secs.toFixed(3);
	}
}
