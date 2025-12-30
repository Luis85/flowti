import { createSystem, WriteEvents, WriteResource, ReadResource, Storage } from "sim-ecs";
import { NewMessageReceivedEvent } from "src/eventsystem/messages/NewMessageReceivedEvent";
import { CUSTOMER_PURCHASE_ORDER_CATALOG } from "src/messages/catalogs/CustomerPurchaseOrderCatalog";
import { shouldSpawn, mkId } from "src/messages/utils";
import { LineItem } from "src/orders";
import { LineItemGenerator } from "src/orders/LineItemGenerator";
import { GameSettingsStore } from "src/simulation/stores/GameSettingsStore";
import { MessageStore } from "src/simulation/stores/MessageStore";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { nextRng, computeTemplateWeight, weightedPick } from "src/simulation/utils";


// Tuneables
const MIN_GAP_SIM_MS = 30 * 60_000; // min 30 sim minutes between messages

export const CustomerPurchaseOrderCreationSystem = createSystem({
	msg: WriteEvents(NewMessageReceivedEvent),
	simStore: WriteResource(SimulationStore),
	msgStore: WriteResource(MessageStore),
	settings: ReadResource(GameSettingsStore),

	storage: Storage({
		lastMsgSimNowMs: 0,
		rngSeed: 123456789,
		seq: 0,
		messageCount: 0,
	}),
})
	.withName("CustomerPurchaseOrderCreationSystem")
	.withRunFunction(async ({ msg, simStore, msgStore, settings, storage }) => {
		const simDt = simStore.lastSimDtMs ?? 0;
		storage.messageCount = msgStore.getActiveMessages().length;

		// Don't spawn if paused, no time passed, inbox full, or no products
		if (simDt <= 0 || simStore.inboxFull || simStore.getSellableProducts().length === 0) {
			return;
		}

		const now = simStore.simNowMs ?? 0;
		const dayIndex = simStore.dayIndex ?? 0;
		const minuteOfDay = simStore.minuteOfDay ?? 0;

		// Throttle - minimum gap between messages
		if (now - storage.lastMsgSimNowMs < MIN_GAP_SIM_MS) return;

		// Roll for "should spawn any message this tick?"
		const rSpawn = nextRng(storage.rngSeed);
		storage.rngSeed = rSpawn.seed;

		if (!shouldSpawn(simDt, settings.dailyOrderChance, rSpawn.value)) return;

		// Build weights per template for current context
		const ctx = { dayIndex, minuteOfDay };
		const weights = CUSTOMER_PURCHASE_ORDER_CATALOG.map((t) =>
			computeTemplateWeight(t, ctx)
		);

		// Roll for template selection
		const rPick = nextRng(storage.rngSeed);
		storage.rngSeed = rPick.seed;

		const template = weightedPick(
			CUSTOMER_PURCHASE_ORDER_CATALOG,
			weights,
			rPick.value
		);
		if (!template) return;

		// Generate RNG function for line item generation
		let currentSeed = storage.rngSeed;
		const rngFunc = () => {
			const r = nextRng(currentSeed);
			currentSeed = r.seed;
			return r.value;
		};

		// Generate line items
		const availableProducts = simStore.getSellableProducts();
		const lineItems = LineItemGenerator.generate(
			template.lineItemsStrategy,
			availableProducts,
			rngFunc
		);

		// Update seed after line item generation
		storage.rngSeed = currentSeed;

		// Create enhanced body with line items info
		const enhancedBody = createEnhancedBody(template.body, lineItems);

		// Increment sequence and update last message time
		storage.seq++;
		storage.lastMsgSimNowMs = now;

		// Create message
		const message = new NewMessageReceivedEvent(
			mkId(dayIndex, minuteOfDay, storage.seq),
			template.type,
			template.subject,
			template.priority,
			template.author,
			now,
			dayIndex,
			minuteOfDay,
			now,
			enhancedBody,
			template.possible_actions,
			template.tags,
			lineItems
		);
		void msg.publish(message);
	})
	.build();

/**
 * Create enhanced body text with line items summary
 */
function createEnhancedBody(
	baseBody: string,
	lineItems: LineItem[]
): string {
	if (lineItems.length === 0) return baseBody;

	const itemsSummary = lineItems
		.map((item) => {
			const price = item.price ? ` @ €${item.price}` : "";
			const known = item.isKnownProduct ? "" : " [Custom]";
			return `- ${item.quantity}x ${item.productName}${price}${known}`;
		})
		.join("\n");

	const totalValue = lineItems
		.filter((item) => item.price !== undefined)
		.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);

	const totalLine =
		totalValue > 0 ? `\n\nEstimated Total: €${totalValue.toFixed(2)}` : "";

	return `${baseBody}\n\n---\nRequested Items:\n${itemsSummary}${totalLine}`;
}
