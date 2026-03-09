/**
 * plugins.ts — Plugin domain facade.
 *
 * Re-exports the public API for the plugin system.
 */

export { commands, pluginsMenu } from "./plugin-commands.js";
export { loadPlugins, detectCollisions, scaffoldPlugin, PLUGINS_DIR } from "./plugin-loader.js";
export { generatePluginReference } from "./plugin-reference.js";
export type { PluginManifest, LoadedPlugin, PluginValidationResult } from "./plugin-types.js";
