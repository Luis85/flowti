/**
 * lifecycle-loader.ts — Lifecycle items loader.
 */

import { lifecycleStore } from "../../domain/lifecycle/lifecycle-store.js";
import { createCrudLoader } from "./crud-loader.js";

export const loadLifecycle = createCrudLoader(lifecycleStore);
