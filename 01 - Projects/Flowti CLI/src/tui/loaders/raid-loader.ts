/**
 * raid-loader.ts — RAID items loader.
 */

import { raidStore } from "../../domain/raid/raid-store.js";
import { createCrudLoader } from "./crud-loader.js";

export const loadRaid = createCrudLoader(raidStore);
