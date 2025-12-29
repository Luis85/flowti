import { createSystem, ReadEvents } from "sim-ecs";
import { ExampleEvent } from "src/eventsystem/ExampleEvent";

export const EventSubscriberSystem = createSystem({
	myEvents: ReadEvents(ExampleEvent),
})
	.withRunFunction(({ myEvents }) => {
		let myEvent;
		for (myEvent of myEvents.iter()) {
			console.log(myEvent.message);
		}
	})
	.build();
