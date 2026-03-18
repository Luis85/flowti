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

	constructor(maxSize = 200) {
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
