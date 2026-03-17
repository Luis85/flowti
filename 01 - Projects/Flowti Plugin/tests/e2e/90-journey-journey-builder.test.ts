/**
 * E2E Chapter 9: Journey Builder
 *
 * TDD blueprint — defines expected behavior for the Journey Builder feature
 * before implementation exists. Steps 1-2 (command/ribbon launch) are fully
 * specified. Steps 3-5 (metadata, step creation, export) are placeholders
 * that will be expanded as the feature develops.
 *
 * Driven by declarative JSON config — see journeys/journey-builder.journey
 * for step definitions and actions.
 *
 * Run with: npm run test:e2e:journey-builder
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "journey-builder.journey");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);
