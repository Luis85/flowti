// ─────────────────────────────────────────────────────────────
// Navigation State Management
// ─────────────────────────────────────────────────────────────

export type ViewType = 
	| 'home'           // Seasons Übersicht
	| 'season'         // Season Detail (Circuits, Drivers, Constructors)
	| 'circuits'       // Alle Circuits der Season
	| 'circuit'        // Circuit Detail mit Events
	| 'drivers'        // Alle Drivers der Season  
	| 'driver'         // Driver Detail
	| 'constructors'   // Alle Constructors der Season
	| 'constructor'    // Constructor Detail
	| 'event'          // Event/Race Detail
	| 'sync'          // Sync/Download View
	| "meetings"       // Alle Meetings der Season (OpenF1)
	| "meeting"        // Meeting Detail (OpenF1) -> Sessions list
	| "session"        // Session Detail (OpenF1) -> lap trigger button lives here
	| "sync";          // Sync/Download View

export interface NavigationState {
	view: ViewType;
	season?: string;
	circuitId?: string;
	driverId?: string;
	constructorId?: string;
	round?: string;
	meetingKey?: number;
	sessionKey?: number;
}

export interface BreadcrumbItem {
	label: string;
	state: NavigationState;
}

// ─────────────────────────────────────────────────────────────
// Navigation Manager
// ─────────────────────────────────────────────────────────────

export class NavigationManager {
	private history: NavigationState[] = [];
	private currentState: NavigationState = { view: 'home' };
	private listeners: Set<(state: NavigationState) => void> = new Set();

	getCurrentState(): NavigationState {
		return { ...this.currentState };
	}

	navigate(state: NavigationState): void {
		// Nur pushen wenn es nicht der gleiche State ist
		if (JSON.stringify(this.currentState) !== JSON.stringify(state)) {
			this.history.push({ ...this.currentState });
		}
		this.currentState = { ...state };
		this.notifyListeners();
	}

	goBack(): boolean {
		if (this.history.length === 0) {
			return false;
		}
		this.currentState = this.history.pop()!;
		this.notifyListeners();
		return true;
	}

	goHome(): void {
		this.history = [];
		this.currentState = { view: 'home' };
		this.notifyListeners();
	}

	canGoBack(): boolean {
		return this.history.length > 0;
	}

	subscribe(listener: (state: NavigationState) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notifyListeners(): void {
		this.listeners.forEach(listener => listener(this.getCurrentState()));
	}

	// ─────────────────────────────────────────────────────────────
	// Breadcrumb Generation
	// ─────────────────────────────────────────────────────────────

	getBreadcrumbs(): BreadcrumbItem[] {
		const breadcrumbs: BreadcrumbItem[] = [
			{ label: '🏠 Home', state: { view: 'home' } }
		];

		const state = this.currentState;

		if (state.view === 'home') {
			return breadcrumbs;
		}

		if (state.season) {
			breadcrumbs.push({
				label: `📅 ${state.season}`,
				state: { view: 'season', season: state.season }
			});
		}

		switch (state.view) {
			case 'circuits':
				breadcrumbs.push({
					label: '🏁 Strecken',
					state: { view: 'circuits', season: state.season }
				});
				break;

			case 'circuit':
				breadcrumbs.push({
					label: '🏁 Strecken',
					state: { view: 'circuits', season: state.season }
				});
				if (state.circuitId) {
					breadcrumbs.push({
						label: `📍 ${state.circuitId}`,
						state: state
					});
				}
				break;

			case 'drivers':
				breadcrumbs.push({
					label: '👤 Fahrer',
					state: { view: 'drivers', season: state.season }
				});
				break;

			case 'driver':
				breadcrumbs.push({
					label: '👤 Fahrer',
					state: { view: 'drivers', season: state.season }
				});
				if (state.driverId) {
					breadcrumbs.push({
						label: state.driverId,
						state: state
					});
				}
				break;

			case 'constructors':
				breadcrumbs.push({
					label: '🏎️ Teams',
					state: { view: 'constructors', season: state.season }
				});
				break;

			case 'constructor':
				breadcrumbs.push({
					label: '🏎️ Teams',
					state: { view: 'constructors', season: state.season }
				});
				if (state.constructorId) {
					breadcrumbs.push({
						label: state.constructorId,
						state: state
					});
				}
				break;

			case 'event':
				breadcrumbs.push({
					label: '🏁 Strecken',
					state: { view: 'circuits', season: state.season }
				});
				if (state.circuitId) {
					breadcrumbs.push({
						label: `📍 ${state.circuitId}`,
						state: { view: 'circuit', season: state.season, circuitId: state.circuitId }
					});
				}
				if (state.round) {
					breadcrumbs.push({
						label: `🏆 Runde ${state.round}`,
						state: state
					});
				}
				break;

			case "meetings":
				breadcrumbs.push({
				label: "📅 Meetings",
				state: { view: "meetings", season: state.season },
				});
				break;

			case "meeting":
				breadcrumbs.push({
				label: "📅 Meetings",
				state: { view: "meetings", season: state.season },
				});
				if (typeof state.meetingKey === "number") {
				breadcrumbs.push({
					label: `🏟️ Meeting ${state.meetingKey}`,
					state: { view: "meeting", season: state.season, meetingKey: state.meetingKey },
				});
				}
				break;

			case "session":
				breadcrumbs.push({
				label: "📅 Meetings",
				state: { view: "meetings", season: state.season },
				});
				if (typeof state.meetingKey === "number") {
				breadcrumbs.push({
					label: `🏟️ Meeting ${state.meetingKey}`,
					state: { view: "meeting", season: state.season, meetingKey: state.meetingKey },
				});
				}
				if (typeof state.sessionKey === "number") {
				breadcrumbs.push({
					label: `🎬 Session ${state.sessionKey}`,
					state: {
					view: "session",
					season: state.season,
					meetingKey: state.meetingKey,
					sessionKey: state.sessionKey,
					},
				});
				}
				break;


			case 'sync':
				breadcrumbs.push({
					label: '⚙️ Sync',
					state: { view: 'sync' }
				});
				break;
		}

		return breadcrumbs;
	}

	// ─────────────────────────────────────────────────────────────
	// Navigation Helpers
	// ─────────────────────────────────────────────────────────────

	navigateToSeason(season: string): void {
		this.navigate({ view: 'season', season });
	}

	navigateToCircuits(season: string): void {
		this.navigate({ view: 'circuits', season });
	}

	navigateToCircuit(season: string, circuitId: string): void {
		this.navigate({ view: 'circuit', season, circuitId });
	}

	navigateToDrivers(season: string): void {
		this.navigate({ view: 'drivers', season });
	}

	navigateToDriver(season: string, driverId: string): void {
		this.navigate({ view: 'driver', season, driverId });
	}

	navigateToConstructors(season: string): void {
		this.navigate({ view: 'constructors', season });
	}

	navigateToConstructor(season: string, constructorId: string): void {
		this.navigate({ view: 'constructor', season, constructorId });
	}

	navigateToEvent(season: string, circuitId: string, round: string): void {
		this.navigate({ view: 'event', season, circuitId, round });
	}

	navigateToMeetings(season: string): void {
		this.navigate({ view: "meetings", season });
	}

	navigateToMeeting(season: string, meetingKey: number): void {
		this.navigate({ view: "meeting", season, meetingKey });
	}

	navigateToSession(season: string, meetingKey: number, sessionKey: number): void {
		this.navigate({ view: "session", season, meetingKey, sessionKey });
	}

	navigateToSync(): void {
		this.navigate({ view: 'sync' });
	}
}
