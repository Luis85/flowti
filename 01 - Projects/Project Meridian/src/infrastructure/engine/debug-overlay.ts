import * as ex from 'excalibur';
import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';
import { NeedsComponent } from '../components/needs-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { StaminaComponent } from '../components/stamina-component.js';
import { QuestBoardComponent } from '../components/quest-board-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Item } from '../../domain/schemas/item-schema.js';

interface OverlayDeps {
	getAgents: () => AgentActor[];
	getWorldEntity: () => Actor;
	getLocations: () => WorldLocation[];
	getLocationActors: () => Map<string, Actor>;
	getTickCount: () => number;
	getTicksPerDay?: () => number;
	getItemRegistry?: () => Map<string, Item>;
	getEventBus?: () => { history: (opts?: { limit?: number }) => { type: string; tick: number; source: string; payload: Record<string, unknown> }[] };
}

type Panel = 'agents' | 'world' | 'economy' | 'stats';

interface Snapshot {
	tick: number;
	day: number;
	treasury: number;
	agentGold: number[];
	velocity: number;
	avgHunger: number;
	avgEnergy: number;
	avgThirst: number;
	totalProduction: number;
	totalSales: number;
}

const ACTION_DISPLAY: Record<string, { emoji: string; label: string }> = {
	work: { emoji: '⛏️', label: 'Working' },
	seek_work: { emoji: '🚶', label: 'Going to work' },
	harvest: { emoji: '🌾', label: 'Harvesting' },
	sell: { emoji: '💰', label: 'Selling' },
	seek_food: { emoji: '🔍🍖', label: 'Looking for food' },
	buy: { emoji: '🛒', label: 'Buying food' },
	eat: { emoji: '🍖', label: 'Eating' },
	drink: { emoji: '💧', label: 'Drinking' },
	seek_water: { emoji: '🔍💧', label: 'Going for water' },
	fill_waterskin: { emoji: '🫗', label: 'Filling waterskin' },
	rest: { emoji: '😴', label: 'Resting' },
	seek_rest: { emoji: '🏠', label: 'Going home' },
	wander: { emoji: '🚶‍♂️', label: 'Wandering' },
	idle: { emoji: '💤', label: 'Idle' },
	claim_job: { emoji: '📋', label: 'Claiming job' },
	seek_market: { emoji: '🏪', label: 'Going to market' },
	seek_social: { emoji: '👋', label: 'Seeking company' },
	talk: { emoji: '💬', label: 'Talking' },
	pickup_cargo: { emoji: '📦', label: 'Picking up cargo' },
	deliver_cargo: { emoji: '🚚', label: 'Delivering' },
	seek_delivery: { emoji: '🚶📦', label: 'Going to deliver' },
	seek_supply: { emoji: '🔍📦', label: 'Finding supplies' },
	claim_quest: { emoji: '📜', label: 'Claiming quest' },
	seek_quest: { emoji: '🗺️', label: 'Quest journey' },
	repair: { emoji: '🔧', label: 'Repairing' },
	switch_job: { emoji: '🔄', label: 'Switching job' },
};

const PHASE_DISPLAY: Record<string, { emoji: string; label: string }> = {
	dawn: { emoji: '🌅', label: 'Dawn' },
	day: { emoji: '☀️', label: 'Day' },
	dusk: { emoji: '🌇', label: 'Dusk' },
	night: { emoji: '🌙', label: 'Night' },
};

const LOCATION_ICONS: Record<string, string> = {
	food: '🌾',
	market: '🏪',
	rest: '🏠',
	water: '💧',
	work: '🏭',
};

function needBar(value: number, label: string, emoji: string): string {
	const pct = Math.round(value);
	const color = pct > 50 ? '#a6e3a1' : pct > 20 ? '#f9e2af' : '#f38ba8';
	const barWidth = Math.max(0, Math.min(100, pct));
	const bar = `<span style="display:inline-block;width:50px;height:6px;background:#313244;border-radius:2px;vertical-align:middle;margin:0 3px"><span style="display:block;width:${String(barWidth)}%;height:100%;background:${color};border-radius:2px"></span></span>`;
	return `${emoji} <span style="color:${color}">${label}</span>${bar}<span style="color:${color}">${value.toFixed(1)}</span>`;
}

function renderTabBar(active: Panel): string {
	const tabs: { id: Panel; label: string; icon: string }[] = [
		{ id: 'agents', label: 'Agents', icon: '👤' },
		{ id: 'world', label: 'World', icon: '🗺️' },
		{ id: 'economy', label: 'Economy', icon: '💰' },
		{ id: 'stats', label: 'Stats', icon: '📈' },
	];
	const parts = tabs.map(t => {
		const bg = t.id === active ? '#45475a' : 'transparent';
		const opacity = t.id === active ? '1' : '0.6';
		return `<span class="meridian-tab" data-tab="${t.id}" style="cursor:pointer;padding:2px 8px;border-radius:4px;background:${bg};opacity:${opacity}">${t.icon} ${t.label}</span>`;
	});
	const copyBtn = '<span class="meridian-copy-snapshot" style="cursor:pointer;padding:2px 8px;border-radius:4px;margin-left:auto;opacity:0.6;font-size:10px" title="Copy diagnostic snapshot to clipboard">📋 Snapshot</span>';
	return `<div style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid #45475a;padding-bottom:6px">${parts.join('')}${copyBtn}</div>`;
}

function renderWorldHeader(deps: OverlayDeps): string {
	const world = deps.getWorldEntity();
	const time = world.get(TimeComponent);
	const phaseInfo = PHASE_DISPLAY[time.state.phase] ?? { emoji: '❓', label: time.state.phase };
	const ticksPerDay = deps.getTicksPerDay?.() ?? 480;
	const tic = time.state.tickInCycle;
	const cursorPct = Math.round((tic / ticksPerDay) * 100);
	const phaseBar = `<span style="display:inline-block;width:100px;height:6px;border-radius:3px;vertical-align:middle;margin:0 4px;position:relative;overflow:hidden;background:linear-gradient(to right, #fab387 0% 12.5%, #f9e2af 12.5% 62.5%, #f5c2e7 62.5% 75%, #585b70 75% 100%)"><span style="position:absolute;left:${String(cursorPct)}%;top:0;width:2px;height:100%;background:#fff"></span></span>`;
	return `${phaseInfo.emoji} Day ${time.state.dayCount} ${phaseBar} <b>${phaseInfo.label}</b> <span style="color:#6c7086">${tic}/${ticksPerDay}</span>`;
}

