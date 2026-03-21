/**
 * sustenance-phrases.ts — Hunger, thirst, eating, and drinking reactive phrases.
 *
 * These fire as thought bubbles when an agent is critically hungry/thirsty,
 * or when they finish using a food/drink station.
 */

export const HUNGER_PHRASES = [
	"My stomach's growling...",
	"When's lunch?",
	"I could really go for a snack right now",
	"Is it just me or does everything smell like food?",
	"Focus... ignore the hunger... focus...",
	"Should've grabbed something from the snack table",
	"Running on empty here",
	"Brain needs fuel to function",
	"Productivity drops sharply at hunger level zero",
	"Did I even eat today?",
] as const;

export const THIRST_PHRASES = [
	"I'm parched...",
	"Need coffee. Now.",
	"Where's the nearest water cooler?",
	"My throat is so dry",
	"Tea time can't come soon enough",
	"Note to self: drink more water",
	"Hydration is important, they said",
	"Is the coffee machine free?",
	"My mouth tastes like old keyboard",
	"Everything sounds like ice clinking in a glass right now",
] as const;

export const EATING_PHRASES = [
	"Mmm, that hits the spot",
	"Much better!",
	"Fuel acquired. Back to work.",
	"That was exactly what I needed",
	"Okay. Fed. Ready to function again.",
	"Productivity: restored",
] as const;

export const DRINKING_PHRASES = [
	"Ahh, refreshing!",
	"Hydration restored!",
	"Good coffee today",
	"That's better. Where was I?",
	"The caffeine can hit any time now. Any time.",
	"First sip. This is the best part of the day",
] as const;

export const STEAL_REACTIONS = [
	"Hey! That's my spot!",
	"The cat got there first... again",
	"Fine, I'll wait...",
	"Excuse me, that's not for you",
	"Sharing is... involuntary today",
	"I was literally on my way there",
	"You have your bowl. That bowl is not your bowl",
] as const;

export const SHARE_PHRASES = [
	"Here you go, little buddy",
	"We can share",
	"Good boy/girl!",
	"Aww, you're hungry too?",
	"Don't tell anyone I'm feeding you at work",
	"Fine. But just this once",
	"How could I say no to that face",
] as const;
