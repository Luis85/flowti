/**
 * particle-system.ts — Lightweight particle pool for footstep trails and dust puffs.
 * Pure logic — no ExcaliburJS imports. Render adapter in main.ts.
 */

export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	color: string;
	lifetime: number;
	age: number;
	opacity: number;
	startOpacity: number;
	radius: number;
}

export interface SpawnOpts {
	x: number;
	y: number;
	color: string;
	lifetime: number;
	opacity: number;
	radius: number;
	vx?: number;
	vy?: number;
}

export type ParticlePreset = "steam" | "confetti" | "sparkle" | "alert" | "scribble" | "hearts" | "thunder" | "rain" | "sunny" | "embers" | "dust-motes" | "leaf-drift" | "fireplace-sparks";

const PRESET_CONFIGS: Record<ParticlePreset, { count: number; colorRange: string[]; lifetime: number; speed: number; radius: number; spread: number }> = {
	steam:    { count: 6,  colorRange: ["rgba(200,200,220,0.4)"], lifetime: 2000, speed: 20, radius: 1.5, spread: 0.5 },
	confetti: { count: 30, colorRange: ["#ef4444","#3b82f6","#10b981","#f59e0b","#a855f7","#ec4899"], lifetime: 3000, speed: 60, radius: 2, spread: Math.PI * 2 },
	sparkle:  { count: 8,  colorRange: ["rgba(255,220,100,0.5)"], lifetime: 1500, speed: 25, radius: 1, spread: Math.PI * 2 },
	alert:    { count: 4,  colorRange: ["rgba(239,68,68,0.6)"], lifetime: 500, speed: 80, radius: 3, spread: Math.PI * 2 },
	scribble: { count: 8,  colorRange: ["#3b82f6","#10b981","#f59e0b"], lifetime: 3000, speed: 15, radius: 1.5, spread: 1 },
	hearts:   { count: 3,  colorRange: ["rgba(244,114,182,0.6)"], lifetime: 800, speed: 20, radius: 2, spread: 0.8 },
	thunder:  { count: 5,  colorRange: ["rgba(120,120,140,0.5)"], lifetime: 2000, speed: 10, radius: 2.5, spread: 0.6 },
	rain:     { count: 1,  colorRange: ["rgba(150,170,220,0.4)"], lifetime: 1500, speed: 120, radius: 0.5, spread: 0.3 },
	sunny:    { count: 1,  colorRange: ["rgba(255,220,100,0.3)"], lifetime: 2000, speed: 15, radius: 1, spread: Math.PI * 2 },
	embers:   { count: 2,  colorRange: ["rgba(255,140,50,0.4)", "rgba(255,100,30,0.3)"], lifetime: 3000, speed: 8, radius: 1, spread: 0.8 },
	"dust-motes": { count: 1, colorRange: ["rgba(255,220,150,0.2)"], lifetime: 4000, speed: 3, radius: 0.5, spread: Math.PI * 2 },
	"leaf-drift": { count: 1, colorRange: ["rgba(100,160,60,0.3)", "rgba(140,120,60,0.3)"], lifetime: 5000, speed: 5, radius: 1.5, spread: 0.5 },
	"fireplace-sparks": { count: 1, colorRange: ["rgba(255,180,50,0.5)", "rgba(255,120,30,0.4)"], lifetime: 1500, speed: 15, radius: 0.5, spread: 0.4 },
};

const DUST_COUNT_MIN = 4;
const DUST_COUNT_MAX = 6;
const DUST_SPEED_MIN = 30;
const DUST_SPEED_MAX = 60;
const DUST_LIFETIME = 800;
const TRAIL_LIFETIME = 2000;
const TRAIL_OPACITY_WANDER = 0.3;
const TRAIL_OPACITY_WALK = 0.6;

export class ParticlePool {
	private readonly particles: Particle[] = [];
	private readonly maxSize: number;

	constructor(maxSize = 400) {
		this.maxSize = maxSize;
	}

	get active(): number {
		return this.particles.length;
	}

	spawn(opts: SpawnOpts): void {
		if (this.particles.length >= this.maxSize) {
			this.particles.shift();
		}
		this.particles.push({
			x: opts.x,
			y: opts.y,
			vx: opts.vx ?? 0,
			vy: opts.vy ?? 0,
			color: opts.color,
			lifetime: opts.lifetime,
			age: 0,
			opacity: opts.opacity,
			startOpacity: opts.opacity,
			radius: opts.radius,
		});
	}

	spawnTrail(x: number, y: number, color: string, isPurposeful: boolean): void {
		this.spawn({
			x, y, color,
			lifetime: TRAIL_LIFETIME,
			opacity: isPurposeful ? TRAIL_OPACITY_WALK : TRAIL_OPACITY_WANDER,
			radius: 1,
		});
	}

	spawnPreset(preset: ParticlePreset, x: number, y: number): void {
		const cfg = PRESET_CONFIGS[preset];
		for (let i = 0; i < cfg.count; i++) {
			const angle = (Math.random() - 0.5) * cfg.spread;
			const speed = cfg.speed * (0.7 + Math.random() * 0.6);
			const color = cfg.colorRange[Math.floor(Math.random() * cfg.colorRange.length)];
			this.spawn({
				x: x + (Math.random() - 0.5) * 10,
				y: y + (Math.random() - 0.5) * 10,
				vx: Math.sin(angle) * speed,
				vy: -Math.cos(angle) * speed,
				color,
				lifetime: cfg.lifetime * (0.8 + Math.random() * 0.4),
				opacity: 0.6 + Math.random() * 0.4,
				radius: cfg.radius,
			});
		}
	}

	spawnDustBurst(x: number, y: number, color: string): void {
		const count = DUST_COUNT_MIN + Math.floor(Math.random() * (DUST_COUNT_MAX - DUST_COUNT_MIN + 1));
		for (let i = 0; i < count; i++) {
			const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
			const speed = DUST_SPEED_MIN + Math.random() * (DUST_SPEED_MAX - DUST_SPEED_MIN);
			this.spawn({
				x, y, color,
				lifetime: DUST_LIFETIME,
				opacity: 0.6,
				radius: 1.5,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
			});
		}
	}

	update(deltaMs: number): void {
		const deltaSec = deltaMs / 1000;
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.age += deltaMs;
			if (p.age >= p.lifetime) {
				this.particles.splice(i, 1);
				continue;
			}
			p.x += p.vx * deltaSec;
			p.y += p.vy * deltaSec;
			p.opacity = p.startOpacity * (1 - p.age / p.lifetime);
		}
	}

	getAll(): readonly Particle[] {
		return this.particles;
	}

	clear(): void {
		this.particles.length = 0;
	}
}
