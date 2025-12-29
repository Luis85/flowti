import type { Vec3, SimulationParams, Obstacle } from "./types";

type Vortex = {
	pos: Vec3;
	strength: number;
	radius: number;
	age: number;
	life: number;
	sign: 1 | -1;
};

export class VortexSystem {
	private vortices: Vortex[] = [];
	private lastSpawnT = 0;
	private flip: 1 | -1 = 1;
	private lastT?: number;

	update(params: SimulationParams, obstacles: Obstacle[], t: number) {
		const dt =
			this.lastT == null
				? 0.016
				: Math.max(0.001, Math.min(0.05, t - this.lastT));
		this.lastT = t;

		for (const v of this.vortices) v.age += dt;
		this.vortices = this.vortices.filter((v) => v.age < v.life);

		// decay existing
		for (const v of this.vortices) v.age += t - (t - 0.016); // keep simple; age += dt is also fine
		this.vortices = this.vortices.filter((v) => v.age < v.life);

		// pick first sphere obstacle as wake source
		const sph = obstacles.find((o) => o.boundingType === "sphere");
		if (!sph) return;

		const wind = params.windSpeed ?? 0;
		const r = Math.max(0.25, sph.boundingSize.x);

		// spawn cadence (faster with more wind)
		const period = Math.max(0.15, 0.55 - wind * 0.03);

		if (t - this.lastSpawnT < period) return;
		this.lastSpawnT = t;

		// alternate sign -> makes the wake look less “static”
		this.flip = this.flip === 1 ? -1 : 1;

		const ox = sph.position.x;
		const oy = sph.position.y;
		const oz = sph.position.z;

		const yOff = r * 0.7 * this.flip;

		this.vortices.push({
			pos: { x: ox + r * 1.4, y: oy + yOff, z: oz },
			strength: Math.max(0.6, wind * 0.8),
			radius: r * 1.2,
			age: 0,
			life: 3.0,
			sign: this.flip,
		});
	}

	sampleVelocity(p: Vec3): Vec3 {
		if (this.vortices.length === 0) return { x: 0, y: 0, z: 0 };

		let vx = 0,
			vy = 0;
		const vz = 0;

		for (const v of this.vortices) {
			const dx = p.x - v.pos.x;
			const dy = p.y - v.pos.y;

			const r2 = dx * dx + dy * dy + 1e-4;
			const falloff = Math.exp(-r2 / (v.radius * v.radius));

			const lifeK = 1 - Math.min(1, v.age / v.life); // 1..0
			const s =
				(v.strength * v.sign * falloff * lifeK) /
				(r2 + v.radius * v.radius);

			vx += -dy * s;
			vy += dx * s;
		}

		return { x: vx, y: vy, z: vz };
	}
}
