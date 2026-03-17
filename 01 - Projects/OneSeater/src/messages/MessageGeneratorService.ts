/**
 * MessageGeneratorService
 * - Wählt Templates basierend auf Kontext und Gewichtung
 */

import { DAIL_ARC_MESSAGE_CATALOG } from "./catalogs/DailyArcMessagesCatalog";
import { BUSINESS_DAILY_INBOX_CATALOG } from "./catalogs/DailyBusinessMessagesCatalog";
import { ENTERPRISE_DAILY_INBOX_CATALOG } from "./catalogs/DailyEnterpriseMessagesCatalog";
import { DAILY_MESSAGES_CATALOG } from "./catalogs/DailyMessagesCatalog";
import { OPS_DELIVERY_DAILY_INBOX_CATALOG } from "./catalogs/DailyOpsDeliveryMessagesCatalog";
import { MessageAction, MessageTemplate } from "./types";

// ============================================================================
// Types
// ============================================================================

export type RngFn = () => number;

export type MessageGenContext = {
    minuteOfDay: number;
    isWeekend: boolean;
};

export type ChannelKey =
    | "customer" | "sales" | "finance" | "internal" | "ops"
    | "it" | "hr" | "legal" | "system" | "spam" | "unknown";

export type ChannelBiasConfig = Partial<Record<ChannelKey, number>>;

export interface SelectResult {
    selected: MessageTemplate[];
    debug: {
        poolSize: number;
        produced: number;
        channelBias: Record<ChannelKey, number>;
    };
}

export interface MessageGeneratorOptions {
    rng?: RngFn;
    resolveChannel?: (template: MessageTemplate) => ChannelKey;
    channelBias?: ChannelBiasConfig;
    defaultActions?: readonly MessageAction[];
}

// ============================================================================
// Constants
// ============================================================================

const CHANNELS: readonly ChannelKey[] = [
    "customer", "sales", "finance", "internal", "ops",
    "it", "hr", "legal", "system", "spam", "unknown",
] as const;

const DEFAULT_ACTIONS: readonly MessageAction[] = ["spam", "accept", "delete"] as const;

// ============================================================================
// MessageGeneratorService
// ============================================================================

export class MessageGeneratorService {
    private readonly rng: RngFn;
    private readonly resolveChannel: (template: MessageTemplate) => ChannelKey;
    private readonly channelBias: Record<ChannelKey, number>;
    private readonly defaultActions: readonly MessageAction[];
    private readonly catalog: readonly MessageTemplate[];

    constructor(options: MessageGeneratorOptions = {}) {
        this.rng = options.rng ?? Math.random;
        this.resolveChannel = options.resolveChannel ?? defaultResolveChannel;
        this.channelBias = normalizeBias(options.channelBias);
        this.defaultActions = options.defaultActions ?? DEFAULT_ACTIONS;

        this.catalog = Object.freeze([
            ...DAIL_ARC_MESSAGE_CATALOG,
            ...BUSINESS_DAILY_INBOX_CATALOG,
            ...ENTERPRISE_DAILY_INBOX_CATALOG,
            ...DAILY_MESSAGES_CATALOG,
            ...OPS_DELIVERY_DAILY_INBOX_CATALOG,
        ]);
    }

    /**
     * Select N templates based on context and weighting.
     * No spawn logic - caller decides how many to request.
     */
    public select(
        count: number,
        ctx: MessageGenContext,
        options?: {
            unique?: boolean;
            channelBiasOverride?: ChannelBiasConfig;
        }
    ): SelectResult {
        const unique = options?.unique ?? true;
        const bias = options?.channelBiasOverride
            ? normalizeBias({ ...this.channelBias, ...options.channelBiasOverride })
            : this.channelBias;

        const pool = [...this.catalog];
        const selected: MessageTemplate[] = [];

        const requested = Math.min(count, pool.length);

        for (let i = 0; i < requested; i++) {
            if (pool.length === 0) break;

            const weights = pool.map((tpl) =>
                this.calculateWeight(tpl, ctx, bias)
            );
            const idx = weightedPickIndex(weights, this.rng);

            if (idx < 0) break;

            selected.push(pool[idx]);

            if (unique) {
                pool.splice(idx, 1);
            }
        }

        return {
            selected,
            debug: {
                poolSize: this.catalog.length,
                produced: selected.length,
                channelBias: bias,
            },
        };
    }