function renderAgentsPanel(deps: OverlayDeps): string {
	const agents = deps.getAgents();
	const locations = deps.getLocations();
	const lines: string[] = [];

	for (const agent of agents) {
		const needs = agent.get(NeedsComponent).state;
		const wallet = agent.get(WalletComponent).state;
		const inv = agent.get(InventoryComponent).state;
		const mood = agent.get(MoodComponent).state;
		const stamina = agent.get(StaminaComponent).state;
		const ba = agent.behaviorAgent;

		const action = ba.btAction ?? 'idle';
		const actionInfo = ACTION_DISPLAY[action] ?? { emoji: '❓', label: action };

		lines.push(`<div style="margin-top:6px;padding:6px;background:#181825;border-radius:4px">`);
		const commitLabel = ba.commitmentTicks > 0 ? ` <span style="color:#f5c2e7">[${ba.commitmentTicks}t]</span>` : '';
		lines.push(`<b style="color:${agent.agentColor}">${agent.agentName}</b> <span style="color:#6c7086">${agent.kind}</span> &middot; ${actionInfo.emoji} ${actionInfo.label}${commitLabel}`);

		// Needs — compact row with personal thresholds
		const ht = ba.personalThresholds.hunger.toFixed(0);
		const et = ba.personalThresholds.energy.toFixed(0);
		lines.push(`<div style="margin:3px 0">${needBar(needs.hunger, 'Food', '🍖')} <span style="color:#585b70;font-size:9px">thr:${ht}</span> ${needBar(needs.thirst, 'Water', '💧')}</div>`);
		lines.push(`<div style="margin:3px 0">${needBar(needs.energy, 'Energy', '⚡')} <span style="color:#585b70;font-size:9px">thr:${et}</span> ${needBar(needs.social, 'Social', '👥')}</div>`);

		// Status line with sleep debt
		const moodEmoji = mood.value > 30 ? '😊' : mood.value > -10 ? '😐' : '😞';
		const debtLabel = ba.sleepDebt > 0 ? ` &middot; <span style="color:#f38ba8">😴 debt:${ba.sleepDebt.toFixed(0)}</span>` : '';
		lines.push(`${moodEmoji} ${mood.bucket} &middot; 🏃 ${stamina.current.toFixed(0)}/${stamina.max} &middot; 💰 ${wallet.gold.toFixed(0)}g${debtLabel}`);

		// Mood factor breakdown
		if (mood.factors !== undefined) {
			const f = mood.factors;
			const parts = [
				`needs:${(f.needs * 100).toFixed(0)}`,
				`mem:+${(f.positiveMemories * 100).toFixed(0)}/-${(f.negativeMemories * 100).toFixed(0)}`,
				`goal:${(f.goalProgress * 100).toFixed(0)}`,
				`gold:${(f.walletHealth * 100).toFixed(0)}`,
				`rel:${(f.relationshipQuality * 100).toFixed(0)}`,
			].join(' ');
			lines.push(`<span style="color:#585b70;font-size:9px">${parts}</span>`);
		}

		// Inventory
		const items = inv.items.map(i => {
			const icon = i.item_id === 'food' ? '🍖' : i.item_id === 'waterskin' ? '🫗' : i.item_id === 'tools' ? '🔧' : i.item_id === 'equipment' ? '🛡️' : '📦';
			if (i.charges !== undefined) return `${icon}${i.item_id}(${i.charges})x${i.quantity}`;
			return `${icon}${i.item_id} x${i.quantity}`;
		});
		if (items.length > 0) lines.push(`🎒 ${items.join(' · ')}`);

		// Location
		const loc = ba.atLocation;
		const target = ba.movementTarget;
		if (loc !== null) {
			const locData = locations.find(l => l.id === loc);
			lines.push(`📍 At <b>${locData?.name ?? loc}</b>`);
		} else if (target !== null) {
			const targetData = locations.find(l => l.id === target.id);
			lines.push(`→ <b>${targetData?.name ?? target.id}</b>`);
		}

		lines.push('</div>');
	}

	return lines.join('<br>');
}

function renderWorldPanel(deps: OverlayDeps): string {
	const locations = deps.getLocations();
	const locationActors = deps.getLocationActors();
	const lines: string[] = [];

	lines.push('<b style="color:#89b4fa">Facilities</b>');

	for (const loc of locations) {
		const actor = locationActors.get(loc.id);
		if (actor === undefined) continue;
		if (!actor.has(FacilityComponent)) continue;
		const fac = actor.get(FacilityComponent);
		const locIcon = LOCATION_ICONS[loc.type] ?? '🏭';
		const stockItems = fac.state.stock.map(s => `${s.item_id} x${s.quantity}`).join(', ') || '<span style="color:#6c7086">empty</span>';
		const worker = fac.state.workerId;
		const workerLabel = worker !== null
			? `<span style="color:#a6e3a1">✅ ${worker.replace('agent-', '')}</span>`
			: '<span style="color:#6c7086">—</span>';
		const progressLabel = fac.state.workProgress > 0
			? ` ⏳ ${fac.state.workProgress}/${loc.production?.ticks_per_cycle ?? '?'}`
			: '';

		lines.push(`<div style="margin:4px 0;padding:4px;background:#181825;border-radius:4px">`);
		lines.push(`${locIcon} <b>${loc.name}</b>${progressLabel}`);
		lines.push(`💰 ${fac.state.fund.toFixed(0)}g · 👷 ${workerLabel} · 📦 ${stockItems}`);
		lines.push('</div>');
	}

	// Non-facility locations
	const nonFacilities = locations.filter(l => {
		const a = locationActors.get(l.id);
		return a?.has(FacilityComponent) !== true;
	});
	if (nonFacilities.length > 0) {
		lines.push('<br><b style="color:#89b4fa">Locations</b>');
		for (const loc of nonFacilities) {
			const locIcon = LOCATION_ICONS[loc.type] ?? '📍';
			lines.push(`${locIcon} ${loc.name} <span style="color:#6c7086">(${loc.type})</span>`);
		}
	}

	// Quest board
	const world = deps.getWorldEntity();
	if (world.has(QuestBoardComponent)) {
		const board = world.get(QuestBoardComponent);
		if (board.state.quests.length > 0) {
			const tickCount = deps.getTickCount();
			lines.push('<br><b style="color:#89b4fa">Quest Board</b>');
			for (const quest of board.state.quests) {
				const icon = quest.type === 'repair' ? '🔧' : quest.type === 'supply' ? '📦' : '🏪';
				const remaining = quest.expiryTicks - (tickCount - quest.createdTick);
				const stateLabel = quest.state === 'claimed'
					? `<span style="color:#f9e2af">claimed by ${quest.claimedBy?.replace('agent-', '') ?? '?'}</span>`
					: quest.state === 'completed'
						? '<span style="color:#a6e3a1">done</span>'
						: '<span style="color:#6c7086">open</span>';
				lines.push(`<div style="margin:2px 0">${icon} ${quest.type} → ${quest.facilityId.replace('loc-', '')} — ${stateLabel} <span style="color:#585b70">(${remaining}t)</span></div>`);
			}
		}
	}

	return lines.join('<br>');
}

