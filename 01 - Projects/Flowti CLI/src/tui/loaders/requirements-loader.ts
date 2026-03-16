/**
 * requirements-loader.ts — Requirements list loader.
 */

import { requirementStore } from "../../domain/requirements/requirement-store.js";
import { createCrudLoader } from "./crud-loader.js";

export const loadRequirements = createCrudLoader(requirementStore);
