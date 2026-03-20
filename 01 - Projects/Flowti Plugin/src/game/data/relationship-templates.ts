/**
 * relationship-templates.ts — Conversation templates per relationship tier.
 *
 * Each tier unlocks additional template pools that overlay the generic social pool.
 * Rival templates replace 30% of normal conversations with bickering.
 */

export interface RelationshipLine {
	readonly text: string;
	readonly weight: number;
}

export const BICKER_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Oh, you're a {opinionB} person? Interesting choice...", weight: 2 },
	{ text: "We are NOT having this debate again", weight: 2 },
	{ text: "I respect your opinion. I just think it's wrong", weight: 2 },
	{ text: "Agree to disagree. Heavily disagree", weight: 1 },
	{ text: "You say {opinionB}, I say {opinionA}. Let's call the whole thing off", weight: 1 },
	{ text: "I knew you'd say that", weight: 1 },
	{ text: "This is our hill and we're both dying on it", weight: 2 },
	{ text: "I've heard your argument. It's still wrong", weight: 1 },
	{ text: "You know what, let's talk about literally anything else", weight: 1 },
	{ text: "One day you'll see the light. Today is not that day", weight: 2 },
	{ text: "Can someone else weigh in? I need backup", weight: 1 },
	{ text: "The audacity of {opinionB}. The absolute audacity", weight: 2 },
	{ text: "Tabs vs spaces was settled years ago. You're on the wrong side", weight: 2 },
	{ text: "You deploy on Fridays? We can't be friends", weight: 2 },
	{ text: "*heavy sigh* Here we go again with {opinionB}", weight: 1 },
	{ text: "I wrote a three-page rebuttal to {opinionB} but deleted it. You're welcome", weight: 2 },
	{ text: "Agree to disagree? No. I just disagree", weight: 1 },
	{ text: "Remember last sprint when {opinionB} caused that outage? I remember", weight: 2 },
	{ text: "I need a third party. Anyone. Literally anyone who agrees {opinionA} is correct", weight: 1 },
	{ text: "The {opinionB} hill is lonely. I hope you packed a lunch", weight: 2 },
	{ text: "This is exactly what happened last time. You said {opinionB}. Things broke", weight: 1 },
	{ text: "I'm not mad. I'm disappointed. There's a difference", weight: 2 },
	{ text: "You know {opinionA} is right. Deep down, you know", weight: 1 },
	{ text: "I'm adding 'convince you about {opinionA}' to next sprint's backlog", weight: 2 },
	{ text: "Fine. Do {opinionB}. But I'm putting it in writing that I warned you", weight: 1 },
];

export const COLLEAGUE_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Good working with you on that", weight: 1 },
	{ text: "Your {domain} perspective always helps", weight: 2 },
	{ text: "We make a solid team on {domain} stuff", weight: 1 },
	{ text: "I've learned a lot working alongside you", weight: 1 },
	{ text: "Your approach to {domain} is really effective", weight: 2 },
	{ text: "Glad we're on the same project", weight: 1 },
	{ text: "We should collaborate more often", weight: 1 },
	{ text: "You always bring good energy to the work", weight: 2 },
	{ text: "That {domain} insight you shared last week? Still thinking about it", weight: 2 },
	{ text: "I'd never thought of {domain} that way before working with you", weight: 1 },
	{ text: "You cover the {domain} gaps I can't — appreciate that", weight: 2 },
	{ text: "Your code reviews on {domain} actually taught me something new", weight: 1 },
	{ text: "The {domain} deliverable came out great. Solid teamwork", weight: 1 },
	{ text: "We balance each other well on the {domain} side", weight: 2 },
	{ text: "I like how you think about {domain} problems differently than I do", weight: 1 },
	{ text: "Honestly, the project is better because you're on {domain}", weight: 2 },
	{ text: "Quick {domain} sync went well. Clean handoff as always", weight: 1 },
	{ text: "We've got a good rhythm going on {domain}. Let's keep it up", weight: 1 },
	{ text: "Your {domain} PR was clean. Made the review easy for once", weight: 2 },
	{ text: "I picked up a few {domain} tricks from watching your approach", weight: 1 },
	{ text: "The way you broke down that {domain} problem was smart", weight: 2 },
	{ text: "When you're on the {domain} work I worry less. That says something", weight: 1 },
];

