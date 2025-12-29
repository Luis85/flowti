import { createSystem, ReadEvents, WriteEvents, Storage, WriteResource } from "sim-ecs";
import { ExampleEvent } from "src/eventsystem/ExampleEvent";
import { SimulationStore } from "src/simulation/stores/SimulationStore";

export const EventSystemExample = createSystem({
	myEventsRead: ReadEvents(ExampleEvent),
	myEventsWrite: WriteEvents(ExampleEvent),
	simStore: WriteResource(SimulationStore),
	lastEvent: Storage({ timestamp: 0 }),
})
	.withRunFunction(({ myEventsRead, myEventsWrite, simStore, lastEvent }) => {
		let myEventRead;
		for (myEventRead of myEventsRead.iter()) {
			console.log(myEventRead.message);
		}
		//this will publish a new event every second
		if (Date.now() - lastEvent.timestamp >= 1000) {
			void myEventsWrite.publish(new ExampleEvent("My event just happened!"));
			lastEvent.timestamp = Date.now();
		}
	})
	.build();