function renderEconomyPanel(deps: OverlayDeps): string {
	const world = deps.getWorldEntity();
	const economy = world.get(EconomyComponent);
	const agents = deps.getAgents();
	const locations = deps.getLocations();
	const locationActors = deps.getLocationActors();
	const items = deps.getItemRegistry?.();
	const velocity = economy.state.monetarySnapshot?.velocity ?? 0;
	const lines: string[] = [];

	// Treasury & velocity
	lines.push('<b style="color:#89b4fa">Treasury</b>');
	lines.push(`🏦 <b>${economy.state.treasury.toFixed(0)}g</b>`);
	const velColor = velocity > 0.2 ? '#a6e3a1' : velocity > 0 ? '#f9e2af' : '#f38ba8';
	lines.push(`📈 Velocity: <b style="color:${velColor}">${velocity.toFixed(3)}</b> <span style="color:#6c7086">(>0.2 healthy)</span>`);

	// Agent wallets
	lines.push('<br><b style="color:#89b4fa">Wallets</b>');
	let totalAgent = 0;
	for (const agent of agents) {
		const gold = agent.get(WalletComponent).state.gold;
		totalAgent += gold;
		lines.push(`${agent.agentName}: <b>${gold.toFixed(0)}g</b>`);
	}
	lines.push(`<span style="color:#6c7086">Total agent gold: ${totalAgent.toFixed(0)}g</span>`);

	// Facility funds
	let totalFacility = 0;
	const facLines: string[] = [];
	for (const loc of locations) {
		const actor = locationActors.get(loc.id);
		if (actor?.has(FacilityComponent) !== true) continue;
		const fund = actor.get(FacilityComponent).state.fund;
		totalFacility += fund;
		facLines.push(`${loc.name}: <b>${fund.toFixed(0)}g</b>`);
	}
	if (facLines.length > 0) {
		lines.push('<br><b style="color:#89b4fa">Facility Funds</b>');
		lines.push(...facLines);
		lines.push(`<span style="color:#6c7086">Total facility gold: ${totalFacility.toFixed(0)}g</span>`);
	}

	// Gold supply
	const totalGold = economy.state.treasury + totalAgent + totalFacility;
	lines.push(`<br><b style="color:#89b4fa">Gold Supply</b>`);
	lines.push(`Total: <b>${totalGold.toFixed(0)}g</b> (treasury ${economy.state.treasury.toFixed(0)} + agents ${totalAgent.toFixed(0)} + facilities ${totalFacility.toFixed(0)})`);

	// Market prices
	const marketLoc = locations.find(l => l.type === 'market');
	if (marketLoc !== undefined) {
		const marketActor = locationActors.get(marketLoc.id);
		if (marketActor?.has(FacilityComponent) === true) {
			const market = marketActor.get(FacilityComponent);
			const prices = market.state.currentPrices ?? {};
			const priceEntries = Object.entries(prices);
			if (priceEntries.length > 0) {
				lines.push('<br><b style="color:#89b4fa">Market Prices</b>');
				for (const [itemId, price] of priceEntries) {
					const p = Number(price);
					const basePrice = items?.get(itemId)?.baseValue ?? p;
					const color = p < basePrice ? '#a6e3a1' : p > basePrice ? '#f38ba8' : '#cdd6f4';
					const arrow = p < basePrice ? '▼' : p > basePrice ? '▲' : '─';
					lines.push(`<span style="color:${color}">${itemId}: <b>${p.toFixed(1)}g</b> ${arrow}</span>`);
				}
			}
		}
	}

	// Daily summary
	const ds = economy.state.dailySummary;
	lines.push('<br><b style="color:#89b4fa">Today</b>');
	lines.push(`Wages: ${ds.totalWages.toFixed(0)}g · Tax: ${ds.totalTax.toFixed(0)}g · Sales: ${ds.totalSales.toFixed(0)}g`);

	return lines.join('<br>');
}

