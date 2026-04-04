import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import type { AgentActor } from '../entity/agent-actor.js';

export function createEquipmentDecaySystem(
	worldEntity: () => Actor,
	getAgents: () => AgentActor[],
): GameSystem {
	return {
		name: 'EquipmentDecaySystem',
		priority: SystemPriority.EQUIPMENT_DECAY,

		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);
			if (!time.state.dayBoundaryThisTick) return;

			const agentList = getAgents();
			for (const agent of agentList) {
				const inv = agent.get(InventoryComponent);
				const hasEquip = inv.state.items.some(i => i.item_id === 'equipment');
				if (!hasEquip) continue;
				const updated = inv.state.items
					.map(i => {
						if (i.item_id !== 'equipment') return { ...i };
						const newCharges = (i.charges ?? 0) - 1;
						return newCharges > 0 ? { ...i, charges: newCharges } : null;
					})
					.filter((i): i is NonNullable<typeof i> => i !== null);
				inv.state = { items: updated };
				inv.markDirty();
			}
		},
	};
}
