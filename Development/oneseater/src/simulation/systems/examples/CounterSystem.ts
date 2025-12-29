import { createSystem, queryComponents, Write } from "sim-ecs";
import { Counter } from "src/simulation/components/Counter";

export const CounterSystem = createSystem({
    query: queryComponents({counterObj: Write(Counter)}),
})
    // this function is called every time the world needs to be updated. Put your logic in there
    .withRunFunction(({query}) =>
        query.execute(({counterObj}) => {++counterObj.a})
    )
    .build();
