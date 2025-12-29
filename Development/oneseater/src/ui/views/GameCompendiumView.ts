/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { F1DataRepository, DataResult } from "src/compendium/services/F1DataRepository";
import { buildDefaultSettings } from "src/settings/settings.utils";
import { OneSeaterSettings } from "src/settings/types";
import { NavigationManager, NavigationState } from "src/utils/NavigationManager";
import { createHeader, createSection, createInfoGrid, createInfoItem, formatDate, createTable, formatNationality } from "src/utils/ViewHelpers";

export const GAME_COMPENDIUM_VIEW = "oneseater-compendium-view";

export class GameCompendiumView extends ItemView {
	private navigationManager: NavigationManager;
	private repository: F1DataRepository;
	private settings: OneSeaterSettings;
	private hydratedSeasons = new Set<string>();

	// UI Container
	contentEl!: HTMLElement;
	private breadcrumbEl: HTMLElement | null = null;
	private statusEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.settings = buildDefaultSettings();
		this.navigationManager = new NavigationManager();
		this.repository = new F1DataRepository(this.app, this.settings);
	}

	getViewType() {
		return GAME_COMPENDIUM_VIEW;
	}
	getDisplayText() {
		return "OneSeater";
	}
	getIcon() {
		return "trophy";
	}

	// ─────────────────────────────────────────────────────────────
	// Lifecycle
	// ─────────────────────────────────────────────────────────────

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("f1-dashboard");

		this.breadcrumbEl = container.createDiv({ cls: "f1-breadcrumbs" });
		this.statusEl = container.createDiv({ cls: "f1-status" });
		this.contentEl = container.createDiv({ cls: "f1-content" });
		
		this.navigationManager.subscribe((state) => this.renderView(state));
		await this.renderView(this.navigationManager.getCurrentState());
		console.log("[OneSeater] Dashboard opened");
	}

	async onClose() {
		console.log("[OneSeater] Dashboard closed");
	}

	// ─────────────────────────────────────────────────────────────
	// View Routing
	// ─────────────────────────────────────────────────────────────

	private async renderView(state: NavigationState) {
		this.renderBreadcrumbs();
		this.contentEl.empty();

		try {
			switch (state.view) {
				case "home":
					await this.renderHomeView();
					break;
				case "season":
					await this.renderSeasonView(state.season!);
					break;
				case "circuits":
					await this.renderCircuitsView(state.season!);
					break;
				case "circuit":
					await this.renderCircuitDetailView(
						state.season!,
						state.circuitId!
					);
					break;
				case "drivers":
					await this.renderDriversView(state.season!);
					break;
				case "driver":
					await this.renderDriverDetailView(
						state.season!,
						state.driverId!
					);
					break;
				case "constructors":
					await this.renderConstructorsView(state.season!);
					break;
				case "constructor":
					await this.renderConstructorDetailView(
						state.season!,
						state.constructorId!
					);
					break;
				case "event":
					await this.renderEventDetailView(
						state.season!,
						state.round!
					);
					break;
				case "meetings":
					await this.renderMeetingsView(state.season!);
					break;
					case "meeting":
					await this.renderMeetingDetailView(state.season!, state.meetingKey!);
					break;
					case "session":
					await this.renderSessionDetailView(
						state.season!,
						state.meetingKey!,
						state.sessionKey!
					);
					break;
				case "sync":
					await this.renderSyncView();
					break;
			}
		} catch (error) {
			this.renderError(error as Error);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Breadcrumb Navigation
	// ─────────────────────────────────────────────────────────────

	private renderBreadcrumbs() {
		if (!this.breadcrumbEl) return;
		this.breadcrumbEl.empty();

		const breadcrumbs = this.navigationManager.getBreadcrumbs();

		breadcrumbs.forEach((item, index) => {
			if (index > 0) {
				this.breadcrumbEl!.createSpan({
					text: " / ",
					cls: "f1-breadcrumb-sep",
				});
			}

			const isLast = index === breadcrumbs.length - 1;
			const link = this.breadcrumbEl!.createEl(isLast ? "span" : "a", {
				text: item.label,
				cls: isLast ? "f1-breadcrumb-current" : "f1-breadcrumb-link",
			});

			if (!isLast) {
				link.addEventListener("click", () =>
					this.navigationManager.navigate(item.state)
				);
			}
		});

		const actions = this.breadcrumbEl.createDiv({
			cls: "f1-breadcrumb-actions",
		});
		const syncBtn = actions.createEl("button", {
			text: "⚙️ Sync",
			cls: "f1-btn f1-btn-small",
		});
		syncBtn.addEventListener("click", () =>
			this.navigationManager.navigateToSync()
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Home View
	// ─────────────────────────────────────────────────────────────

	private async renderHomeView() {
		const content = this.contentEl;
		createHeader(
			content,
			"🏎️ OneSeater",
			"Wähle eine Saison um die Daten zu erkunden"
		);

		this.setStatus("Lade Saisons...", "info");

		const result = await this.repository.getSeasons();
		const seasons = result.data.sort(
			(a, b) => parseInt(b.season) - parseInt(a.season)
		);

		this.clearStatus();
		this.renderCacheIndicator(content, result);

		const grid = content.createDiv({ cls: "f1-card-grid" });

		seasons.forEach((season) => {
			const card = grid.createDiv({ cls: "f1-card f1-card-clickable" });
			card.createEl("span", { text: "📅", cls: "f1-card-icon" });
			card.createEl("span", {
				text: season.season,
				cls: "f1-card-title",
			});
			card.addEventListener("click", () =>
				this.navigationManager.navigateToSeason(season.season)
			);
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Season View
	// ─────────────────────────────────────────────────────────────

	private async renderSeasonView(season: string) {
		const content = this.contentEl;
		createHeader(content, `Saison ${season}`);

		if (!this.hydratedSeasons.has(season)) {
			try {
				// Initial status
				this.setStatus(`Hydrating season ${season}…`, "info");

				await this.repository.loadAndCacheSeasonData(season, (p) => {
					const safeTotal = Number.isFinite(p.total) ? p.total : 0;
					const safeCompleted = Number.isFinite(p.completed)
						? p.completed
						: 0;

					const counter =
						safeTotal > 0
							? ` (${Math.min(safeCompleted,safeTotal)}/${safeTotal})`
							: "";

					const errCount = Array.isArray(p.errors)
						? p.errors.length
						: 0;
					const errSuffix =
						errCount > 0
							? ` • ${errCount} error${errCount === 1 ? "" : "s"}`
							: "";

					// p.current is the “what are we doing right now”
					const label = p.current?.trim()
						? p.current.trim()
						: "Loading…";

					this.setStatus(
						`${label}${counter}${errSuffix}`,
						errCount > 0 ? "error" : "info"
					);
				});

				this.hydratedSeasons.add(season);

				this.setStatus(`Season ${season} ready`, "success");
				window.setTimeout(() => this.clearStatus(), 800);
			} catch (e) {
				console.error(e);
				new Notice(
					`Season hydration failed. Using cached data if available.`
				);
				this.setStatus(`Hydration failed — using cache`, "error");
				window.setTimeout(() => this.clearStatus(), 1500);
			}
		}

		// Render as before
		const grid = content.createDiv({
			cls: "f1-card-grid f1-card-grid-large",
		});

		const categories = [
			{
				icon: "🏁",
				title: "Strecken & Events",
				desc: "Alle Rennen d...",
				action: () => this.navigationManager.navigateToCircuits(season),
			},
			{
				icon: "👤",
				title: "Fahrer",
				desc: "Alle Fahrer der Saison",
				action: () => this.navigationManager.navigateToDrivers(season),
			},
			{
				icon: "🏎️",
				title: "Teams",
				desc: "Alle Teams der Saison",
				action: () =>
					this.navigationManager.navigateToConstructors(season),
			},
			{
				icon: "📅",
				title: "Meetings (OpenF1)",
				desc: "Events & Sessions (FP/Q/R)",
				action: () => this.navigationManager.navigateToMeetings(season),
			},

		];

		categories.forEach((cat) => {
			const card = grid.createDiv({
				cls: "f1-card f1-card-clickable f1-card-large",
			});
			card.createEl("span", {
				text: cat.icon,
				cls: "f1-card-icon-large",
			});
			const info = card.createDiv({ cls: "f1-card-info" });
			info.createEl("h3", { text: cat.title });
			info.createEl("p", { text: cat.desc });
			card.addEventListener("click", cat.action);
		});

		await this.renderSeasonStats(content, season);
	}

	private async renderSeasonStats(content: HTMLElement, season: string) {
		const section = createSection(content, "📊 Season Overview");
		const grid = createInfoGrid(section);

		// ─────────────────────────────────────────────────────────────
		// Ergast data
		// ─────────────────────────────────────────────────────────────
		const [
			driversResult,
			constructorsResult,
			circuitsResult,
			racesResult,
			driverStandings,
		] = await Promise.all([
			this.repository.getDrivers(season),
			this.repository.getConstructors(season),
			this.repository.getCircuits(),
			this.repository.getRaces(season),
			this.repository.getDriverStandings(season),
		]);

		createInfoItem(grid, "Drivers", String(driversResult.data.length), "👤");
		createInfoItem(grid, "Teams", String(constructorsResult.data.length), "🏎️");
		createInfoItem(grid, "Circuits", String(circuitsResult.data.length), "🏁");
		createInfoItem(grid, "Races", String(racesResult.data.length), "🏆");

		if (driverStandings?.data.length > 0) {
			createInfoItem(
			grid,
			"Champion",
			`${driverStandings.data[0].driverId}`,
			"🥇"
			);
		}

		// ─────────────────────────────────────────────────────────────
		// OpenF1 data
		// ─────────────────────────────────────────────────────────────
		const meetingsResult = await this.repository.getMeetings(season);

		const meetingsCount = meetingsResult.data.length;

		// Sessions are stored per season → aggregate once
		let sessionsCount = 0;
		if (meetingsCount > 0) {
			const sessionsResult = await this.repository.getSessions(season);
			sessionsCount = sessionsResult.data.length;
		}

		createInfoItem(grid, "Meetings", String(meetingsCount), "📅");
		createInfoItem(grid, "Sessions", String(sessionsCount), "🎬");

		// Optional: cache indicators (nice touch, but not required)
		const cacheRow = section.createDiv({ cls: "f1-cache-row" });
		this.renderCacheIndicator(cacheRow, meetingsResult);
	}


	// ─────────────────────────────────────────────────────────────
	// Circuits List View
	// ─────────────────────────────────────────────────────────────

	private async renderCircuitsView(season: string) {
		const content = this.contentEl;
		const header = createHeader(content, `🏁 Rennkalender ${season}`);

		this.setStatus("Lade Rennkalender...", "info");

		const result = await this.repository.getRaces(season);
		this.clearStatus();

		this.addRefreshButton(header, async () => {
			await this.repository.getRaces(season, { forceRefresh: true });
			await this.renderCircuitsView(season);
		});
		this.renderCacheIndicator(content, result);

		const list = content.createDiv({ cls: "f1-list" });

		result.data.forEach((race) => {
			const item = list.createDiv({
				cls: "f1-list-item f1-list-item-clickable",
			});
			const info = item.createDiv({ cls: "f1-list-item-info" });
			info.createEl("span", {
				text: `Runde ${race.round}`,
				cls: "f1-list-item-badge",
			});
			info.createEl("strong", { text: race.raceName });
			info.createEl("span", {
				text: formatDate(race.date),
				cls: "f1-text-muted",
			});
			item.addEventListener("click", () =>
				this.navigationManager.navigateToEvent(
					season,
					race.circuitId,
					race.round
				)
			);
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Circuit Detail View
	// ─────────────────────────────────────────────────────────────

	private async renderCircuitDetailView(season: string, circuitId: string) {
		const content = this.contentEl;

		this.setStatus("Lade Strecken-Details...", "info");

		const { circuit, races } = await this.repository.getCircuitWithRaces(
			season,
			circuitId
		);
		this.clearStatus();

		if (!circuit) {
			content.createEl("p", {
				text: "Strecke nicht gefunden.",
				cls: "f1-text-muted",
			});
			return;
		}

		createHeader(
			content,
			`📍 ${circuit.circuitName}`,
			circuit.locality
				? `${circuit.locality}, ${circuit.country}`
				: undefined
		);

		const infoSection = createSection(content, "📋 Strecken-Informationen");
		const grid = createInfoGrid(infoSection);

		createInfoItem(grid, "Land", circuit.country, "🌍");
		createInfoItem(grid, "Ort", circuit.locality, "📍");
		if (circuit.lat && circuit.lng) {
			createInfoItem(
				grid,
				"Koordinaten",
				`${circuit.lat.toFixed(4)}, ${circuit.lng.toFixed(4)}`,
				"🗺️"
			);
		}

		if (races.length > 0) {
			const racesSection = createSection(content, `🏁 Rennen ${season}`);

			races.forEach((race) => {
				const item = racesSection.createDiv({
					cls: "f1-list-item f1-list-item-clickable",
				});
				const info = item.createDiv({ cls: "f1-list-item-info" });
				info.createEl("span", {
					text: `Runde ${race.round}`,
					cls: "f1-list-item-badge",
				});
				info.createEl("strong", { text: race.raceName });
				info.createEl("span", {
					text: formatDate(race.date),
					cls: "f1-text-muted",
				});
				item.addEventListener("click", () =>
					this.navigationManager.navigateToEvent(
						season,
						circuitId,
						race.round
					)
				);
			});
		}

		if (circuit.url) {
			const linksSection = createSection(content, "🔗 Links");
			const link = linksSection.createEl("a", {
				text: "Wikipedia →",
				href: circuit.url,
				cls: "f1-external-link",
			});
			link.setAttr("target", "_blank");
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Drivers List View
	// ─────────────────────────────────────────────────────────────

	private async renderDriversView(season: string) {
		const content = this.contentEl;
		const header = createHeader(content, `👤 Fahrer ${season}`);

		this.setStatus("Lade Fahrer...", "info");

		const [driversResult, standingsResult] = await Promise.all([
			this.repository.getDrivers(season),
			this.repository.getDriverStandings(season),
		]);

		this.clearStatus();

		this.addRefreshButton(header, async () => {
			await this.repository.getDrivers(season, { forceRefresh: true });
			await this.repository.getDriverStandings(season, {
				forceRefresh: true,
			});
			await this.renderDriversView(season);
		});
		this.renderCacheIndicator(content, driversResult);

		const standingsMap = new Map(
			standingsResult.data.map((s) => [s.driverId, s])
		);

		const sortedDrivers = [...driversResult.data].sort((a, b) => {
			const posA = parseInt(
				standingsMap.get(a.driverId)?.position || "99"
			);
			const posB = parseInt(
				standingsMap.get(b.driverId)?.position || "99"
			);
			return posA - posB;
		});

		createTable(
			content,
			["Pos", "Nr", "Fahrer", "Nationalität", "Punkte"],
			sortedDrivers.map((d) => ({
				...d,
				position: standingsMap.get(d.driverId)?.position || "-",
				points: standingsMap.get(d.driverId)?.points || "0",
				fullName: `${d.givenName} ${d.familyName}`,
			})),
			[
				{ key: "position" },
				{
					key: "permanentNumber",
					format: (v: string) => String(v || "-"),
				},
				{ key: "fullName" },
				{
					key: "nationality",
					format: (v: string) => formatNationality(v as string),
				},
				{ key: "points" },
			],
			(row: { driverId: string }) =>
				this.navigationManager.navigateToDriver(
					season,
					row.driverId as string
				)
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Driver Detail View
	// ─────────────────────────────────────────────────────────────

	private async renderDriverDetailView(season: string, driverId: string) {
		const content = this.contentEl;

		this.setStatus("Lade Fahrer-Details...", "info");

		const {
			driver,
			standing,
			constructor: team,
		} = await this.repository.getDriverWithStanding(season, driverId);
		this.clearStatus();

		if (!driver) {
			content.createEl("p", {
				text: "Fahrer nicht gefunden.",
				cls: "f1-text-muted",
			});
			return;
		}

		const fullName = `${driver.givenName} ${driver.familyName}`;
		createHeader(
			content,
			`👤 ${fullName}`,
			driver.code
				? `#${driver.permanentNumber} • ${driver.code}`
				: undefined
		);

		if (standing) {
			const standingsCard = content.createDiv({
				cls: "f1-highlight-card",
			});
			standingsCard.createEl("span", {
				text: "🏆",
				cls: "f1-highlight-icon",
			});
			const standingsInfo = standingsCard.createDiv({
				cls: "f1-highlight-info",
			});
			standingsInfo.createEl("span", {
				text: `Position ${standing.position}`,
				cls: "f1-highlight-title",
			});
			standingsInfo.createEl("span", {
				text: `${standing.points} Punkte • ${standing.wins} Siege`,
				cls: "f1-highlight-subtitle",
			});
		}

		const infoSection = createSection(content, "📋 Fahrer-Informationen");
		const grid = createInfoGrid(infoSection);

		createInfoItem(
			grid,
			"Nationalität",
			formatNationality(driver.nationality),
			"🌍"
		);
		createInfoItem(
			grid,
			"Geburtsdatum",
			formatDate(driver.dateOfBirth),
			"🎂"
		);
		createInfoItem(grid, "Startnummer", driver.permanentNumber, "#️⃣");
		createInfoItem(grid, "Kürzel", driver.code, "🔤");

		if (team) {
			const teamSection = createSection(content, "🏎️ Team");
			const teamCard = teamSection.createDiv({
				cls: "f1-card f1-card-clickable",
			});
			teamCard.createEl("span", {
				text: team.name,
				cls: "f1-card-title",
			});
			teamCard.createEl("span", {
				text: formatNationality(team.nationality),
				cls: "f1-text-muted",
			});
			teamCard.addEventListener("click", () =>
				this.navigationManager.navigateToConstructor(
					season,
					team.constructorId
				)
			);
		}

		if (driver.url) {
			const linksSection = createSection(content, "🔗 Links");
			const link = linksSection.createEl("a", {
				text: "Wikipedia →",
				href: driver.url,
				cls: "f1-external-link",
			});
			link.setAttr("target", "_blank");
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Constructors List View
	// ─────────────────────────────────────────────────────────────

	private async renderConstructorsView(season: string) {
		const content = this.contentEl;
		const header = createHeader(content, `🏎️ Teams ${season}`);

		this.setStatus("Lade Teams...", "info");

		const [constructorsResult, standingsResult] = await Promise.all([
			this.repository.getConstructors(season),
			this.repository.getConstructorStandings(season),
		]);

		this.clearStatus();

		this.addRefreshButton(header, async () => {
			await this.repository.getConstructors(season, {
				forceRefresh: true,
			});
			await this.repository.getConstructorStandings(season, {
				forceRefresh: true,
			});
			await this.renderConstructorsView(season);
		});
		this.renderCacheIndicator(content, constructorsResult);

		const standingsMap = new Map(
			standingsResult.data.map((s) => [s.constructorId, s])
		);

		const sortedConstructors = [...constructorsResult.data].sort((a, b) => {
			const posA = parseInt(
				standingsMap.get(a.constructorId)?.position || "99"
			);
			const posB = parseInt(
				standingsMap.get(b.constructorId)?.position || "99"
			);
			return posA - posB;
		});

		createTable(
			content,
			["Pos", "Team", "Nationalität", "Punkte", "Siege"],
			sortedConstructors.map((c) => ({
				...c,
				position: standingsMap.get(c.constructorId)?.position || "-",
				points: standingsMap.get(c.constructorId)?.points || "0",
				wins: standingsMap.get(c.constructorId)?.wins || "0",
			})),
			[
				{ key: "position" },
				{ key: "name" },
				{
					key: "nationality",
					format: (v: string) => formatNationality(v as string),
				},
				{ key: "points" },
				{ key: "wins" },
			],
			(row: { constructorId: string }) =>
				this.navigationManager.navigateToConstructor(
					season,
					row.constructorId as string
				)
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Constructor Detail View
	// ─────────────────────────────────────────────────────────────

	private async renderConstructorDetailView(
		season: string,
		constructorId: string
	) {
		const content = this.contentEl;

		this.setStatus("Lade Team-Details...", "info");

		const {
			constructor: team,
			standing,
			drivers,
		} = await this.repository.getConstructorWithStanding(
			season,
			constructorId
		);
		this.clearStatus();

		if (!team) {
			content.createEl("p", {
				text: "Team nicht gefunden.",
				cls: "f1-text-muted",
			});
			return;
		}

		createHeader(
			content,
			`🏎️ ${team.name}`,
			formatNationality(team.nationality)
		);

		if (standing) {
			const standingsCard = content.createDiv({
				cls: "f1-highlight-card",
			});
			standingsCard.createEl("span", {
				text: "🏆",
				cls: "f1-highlight-icon",
			});
			const standingsInfo = standingsCard.createDiv({
				cls: "f1-highlight-info",
			});
			standingsInfo.createEl("span", {
				text: `Position ${standing.position}`,
				cls: "f1-highlight-title",
			});
			standingsInfo.createEl("span", {
				text: `${standing.points} Punkte • ${standing.wins} Siege`,
				cls: "f1-highlight-subtitle",
			});
		}

		const infoSection = createSection(content, "📋 Team-Informationen");
		const grid = createInfoGrid(infoSection);
		createInfoItem(
			grid,
			"Nationalität",
			formatNationality(team.nationality),
			"🌍"
		);

		if (drivers.length > 0) {
			const driversSection = createSection(
				content,
				`👤 Fahrer ${season}`
			);

			drivers.forEach((driver) => {
				const card = driversSection.createDiv({
					cls: "f1-card f1-card-clickable",
				});
				card.createEl("span", {
					text: `#${driver.permanentNumber || "?"}`,
					cls: "f1-card-badge",
				});
				card.createEl("span", {
					text: `${driver.givenName} ${driver.familyName}`,
					cls: "f1-card-title",
				});
				card.createEl("span", {
					text: formatNationality(driver.nationality),
					cls: "f1-text-muted",
				});
				card.addEventListener("click", () =>
					this.navigationManager.navigateToDriver(
						season,
						driver.driverId
					)
				);
			});
		}

		if (team.url) {
			const linksSection = createSection(content, "🔗 Links");
			const link = linksSection.createEl("a", {
				text: "Wikipedia →",
				href: team.url,
				cls: "f1-external-link",
			});
			link.setAttr("target", "_blank");
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Event Detail View
	// ─────────────────────────────────────────────────────────────

	private async renderEventDetailView(season: string, round: string) {
		const content = this.contentEl;

		this.setStatus("Lade Event-Details...", "info");

		const { race, circuit } = await this.repository.getRaceWithDetails(
			season,
			round
		);
		this.clearStatus();

		if (!race) {
			content.createEl("p", {
				text: "Event nicht gefunden.",
				cls: "f1-text-muted",
			});
			return;
		}

		createHeader(
			content,
			`🏆 ${race.raceName}`,
			`Runde ${race.round} • ${formatDate(race.date)}`
		);

		const infoSection = createSection(content, "📋 Event-Informationen");
		const grid = createInfoGrid(infoSection);

		createInfoItem(grid, "Saison", season, "📅");
		createInfoItem(grid, "Runde", race.round, "#️⃣");
		createInfoItem(grid, "Datum", formatDate(race.date), "🗓️");
		if (race.time) {
			createInfoItem(grid, "Startzeit", race.time, "⏰");
		}

		if (circuit) {
			const circuitSection = createSection(content, "🏁 Strecke");
			const circuitCard = circuitSection.createDiv({
				cls: "f1-card f1-card-clickable f1-card-large",
			});
			circuitCard.createEl("span", {
				text: "📍",
				cls: "f1-card-icon-large",
			});
			const info = circuitCard.createDiv({ cls: "f1-card-info" });
			info.createEl("h3", { text: circuit.circuitName });
			info.createEl("p", {
				text: `${circuit.locality}, ${circuit.country}`,
			});
			circuitCard.addEventListener("click", () =>
				this.navigationManager.navigateToCircuit(
					season,
					circuit.circuitId
				)
			);
		}

		const resultsSection = createSection(content, "📊 Ergebnisse");
		resultsSection.createEl("p", {
			text: "Rennergebnisse werden in einer zukünftigen Version verfügbar sein.",
			cls: "f1-text-muted",
		});
	}

	private async renderMeetingsView(season: string) {
		const content = this.contentEl;
		const header = createHeader(content, `📅 Meetings ${season}`, "OpenF1 Events & Sessions");

		this.setStatus("Lade Meetings...", "info");
		const result = await this.repository.getMeetings(season);
		this.clearStatus();

		this.addRefreshButton(header, async () => {
			await this.repository.getMeetings(season, { forceRefresh: true });
			await this.renderMeetingsView(season);
		});

		this.renderCacheIndicator(content, result);

		if (result.data.length === 0) {
			content.createEl("p", { text: "Keine Meetings gefunden.", cls: "f1-text-muted" });
			return;
		}

		const list = content.createDiv({ cls: "f1-list" });

		// Sort by dateStart ascending
		const sorted = [...result.data].sort((a, b) => a.dateStart.localeCompare(b.dateStart));

		sorted.forEach((m) => {
			const item = list.createDiv({ cls: "f1-list-item f1-list-item-clickable" });
			const info = item.createDiv({ cls: "f1-list-item-info" });

			info.createEl("span", { text: `#${m.meetingKey}`, cls: "f1-list-item-badge" });
			info.createEl("strong", { text: m.meetingName });
			info.createEl("span", {
			text: `${m.location}, ${m.countryName} • ${formatDate(m.dateStart)}`,
			cls: "f1-text-muted",
			});

			item.addEventListener("click", () =>
			this.navigationManager.navigateToMeeting(season, m.meetingKey)
			);
		});
	}

	private async renderMeetingDetailView(season: string, meetingKey: number) {
		const content = this.contentEl;

		this.setStatus("Lade Meeting-Details...", "info");

		const [meeting, sessions] = await Promise.all([
			this.repository.getMeeting(season, meetingKey),
			this.repository.getSessionsForMeeting(season, meetingKey),
		]);

		this.clearStatus();

		if (!meeting) {
			content.createEl("p", { text: "Meeting nicht gefunden.", cls: "f1-text-muted" });
			return;
		}

		createHeader(
			content,
			`🏟️ ${meeting.meetingName}`,
			`${meeting.location}, ${meeting.countryName} • ${formatDate(meeting.dateStart)}`
		);

		const infoSection = createSection(content, "📋 Meeting-Informationen");
		const grid = createInfoGrid(infoSection);

		createInfoItem(grid, "Season", String(meeting.year), "📅");
		createInfoItem(grid, "Meeting Key", String(meeting.meetingKey), "🔑");
		createInfoItem(grid, "Circuit", meeting.circuitShortName, "🏁");
		createInfoItem(grid, "Country", `${meeting.countryName} (${meeting.countryCode})`, "🌍");
		createInfoItem(grid, "Start", formatDate(meeting.dateStart), "🗓️");
		createInfoItem(grid, "GMT Offset", meeting.gmtOffset, "⏱️");

		const sessionsSection = createSection(content, "🎬 Sessions");
		if (!sessions || sessions.length === 0) {
			sessionsSection.createEl("p", { text: "Keine Sessions gefunden.", cls: "f1-text-muted" });
			return;
		}

		const list = sessionsSection.createDiv({ cls: "f1-list" });

		const sorted = [...sessions].sort((a, b) => a.dateStart.localeCompare(b.dateStart));

		sorted.forEach((s) => {
			const item = list.createDiv({ cls: "f1-list-item f1-list-item-clickable" });
			const info = item.createDiv({ cls: "f1-list-item-info" });

			info.createEl("span", { text: s.sessionType || "SESSION", cls: "f1-list-item-badge" });
			info.createEl("strong", { text: s.sessionName });
			info.createEl("span", {
			text: `${formatDate(s.dateStart)} → ${formatDate(s.dateEnd)}`,
			cls: "f1-text-muted",
			});

			item.addEventListener("click", () =>
			this.navigationManager.navigateToSession(season, meetingKey, s.sessionKey)
			);
		});
	}

	private async renderSessionDetailView(
		season: string,
		meetingKey: number,
		sessionKey: number
	) {
		const content = this.contentEl;

		this.setStatus("Lade Session-Details...", "info");

		// Session is inside sessions_{season}, so we reuse getSessionsForMeeting and find it
		const [meeting, sessions] = await Promise.all([
			this.repository.getMeeting(season, meetingKey),
			this.repository.getSessionsForMeeting(season, meetingKey),
		]);

		const session = sessions.find((s) => s.sessionKey === sessionKey) || null;

		this.clearStatus();

		if (!session) {
			content.createEl("p", { text: "Session nicht gefunden.", cls: "f1-text-muted" });
			return;
		}

		createHeader(
			content,
			`🎬 ${session.sessionName}`,
			`${session.sessionType} • ${formatDate(session.dateStart)}`
		);

		const infoSection = createSection(content, "📋 Session-Informationen");
		const grid = createInfoGrid(infoSection);

		createInfoItem(grid, "Season", String(session.year), "📅");
		createInfoItem(grid, "Meeting Key", String(meetingKey), "🏟️");
		createInfoItem(grid, "Session Key", String(session.sessionKey), "🔑");
		createInfoItem(grid, "Circuit", session.circuitShortName, "🏁");
		if (meeting) {
			createInfoItem(grid, "Location", `${meeting.location}, ${meeting.countryName}`, "📍");
		}
		createInfoItem(grid, "Start", formatDate(session.dateStart), "🗓️");
		createInfoItem(grid, "End", formatDate(session.dateEnd), "🏁");

		// ─────────────────────────────────────────────────────────────
		// Manual big-data trigger (laps)
		// ─────────────────────────────────────────────────────────────

		const actionsSection = createSection(content, "⚡ Actions");
		const row = actionsSection.createDiv({ cls: "f1-actions-row" });

		const lapsBtn = row.createEl("button", {
			text: "⬇️ Load Lap Data (Manual)",
			cls: "f1-btn f1-btn-primary",
		});

		const hint = row.createDiv({ cls: "f1-text-muted" });
		hint.setText("Large dataset. Only loaded on demand.");

		const lapsContainer = content.createDiv({ cls: "f1-section" });

		lapsBtn.addEventListener("click", async () => {
			lapsBtn.disabled = true;
			lapsContainer.empty();

			this.setStatus("Lade Lap Data...", "info");

			try {
			const lapsResult = await this.repository.getLaps(sessionKey, { forceRefresh: true });
			this.clearStatus();

			this.renderCacheIndicator(lapsContainer, lapsResult);

			if (lapsResult.data.length === 0) {
				lapsContainer.createEl("p", { text: "Keine Lap Daten gefunden.", cls: "f1-text-muted" });
				return;
			}

			// Show a lightweight preview (first 50 rows)
			const preview = lapsResult.data.slice(0, 50).map((l) => ({
				driverId: l.driverId,
				lap: l.lap,
				position: l.position,
				time: l.time ?? (typeof l.milliseconds === "number" ? `${l.milliseconds} ms` : "-"),
				sector1: l.sector1 ?? "-",
				sector2: l.sector2 ?? "-",
				sector3: l.sector3 ?? "-",
			}));

			createTable(
				lapsContainer,
				["Driver", "Lap", "Pos", "Time", "S1", "S2", "S3"],
				preview,
				[
				{ key: "driverId" },
				{ key: "lap" },
				{ key: "position" },
				{ key: "time" },
				{ key: "sector1" },
				{ key: "sector2" },
				{ key: "sector3" },
				]
			);

			lapsContainer.createEl("p", {
				text: `Showing 50 / ${lapsResult.data.length} laps (preview)`,
				cls: "f1-text-muted",
			});
			} catch (e) {
				console.error(e);
				this.setStatus("Lap Data konnte nicht geladen werden.", "error");
				new Notice("Lap Data load failed (see console).");
				window.setTimeout(() => this.clearStatus(), 1500);
			} finally {
				lapsBtn.disabled = false;
			}
		});
	}


	// ─────────────────────────────────────────────────────────────
	// Sync View
	// ─────────────────────────────────────────────────────────────

	private async renderSyncView() {
		const content = this.contentEl;
		createHeader(
			content,
			"⚙️ Daten Synchronisation",
			"Lade alle Stammdaten herunter und speichere sie lokal."
		);

		const settingsInfo = content.createDiv({ cls: "f1-info-box" });
		settingsInfo.createEl("strong", { text: "Speicherort: " });
		settingsInfo.createEl("code", {
			text: `${this.settings.dataFolderPath}/cache/`,
		});

		const cacheInfo = await this.repository.getCacheInfo();
		const cacheBox = content.createDiv({ cls: "f1-info-box" });
		cacheBox.createEl("strong", { text: "Cache: " });
		cacheBox.createEl("span", {
			text: `${cacheInfo.files.length} Dateien (${this.formatBytes(
				cacheInfo.totalSize
			)})`,
		});

		if (cacheInfo.entries.length > 0) {
			const entriesSection = createSection(content, "📦 Gecachte Daten");
			const entriesList = entriesSection.createDiv({
				cls: "f1-cache-list",
			});

			cacheInfo.entries.forEach((entry) => {
				const item = entriesList.createDiv({ cls: "f1-cache-entry" });
				item.createEl("span", { text: entry.key, cls: "f1-cache-key" });
				item.createEl("span", {
					text: `${entry.count} Einträge`,
					cls: "f1-cache-count",
				});
				item.createEl("span", {
					text: formatDate(entry.cachedAt),
					cls: "f1-cache-date",
				});
			});
		}

		const optionsSection = createSection(
			content,
			"Synchronisations-Optionen"
		);
		const seasonRow = optionsSection.createDiv({ cls: "f1-option-row" });
		seasonRow.createEl("label", { text: "Saison:" });
		const seasonInput = seasonRow.createEl("input", {
			type: "text",
			value: new Date().getFullYear().toString(),
			placeholder: "z.B. 2024",
		});

		const actionsSection = content.createDiv({
			cls: "f1-section f1-actions-row",
		});

		const syncBtn = actionsSection.createEl("button", {
			text: "🔄 Alle Stammdaten synchronisieren",
			cls: "f1-btn f1-btn-primary f1-btn-large",
		});

		const clearBtn = actionsSection.createEl("button", {
			text: "🗑️ Cache leeren",
			cls: "f1-btn f1-btn-large",
		});

		const progressEl = actionsSection.createDiv({
			cls: "f1-progress-container",
		});
		progressEl.style.display = "none";

		syncBtn.addEventListener("click", async () => {
			const season = seasonInput.value || "current";
			syncBtn.disabled = true;
			progressEl.style.display = "block";
			progressEl.empty();

			const progressBar = progressEl.createDiv({
				cls: "f1-progress-bar",
			});
			const progressFill = progressBar.createDiv({
				cls: "f1-progress-fill",
			});
			const progressText = progressEl.createDiv({
				cls: "f1-progress-text",
			});

			progressText.setText("Synchronisiere...");
			progressFill.style.width = "50%";

			const result = await this.repository.refreshAll(season);

			progressFill.style.width = "100%";
			progressText.setText(
				result.errors.length === 0
					? `✅ ${result.success} Entitäten erfolgreich synchronisiert!`
					: `⚠️ ${result.success} erfolgreich. Fehler: ${result.errors.join(", ")}`
			);

			syncBtn.disabled = false;
			new Notice(`Sync abgeschlossen: ${result.success} erfolgreich`);
		});

		clearBtn.addEventListener("click", async () => {
			await this.repository.clearCache();
			new Notice("Cache geleert");
			this.renderSyncView();
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Helper Methods
	// ─────────────────────────────────────────────────────────────

	private renderCacheIndicator(
		container: HTMLElement,
		result: DataResult<unknown[]>
	) {
		const indicator = container.createDiv({ cls: "f1-cache-indicator" });

		if (result.source === "cache") {
			indicator.addClass("is-cached");
			const date = result.cachedAt
				? formatDate(result.cachedAt)
				: "Unbekannt";
			indicator.createEl("span", { text: `📦 Aus Cache (${date})` });
		} else {
			indicator.addClass("is-live");
			indicator.createEl("span", { text: "🌐 Live geladen & gecached" });
		}
	}

	private addRefreshButton(
		header: HTMLElement,
		onRefresh: () => Promise<void>
	) {
		const actions =
			(header.querySelector(".f1-view-actions") as HTMLElement) ||
			header.createDiv({ cls: "f1-view-actions" });
		const btn = actions.createEl("button", {
			text: "🔄",
			cls: "f1-btn f1-btn-small",
			attr: { title: "Neu laden" },
		});
		btn.addEventListener("click", async () => {
			btn.disabled = true;
			await onRefresh();
			btn.disabled = false;
		});
	}

	private setStatus(
		message: string,
		type: "info" | "success" | "error" = "info"
	) {
		if (!this.statusEl) return;
		this.statusEl.empty();
		this.statusEl.removeClass(
			"is-hidden",
			"is-success",
			"is-error",
			"is-info"
		);
		this.statusEl.addClass(`is-${type}`);
		this.statusEl.createEl("span", { text: message });
	}

	private clearStatus() {
		if (!this.statusEl) return;
		this.statusEl.empty();
		this.statusEl.addClass("is-hidden");
	}

	private renderError(error: Error) {
		const errorBox = this.contentEl.createDiv({ cls: "f1-error-box" });
		errorBox.createEl("h3", { text: "❌ Fehler" });
		errorBox.createEl("p", { text: error.message });

		const retryBtn = errorBox.createEl("button", {
			text: "🔄 Erneut versuchen",
			cls: "f1-btn",
		});
		retryBtn.addEventListener("click", () =>
			this.renderView(this.navigationManager.getCurrentState())
		);
	}

	private formatBytes(bytes: number): string {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
	}
}
