/**
 * resources-loader.ts — Resources list loader.
 */

import { resourceStore } from "../../domain/resources/resource-store.js";
import { createCrudLoader } from "./crud-loader.js";

export const loadResources = createCrudLoader(resourceStore);
