import { GameSettings } from "src/settings/types";

export class GameSettingsStore {
	slowAfterSleep = true;
	maxMessages = 100;
	dailyMailChance = 0.35;
	dailySpamChance = 0.8;
	dailyOrderChance = 0.15;
	dailySpam = true;
	dailyMail = true;
	mailLambda = 6;
	mailHardCapPerStep = 6;

	paymentDelayDays = 3;
	paymentJitterDays = 2;
	paymentSuccessChance = 0.98;

	applyFrom(src: Partial<GameSettings>) {
		if (src.slowAfterSleep !== undefined)
			this.slowAfterSleep = src.slowAfterSleep;
		if (src.maxMessages !== undefined) this.maxMessages = src.maxMessages;
		if (src.mailLambda !== undefined) this.mailLambda = src.mailLambda;
		if (src.mailHardCapPerStep !== undefined) this.mailHardCapPerStep = src.mailHardCapPerStep;
		if (src.dailyMailChance !== undefined)
			this.dailyMailChance = src.dailyMailChance;
		if (src.dailySpamChance !== undefined)
			this.dailySpamChance = src.dailySpamChance;
		if (src.dailyOrderChance !== undefined)
			this.dailyOrderChance = src.dailyOrderChance;
		if (src.dailySpam !== undefined) this.dailySpam = src.dailySpam;
		if (src.dailyMail !== undefined) this.dailyMail = src.dailyMail;
		if (src.paymentDelayDays !== undefined)
			this.paymentDelayDays = src.paymentDelayDays;
		if (src.paymentJitterDays !== undefined)
			this.paymentJitterDays = src.paymentJitterDays;
		if (src.paymentSuccessChance !== undefined)
			this.paymentSuccessChance = src.paymentSuccessChance;
	}

	toJSON(): GameSettings {
		return {
			slowAfterSleep: this.slowAfterSleep,
			maxMessages: this.maxMessages,
			dailyMailChance: this.dailyMailChance,
			dailySpamChance: this.dailySpamChance,
			dailyOrderChance: this.dailyOrderChance,
			dailySpam: this.dailySpam,
			dailyMail: this.dailyMail,
			paymentDelayDays: this.paymentDelayDays,
			paymentJitterDays: this.paymentJitterDays,
			paymentSuccessChance: this.paymentSuccessChance,
			mailHardCapPerStep: this.mailHardCapPerStep,
			mailLambda: this.mailLambda,
		};
	}
}
