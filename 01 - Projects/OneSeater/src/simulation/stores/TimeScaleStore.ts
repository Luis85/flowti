export class TimeScaleStore {
	
	multiplier = 1;
	min = 0.1;
	max = 36000;

	set(multiplier: number) {
		const clamped = Math.max(this.min, Math.min(this.max, multiplier));
		this.multiplier = clamped;
	}
}
