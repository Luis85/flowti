/**
 * TrailBuffer
 *
 * Manages particle trail history for visualization.
 * Optimized for batch updates to minimize per-particle overhead.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TrailData {
	positions: Float32Array; // N * trailLen * 3
	heat: Float32Array;      // N * trailLen
}

// ─────────────────────────────────────────────────────────────
// TrailBuffer
// ─────────────────────────────────────────────────────────────

export class TrailBuffer {
	readonly particleCount: number;
	readonly trailLen: number;

	/** Packed trail positions: [p0_t0_xyz, p0_t1_xyz, ..., p1_t0_xyz, ...] */
	readonly positions: Float32Array;

	/** Heat values per trail point */
	readonly heat: Float32Array;

	// Precomputed sizes for batch operations
	private readonly trailLen3: number;      // trailLen * 3
	private readonly lastOffset3: number;    // (trailLen - 1) * 3
	private readonly lastOffset: number;     // trailLen - 1

	constructor(particleCount: number, trailLen: number) {
		this.particleCount = Math.max(0, Math.floor(particleCount));
		this.trailLen = Math.max(1, Math.floor(trailLen));

		const totalPoints = this.particleCount * this.trailLen;
		this.positions = new Float32Array(totalPoints * 3);
		this.heat = new Float32Array(totalPoints);

		// Precompute for hot path
		this.trailLen3 = this.trailLen * 3;
		this.lastOffset3 = (this.trailLen - 1) * 3;
		this.lastOffset = this.trailLen - 1;
	}

	/**
	 * Initialize all trail points for a particle to the same position.
	 */
	init(particleIndex: number, x: number, y: number, z: number): void {
		const posBase = particleIndex * this.trailLen3;
		const heatBase = particleIndex * this.trailLen;

		for (let k = 0; k < this.trailLen; k++) {
			const offset = posBase + k * 3;
			this.positions[offset] = x;
			this.positions[offset + 1] = y;
			this.positions[offset + 2] = z;
			this.heat[heatBase + k] = 0;
		}
	}

	/**
	 * Batch update: push new positions for ALL particles at once.
	 * Much faster than individual push() calls.
	 *
	 * @param x - X positions array (length >= count)
	 * @param y - Y positions array (length >= count)
	 * @param z - Z positions array (length >= count)
	 * @param particleHeat - Heat values array (length >= count)
	 * @param count - Number of particles to update
	 */
	pushAll(
		x: Float32Array,
		y: Float32Array,
		z: Float32Array,
		particleHeat: Float32Array,
		count: number
	): void {
		const positions = this.positions;
		const heat = this.heat;
		const trailLen3 = this.trailLen3;
		const trailLen = this.trailLen;
		const lastOffset3 = this.lastOffset3;
		const lastOffset = this.lastOffset;

		for (let i = 0; i < count; i++) {
			const posBase = i * trailLen3;
			const heatBase = i * trailLen;

			// Shift older entries using copyWithin (native, fast)
			positions.copyWithin(posBase, posBase + 3, posBase + trailLen3);
			heat.copyWithin(heatBase, heatBase + 1, heatBase + trailLen);

			// Write newest at end
			const endPos = posBase + lastOffset3;
			positions[endPos] = x[i];
			positions[endPos + 1] = y[i];
			positions[endPos + 2] = z[i];

			heat[heatBase + lastOffset] = particleHeat[i];
		}
	}

	/**
	 * Clear all heat values for a particle's trail.
	 */
	clearHeat(particleIndex: number): void {
		const base = particleIndex * this.trailLen;
		const end = base + this.trailLen;
		this.heat.fill(0, base, end);
	}

	/**
	 * Get trail data for snapshot/rendering.
	 */
	getData(): TrailData {
		return {
			positions: this.positions,
			heat: this.heat,
		};
	}
}
