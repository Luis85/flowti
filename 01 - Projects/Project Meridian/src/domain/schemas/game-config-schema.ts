import { z } from 'zod';
import { USE_BONUS_RANGE, MOOD_RANGE } from './ranges.js';

/** Zod v4 workaround: .default({}) doesn't cascade inner defaults; function default does */
function withDefaults<T extends z.ZodType>(schema: T): z.ZodDefault<T> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any -- Zod v4 generic .default() type mismatch
	return schema.default(() => schema.parse({}) as any) as any;
}

const ActivityCostSchema = z.object({
	hunger: z.number().default(1),
	thirst: z.number().default(1),
	energy: z.number().default(1),
});

const NeedsConfigSchema = z.object({
	hunger_decay: z.number().default(0.04),
	energy_decay: z.number().default(0.06),
	social_decay: z.number().default(0.05),
	thirst_decay: z.number().default(0.05),
	food_recovery_rate: z.number().default(30),
	drink_recovery: z.number().default(30),
	hunger_threshold: z.number().default(40),
	energy_threshold: z.number().default(30),
	social_threshold: z.number().default(40),
	thirst_threshold: z.number().default(40),
	recovery_hysteresis: z.number().default(20),
	food_reserve: z.number().int().default(3),
	activity_costs: z.record(z.string(), ActivityCostSchema).default({
		work:           { hunger: 2.5, thirst: 2.0, energy: 2.0 },
		harvest:        { hunger: 1.8, thirst: 1.5, energy: 1.5 },
		seek_work:      { hunger: 1.3, thirst: 1.5, energy: 1.3 },
		seek_food:      { hunger: 1.3, thirst: 1.5, energy: 1.3 },
		seek_water:     { hunger: 1.3, thirst: 1.5, energy: 1.3 },
		seek_rest:      { hunger: 1.2, thirst: 1.3, energy: 1.2 },
		seek_market:    { hunger: 1.3, thirst: 1.5, energy: 1.3 },
		wander:         { hunger: 1.1, thirst: 1.2, energy: 1.1 },
		eat:            { hunger: 0,   thirst: 0.5, energy: 0.3 },
		drink:          { hunger: 0.5, thirst: 0,   energy: 0.3 },
		rest:           { hunger: 0.3, thirst: 0.3, energy: 0 },
		idle:           { hunger: 0.5, thirst: 0.5, energy: 0.3 },
		sell:           { hunger: 1,   thirst: 1,   energy: 1 },
		buy:            { hunger: 1,   thirst: 1,   energy: 1 },
		fill_waterskin: { hunger: 1,   thirst: 1,   energy: 1 },
		claim_job:      { hunger: 1,   thirst: 1,   energy: 1 },
		repair:         { hunger: 1.2, thirst: 1.1, energy: 1.3 },
		seek_quest:     { hunger: 1.0, thirst: 1.0, energy: 1.0 },
		claim_quest:    { hunger: 1.0, thirst: 1.0, energy: 1.0 },
	}),
});

const StaminaConfigSchema = z.object({
	recovery_per_idle_tick: z.number().default(0.05),
	exhaustion_speed_modifier: z.number().default(0.5),
	exhaustion_skill_penalty: z.number().default(-2),
	movement_energy_cost: z.number().default(0.02),
});

const MemoryConfigSchema = z.object({
	max_entries: z.number().int().default(50),
	min_lifespan_ticks: z.number().int().default(20),
});

const MonetaryPolicyConfigSchema = z.object({
	velocity_window_ticks: z.number().default(500),
	velocity_healthy_min: z.number().default(0.3),
	velocity_healthy_max: z.number().default(0.8),
	velocity_stagnant: z.number().default(0.2),
	velocity_overheated: z.number().default(1.5),
	velocity_critical: z.number().default(0.1),
	stimulus_trigger_ticks: z.number().default(50),
	stimulus_duration_ticks: z.number().default(100),
	caravan_cooldown_ticks: z.number().default(500),
	tax_base_rate: z.number().default(0.10),
	tax_stagnant_multiplier: z.number().default(0.5),
	tax_overheated_multiplier: z.number().default(1.5),
	admin_fee_rate: z.number().default(0.02),
});

