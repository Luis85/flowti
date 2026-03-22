/**
 * sustenance-phrases.ts — Hunger, thirst, eating, and drinking reactive phrases.
 *
 * These fire as thought bubbles when an agent is critically hungry/thirsty,
 * or when they finish using a food/drink station.
 */

export const HUNGER_PHRASES = [
	"My stomach is staging a protest louder than my mechanical keyboard",
	"When's lunch? When was lunch? Did lunch happen without me?",
	"I can smell someone's leftovers from three desks away and I am SUFFERING",
	"Is it just me or does the vending machine glow brighter when you're starving?",
	"Focus... ignore the hunger... the code is nourishment... no it isn't",
	"Should've grabbed something before the standup. Now I'm debugging on empty",
	"Running on empty. My brain is parsing at half speed",
	"You know you're hungry when you start reading variable names as food",
	"Productivity drops sharply at hunger level zero. I am the proof",
	"Did I even eat today? My git log says yes. My stomach says no",
	"I skipped breakfast for 'one more commit' three hours ago",
	"The snack drawer is calling. The snack drawer is SCREAMING",
	"If my stomach growls in standup one more time I'm blaming the mic",
] as const;

export const THIRST_PHRASES = [
	"I'm so parched I can feel the dehydration in my typing speed",
	"Need coffee. Espresso. Double shot. No conversation until it arrives",
	"Where's the nearest water cooler? My kingdom for hydration",
	"My throat is drier than our API documentation",
	"The cold brew in the fridge is speaking to me. Literally whispering my name",
	"Note to self: water is not optional. Water is infrastructure",
	"Hydration is important, they said. I said I'd get to it. I lied",
	"Is the espresso machine free or am I waiting behind another pour-over sermon?",
	"My mouth tastes like stale air and regret",
	"Third coffee and it's not even 10am. New record or a cry for help?",
	"I refuse to believe drip coffee and espresso are the same species",
	"The cold brew hits different at 3pm. It hits like a revelation",
	"Someone brought oat milk. The office is healing",
] as const;

export const EATING_PHRASES = [
	"Mmm, that hits the spot like a perfectly cached query",
	"Much better. I can feel the neurons firing again",
	"Fuel acquired. Systems nominal. Resuming operations",
	"That was exactly what I needed. Food is the original dependency injection",
	"Okay. Fed. Brain online. Show me the broken build",
	"Productivity restored. Serotonin levels rising. All systems go",
	"I'm a completely different person when I'm not starving",
	"Food is the best debugger. I can see the problem clearly now",
	"Why do I always forget that eating makes everything better?",
] as const;

export const DRINKING_PHRASES = [
	"Ahh, the first sip. Nothing else in life compares to this moment",
	"Hydration restored. Clarity returning. The fog lifts",
	"Good coffee today. Like, genuinely good. Who changed the beans?",
	"That's better. Where was I? Oh right, the bug. The bug can wait",
	"The caffeine should hit in about... three... two... there it is",
	"First sip of the morning. This is the real daily standup",
	"Espresso was the right call. Drip was not going to cut it today",
	"Iced coffee in winter is a personality trait and I will not apologize",
	"This cup is doing more for my velocity than any sprint planning ever did",
] as const;

export const STEAL_REACTIONS = [
	"Hey! I called dibs! That's how dibs works!",
	"The cat beat me to the coffee machine. The indignity",
	"Fine, I'll wait. Standing here. Visibly annoyed",
	"Excuse me, that has my name on it. Metaphorically. But still",
	"Sharing is involuntary when your coworker has four legs and zero manners",
	"I was literally three steps away. Three steps!",
	"You have your bowl. That is MY mug. We've discussed this",
	"The audacity. The sheer, caffeinated audacity",
] as const;

export const SHARE_PHRASES = [
	"Here you go, little buddy. Don't tell the others",
	"We can share. You get the crumbs. I get the dignity",
	"Good buddy. Best buddy. You owe me one",
	"Aww, you're hungry too? We're both running on empty huh",
	"Don't tell anyone I'm feeding you at work. HR has opinions",
	"Fine. But just this once. And by once I mean every single time",
	"How could I say no to that face? I literally cannot. It's a problem",
	"Take it. You clearly need it more than my productivity does",
] as const;
