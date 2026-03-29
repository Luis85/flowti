/**
 * Generates README.md from shipped game data files and known config constants.
 * Run: node scripts/generate-readme.mjs
 * Called automatically by the vite build plugin.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function loadJsonDir(dir) {
	const fullPath = resolve(projectRoot, dir);
	try {
		return readdirSync(fullPath)
			.filter(f => f.endsWith('.json'))
			.map(f => JSON.parse(readFileSync(resolve(fullPath, f), 'utf-8')));
	} catch { return []; }
}

function readManifest() {
	try {
		return JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf-8'));
	} catch { return { name: 'Project Meridian', version: '0.0.0', description: '' }; }
}

// --- Load data ---
const manifest = readManifest();
const agents = loadJsonDir('agents');
const locations = loadJsonDir('locations');
const bts = loadJsonDir('behavior-trees');

// --- Config constants (from game-config-schema.ts defaults) ---
const CONFIG = {
	tick_interval_ms: 500,
	ticks_per_day: 480,
	needs: { hunger_decay: 0.5, energy_decay: 0.25, social_decay: 0.15, food_recovery_rate: 1.5 },
	stamina: { movement_energy_cost: 0.1, exhaustion_speed_modifier: 0.5 },
	perception: { base_multiplier: 20, night_multiplier: 0.5, interaction_radius: 25 },
	formulas: { basic_speed_divisor: 4 },
	rest_tiers: {
		owned_home: { recovery_rate: 2.0, mood_effect: 2 },
		public_shelter: { recovery_rate: 1.5, mood_effect: 0 },
		outdoors: { recovery_rate: 1.0, mood_effect: -3 },
	},
	social: { recovery_rate: 0.5, memory_significance: 3, memory_mood_impact: 2, cooldown_ticks: 50 },
	memory: { max_entries: 50, min_lifespan_ticks: 20 },
	mood: {
		factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
		buckets: [
			{ name: 'elated', min: 60, max: 100 },
			{ name: 'content', min: 20, max: 59 },
			{ name: 'stressed', min: -19, max: 19 },
			{ name: 'distressed', min: -59, max: -20 },
			{ name: 'breakdown', min: -100, max: -60 },
		],
	},
	day_night: {
		dawn: { start: 0, end: 59 },
		day: { start: 60, end: 299 },
		dusk: { start: 300, end: 359 },
		night: { start: 360, end: 479 },
	},
	critical_thresholds: { hunger: 20, energy: 15, social: 25 },
};

const dayDurationSec = (CONFIG.ticks_per_day * CONFIG.tick_interval_ms) / 1000;

// --- BT summary ---
function summarizeBT(node, depth = 0) {
	const indent = '  '.repeat(depth);
	if (node.type === 'action') return `${indent}- **${node.action}**`;
	if (node.type === 'condition') {
		const p = Object.entries(node.params || {}).map(([k, v]) => `${k}=${v}`).join(', ');
		return `${indent}- if \`${node.check}\`${p ? ` (${p})` : ''}`;
	}
	const label = node.type === 'selector' ? 'try first match' : 'all must pass';
	const children = (node.children || []).map(c => summarizeBT(c, depth + 1)).join('\n');
	return `${indent}- *${label}:*\n${children}`;
}

// --- Generate ---
const lines = [];
const w = (s = '') => lines.push(s);

w(`# ${manifest.name} v${manifest.version}`);
w();
w(`> ${manifest.description}`);
w();
w('*This file is auto-generated during build from game data and config constants.*');
w();

// --- Overview ---
w('## How It Works');
w();
w('Project Meridian is an emergent agent simulation that runs inside Obsidian. Agents have needs (hunger, energy, social) that decay over time, moods that react to their state, and behavior trees that drive their decisions. They perceive nearby locations and other agents, then autonomously move to satisfy their needs.');
w();
w('The simulation ticks continuously. Each tick runs these systems in order:');
w();
w('| Priority | System | What it does |');
w('|----------|--------|-------------|');
w('| 0.5 | Trait Resolver | Applies trait modifiers to agent stats |');
w('| 0.7 | Day/Night | Advances time cycle (dawn/day/dusk/night) |');
w('| 1 | Needs Decay | Reduces hunger, energy, social each tick |');
w('| 2 | Mood | Recalculates mood from needs + memories |');
w('| 3 | Perception | Detects nearby agents and locations |');
w('| 4 | Memory Decay | Fades old memories, prunes insignificant ones |');
w('| 5 | Behavior Tree | Evaluates decisions, picks an action |');
w('| 5.5 | Movement | Walks agent toward chosen target (drains energy) |');
w('| 6.5 | Rest | Recovers energy at rest locations (3 tiers) |');
w('| 6.6 | Feed | Recovers hunger at food locations |');
w('| 6.7 | Socialize | Recovers social near agents, creates memories |');
w();

// --- Day/Night ---
w('## Day/Night Cycle');
w();
w(`A full day lasts **${dayDurationSec} seconds** (${CONFIG.ticks_per_day} ticks at ${CONFIG.tick_interval_ms}ms per tick).`);
w();
w('| Phase | Ticks | Real Time |');
w('|-------|-------|-----------|');
for (const [phase, range] of Object.entries(CONFIG.day_night)) {
	const ticks = range.end - range.start + 1;
	const sec = (ticks * CONFIG.tick_interval_ms / 1000).toFixed(0);
	w(`| ${phase} | ${range.start}–${range.end} | ~${sec}s |`);
}
w();
w('At night, agent perception radius is reduced (see Perception below).');
w();

// --- Agents ---
w('## Agents');
w();
w(`${agents.length} agents in the world:`);
w();
w('| Name | Kind | Color | ST | DX | IQ | HT | Hunger | Energy | Social | Traits |');
w('|------|------|-------|----|----|----|-----|--------|--------|--------|--------|');
for (const a of agents) {
	const attr = a.attributes;
	const needs = a.needs;
	const traits = (a.traits || []).join(', ') || '—';
	w(`| ${a.name} | ${a.kind} | ${a.color || '#b0b0b0'} | ${attr.ST} | ${attr.DX} | ${attr.IQ} | ${attr.HT} | ${needs.hunger} | ${needs.energy} | ${needs.social} | ${traits} |`);
}
w();
w('Agent files: `03 - Resources/Agents/*.json` — edit in Obsidian to change starting stats, color, traits, etc.');
w();
if (agents.some(a => a.persona)) {
	w('### Personas');
	w();
	w('Each agent has a markdown persona file describing their personality:');
	w();
	for (const a of agents) {
		if (a.persona) w(`- **${a.name}**: \`03 - Resources/Personas/${a.persona.split('/').pop()}\``);
	}
	w();
}

// --- Locations ---
w('## Locations');
w();
w(`${locations.length} locations in the world:`);
w();
w('| Name | Type | Color | Position | Capacity |');
w('|------|------|-------|----------|----------|');
for (const l of locations) {
	w(`| ${l.name} | ${l.type} | ${l.color || '#808080'} | (${l.position.x}, ${l.position.y}) | ${l.capacity} |`);
}
w();
w('Location files: `03 - Resources/Locations/*.json` — edit to add/move/recolor locations.');
w();

// --- Needs ---
w('## Needs & Survival');
w();
w('Every tick, each agent\'s needs decay:');
w();
w('| Need | Decay/tick | Formula | Critical Threshold |');
w('|------|-----------|---------|-------------------|');
w(`| Hunger | ${CONFIG.needs.hunger_decay} | decay / (HT / 10) | < ${CONFIG.critical_thresholds.hunger} |`);
w(`| Energy | ${CONFIG.needs.energy_decay} | decay / (HT / 10) | < ${CONFIG.critical_thresholds.energy} |`);
w(`| Social | ${CONFIG.needs.social_decay} | decay / (Charisma / 10) | < ${CONFIG.critical_thresholds.social} |`);
w();
w('Higher HT (or Charisma for social) means slower decay. Trait modifiers can scale decay rates.');
w();
w('When energy hits 0, the agent is **exhausted**.');
w();

// --- Mood ---
w('## Mood');
w();
w('Mood is calculated from weighted factors:');
w();
w('| Factor | Weight | Source |');
w('|--------|--------|--------|');
for (const [k, v] of Object.entries(CONFIG.mood.factor_weights)) {
	const source = { needs: 'Average of hunger/energy/social', positive_memories: 'Recent positive outcomes', negative_memories: 'Recent negative outcomes', goal_progress: 'Not yet active', wallet: 'Not yet active', equipment: 'Not yet active', relationships: 'Not yet active' }[k] || '—';
	w(`| ${k.replace(/_/g, ' ')} | ${v} | ${source} |`);
}
w();
w('The weighted score maps to a mood bucket:');
w();
w('| Bucket | Range |');
w('|--------|-------|');
for (const b of CONFIG.mood.buckets) {
	w(`| ${b.name} | ${b.min} to ${b.max} |`);
}
w();

// --- Perception ---
w('## Perception');
w();
w(`Base radius: **${CONFIG.perception.base_multiplier} x IQ** pixels.`);
w();
w(`At night: radius x **${CONFIG.perception.night_multiplier}** (halved).`);
w();
w('Example: IQ 10 agent sees 200px by day, 100px by night.');
w();

// --- Movement ---
w('## Movement');
w();
w(`Speed: **DX / ${CONFIG.formulas.basic_speed_divisor}** pixels per tick.`);
w();
w('| DX | Speed (px/tick) | Speed (px/sec) |');
w('|----|----------------|----------------|');
for (const dx of [8, 10, 12, 15]) {
	const speed = dx / CONFIG.formulas.basic_speed_divisor;
	const pxSec = (speed * 1000 / CONFIG.tick_interval_ms).toFixed(1);
	w(`| ${dx} | ${speed.toFixed(1)} | ${pxSec} |`);
}
w();

// --- Action Consequences ---
w('## Action Consequences');
w();
w(`Actions have tangible effects when agents are within **${CONFIG.perception.interaction_radius}px** of the relevant location or agent.`);
w();
w('### Rest Recovery');
w();
w('Agents recover energy at rest locations. The tier depends on ownership:');
w();
w('| Tier | Recovery/tick | Mood Effect | Condition |');
w('|------|-------------|-------------|-----------|');
w(`| Owned Home | ${CONFIG.rest_tiers.owned_home.recovery_rate} | +${CONFIG.rest_tiers.owned_home.mood_effect} | Agent owns the location |`);
w(`| Public Shelter | ${CONFIG.rest_tiers.public_shelter.recovery_rate} | ${CONFIG.rest_tiers.public_shelter.mood_effect} | At rest location, not owned |`);
w(`| Outdoors | ${CONFIG.rest_tiers.outdoors.recovery_rate} | ${CONFIG.rest_tiers.outdoors.mood_effect} | Idle, no rest location nearby |`);
w();
w('### Food Recovery');
w();
w(`At food locations, hunger recovers at **${CONFIG.needs.food_recovery_rate}/tick**.`);
w();
w('### Social Recovery');
w();
w(`When an agent socializes near another agent, social recovers at **${CONFIG.social.recovery_rate}/tick**. A memory of the interaction is created (significance: ${CONFIG.social.memory_significance}, mood impact: +${CONFIG.social.memory_mood_impact}).`);
w();
w(`Memories have a **${CONFIG.social.cooldown_ticks}-tick cooldown** per pair — social still recovers during cooldown, but no new memory is created.`);
w();
w('### Movement Energy Cost');
w();
w(`Moving drains energy: **speed × ${CONFIG.stamina.movement_energy_cost}/tick**. Exhausted agents (energy < ${CONFIG.critical_thresholds.energy}) move at **${CONFIG.stamina.exhaustion_speed_modifier}x speed**.`);
w();

// --- Memory ---
w('## Memory');
w();
w(`Max entries: **${CONFIG.memory.max_entries}**. Memories younger than **${CONFIG.memory.min_lifespan_ticks} ticks** are protected from decay.`);
w();
w('Older memories lose significance each tick. High-significance memories decay slower. Entries below significance 1 are pruned.');
w();

// --- Behavior Trees ---
w('## Behavior Trees');
w();
w(`${bts.length} behavior trees define how agents decide:`);
w();
for (const bt of bts) {
	const kind = bt.id.startsWith('bt-') ? bt.id.slice(3) : bt.id;
	w(`### ${kind}`);
	w();
	w('```');
	w(summarizeBT(bt.root));
	w('```');
	w();
}
w('BT files: `03 - Resources/BehaviorTrees/*.json` — edit to change agent decision logic.');
w();

// --- Available BT vocabulary ---
w('### Available Conditions');
w();
w('| Condition | Params | Logic |');
w('|-----------|--------|-------|');
w('| `need_critical` | `need` | Need value < critical threshold |');
w('| `need_below` | `need`, `threshold` | Need value < custom threshold |');
w('| `mood_is` | `bucket` | Current mood bucket matches |');
w('| `time_is` | `phase` | Current time phase matches |');
w('| `nearby_location` | `locationType` | Perception has a location of given type |');
w('| `nearby_agent` | — | At least one agent nearby |');
w('| `chance` | `probability` | Random roll (0–1) |');
w();

w('### Available Actions');
w();
w('| Action | Effect |');
w('|--------|--------|');
w('| `seek_food` | Move to nearest food location |');
w('| `seek_rest` | Move to nearest rest location |');
w('| `seek_social` | Move to nearest social location |');
w('| `seek_work` | Move to nearest work location |');
w('| `socialize` | Move toward nearest agent |');
w('| `interact` | Move toward nearest agent |');
w('| `idle` | Stay put |');
w();

// --- Customization ---
w('## Customization');
w();
w('All game data lives in `03 - Resources/` and can be edited in Obsidian:');
w();
w('| What | Where | Format |');
w('|------|-------|--------|');
w('| Agents | `03 - Resources/Agents/*.json` | JSON — stats, needs, traits, color |');
w('| Personas | `03 - Resources/Personas/*.md` | Markdown — personality, speech, motivations |');
w('| Locations | `03 - Resources/Locations/*.json` | JSON — position, type, capacity, color |');
w('| Behavior Trees | `03 - Resources/BehaviorTrees/*.json` | JSON — decision tree nodes |');
w();
w('### Plugin Settings (Obsidian Settings > Project Meridian)');
w();
w('| Setting | Default | Description |');
w('|---------|---------|-------------|');
w('| Tick rate | 60 | Ticks per second (simulation speed) |');
w('| Day cycle duration | 120s | Real seconds per full day/night cycle |');
w('| Perception radius | 150 | Base perception multiplier |');
w('| Log level | info | Console log verbosity |');
w('| Debug mode | off | Debug overlays and verbose logging |');
w('| Performance tracking | off | System timing per tick |');
w();

const output = lines.join('\n') + '\n';
const outPath = resolve(projectRoot, 'dist', 'README.md');

// Allow running standalone or being imported
if (process.argv[1]?.endsWith('generate-readme.mjs')) {
	writeFileSync(outPath, output);
	console.log(`README generated: ${outPath} (${lines.length} lines)`);
}

export { output as readmeContent };