const EconomyConfigSchema = z.object({
	tax_base_rate: z.number().min(0).max(1).default(0.10),
	price_clamp_min: z.number().default(0.5),
	price_clamp_max: z.number().default(3.0),
	recalculation_interval_ticks: z.number().int().default(10),
	welfare_threshold_gold: z.number().default(10),
	welfare_reward_min: z.number().default(15),
	welfare_reward_max: z.number().default(25),
	max_active_welfare_quests: z.number().int().default(3),
	treasury_start_sandbox: z.number().default(1000),
	treasury_regen_per_agent_per_day: z.number().default(25),
	circulation_floor_per_agent: z.number().default(50),
	loan_interest_per_day: z.number().default(0.01),
	food_price: z.number().default(3),
	rest_price: z.number().default(1),
	facility_start_fund: z.number().default(200),
	ledger_retention_days: z.number().int().default(7),
	guard_stipend: z.number().default(2),
	merchant_stipend: z.number().default(8),
	facility_subsidy_threshold: z.number().default(100),
	facility_subsidy_per_day: z.number().default(30),
	price_memory_max: z.number().default(20),
	price_memory_stale_ticks: z.number().default(200),
	reservation_urgency_max: z.number().default(3),
	reservation_stock_factor: z.number().default(0.5),
	reservation_budget_cap: z.number().default(0.3),
	reservation_budget_cap_critical: z.number().default(0.8),
	demand_window_ticks: z.number().default(500),
	elasticity: z.record(z.string(), z.number().min(0).max(3)).default({
		subsistence: 1.5,
		comfort: 1.0,
		trade_goods: 0.7,
		luxury: 0.4,
	}),
	tools_output_multiplier: z.number().default(2),
	equipment_decay_reduction: z.number().default(0.2),
	monetary_policy: withDefaults(MonetaryPolicyConfigSchema),
});

const MoodFactorWeightsSchema = z.object({
	needs: z.number().default(30),
	positive_memories: z.number().default(20),
	negative_memories: z.number().default(20),
	goal_progress: z.number().default(10),
	wallet: z.number().default(10),
	equipment: z.number().default(5),
	relationships: z.number().default(5),
});

const MoodBucketSchema = z.object({
	name: z.string(),
	min: z.number().min(MOOD_RANGE.min).max(MOOD_RANGE.max),
	max: z.number().min(MOOD_RANGE.min).max(MOOD_RANGE.max),
});

const MoodConfigSchema = z.object({
	memory_window_ticks: z.number().int().default(50),
	memory_saturation_count: z.number().int().default(10),
	factor_weights: withDefaults(MoodFactorWeightsSchema),
	buckets: z.array(MoodBucketSchema).default([
		{ name: 'elated', min: 60, max: 100 },
		{ name: 'content', min: 20, max: 59 },
		{ name: 'stressed', min: -19, max: 19 },
		{ name: 'distressed', min: -59, max: -20 },
		{ name: 'breakdown', min: -100, max: -60 },
	]),
	skill_roll_modifiers: z.object({
		elated: z.number().int().default(1),
		content: z.number().int().default(0),
		stressed: z.number().int().default(0),
		distressed: z.number().int().default(-1),
		breakdown: z.number().int().default(-3),
	}).default({ elated: 1, content: 0, stressed: 0, distressed: -1, breakdown: -3 }),
	external_modifier_cap: z.number().default(30),
	rock_bottom_threshold: z.number().default(-40),
	rock_bottom_boost: z.number().default(10),
});

const MortalityConfigSchema = z.object({
	starvation_collapse_ticks: z.number().int().default(50),
	starvation_death_ticks: z.number().int().default(100),
	despair_death_ticks: z.number().int().default(200),
	quest_danger_mortality_chance: z.number().min(0).max(1).default(0.1),
});

