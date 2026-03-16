/**
 * capa-loader.ts — CAPA items loader.
 */

import { capaStore } from "../../domain/capa/capa-store.js";
import { createCrudLoader } from "./crud-loader.js";

export const loadCapa = createCrudLoader(capaStore);
