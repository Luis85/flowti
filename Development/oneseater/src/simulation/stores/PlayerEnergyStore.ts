export class PlayerEnergyStore {
	energy = 100;
	endurance = 0; // 0..100 (später)
	fatigueMult = 1.0; // Buff/Debuff
	sleepTarget = 80;
	sleepCompleted = false;
	exhaustedSleepStacks = 0;
}
