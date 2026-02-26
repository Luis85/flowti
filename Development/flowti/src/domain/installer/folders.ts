/**
 * Default IBDE folder scaffold — derived from {@link DEFAULT_FOLDER_CONFIG}.
 *
 * This flat path array is the backwards-compatible export consumed by
 * FolderScaffoldStep and tests. The structured config with descriptions
 * lives in `folderConfig.ts`.
 *
 * @see folderConfig.ts for the versioned config with descriptions
 * @see docs/ideas/Flowti IBDE - User Vault.md, lines 165-199
 */
import { DEFAULT_FOLDER_CONFIG, getFolderPaths } from "./folderConfig";

export const DEFAULT_IBDE_FOLDERS: readonly string[] = getFolderPaths(DEFAULT_FOLDER_CONFIG);