export const FRIEND_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Remember when we fixed that impossible bug together?", weight: 2 },
	{ text: "You're one of the good ones, you know that?", weight: 2 },
	{ text: "Lunch? Same spot?", weight: 1 },
	{ text: "I saved you a seat", weight: 1 },
	{ text: "You look like you need a break. Coffee's on me", weight: 2 },
	{ text: "Nobody gets my jokes like you do", weight: 1 },
	{ text: "We've been through some builds together", weight: 2 },
	{ text: "If I had to be stuck in a war room, I'd want you there", weight: 2 },
	{ text: "That inside joke from last week? Still funny", weight: 1 },
	{ text: "You and me vs the backlog. Let's go", weight: 1 },
	{ text: "Thanks for having my back in that meeting", weight: 2 },
	{ text: "I trust your judgment more than most", weight: 1 },
	{ text: "I already ordered your usual. Oat milk, no sugar, right?", weight: 2 },
	{ text: "Someone was talking about you in standup. I defended your honor", weight: 2 },
	{ text: "We don't need to talk. We can just sit here and that's fine", weight: 1 },
	{ text: "You remember the deploy that went sideways in February? War stories for life", weight: 2 },
	{ text: "Whenever you're not in the meeting it's noticeably worse", weight: 1 },
	{ text: "I know that face. What broke?", weight: 2 },
	{ text: "The fact that we survived that sprint together says everything", weight: 1 },
	{ text: "You're the first person I ping when things go wrong. That's not nothing", weight: 2 },
	{ text: "I can tell you're stressed without you saying a word. Take five", weight: 1 },
	{ text: "Honestly? You make the hard days bearable", weight: 2 },
	{ text: "I'll hold the fort. Go handle your thing", weight: 1 },
	{ text: "Our slack thread is 90% memes and 10% actual work. Perfect ratio", weight: 2 },
	{ text: "Next time someone says that in a meeting, look at me. We'll know", weight: 1 },
];

export const BEST_FRIEND_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "I was literally about to say the same thing", weight: 2 },
	{ text: "You finish my sentences and I'm not even mad", weight: 2 },
	{ text: "Ride or die, build or crash", weight: 2 },
	{ text: "I'd take a bullet for you. A metaphorical, code-related bullet", weight: 2 },
	{ text: "No one else would understand why that's funny", weight: 1 },
	{ text: "We don't even need to talk. We just know", weight: 1 },
	{ text: "Best partner in code I've ever had", weight: 2 },
	{ text: "If they ever split us up I'm quitting", weight: 2 },
	{ text: "Our vibe is immaculate and I will not apologize", weight: 1 },
	{ text: "Telepathic debugging session?", weight: 1 },
	{ text: "You looked at me. I looked at you. We both saw the bug. No words needed", weight: 2 },
	{ text: "People ask how we communicate so fast. I say we don't — we just know", weight: 2 },
	{ text: "Other pairs wish they had what we have", weight: 1 },
	{ text: "Us against the codebase. Always has been", weight: 2 },
	{ text: "Remember year one? We've come so far it's almost emotional", weight: 1 },
	{ text: "I don't have to explain the context. You were there. You always are", weight: 2 },
	{ text: "You started typing the fix before I finished describing the problem", weight: 2 },
	{ text: "If pair programming had a hall of fame we'd be first ballot", weight: 1 },
	{ text: "I already know what you're about to suggest. And yes, you're right", weight: 2 },
	{ text: "Some bonds are forged in fire. Ours was forged in merge conflicts", weight: 2 },
	{ text: "The new folks don't get our shorthand yet. They will", weight: 1 },
	{ text: "One look and I know you disagree with the architecture. Me too", weight: 2 },
	{ text: "We don't celebrate wins anymore — we just nod. That's how deep it goes", weight: 1 },
	{ text: "You're not just my teammate. You're the reason I stuck around", weight: 2 },
	{ text: "No one else could have survived that refactor with me. Literally no one", weight: 1 },
];

export const AGREEMENT_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Finally, someone with taste! {opinionA} all the way", weight: 2 },
	{ text: "You're a {opinionA} person too? Instant respect", weight: 2 },
	{ text: "I knew I liked you. {opinionA} is clearly the right choice", weight: 1 },
	{ text: "See? Great minds think alike. {opinionA} forever", weight: 1 },
	{ text: "{opinionA} gang rise up", weight: 2 },
	{ text: "We're on the same side and that matters", weight: 1 },
	{ text: "Wait, you also think {opinionA}? Where have you been all my life?", weight: 2 },
	{ text: "That's it — {opinionA} team roster is getting stronger by the day", weight: 1 },
	{ text: "I felt so alone on {opinionA} until right now. This changes everything", weight: 2 },
	{ text: "You just validated my entire worldview with one sentence. {opinionA}", weight: 2 },
	{ text: "Tell them what you told me. About {opinionA}. They need to hear it", weight: 1 },
	{ text: "If more people understood {opinionA} the world would be better. I said what I said", weight: 1 },
	{ text: "Adding you to the {opinionA} group chat immediately", weight: 2 },
	{ text: "{opinionA}. Yes. Thank you. I'm not crazy after all", weight: 2 },
	{ text: "You believe in {opinionA} too? We should start a movement", weight: 1 },
	{ text: "I've been saying {opinionA} for months. Finally, an ally", weight: 1 },
	{ text: "The {opinionA} evidence speaks for itself. Glad you see it too", weight: 1 },
	{ text: "I'm screenshotting this. Proof that someone else supports {opinionA}", weight: 2 },
	{ text: "We should co-present a talk on why {opinionA} is the only answer", weight: 1 },
	{ text: "Two of us now. That's a quorum. {opinionA} wins", weight: 2 },
];

/** Get templates for a relationship tier. */
export function getTemplatesForTier(tier: string): readonly RelationshipLine[] {
	switch (tier) {
		case "rival": return BICKER_TEMPLATES;
		case "colleague": return COLLEAGUE_TEMPLATES;
		case "friend": return FRIEND_TEMPLATES;
		case "best-friend": return BEST_FRIEND_TEMPLATES;
		default: return [];
	}
}