const PerceptionConfigSchema = z.object({
	base_multiplier: z.number().default(20),
	night_multiplier: z.number().default(0.5),
	interaction_radius: z.number().default(25),
});

const TimeRangeSchema = z.object({
	start: z.number().default(0),
	end: z.number().default(0),
});

const DayNightConfigSchema = z.object({
	dawn: TimeRangeSchema.default({ start: 0, end: 59 }),
	day: TimeRangeSchema.default({ start: 60, end: 299 }),
	dusk: TimeRangeSchema.default({ start: 300, end: 359 }),
	night: TimeRangeSchema.default({ start: 360, end: 479 }),
});

const GossipConfigSchema = z.object({
	reliability_tiers: z.array(z.number()).default([1.0, 0.7, 0.5, 0.3]),
	iq_filter_threshold: z.number().default(12),
	familiarity_threshold: z.number().default(3),
	max_items_per_exchange: z.number().int().default(2),
	min_reliability: z.number().default(0.3),
});

const StatusConfigSchema = z.object({
	evaluation_interval_ticks: z.number().int().default(100),
});

const CrimeConfigSchema = z.object({
	mood_threshold: z.number().default(-20),
});

const SkillsConfigSchema = z.object({
	use_thresholds: z.array(z.number().int()).default([10, 25, 50, 100, 200]),
	max_use_bonus: z.number().int().default(USE_BONUS_RANGE.max),
});

const RestTierSchema = z.object({
	recovery_rate: z.number().default(1.0),
	mood_effect: z.number().default(0),
});

const RestTiersConfigSchema = z.object({
	owned_home: RestTierSchema.default({ recovery_rate: 2.0, mood_effect: 2 }),
	public_shelter: RestTierSchema.default({ recovery_rate: 1.5, mood_effect: 0 }),
	outdoors: RestTierSchema.default({ recovery_rate: 1.0, mood_effect: -3 }),
});

const SeasonConfigSchema = z.object({
	days_per_season: z.number().int().default(15),
});

const CandidatePoolConfigSchema = z.object({
	size_min: z.number().int().default(3),
	size_max: z.number().int().default(5),
	weighted_count: z.number().int().default(2),
	refresh_days: z.number().int().default(5),
});

const WorldEventsConfigSchema = z.object({
	evaluation_interval_ticks: z.number().int().default(50),
});

const GameLLMConfigSchema = z.object({
	provider: z.string().default('cursor'),
	budget_daily_calls: z.number().int().default(50),
});

const FormulasConfigSchema = z.object({
	basic_speed_divisor: z.number().default(4),
	carry_capacity_multiplier: z.number().default(5),
	trade_modifier_per_chr: z.number().default(0.02),
	social_reach_multiplier: z.number().default(0.5),
	arrival_threshold_multiplier: z.number().default(1.5),
	arrival_spread_radius: z.number().default(22),
});

const JobDefinitionSchema = z.object({
	primary_attribute: z.enum(['ST', 'DX', 'IQ', 'HT']),
});

const JobsConfigSchema = z.object({
	aptitude_baseline: z.number().default(12),
	desperation_ticks: z.number().default(200),
	definitions: z.record(z.string(), JobDefinitionSchema).default({
		settler: { primary_attribute: 'HT' },
		guard: { primary_attribute: 'ST' },
		craftsman: { primary_attribute: 'DX' },
	}),
});

const QuestsConfigSchema = z.object({
	max_open: z.number().default(5),
	expiry_ticks: z.number().default(960),
	supply_reward_multiplier: z.number().default(1.5),
	restock_reward: z.number().default(10),
	repair_reward: z.number().default(25),
	repair_ticks: z.number().default(30),
	repair_fund_injection: z.number().default(100),
	restock_threshold: z.number().default(3),
});

const BTConfigSchema = z.object({
	quest_wage_skip_multiplier: z.number().default(1.5),
});