function sparkline(values: number[], width: number, height: number, color: string): string {
	if (values.length < 2) return '';
	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 1;
	const step = width / (values.length - 1);
	const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ');
	return `<svg width="${width}" height="${height}" style="vertical-align:middle;margin:0 4px"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}

function renderStatsPanel(history: Snapshot[], deps: OverlayDeps): string {
	const lines: string[] = [];
	const agents = deps.getAgents();

	if (history.length < 2) {
		lines.push('<span style="color:#6c7086">Collecting data...</span>');
		return lines.join('<br>');
	}

	const latest = history[history.length - 1]!;
	const first = history[0]!;

	function trend(current: number, initial: number): string {
		const delta = current - initial;
		if (Math.abs(delta) < 0.5) return '<span style="color:#6c7086">─</span>';
		return delta > 0
			? `<span style="color:#a6e3a1">▲ +${delta.toFixed(0)}</span>`
			: `<span style="color:#f38ba8">▼ ${delta.toFixed(0)}</span>`;
	}

	// Treasury trend
	const treasuryVals = history.map(h => h.treasury);
	lines.push(`<b style="color:#89b4fa">Treasury</b> ${sparkline(treasuryVals, 80, 16, '#89b4fa')}`);
	lines.push(`${latest.treasury.toFixed(0)}g ${trend(latest.treasury, first.treasury)}`);

	// Velocity trend
	const velocityVals = history.map(h => h.velocity);
	lines.push(`<br><b style="color:#89b4fa">Velocity</b> ${sparkline(velocityVals, 80, 16, '#a6e3a1')}`);
	lines.push(`${latest.velocity.toFixed(3)} ${trend(latest.velocity, first.velocity)}`);

	// Agent gold trends
	lines.push(`<br><b style="color:#89b4fa">Agent Gold</b>`);
	for (let i = 0; i < agents.length; i++) {
		const agent = agents[i]!;
		const vals = history.map(h => h.agentGold[i] ?? 0);
		const current = latest.agentGold[i] ?? 0;
		const initial = first.agentGold[i] ?? 0;
		lines.push(`${agent.agentName} ${sparkline(vals, 60, 14, agent.agentColor)} <b>${current.toFixed(0)}g</b> ${trend(current, initial)}`);
	}

	// Needs averages
	const hungerVals = history.map(h => h.avgHunger);
	const energyVals = history.map(h => h.avgEnergy);
	const thirstVals = history.map(h => h.avgThirst);
	lines.push(`<br><b style="color:#89b4fa">Avg Needs</b>`);
	lines.push(`🍖 ${sparkline(hungerVals, 60, 14, '#a6e3a1')} ${latest.avgHunger.toFixed(0)}`);
	lines.push(`💧 ${sparkline(thirstVals, 60, 14, '#74c7ec')} ${latest.avgThirst.toFixed(0)}`);
	lines.push(`⚡ ${sparkline(energyVals, 60, 14, '#f9e2af')} ${latest.avgEnergy.toFixed(0)}`);

	// Production & sales
	const prodVals = history.map(h => h.totalProduction);
	const salesVals = history.map(h => h.totalSales);
	lines.push(`<br><b style="color:#89b4fa">Activity</b>`);
	lines.push(`Production ${sparkline(prodVals, 60, 14, '#fab387')} ${latest.totalProduction.toFixed(0)}g`);
	lines.push(`Sales ${sparkline(salesVals, 60, 14, '#f5c2e7')} ${latest.totalSales.toFixed(0)}g`);

	lines.push(`<br><span style="color:#6c7086">${history.length} snapshots (since day ${first.day})</span>`);

	// Event log
	const eventBus = deps.getEventBus?.();
	if (eventBus !== undefined) {
		const EVENT_ICONS: Record<string, string> = {
			QuestGenerated: '📜', QuestClaimed: '📋', QuestCompleted: '✅', QuestExpired: '⏰', QuestAbandoned: '❌',
			JobSwitched: '🔄', GoldFlowed: '💰', MoodChanged: '😶', MoodBreakdown: '💔',
			FacilityAbandoned: '🏚️', FacilityRestored: '🏗️', RestStarted: '😴',
			DayPhaseChanged: '🌅', SupplyDelivered: '📦', TickBudgetExceeded: '⚠️',
		};
		const events = eventBus.history({ limit: 15 }).reverse();
		if (events.length > 0) {
			lines.push('<br><b style="color:#89b4fa">Recent Events</b>');
			for (const e of events) {
				const icon = EVENT_ICONS[e.type] ?? '📋';
				const detail = formatEventPayload(e);
				lines.push(`<span style="color:#585b70">t${e.tick}</span> ${icon} <span style="color:#bac2de">${detail}</span>`);
			}
		}
	}

	return lines.join('<br>');
}

function formatEventPayload(e: { type: string; payload: Record<string, unknown> }): string {
	const p = e.payload;
	switch (e.type) {
		case 'QuestGenerated': return `Quest: ${String(p['type'])} → ${String(p['facilityId'])}`;
		case 'QuestClaimed': return `${String(p['agentId']).replace('agent-', '')} claimed ${String(p['questType'])} quest`;
		case 'QuestCompleted': return `${String(p['agentId']).replace('agent-', '')} completed quest (+${String(p['reward'])}g)`;
		case 'JobSwitched': return `${String(p['agentId']).replace('agent-', '')} switched job`;
		case 'GoldFlowed': return `${String(p['subcategory'] as string | undefined ?? '')}: ${String(p['amount'])}g`;
		case 'MoodChanged': return `${String(p['agentId']).replace('agent-', '')} mood: ${String(p['oldBucket'])} → ${String(p['newBucket'])}`;
		case 'DayPhaseChanged': return `${String(p['previousPhase'])} → ${String(p['newPhase'])}`;
		case 'FacilityAbandoned': return `${String(p['facilityId'])} abandoned`;
		case 'FacilityRestored': return `${String(p['facilityId'])} restored`;
		default: return e.type;
	}
}

function buildDiagnosticSnapshot(deps: OverlayDeps): string {
	const world = deps.getWorldEntity();
	const agents = deps.getAgents();
	const locations = deps.getLocations();
	const locationActors = deps.getLocationActors();
	const tick = deps.getTickCount();
	const time = world.get(TimeComponent);
	const economy = world.get(EconomyComponent);
	const velocity = economy.state.monetarySnapshot?.velocity ?? 0;
	const ds = economy.state.dailySummary;

	const lines: string[] = [];

	// Header
	lines.push('# Meridian Simulation Snapshot');
	lines.push(`Tick: ${tick} | Day: ${time.state.dayCount} | Phase: ${time.state.phase} (${time.state.tickInCycle}/${deps.getTicksPerDay?.() ?? 480})`);
	lines.push('');

	// Economy overview
	let totalAgentGold = 0;
	let totalFacilityGold = 0;
	for (const a of agents) totalAgentGold += a.get(WalletComponent).state.gold;
	for (const loc of locations) {
		const la = locationActors.get(loc.id);
		if (la?.has(FacilityComponent) === true) totalFacilityGold += la.get(FacilityComponent).state.fund;
	}
	lines.push('## Economy');
	lines.push(`Treasury: ${economy.state.treasury.toFixed(0)}g | Agent gold: ${totalAgentGold.toFixed(0)}g | Facility gold: ${totalFacilityGold.toFixed(0)}g | Total: ${(economy.state.treasury + totalAgentGold + totalFacilityGold).toFixed(0)}g`);
	lines.push(`Velocity: ${velocity.toFixed(3)} ${velocity > 0.2 ? '(healthy)' : velocity > 0 ? '(slow)' : '(stalled)'}`);
	lines.push(`Today: wages ${ds.totalWages.toFixed(0)}g | tax ${ds.totalTax.toFixed(0)}g | sales ${ds.totalSales.toFixed(0)}g | job switches ${ds.jobSwitchesThisDay} | supply deliveries ${ds.supplyDeliveries} | quests completed ${ds.questsCompletedThisDay}`);

	// Market prices
	const marketLoc = locations.find(l => l.type === 'market');
	if (marketLoc !== undefined) {
		const ma = locationActors.get(marketLoc.id);
		if (ma?.has(FacilityComponent) === true) {
			const prices = ma.get(FacilityComponent).state.currentPrices ?? {};
			const priceStr = Object.entries(prices).map(([id, p]) => `${id}: ${Number(p).toFixed(1)}g`).join(', ');
			if (priceStr.length > 0) lines.push(`Market prices: ${priceStr}`);
		}
	}
	lines.push('');

	// Population health summary
	const avgHunger = agents.length > 0 ? agents.reduce((s, a) => s + a.get(NeedsComponent).state.hunger, 0) / agents.length : 0;
	const avgEnergy = agents.length > 0 ? agents.reduce((s, a) => s + a.get(NeedsComponent).state.energy, 0) / agents.length : 0;
	const avgThirst = agents.length > 0 ? agents.reduce((s, a) => s + a.get(NeedsComponent).state.thirst, 0) / agents.length : 0;
	const avgMood = agents.length > 0 ? agents.reduce((s, a) => s + a.get(MoodComponent).state.value, 0) / agents.length : 0;
	const avgDebt = agents.length > 0 ? agents.reduce((s, a) => s + a.behaviorAgent.sleepDebt, 0) / agents.length : 0;
	const employed = agents.filter(a => a.job !== null).length;
	lines.push('## Population Health');
	lines.push(`Agents: ${agents.length} | Employed: ${employed}/${agents.length}`);
	lines.push(`Avg needs: hunger ${avgHunger.toFixed(0)} | energy ${avgEnergy.toFixed(0)} | thirst ${avgThirst.toFixed(0)}`);
	lines.push(`Avg mood: ${avgMood.toFixed(0)} | Avg sleep debt: ${avgDebt.toFixed(0)}`);
	lines.push('');

	// Agents
	lines.push('## Agents');
	for (const agent of agents) {
		const needs = agent.get(NeedsComponent).state;
		const wallet = agent.get(WalletComponent).state;
		const mood = agent.get(MoodComponent).state;
		const stamina = agent.get(StaminaComponent).state;
		const inv = agent.get(InventoryComponent).state;
		const ba = agent.behaviorAgent;
		const action = ba.btAction ?? 'idle';
		const loc = ba.atLocation;
		const locName = loc !== null ? (locations.find(l => l.id === loc)?.name ?? loc) : 'travelling';
		const target = ba.movementTarget;
		const targetName = target !== null ? (locations.find(l => l.id === target.id)?.name ?? target.id) : null;

		lines.push(`### ${agent.agentName} (${agent.kind}) — ${agent.agentId}`);
		lines.push(`Action: ${action}${ba.commitmentTicks > 0 ? ` [committed ${ba.commitmentTicks}t, action=${ba.committedAction ?? '?'}]` : ''}`);
		lines.push(`Position: (${agent.pos.x.toFixed(0)}, ${agent.pos.y.toFixed(0)}) | Location: ${locName}${targetName !== null ? ` → ${targetName}` : ''}${ba.insideFacility ? ' (inside facility)' : ''}`);
		lines.push(`Needs: hunger ${needs.hunger.toFixed(1)} (thr:${ba.personalThresholds.hunger.toFixed(0)}) | energy ${needs.energy.toFixed(1)} (thr:${ba.personalThresholds.energy.toFixed(0)}) | thirst ${needs.thirst.toFixed(1)} (thr:${ba.personalThresholds.thirst.toFixed(0)}) | social ${needs.social.toFixed(1)}`);
		lines.push(`Mood: ${mood.value.toFixed(0)} (${mood.bucket})${mood.factors !== undefined ? ` = needs:${(mood.factors.needs * 100).toFixed(0)} mem:+${(mood.factors.positiveMemories * 100).toFixed(0)}/-${(mood.factors.negativeMemories * 100).toFixed(0)} goal:${(mood.factors.goalProgress * 100).toFixed(0)} gold:${(mood.factors.walletHealth * 100).toFixed(0)} equip:${(mood.factors.equipmentCondition * 100).toFixed(0)} rel:${(mood.factors.relationshipQuality * 100).toFixed(0)}` : ''}`);
		lines.push(`Gold: ${wallet.gold.toFixed(0)}g | Stamina: ${stamina.current.toFixed(0)}/${stamina.max} | Sleep debt: ${ba.sleepDebt.toFixed(0)} | Rested today: ${ba.ticksRestedThisDay}t | Recovering: ${ba.recovering ? 'yes' : 'no'}`);
		// Job + facility cross-reference
		const jobFacility = locations.find(l => {
			const la = locationActors.get(l.id);
			return la?.has(FacilityComponent) === true && la.get(FacilityComponent).state.workerId === agent.agentId;
		});
		const jobFacilityLabel = jobFacility !== undefined ? ` @ ${jobFacility.name}` : (agent.job !== null ? ' (no facility assigned)' : '');
		lines.push(`Job: ${agent.job ?? 'none'}${jobFacilityLabel} | Unemployed ticks: ${ba.unemployedTicks}`);
		lines.push(`Known: ${ba.knownLocations.map(id => { const l = locations.find(x => x.id === id); return l?.name ?? id; }).join(', ') || 'none'}`);

		const items = inv.items.map(i => i.charges !== undefined ? `${i.item_id}(${i.charges})x${i.quantity}` : `${i.item_id}x${i.quantity}`);
		if (items.length > 0) lines.push(`Inventory: ${items.join(', ')}`);

		if (ba.activeQuest !== null) {
			const q = ba.activeQuest;
			lines.push(`Active quest: ${q.type} at ${q.facilityId} (${q.state}, progress: ${q.repairProgress})`);
		}
		if (ba.supplyRoute !== null) {
			const r = ba.supplyRoute;
			lines.push(`Supply route: ${r.sourceId} → ${r.destinationId} (${r.itemId})`);
		}
		if (ba.haulCargo !== null) {
			lines.push(`Hauling: ${ba.haulCargo.itemId}x${ba.haulCargo.quantity} → ${ba.haulCargo.destination}`);
		}
		// Relationships
		if (agent.has(RelationshipComponent)) {
			const rels = agent.get(RelationshipComponent).state.entries;
			if (rels.length > 0) {
				const relStr = rels.map(r => {
					const name = agents.find(a => a.agentId === r.agentId)?.agentName ?? r.agentId.replace('agent-', '');
					return `${name}:${r.disposition.toFixed(0)}(f${r.familiarity.toFixed(0)})`;
				}).join(', ');
				lines.push(`Relationships: ${relStr}`);
			}
		}
		// Recent memories (last 3)
		if (agent.has(MemoryComponent)) {
			const mem = agent.get(MemoryComponent).state.entries;
			if (mem.length > 0) {
				const recent = mem.slice(-3);
				const memStr = recent.map(m => `t${m.tick} ${m.outcome === 'positive' ? '+' : m.outcome === 'negative' ? '-' : '~'} ${m.type}`).join(' | ');
				lines.push(`Memories: ${memStr}`);
			}
		}
		lines.push('');
	}

	// Facilities
	lines.push('## Facilities');
	for (const loc of locations) {
		const la = locationActors.get(loc.id);
		if (la?.has(FacilityComponent) !== true) continue;
		const fac = la.get(FacilityComponent);
		const stock = fac.state.stock.map(s => `${s.item_id}x${s.quantity}`).join(', ') || 'empty';
		const worker = fac.state.workerId?.replace('agent-', '') ?? 'none';
		const progress = fac.state.workProgress > 0 ? ` | progress: ${fac.state.workProgress}/${loc.production?.ticks_per_cycle ?? '?'}` : '';
		lines.push(`${loc.name} (${loc.type}): status=${fac.state.status} | fund=${fac.state.fund.toFixed(0)}g | worker=${worker} | stock=[${stock}]${progress}`);
		if (loc.production !== null) {
			const p = loc.production;
			lines.push(`  Production: ${p.output.item_id}x${p.output.quantity} every ${p.ticks_per_cycle}t | wage=${p.wage}g | job=${p.job}${p.input !== null ? ` | input=${p.input.item_id}x${p.input.quantity}` : ''}`);
		}
	}

	// Non-facility locations
	const nonFac = locations.filter(l => locationActors.get(l.id)?.has(FacilityComponent) !== true);
	if (nonFac.length > 0) {
		lines.push('');
		lines.push('## Locations');
		for (const loc of nonFac) {
			lines.push(`${loc.name} (${loc.type}) at (${loc.position.x}, ${loc.position.y})`);
		}
	}

	// Quest board
	if (world.has(QuestBoardComponent)) {
		const board = world.get(QuestBoardComponent);
		if (board.state.quests.length > 0) {
			lines.push('');
			lines.push('## Quest Board');
			for (const q of board.state.quests) {
				const remaining = q.expiryTicks - (tick - q.createdTick);
				lines.push(`[${q.state}] ${q.type} → ${q.facilityId}${q.itemId !== null ? ` (${q.itemId}x${q.quantity})` : ''} | reward=${q.reward}g | expires in ${remaining}t${q.claimedBy !== null ? ` | claimed by ${q.claimedBy.replace('agent-', '')}` : ''}${q.repairProgress > 0 ? ` | repair=${q.repairProgress}` : ''}`);
			}
		}
	}

	// Gold flow ledger summary (today's transactions by type)
	const ledger = economy.state.ledger;
	if (ledger.length > 0) {
		const dayStartTick = tick - time.state.tickInCycle;
		const todayLedger = ledger.filter(e => e.tick >= dayStartTick);
		if (todayLedger.length > 0) {
			const byType = new Map<string, number>();
			for (const entry of todayLedger) {
				byType.set(entry.type, (byType.get(entry.type) ?? 0) + entry.gold);
			}
			lines.push('');
			lines.push('## Gold Flows Today');
			for (const [type, total] of byType) {
				lines.push(`${type}: ${total.toFixed(0)}g (${todayLedger.filter(e => e.type === type).length} txns)`);
			}
		}
	}

	// Recent events — filtered (skip NeedChanged noise, keep meaningful events)
	const eventBus = deps.getEventBus?.();
	if (eventBus !== undefined) {
		const allEvents = eventBus.history({ limit: 200 });
		const meaningful = allEvents.filter(e => e.type !== 'NeedChanged' && e.type !== 'NeedCritical' && e.type !== 'EconomicStimulusActivated');
		const recent = meaningful.slice(-30).reverse();
		if (recent.length > 0) {
			lines.push('');
			lines.push('## Recent Events (last 30, filtered)');
			for (const e of recent) {
				const payload = Object.entries(e.payload).map(([k, v]) => `${k}=${String(v)}`).join(', ');
				lines.push(`t${e.tick} [${e.source}] ${e.type}: ${payload}`);
			}
		}
	}

	// Anomaly scan — behavioral, economic, and systemic issues
	const anomalies: string[] = [];
	const agentsByAction = new Map<string, string[]>();
	for (const agent of agents) {
		const needs = agent.get(NeedsComponent).state;
		const mood = agent.get(MoodComponent).state;
		const ba = agent.behaviorAgent;
		const name = agent.agentName;
		const action = ba.btAction ?? 'idle';

		// Track action distribution
		const existing = agentsByAction.get(action) ?? [];
		existing.push(name);
		agentsByAction.set(action, existing);

		// Critical needs
		if (needs.hunger <= 20) anomalies.push(`[CRITICAL] ${name}: hunger at ${needs.hunger.toFixed(1)} (critical < 20)`);
		if (needs.energy <= 15) anomalies.push(`[CRITICAL] ${name}: energy at ${needs.energy.toFixed(1)} (critical < 15)`);
		if (needs.thirst <= 20) anomalies.push(`[CRITICAL] ${name}: thirst at ${needs.thirst.toFixed(1)} (critical < 20)`);

		// Mood
		if (mood.value < -20) anomalies.push(`[HIGH] ${name}: distressed mood (${mood.value.toFixed(0)}, ${mood.bucket})`);

		// Sleep
		if (ba.sleepDebt > 50) anomalies.push(`[HIGH] ${name}: high sleep debt (${ba.sleepDebt.toFixed(0)}/100)`);
		if (ba.recovering) anomalies.push(`[MEDIUM] ${name}: recovering (energy=${needs.energy.toFixed(1)}, needs >=${(ba.personalThresholds.energy + 20).toFixed(0)} to clear)`);

		// Behavioral
		if (ba.commitmentTicks > 60) anomalies.push(`[HIGH] ${name}: very long commitment (${ba.commitmentTicks}t to ${ba.committedAction ?? action})`);
		if (ba.unemployedTicks > 200) anomalies.push(`[HIGH] ${name}: long unemployment (${ba.unemployedTicks} ticks)`);
		if (agent.job !== null && action === 'wander') anomalies.push(`[MEDIUM] ${name}: has job=${agent.job} but wandering`);
		if (agent.job !== null && action === 'idle') anomalies.push(`[MEDIUM] ${name}: has job=${agent.job} but idle`);
		if (needs.hunger < ba.personalThresholds.hunger && action !== 'eat' && action !== 'buy' && action !== 'seek_food') {
			anomalies.push(`[LOW] ${name}: hungry (${needs.hunger.toFixed(0)} < thr ${ba.personalThresholds.hunger.toFixed(0)}) but action=${action}`);
		}
	}

	// Economy
	if (velocity <= 0) anomalies.push('[CRITICAL] Economy: velocity stalled at 0');
	else if (velocity < 0.1) anomalies.push(`[HIGH] Economy: velocity very low (${velocity.toFixed(3)})`);
	if (economy.state.treasury <= 0) anomalies.push('[CRITICAL] Economy: treasury empty');
	if (ds.totalWages === 0 && ds.totalSales === 0) anomalies.push('[HIGH] Economy: no wages or sales today — economy is frozen');

	// Facilities
	for (const loc of locations) {
		const la = locationActors.get(loc.id);
		if (la?.has(FacilityComponent) !== true) continue;
		const fac = la.get(FacilityComponent);
		if (fac.state.status === 'abandoned') anomalies.push(`[HIGH] Facility ${loc.name}: abandoned`);
		if (fac.state.fund <= 0 && fac.state.status !== 'abandoned') anomalies.push(`[MEDIUM] Facility ${loc.name}: fund depleted (${fac.state.fund.toFixed(0)}g)`);
		if (loc.production !== null && fac.state.workerId === null && fac.state.status !== 'abandoned') {
			anomalies.push(`[MEDIUM] Facility ${loc.name}: production facility with no worker (job=${loc.production.job})`);
		}
	}

	// Agent-facility mismatches
	for (const agent of agents) {
		if (agent.job === null) continue;
		const hasRegisteredFacility = locations.some(l => {
			const la = locationActors.get(l.id);
			return la?.has(FacilityComponent) === true && la.get(FacilityComponent).state.workerId === agent.agentId;
		});
		if (!hasRegisteredFacility) {
			anomalies.push(`[MEDIUM] ${agent.agentName}: has job=${agent.job} but no facility has them as worker`);
		}
	}

	// Completed quests sitting on board (should be cleaned up)
	if (world.has(QuestBoardComponent)) {
		const board = world.get(QuestBoardComponent);
		const staleCompleted = board.state.quests.filter(q => q.state === 'completed');
		if (staleCompleted.length > 0) {
			anomalies.push(`[LOW] Quest board: ${staleCompleted.length} completed quest(s) not cleaned up`);
		}
		const expired = board.state.quests.filter(q => q.state === 'open' && tick - q.createdTick > q.expiryTicks);
		if (expired.length > 0) {
			anomalies.push(`[LOW] Quest board: ${expired.length} expired quest(s) not cleaned up`);
		}
	}

	// Gold inflation check
	const totalGold = economy.state.treasury + totalAgentGold + totalFacilityGold;
	const expectedGold = 1720; // approximate starting gold
	if (totalGold > expectedGold * 2) {
		anomalies.push(`[MEDIUM] Gold inflation: total ${totalGold.toFixed(0)}g is ${(totalGold / expectedGold * 100).toFixed(0)}% of starting supply`);
	}

	// Systemic: action uniformity (all agents doing the same thing = lockstep)
	for (const [action, names] of agentsByAction) {
		if (names.length === agents.length && agents.length > 1) {
			anomalies.push(`[MEDIUM] All ${agents.length} agents doing "${action}" simultaneously — possible lockstep behavior`);
		}
	}

	lines.push('');
	lines.push('## Action Distribution');
	for (const [action, names] of agentsByAction) {
		lines.push(`${action}: ${names.join(', ')} (${names.length}/${agents.length})`);
	}

	if (anomalies.length > 0) {
		lines.push('');
		lines.push('## Anomalies');
		for (const a of anomalies) lines.push(`- ${a}`);
	} else {
		lines.push('');
		lines.push('## Anomalies');
		lines.push('None detected.');
	}

	// Key config values for tuning context
	lines.push('');
	lines.push('## Config (key tuning values)');
	lines.push(`Ticks/day: ${deps.getTicksPerDay?.() ?? 480} | Phases: dawn 0-59, day 60-299, dusk 300-359, night 360-479`);
	if (agents.length > 0) {
		const a1 = agents[0]!;
		lines.push(`Thresholds (${a1.agentName}): hunger=${a1.behaviorAgent.personalThresholds.hunger.toFixed(0)} energy=${a1.behaviorAgent.personalThresholds.energy.toFixed(0)} thirst=${a1.behaviorAgent.personalThresholds.thirst.toFixed(0)}`);
	}
	lines.push(`Sleep: min_rest=50t | debt_max=100 | Treasury regen: 25g/agent/day`);

	return lines.join('\n');
}

