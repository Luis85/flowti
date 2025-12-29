import { createSystem, WriteEvents, Storage } from "sim-ecs";
import { ExampleEvent } from "src/eventsystem/ExampleEvent";

export const EventPublisherSystem = createSystem({
	myEvents: WriteEvents(ExampleEvent),
	lastEvent: Storage({ timestamp: 0 }),
})
	.withRunFunction(async ({ myEvents, lastEvent }) => {
		//this will publish a new event every second
		if (Date.now() - lastEvent.timestamp >= 1000) {
			await myEvents.publish(new ExampleEvent("My event just happened!"));
			lastEvent.timestamp = Date.now();
		}
	})
	.build();