    /**
     * Convenience: Select a single template.
     */
    public selectOne(ctx: MessageGenContext): MessageTemplate | undefined {
        return this.select(1, ctx).selected[0];
    }

    /**
     * Merge template actions with default actions.
     */
    public mergeActions(templateActions?: readonly MessageAction[]): MessageAction[] {
        const base = templateActions ?? [];
        const merged = [...base];

        for (const action of this.defaultActions) {
            if (!merged.includes(action)) {
                merged.push(action);
            }
        }

        return merged;
    }

    private calculateWeight(
        template: MessageTemplate,
        ctx: MessageGenContext,
        channelBias: Record<ChannelKey, number>
    ): number {
        const baseWeight = template.weight ?? 1;

        const todFactor = template.soft?.timeOfDayFactor
            ? template.soft.timeOfDayFactor(ctx.minuteOfDay)
            : defaultTimeOfDayFactor(ctx.minuteOfDay);

        const weekendFactor = template.soft?.weekendFactor
            ? template.soft.weekendFactor(ctx.isWeekend)
            : 1.0;

        const channel = this.resolveChannel(template);
        const bias = channelBias[channel] ?? 0;
        const channelMult = 1.0 + bias * 1.2;

        const weight = baseWeight * todFactor * weekendFactor * channelMult;

        return Number.isFinite(weight) && weight > 0 ? weight : 0;
    }

    get catalogSize(): number {
        return this.catalog.length;
    }
}

// ============================================================================
// Utilities (private module scope)
// ============================================================================

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function defaultTimeOfDayFactor(minuteOfDay: number): number {
    const m = clamp(minuteOfDay, 0, 1439);
    if (m < 420) return 0.15;
    if (m < 540) return 0.7;
    if (m < 720) return 1.25;
    if (m < 870) return 1.05;
    if (m < 1020) return 1.15;
    if (m < 1200) return 0.65;
    return 0.25;
}

function weightedPickIndex(weights: number[], rng: RngFn): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return -1;

    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

function normalizeBias(input?: ChannelBiasConfig): Record<ChannelKey, number> {
    const result = {} as Record<ChannelKey, number>;
    for (const c of CHANNELS) result[c] = 0;
    if (!input) return result;

    for (const c of CHANNELS) {
        const v = input[c];
        if (v != null) result[c] = clamp(Number(v), 0, 1);
    }
    return result;
}

function isChannelKey(value: unknown): value is ChannelKey {
    return typeof value === "string" && CHANNELS.includes(value as ChannelKey);
}

function defaultResolveChannel(template: MessageTemplate): ChannelKey {
    const lc = (s: unknown): string => String(s ?? "").toLowerCase();

    if (template.channel && isChannelKey(template.channel)) {
        return template.channel;
    }

    const category = lc(template.category);
    const type = lc(template.type);
    const tags = (template.tags ?? []).map(lc);

    if (category.includes("spam") || type.includes("phish") || tags.includes("spam")) return "spam";
    if (category.includes("finance") || tags.includes("finance") || type.includes("payment")) return "finance";
    if (category.includes("sales") || tags.includes("sales")) return "sales";
    if (category.includes("customer") || type.includes("complain")) return "customer";
    if (category.includes("it") || tags.includes("security")) return "it";
    if (category.includes("hr") || tags.includes("hr")) return "hr";
    if (category.includes("legal") || type.includes("legal")) return "legal";
    if (category.includes("ops") || tags.includes("supplier")) return "ops";
    if (category.includes("system")) return "system";
    if (category.includes("internal")) return "internal";

    return "unknown";
}
