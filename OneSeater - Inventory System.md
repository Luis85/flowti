# Inventory System

```ts
class Inventory {
  private items: Item[] = []
  
}
```

Does it make sense to use the Inventory as a ECS Component?

How to attach the inventory to an entity?
Using inventory trough ECS does not make sense in my opinion. I think items or actions out of inventory would benefit from a state machine, other then that I don‘t think we need to bring an inventory to the simulation tick.

When triggering crafting for example, the system checks for available and needed items out of the triggering entities inventory. this sounds more like state-machine and workflow work.