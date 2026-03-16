/**
 * deliverables-loader.ts — Deliverables list loader.
 */

import { deliverableStore } from "../../domain/deliverables/deliverable-store.js";
import { createCrudLoader } from "./crud-loader.js";

export const loadDeliverables = createCrudLoader(deliverableStore);
