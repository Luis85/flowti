import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';
import { NeedsComponent } from '../components/needs-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

interface OverlayDeps {
	getAgents: () => AgentActor[];
	getWorldEntity: () => Actor;
	getLocations: () => WorldLocation[];
	getLocationActors: () => Map<string, Actor>;
	getTickCount: () => number;
}

function needBar(value: number, label: string): string {
	const pct = Math.round(value);
	const color = pct > 50 ? '#a6e3a1' : pct > 20 ? '#f9e2af' : '#f38ba8';
	return `<span style="color:${color}">${label} ${pct}</span>`;
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
		padding: 10px 12px; border-radius: 6px; width: 300px; max-height: 50vh;
		overflow-y: auto; overflow-x: hidden;
		border: 1px solid var(--background-modifier-border, #45475a);
		opacity: 0.92; pointer-events: none;
	`;
	container.style.position = 'relative';
	container.appendChild(el);

	function update(): void {
		const agents = deps.getAgents();
		const world = deps.getWorldEntity();
		const locations = deps.getLocations();
		const locationActors = deps.getLocationActors();
		const tick = deps.getTickCount();

		const time = world.get(TimeComponent);
		const economy = world.get(EconomyComponent);
		const velocity = economy.state.monetarySnapshot?.velocity ?? 0;

		const lines: string[] = [];

		// World state
		lines.push('<b style="color:#89b4fa">World</b>');
		lines.push(`  Tick <b>${tick}</b> &middot; Day ${time.state.dayCount} &middot; <b>${time.state.phase}</b>`);
		lines.push(`  Treasury: <b>${economy.state.treasury.toFixed(0)}g</b> <span style="color:#6c7086">(director gold pool)</span>`);
		lines.push(`  Velocity: <b>${velocity.toFixed(3)}</b> <span style="color:#6c7086">(gold flow rate, >0.2 = healthy)</span>`);

		// Agents
		for (const agent of agents) {
			const needs = agent.get(NeedsComponent).state;
			const wallet = agent.get(WalletComponent).state;
			const inv = agent.get(InventoryComponent).state;
			const ba = agent.behaviorAgent;

			lines.push('');
			lines.push(`<b style="color:#89b4fa">${agent.agentName}</b>`);

			// Current behavior
			const action = ba.btAction ?? 'idle';
			lines.push(`  Doing: <b>${action}</b> &middot; Job: <b>${agent.job ?? 'none'}</b>`);

			// Needs with color coding
			lines.push(`  ${needBar(needs.hunger, 'Hunger')} &middot; ${needBar(needs.thirst, 'Thirst')}`);
			lines.push(`  ${needBar(needs.energy, 'Energy')} &middot; ${needBar(needs.social, 'Social')}`);

			// Gold
			lines.push(`  Gold: <b>${wallet.gold.toFixed(0)}g</b>`);

			// Inventory
			const items = inv.items.map(i => {
				if (i.charges !== undefined) return `${i.item_id} (${i.charges} charges) x${i.quantity}`;
				return `${i.item_id} x${i.quantity}`;
			});
			lines.push(`  Bag: ${items.length > 0 ? items.join(', ') : '<span style="color:#6c7086">empty</span>'}`);

			// Location / movement
			const loc = ba.atLocation;
			const target = ba.movementTarget;
			if (loc !== null) {
				const locName = locations.find(l => l.id === loc)?.name ?? loc;
				lines.push(`  At: <b>${locName}</b>`);
			} else if (target !== null) {
				const targetName = locations.find(l => l.id === target.id)?.name ?? target.id;
				lines.push(`  Moving to: <b>${targetName}</b>`);
			} else {
				lines.push('  At: <span style="color:#6c7086">wandering</span>');
			}
		}

		// Facilities
		lines.push('');
		lines.push('<b style="color:#89b4fa">Facilities</b>');
		for (const loc of locations) {
			const actor = locationActors.get(loc.id);
			if (actor === undefined) continue;
			if (!actor.has(FacilityComponent)) continue;
			const fac = actor.get(FacilityComponent);
			const stockItems = fac.state.stock.map(s => `${s.item_id} x${s.quantity}`).join(', ') || 'empty';
			const worker = fac.state.workerId;
			const workerLabel = worker !== null
				? `<span style="color:#a6e3a1">${worker.replace('agent-', '')}</span>`
				: '<span style="color:#6c7086">none</span>';

			lines.push(`  <b>${loc.name}</b>`);
			lines.push(`    Fund: ${fac.state.fund.toFixed(0)}g &middot; Worker: ${workerLabel}`);
			lines.push(`    Stock: ${stockItems}`);
		}

		el.innerHTML = lines.join('<br>');
	}

	const interval = setInterval(update, 1000);
	update();

	return {
		dispose(): void {
			clearInterval(interval);
			el.remove();
		},
	};
}
