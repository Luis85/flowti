/** Known BT action names — shared between system and validation. */
export const KNOWN_ACTIONS = new Set([
	'idle',
	'seek_food',
	'seek_rest',
	'seek_social',
	'seek_work',
	'interact',
	'socialize',
	'eat',
	'rest',
	'talk',
	'work',
]);

/** Actions that target a nearby agent rather than a location. */
export const AGENT_SOCIAL_ACTIONS = new Set(['interact', 'socialize']);
