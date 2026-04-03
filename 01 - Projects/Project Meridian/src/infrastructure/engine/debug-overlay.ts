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
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

interface OverlayDeps {
	getAgents: () => AgentActor[];
	getWorldEntity: () => Actor;
	getLocations: () => WorldLocation[];
	getLocationActors: () => Map<string, Actor>;
	getTickCount: () => number;
	getTicksPerDay?: () => number;
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
};

function needBar(value: number, label: string, emoji: string): string {
	const pct = Math.round(value);
	const color = pct > 50 ? '#a6e3a1' : pct > 20 ? '#f9e2af' : '#f38ba8';
	const barWidth = Math.max(0, Math.min(100, pct));
	const bar = `<span style="display:inline-block;width:50px;height:6px;background:#313244;border-radius:2px;vertical-align:middle;margin:0 3px"><span style="display:block;width:${String(barWidth)}%;height:100%;background:${color};border-radius:2px"></span></span>`;
	return `${emoji} <span style="color:${color}">${label}</span>${bar}<span style="color:${color}">${value.toFixed(1)}</span>`;
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
		font-family: var(--font-monospace); font-size: 11px; line-height: 1.6;
		padding: 10px 12px; border-radius: 6px; width: 360px; max-height: 75vh;
		overflow-y: auto; overflow-x: hidden;
		border: 1px solid var(--background-modifier-border, #45475a);
		opacity: 0.92; pointer-events: auto;
	`;
	container.style.position = 'relative';
	container.appendChild(el);

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

	function update(): void {
		const agents = deps.getAgents();
		const world = deps.getWorldEntity();
		const locations = deps.getLocations();
		const locationActors = deps.getLocationActors();
		const tick = deps.getTickCount();

		const time = world.get(TimeComponent);
		const economy = world.get(EconomyComponent);
		const velocity = economy.state.monetarySnapshot?.velocity ?? 0;
		const phaseInfo = PHASE_DISPLAY[time.state.phase] ?? { emoji: '❓', label: time.state.phase };
		const ticksPerDay = deps.getTicksPerDay?.() ?? 480;
		const tic = time.state.tickInCycle;

		// Phase bar — shows dawn/day/dusk/night segments with cursor
		const phasePcts = { dawn: 12.5, day: 50, dusk: 12.5, night: 25 };
		const cursorPct = Math.round((tic / ticksPerDay) * 100);
		const phaseBar = `<span style="display:inline-block;width:120px;height:8px;border-radius:3px;vertical-align:middle;margin:0 4px;position:relative;overflow:hidden;background:linear-gradient(to right, #fab387 0% 12.5%, #f9e2af 12.5% 62.5%, #f5c2e7 62.5% 75%, #585b70 75% 100%)"><span style="position:absolute;left:${String(cursorPct)}%;top:0;width:2px;height:100%;background:#fff"></span></span>`;

		const lines: string[] = [];

		// World header
		lines.push(`${phaseInfo.emoji} <b style="color:#89b4fa">World</b> &mdash; Day ${time.state.dayCount}`);
		lines.push(`  ${phaseBar} <b>${phaseInfo.label}</b> (tick ${tic}/${ticksPerDay})`);
		lines.push(`  🏦 Treasury: <b>${economy.state.treasury.toFixed(0)}g</b>`);
		const velColor = velocity > 0.2 ? '#a6e3a1' : velocity > 0 ? '#f9e2af' : '#f38ba8';
		lines.push(`  📈 Velocity: <b style="color:${velColor}">${velocity.toFixed(3)}</b> <span style="color:#6c7086">(>0.2 healthy)</span>`);

		// Agents
		for (const agent of agents) {
			const needs = agent.get(NeedsComponent).state;
			const wallet = agent.get(WalletComponent).state;
			const inv = agent.get(InventoryComponent).state;
			const mood = agent.get(MoodComponent).state;
			const stamina = agent.get(StaminaComponent).state;
			const ba = agent.behaviorAgent;

			const action = ba.btAction ?? 'idle';
			const actionInfo = ACTION_DISPLAY[action] ?? { emoji: '❓', label: action };

			// Update thought bubble on the game canvas
			const bubble = ensureThoughtBubble(agent);
			bubble.text = `${actionInfo.emoji} ${actionInfo.label}`;

			lines.push('');
			lines.push(`👤 <b style="color:#89b4fa">${agent.agentName}</b> <span style="color:#6c7086">(${agent.kind})</span>`);

			// Current behavior with emoji
			lines.push(`  ${actionInfo.emoji} <b>${actionInfo.label}</b>`);
			lines.push(`  🔧 Job: <b>${agent.job ?? '<span style="color:#6c7086">unemployed</span>'}</b>`);

			// All 4 needs
			lines.push(`  ${needBar(needs.hunger, 'Food', '🍖')}`);
			lines.push(`  ${needBar(needs.thirst, 'Water', '💧')}`);
			lines.push(`  ${needBar(needs.energy, 'Energy', '⚡')}`);
			lines.push(`  ${needBar(needs.social, 'Social', '👥')}`);

			// Mood + Stamina
			const moodEmoji = mood.value > 30 ? '😊' : mood.value > -10 ? '😐' : '😞';
			lines.push(`  ${moodEmoji} Mood: <b>${mood.value}</b> (${mood.bucket}) &middot; 🏃 Stamina: <b>${stamina.current.toFixed(0)}/${stamina.max}</b>`);

			// Gold + inventory
			lines.push(`  💰 Gold: <b>${wallet.gold.toFixed(1)}g</b>`);
			const items = inv.items.map(i => {
				const icon = i.item_id === 'food' ? '🍖' : i.item_id === 'waterskin' ? '🫗' : i.item_id === 'tools' ? '🔧' : i.item_id === 'equipment' ? '🛡️' : '📦';
				if (i.charges !== undefined) return `${icon} ${i.item_id} (${i.charges}) x${i.quantity}`;
				return `${icon} ${i.item_id} x${i.quantity}`;
			});
			lines.push(`  🎒 ${items.length > 0 ? items.join(' &middot; ') : '<span style="color:#6c7086">empty bag</span>'}`);

			// Location / movement
			const loc = ba.atLocation;
			const target = ba.movementTarget;
			if (loc !== null) {
				const locData = locations.find(l => l.id === loc);
				const locIcon = LOCATION_ICONS[locData?.type ?? ''] ?? '📍';
				lines.push(`  ${locIcon} At: <b>${locData?.name ?? loc}</b>`);
			} else if (target !== null) {
				const targetData = locations.find(l => l.id === target.id);
				const targetIcon = LOCATION_ICONS[targetData?.type ?? ''] ?? '📍';
				lines.push(`  ${targetIcon} → <b>${targetData?.name ?? target.id}</b>`);
			} else {
				lines.push('  🧭 Wandering...');
			}

			// Position
			lines.push(`  <span style="color:#6c7086">📐 (${agent.pos.x.toFixed(0)}, ${agent.pos.y.toFixed(0)})</span>`);
		}

		// Facilities
		lines.push('');
		lines.push('🏭 <b style="color:#89b4fa">Facilities</b>');
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
				: '<span style="color:#6c7086">❌ none</span>';
			const progressLabel = fac.state.workProgress > 0
				? ` &middot; ⏳ ${fac.state.workProgress}/${loc.production?.ticks_per_cycle ?? '?'}`
				: '';

			lines.push(`  ${locIcon} <b>${loc.name}</b>`);
			lines.push(`    💰 ${fac.state.fund.toFixed(0)}g &middot; 👷 ${workerLabel}${progressLabel}`);
			lines.push(`    📦 ${stockItems}`);
		}

		// Market prices
		const marketLoc = locations.find(l => l.type === 'market');
		if (marketLoc !== undefined) {
			const marketActor = locationActors.get(marketLoc.id);
			if (marketActor !== undefined && marketActor.has(FacilityComponent)) {
				const market = marketActor.get(FacilityComponent);
				lines.push('');
				lines.push('📊 <b style="color:#89b4fa">Market Prices</b>');
				const prices = market.state.currentPrices ?? {};
				for (const [itemId, price] of Object.entries(prices)) {
					lines.push(`  ${itemId}: <b>${Number(price).toFixed(1)}g</b>`);
				}
				if (Object.keys(prices).length === 0) {
					lines.push('  <span style="color:#6c7086">No prices set</span>');
				}
			}
		}

		el.innerHTML = lines.join('<br>');
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
		},
	};
}
