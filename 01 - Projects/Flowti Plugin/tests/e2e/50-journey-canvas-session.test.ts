/**
 * E2E Chapter 5: Canvas Session Journey
 *
 * Validates the complete canvas session lifecycle: template picker →
 * goal input → canvas created → session running → pause → resume →
 * complete → closure overlay → skip → completed.
 *
 * Driven by declarative JSON config — see journeys/canvas-session.journey
 * for step definitions and actions.
 *
 * Run with: npm run test:e2e:canvas-session
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "canvas-session.journey");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);
