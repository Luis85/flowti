/**
 * timelog-loader.ts — Timelog entries loader.
 */

import { timelogStore } from "../../domain/timelog/timelog-store.js";
import { createCrudLoader } from "./crud-loader.js";

export const loadTimelog = createCrudLoader(timelogStore);
