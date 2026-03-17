import { EntityRegistry } from "./EntityRegistry";

export const ENTITY_REGISTRY = new EntityRegistry();

ENTITY_REGISTRY.register({
  key: "drivers",
  folder: "drivers",
  templateFile: "Driver.md",
  idField: "driverId",
  mapRow: (r) => ({
    ...r,
    fullName: [r.givenName, r.familyName].filter(Boolean).join(" "),
  }),
});

ENTITY_REGISTRY.register({
  key: "circuits",
  folder: "circuits",
  templateFile: "Circuit.md",
  idField: "circuitId",
});

ENTITY_REGISTRY.register({
  key: "constructors",
  folder: "constructors",
  templateFile: "Constructor.md",
  idField: "constructorId",
});

ENTITY_REGISTRY.register({
  key: "races",
  folder: "races",
  templateFile: "Race.md",
  idField: "raceId",
  mapRow: (r) => ({
    ...r,
    raceId: `${r.season}_R${r.round}`,
  }),
});

ENTITY_REGISTRY.register({
  key: "seasons",
  folder: "seasons",
  templateFile: "Season.md",
  idField: "season",
});

ENTITY_REGISTRY.register({
  key: "meetings",
  folder: "meetings",
  templateFile: "Meeting.md",
  idField: "meetingId",
  mapRow: (r) => ({
    ...r,
    meetingId: `${r.year}_${r.meetingKey}`,
  }),
});

ENTITY_REGISTRY.register({
  key: "sessions",
  folder: "sessions",
  templateFile: "Session.md",
  idField: "sessionId",
  mapRow: (r) => ({
    ...r,
    sessionId: `${r.year}_${r.sessionKey}`,
  }),
});

ENTITY_REGISTRY.register({
  key: "entity",
  folder: "entities",
  templateFile: "Default.md",
  idField: "entityId",
});
