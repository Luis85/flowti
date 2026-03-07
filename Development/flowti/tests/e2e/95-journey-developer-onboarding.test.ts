/**
 * E2E Chapter 9: Developer Onboarding Journey
 *
 * Validates the developer onboarding experience: CLI discovery,
 * build from source, plugin activation, and feature exploration.
 *
 * Driven by declarative JSON config — see journeys/developer-onboarding.journey
 *
 * Run with: npm run test:e2e -- --journey=developer-onboarding
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "developer-onboarding.journey");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);