export function createDebugOverlay(
	container: HTMLElement,
	deps: OverlayDeps,
): { dispose: () => void } {
	const el = document.createElement('div');
	el.className = 'meridian-debug-overlay';
	el.style.cssText = `
		position: absolute; top: 8px; right: 8px; z-index: 100;
		background: var(--background-secondary, #1e1e2e); color: var(--text-normal, #cdd6f4);
		font-family: var(--font-monospace); font-size: 11px; line-height: 1.5;
		padding: 10px 12px; border-radius: 6px; width: 320px; max-height: 80vh;
		overflow-y: auto; overflow-x: hidden;
		border: 1px solid var(--background-modifier-border, #45475a);
		opacity: 0.92; pointer-events: auto;
	`;
	container.addClass('meridian-debug-container');
	container.appendChild(el);

	let activePanel: Panel = 'agents';
	const history: Snapshot[] = [];
	const MAX_HISTORY = 60;
	let lastSnapshotTick = -1;

	// Tab click handler
	el.addEventListener('click', (e) => {
		const clickTarget = e.target as HTMLElement;

		// Copy snapshot button
		if (clickTarget.closest('.meridian-copy-snapshot') !== null) {
			const snapshot = buildDiagnosticSnapshot(deps);
			void navigator.clipboard.writeText(snapshot).then(() => {
				const btn = el.querySelector('.meridian-copy-snapshot');
				if (btn !== null) {
					btn.textContent = '✅ Copied';
					setTimeout(() => { btn.textContent = '📋 Snapshot'; }, 1500);
				}
			});
			return;
		}

		// Tab switching
		const tabTarget = clickTarget.closest('.meridian-tab');
		if (tabTarget === null) return;
		const tab = (tabTarget as HTMLElement).dataset['tab'] as Panel | undefined;
		if (tab !== undefined) {
			activePanel = tab;
			update();
		}
	});

	// Thought bubble labels — one per agent, added as ExcaliburJS child
	const thoughtLabels = new Map<string, ex.Label>();

	function ensureThoughtBubble(agent: AgentActor): ex.Label {
		let label = thoughtLabels.get(agent.agentId);
		if (label === undefined) {
			label = new ex.Label({
				text: '',
				pos: ex.vec(0, -38),
				font: new ex.Font({ size: 14, unit: ex.FontUnit.Px, color: ex.Color.White }),
			});
			agent.addChild(label);
			thoughtLabels.set(agent.agentId, label);
		}
		return label;
	}

	function recordSnapshot(): void {
		const tick = deps.getTickCount();
		if (tick === lastSnapshotTick) return;
		lastSnapshotTick = tick;

		const agents = deps.getAgents();
		const world = deps.getWorldEntity();
		const economy = world.get(EconomyComponent);
		const time = world.get(TimeComponent);

		const agentGold = agents.map(a => a.get(WalletComponent).state.gold);
		const hungers = agents.map(a => a.get(NeedsComponent).state.hunger);
		const energies = agents.map(a => a.get(NeedsComponent).state.energy);
		const thirsts = agents.map(a => a.get(NeedsComponent).state.thirst);
		const avg = (arr: number[]): number => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

		history.push({
			tick,
			day: time.state.dayCount,
			treasury: economy.state.treasury,
			agentGold,
			velocity: economy.state.monetarySnapshot?.velocity ?? 0,
			avgHunger: avg(hungers),
			avgEnergy: avg(energies),
			avgThirst: avg(thirsts),
			totalProduction: economy.state.dailySummary.totalWages,
			totalSales: economy.state.dailySummary.totalSales,
		});
		if (history.length > MAX_HISTORY) history.shift();
	}

	// Occupancy badge labels — one per location actor
	const occupancyLabels = new Map<string, ex.Label>();

	function ensureOccupancyLabel(locId: string, locActor: Actor): ex.Label {
		let label = occupancyLabels.get(locId);
		if (label === undefined) {
			label = new ex.Label({
				text: '',
				pos: ex.vec(0, 18),
				font: new ex.Font({ size: 11, unit: ex.FontUnit.Px, color: ex.Color.White, bold: true }),
			});
			locActor.addChild(label);
			occupancyLabels.set(locId, label);
		}
		return label;
	}

	function update(): void {
		// Update thought bubbles + hide agents inside facilities
		for (const agent of deps.getAgents()) {
			const action = agent.behaviorAgent.btAction ?? 'idle';
			const actionInfo = ACTION_DISPLAY[action] ?? { emoji: '❓', label: action };
			const bubble = ensureThoughtBubble(agent);
			bubble.text = `${actionInfo.emoji} ${actionInfo.label}`;

			if (agent.behaviorAgent.insideFacility === true) {
				agent.graphics.visible = false;
				bubble.graphics.visible = false;
			} else {
				agent.graphics.visible = true;
				bubble.graphics.visible = true;
			}
		}

		// Occupancy badges on facility locations
		const occupancyCounts = new Map<string, number>();
		for (const agent of deps.getAgents()) {
			const ba = agent.behaviorAgent;
			if (ba.insideFacility === true && ba.atLocation !== null) {
				occupancyCounts.set(ba.atLocation, (occupancyCounts.get(ba.atLocation) ?? 0) + 1);
			}
		}
		const locationActors = deps.getLocationActors();
		for (const [locId, locActor] of locationActors) {
			const count = occupancyCounts.get(locId) ?? 0;
			if (count > 0) {
				const badge = ensureOccupancyLabel(locId, locActor);
				badge.text = `x${count}`;
				badge.graphics.visible = true;
			} else {
				const existing = occupancyLabels.get(locId);
				if (existing !== undefined) {
					existing.graphics.visible = false;
				}
			}
		}

		recordSnapshot();

		const header = renderWorldHeader(deps);
		let body: string;
		switch (activePanel) {
			case 'agents': body = renderAgentsPanel(deps); break;
			case 'world': body = renderWorldPanel(deps); break;
			case 'economy': body = renderEconomyPanel(deps); break;
			case 'stats': body = renderStatsPanel(history, deps); break;
		}

		while (el.firstChild !== null) el.removeChild(el.firstChild);
		const range = document.createRange();
		range.selectNodeContents(el);
		el.appendChild(range.createContextualFragment(`${header}<br>${renderTabBar(activePanel)}${body}`));
	}

	const interval = setInterval(update, 1000);
	update();

	return {
		dispose(): void {
			clearInterval(interval);
			el.remove();
			for (const label of thoughtLabels.values()) {
				label.kill();
			}
			thoughtLabels.clear();
			for (const label of occupancyLabels.values()) {
				label.kill();
			}
			occupancyLabels.clear();
		},
	};
}