const AgentCreationConfigSchema = z.object({
	base_cost: z.number().default(50),
	cost_per_attribute_point: z.number().default(5),
	candidate_discount: z.number().default(0.7),
});

const WorldHealthTierSchema = z.object({
	name: z.string(),
	max: z.number(),
	positive_event_multiplier: z.number(),
	negative_event_multiplier: z.number(),
});

const WorldHealthConfigSchema = z.object({
	tiers: z.array(WorldHealthTierSchema).default([
		{ name: 'critical', max: 20, positive_event_multiplier: 2.0, negative_event_multiplier: 0.3 },
		{ name: 'struggling', max: 40, positive_event_multiplier: 1.5, negative_event_multiplier: 0.6 },
		{ name: 'stable', max: 60, positive_event_multiplier: 1.0, negative_event_multiplier: 1.0 },
		{ name: 'thriving', max: 80, positive_event_multiplier: 0.8, negative_event_multiplier: 1.3 },
		{ name: 'booming', max: 100, positive_event_multiplier: 0.6, negative_event_multiplier: 1.5 },
	]),
});

const SocialConfigSchema = z.object({
	recovery_rate: z.number().default(3.0),
	memory_significance: z.number().int().default(3),
	memory_mood_impact: z.number().default(2),
	cooldown_ticks: z.number().int().default(20),
});

export const GameConfigSchema = z.object({
	version: z.string().default('1.0.0'),
	locale: z.string().default('en'),
	tick_interval_ms: z.number().int().min(50).default(500),
	max_catch_up_ticks: z.number().int().min(1).default(3),
	ticks_per_day: z.number().int().min(1).default(480),
	mortality: z.boolean().default(false),
	needs: withDefaults(NeedsConfigSchema),
	stamina: withDefaults(StaminaConfigSchema),
	memory: withDefaults(MemoryConfigSchema),
	economy: withDefaults(EconomyConfigSchema),
	mood: withDefaults(MoodConfigSchema),
	mortality_config: withDefaults(MortalityConfigSchema),
	perception: withDefaults(PerceptionConfigSchema),
	day_night: withDefaults(DayNightConfigSchema),
	gossip: withDefaults(GossipConfigSchema),
	status: withDefaults(StatusConfigSchema),
	crime: withDefaults(CrimeConfigSchema),
	skills: withDefaults(SkillsConfigSchema),
	rest_tiers: withDefaults(RestTiersConfigSchema),
	season: withDefaults(SeasonConfigSchema),
	candidate_pool: withDefaults(CandidatePoolConfigSchema),
	world_events: withDefaults(WorldEventsConfigSchema),
	canvas_checkpoint_interval_ticks: z.number().int().default(50),
	ui_bridge_snapshot_interval_ticks: z.number().int().default(10),
	vault_sync_debounce_ms: z.number().int().default(2000),
	llm: withDefaults(GameLLMConfigSchema),
	formulas: withDefaults(FormulasConfigSchema),
	bt: withDefaults(BTConfigSchema),
	agent_creation: withDefaults(AgentCreationConfigSchema),
	world_health: withDefaults(WorldHealthConfigSchema),
	social: withDefaults(SocialConfigSchema),
	jobs: withDefaults(JobsConfigSchema),
	quests: withDefaults(QuestsConfigSchema),
	items: z.record(z.string(), z.object({
		name: z.string().default(''),
		baseValue: z.number().default(0),
		maxCharges: z.number().optional(),
	})).default({
		equipment: { name: 'Equipment', baseValue: 10, maxCharges: 5 },
		tools: { name: 'Tools', baseValue: 8, maxCharges: 5 },
		waterskin: { name: 'Waterskin', baseValue: 3, maxCharges: 3 },
	}),
	commitment_ticks: z.record(z.string(), z.number()).default({}),
	rest_day_interval: z.number().int().min(1).default(7),
	leisure_mood_threshold: z.number().default(-20),
	sleep_debt_max: z.number().default(100),
	min_rest_ticks: z.number().default(80),
	debug: z.boolean().default(false),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
