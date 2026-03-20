/**
 * micro-event-templates.ts — Phrase templates for world micro-events.
 *
 * Every spoken or thought bubble during a micro-event draws from these pools.
 * Add phrases here to extend what agents say during events — no engine changes needed.
 */

export interface EventTemplate {
	readonly text: string;
	readonly weight: number;
}

// ── Standup ──────────────────────────────────────────────────────────

export const STANDUP_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "Quick status update...", weight: 1 },
	{ text: "Yesterday I worked on the {domain} stuff", weight: 2 },
	{ text: "No blockers on my end", weight: 1 },
	{ text: "Making progress on my task", weight: 1 },
	{ text: "I'm about 70% through this one", weight: 1 },
	{ text: "Need to sync with someone on this later", weight: 1 },
	{ text: "Same as yesterday but with more coffee", weight: 2 },
	{ text: "Actually ahead of schedule for once", weight: 2 },
	{ text: "Still debugging that tricky issue", weight: 1 },
	{ text: "I'll wrap this up today, hopefully", weight: 1 },
	{ text: "Pair session helped a lot yesterday", weight: 1 },
	{ text: "Reviewing PRs this morning, then back to coding", weight: 1 },
	{ text: "The tests are finally cooperating", weight: 2 },
	{ text: "Let's keep it short — lots to do today", weight: 1 },
	{ text: "Good momentum, let's keep it going", weight: 1 },
	// --- new ---
	{ text: "I did things. Important things. I think", weight: 2 },
	{ text: "Refactored half the module yesterday — the other half is terrified", weight: 2 },
	{ text: "Spent three hours on a bug that turned out to be a missing comma", weight: 2 },
	{ text: "Honestly? I forgot what I did yesterday. But my git log remembers", weight: 2 },
	{ text: "Wrote seventeen tests. Fourteen pass. We're getting there", weight: 2 },
	{ text: "I'm going to say 'no blockers' because explaining would take the whole standup", weight: 2 },
	{ text: "Reviewed four PRs. Left comments. Made enemies", weight: 2 },
	{ text: "The type system and I had a disagreement. The type system won", weight: 2 },
	{ text: "Working on that refactor. It's like untangling headphones but in code", weight: 1 },
	{ text: "Yesterday was one of those 'delete everything and start over' days", weight: 1 },
	{ text: "Two words: dependency hell. That's my update", weight: 1 },
	{ text: "I'll keep mine short — I'm still writing the code I'm about to talk about", weight: 1 },
	{ text: "Documentation day yesterday. Yes, really. I documented things", weight: 1 },
	{ text: "Made a breakthrough at 11pm. Forgot what it was by morning", weight: 2 },
	{ text: "Same branch, different day", weight: 1 },
];

// ── Deploy success ───────────────────────────────────────────────────

export const DEPLOY_SUCCESS_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "Deploy is green! Ship it!", weight: 2 },
	{ text: "We're live! Nice work everyone", weight: 2 },
	{ text: "Smooth deploy. Love to see it", weight: 1 },
	{ text: "Green across the board. Beautiful", weight: 1 },
	{ text: "Deployed without a hitch!", weight: 2 },
	{ text: "Another successful ship day", weight: 1 },
	{ text: "Zero rollbacks. That's the dream", weight: 2 },
	{ text: "CI/CD came through. Chef's kiss", weight: 1 },
	{ text: "Celebration-worthy deploy right there", weight: 1 },
	{ text: "And it's live! Time for a victory lap", weight: 2 },
	{ text: "Clean deploy. The pipeline gods are pleased", weight: 2 },
	{ text: "Ship it and forget it. Wait no — monitor it", weight: 1 },
	// --- new ---
	{ text: "WE DID IT. WE ACTUALLY DID IT", weight: 2 },
	{ text: "Nobody touch anything", weight: 2 },
	{ text: "Quietly celebrates at desk", weight: 2 },
	{ text: "Thanks to everyone who reviewed. You saved us from myself", weight: 2 },
	{ text: "I'm going to pretend I wasn't nervous the whole time", weight: 1 },
	{ text: "Shipped on a Friday. Living dangerously", weight: 2 },
	{ text: "That deploy was so smooth I don't trust it", weight: 2 },
	{ text: "The dashboards are green. I repeat: the dashboards are GREEN", weight: 1 },
	{ text: "Somebody ring the deploy bell", weight: 1 },
	{ text: "Feature flag flipped. Users are getting the goods", weight: 1 },
	{ text: "First deploy in production with zero Slack alerts. Emotional", weight: 2 },
	{ text: "I'm superstitious now. Everyone stay exactly where you are", weight: 2 },
	{ text: "That one's going in the deployment hall of fame", weight: 1 },
	{ text: "Metrics look healthy. I can finally blink", weight: 1 },
	{ text: "Adding 'shipped it' to my resume right now", weight: 1 },
	{ text: "This calls for a celebratory snack", weight: 1 },
	{ text: "Do I hear confetti? No? Just me?", weight: 2 },
	{ text: "Deployed before lunch. Rest of the day is bonus time", weight: 1 },
];

// ── End of day ───────────────────────────────────────────────────────

export const END_OF_DAY_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "Wrapping up for the day...", weight: 1 },
	{ text: "Good day's work. Time to wind down", weight: 1 },
	{ text: "Pushing my last commit before EOD", weight: 2 },
	{ text: "See everyone tomorrow!", weight: 1 },
	{ text: "Logging off. Don't break anything while I'm gone", weight: 2 },
	{ text: "That was a productive cycle", weight: 1 },
	{ text: "Done for the day. Brain is officially off", weight: 2 },
	{ text: "Tomorrow's problem is tomorrow's problem", weight: 1 },
	{ text: "Calling it. Good work today, team", weight: 1 },
	{ text: "One more look at the board... nope, I'm done", weight: 2 },
	{ text: "Save, commit, close laptop. In that order", weight: 1 },
	{ text: "Time flies when you're shipping features", weight: 1 },
	// --- new ---
	{ text: "My cat is going to judge me for being late again", weight: 2 },
	{ text: "I've been watching the clock for an hour. Freedom at last", weight: 2 },
	{ text: "Five more minutes... okay ten... okay I'm staying", weight: 2 },
	{ text: "Tomorrow I'm tackling that refactor. For real this time", weight: 2 },
	{ text: "I could keep going but my brain has other plans", weight: 1 },
	{ text: "Leaving the code better than I found it. Mostly", weight: 1 },
	{ text: "Stashing my changes because I don't trust this commit yet", weight: 1 },
	{ text: "Left some breadcrumbs in the comments so morning-me can follow", weight: 2 },
	{ text: "That's a wrap. Dinner isn't going to cook itself", weight: 1 },
	{ text: "I just realized I forgot to eat lunch. Again", weight: 2 },
	{ text: "Setting a reminder to NOT check Slack after 6pm", weight: 1 },
	{ text: "Leaving the build running overnight. Wish it luck", weight: 1 },
	{ text: "Mentally closing all my browser tabs", weight: 2 },
	{ text: "Going home. If production breaks, I saw nothing", weight: 2 },
	{ text: "I'll finish this thought in the shower like a normal person", weight: 1 },
	{ text: "Signed off before anyone can ask for 'one quick thing'", weight: 2 },
	{ text: "Good stopping point. Or at least a stopping point", weight: 1 },
	{ text: "Tomorrow is going to be a good day. I've prepped everything", weight: 1 },
];

// ── Eureka moment ────────────────────────────────────────────────────

export const EUREKA_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "Wait... I've got it!", weight: 2 },
	{ text: "OH. That's it. That's the solution!", weight: 2 },
	{ text: "Everything just clicked!", weight: 2 },
	{ text: "I can't believe I didn't see it sooner", weight: 1 },
	{ text: "The answer was right in front of me", weight: 1 },
	{ text: "YES! This is going to work", weight: 2 },
	{ text: "Breakthrough! The pieces fit!", weight: 2 },
	{ text: "Lightbulb moment. Hold on, let me write this down", weight: 1 },
	{ text: "I just had the best idea", weight: 1 },
	{ text: "It all makes sense now", weight: 2 },
	{ text: "Why didn't I think of this earlier?!", weight: 1 },
	{ text: "THIS is the approach. I can feel it", weight: 2 },
	// --- new ---
	{ text: "It was a typo. It was always a typo", weight: 2 },
	{ text: "I need to tell someone right now. Anyone. You. Listen", weight: 2 },
	{ text: "Hold on... hold on... YES. YES!", weight: 2 },
	{ text: "Wait. No. Wait. Actually yes. YES!", weight: 2 },
	{ text: "The bug wasn't a bug. It was a feature I didn't understand yet", weight: 2 },
	{ text: "Three days. Three days for a one-character fix. I'm not okay", weight: 2 },
	{ text: "Rubber duck debugging strikes again", weight: 1 },
	{ text: "I literally explained it to myself out loud and then got it", weight: 1 },
	{ text: "Okay so what if we just... *scribbles furiously*", weight: 2 },
	{ text: "The tests were right all along. I was the bug", weight: 2 },
	{ text: "It hit me in the shower this morning", weight: 1 },
	{ text: "I just deleted 200 lines and everything works better", weight: 1 },
	{ text: "Oh no. Oh no no no. I've been overthinking this for days", weight: 2 },
	{ text: "Read the error message. Actually read it. There it is", weight: 1 },
	{ text: "The solution was in the docs the whole time. THE DOCS", weight: 2 },
	{ text: "My subconscious was working on this while I slept", weight: 1 },
	{ text: "I'm going to write this down before the clarity fades", weight: 1 },
	{ text: "Accidentally solved it while fixing something else", weight: 2 },
];

// ── Build break ──────────────────────────────────────────────────────

export const BUILD_BREAK_REACTION_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "Uh oh...", weight: 1 },
	{ text: "Something broke", weight: 1 },
	{ text: "That doesn't look right", weight: 1 },
	{ text: "Who pushed?", weight: 2 },
	{ text: "The build is red", weight: 1 },
	{ text: "Not again...", weight: 2 },
	{ text: "Checking the logs...", weight: 1 },
	{ text: "Deep breaths everyone", weight: 1 },
	{ text: "This is fine. Everything is fine", weight: 2 },
	{ text: "I had a bad feeling about that last merge", weight: 1 },
	{ text: "Alert alert alert", weight: 1 },
	{ text: "Hold all deploys", weight: 2 },
	// --- new ---
	{ text: "I'm not saying who did it, but they know", weight: 2 },
	{ text: "Checking git blame... for academic purposes only", weight: 2 },
	{ text: "Was it a missing semicolon? It's always a missing semicolon", weight: 2 },
	{ text: "Someone forgot to push their other file", weight: 1 },
	{ text: "The merge conflict won", weight: 2 },
	{ text: "Looks like someone was on the wrong branch", weight: 1 },
	{ text: "I just got here and it was already broken. For the record", weight: 2 },
	{ text: "Deploying on a Friday. We talked about this", weight: 2 },
	{ text: "Reading the stack trace... this is going to be a long one", weight: 1 },
	{ text: "CI is crying. Understandable", weight: 2 },
	{ text: "Okay. Remain calm. We've been through worse. I think", weight: 1 },
	{ text: "The test that was 'temporarily' skipped? It was important", weight: 2 },
	{ text: "My local build works, so it's not my problem. Right?", weight: 2 },
	{ text: "Did anyone run the tests before pushing? Anyone?", weight: 1 },
	{ text: "Pouring coffee. This might take a while", weight: 1 },
	{ text: "The pipeline has opinions today", weight: 1 },
	{ text: "Main is red. Nobody panic. I said DON'T panic", weight: 2 },
	{ text: "Interesting. That's one word for it", weight: 1 },
];

export const BUILD_BREAK_RESOLVE_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "Fixed it. We're back.", weight: 2 },
	{ text: "Crisis averted. Just a typo", weight: 2 },
	{ text: "Patched and pushed. Green again", weight: 1 },
	{ text: "Found it — one-liner fix", weight: 1 },
	{ text: "Build is back. That was a quick one", weight: 2 },
	{ text: "All clear. Carry on", weight: 1 },
	{ text: "Resolved. Let's pretend that didn't happen", weight: 2 },
	{ text: "Back to green. My heart rate is normalizing", weight: 2 },
	{ text: "Hotfix deployed. We're good", weight: 1 },
	{ text: "False alarm... well, real alarm, but it's fixed now", weight: 1 },
	// --- new ---
	{ text: "It was a missing import. Just a missing import", weight: 2 },
	{ text: "Turns out 'undefined' is not a valid config value. Who knew", weight: 2 },
	{ text: "Fixed by reverting the revert of the revert", weight: 2 },
	{ text: "Sorted. Adding a test so this never happens again", weight: 1 },
	{ text: "The fix was embarrassingly simple. Moving on", weight: 2 },
	{ text: "Someone's node_modules were haunted. Fresh install fixed it", weight: 2 },
	{ text: "Found the culprit. It was me. I was the culprit", weight: 2 },
	{ text: "Root cause: a trailing comma in JSON. Computers, man", weight: 1 },
	{ text: "We're green. Nobody push anything for five minutes", weight: 2 },
	{ text: "Cache was stale. Cleared it. Life goes on", weight: 1 },
	{ text: "Merged the fix. Build is recovering. So am I", weight: 1 },
	{ text: "Postmortem: we should probably have a staging environment", weight: 1 },
	{ text: "env variable was wrong. Classic", weight: 1 },
	{ text: "Fixed in 4 minutes. The investigation took 40 though", weight: 2 },
	{ text: "Green again. I need a walk", weight: 1 },
	{ text: "Order restored. Let us never speak of this again", weight: 2 },
	{ text: "That was character-building. For all of us", weight: 1 },
	{ text: "Back online. Adding this to the incident retrospective", weight: 1 },
	{ text: "It's always DNS. Except this time. This time it was permissions", weight: 2 },
	{ text: "Cleaned up, tests passing, PR merged. We're back baby", weight: 1 },
];

// ── Birthday ─────────────────────────────────────────────────────────

export const BIRTHDAY_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "Wait, is that cake?!", weight: 2 },
	{ text: "Happy birthday to me? You shouldn't have!", weight: 2 },
	{ text: "Cake in the office! Best day ever", weight: 1 },
	{ text: "I love surprise celebrations!", weight: 1 },
	{ text: "Is this because I've been working so hard?", weight: 2 },
	{ text: "This makes up for that production bug last week", weight: 2 },
	{ text: "I'm not crying, you're crying", weight: 1 },
	{ text: "The team remembered! I'm touched", weight: 1 },
	{ text: "Cake solves everything, including my mood", weight: 2 },
	{ text: "Best surprise since that zero-bug release", weight: 1 },
	// --- new ---
	{ text: "It's NOT my birthday. ...Okay fine it is. Thank you", weight: 2 },
	{ text: "Chocolate or vanilla? Trick question — I want both", weight: 2 },
	{ text: "I specifically asked for no fuss. This is the right amount of fuss", weight: 2 },
	{ text: "How did you know my birthday? ...Oh right, it's in the HR system", weight: 1 },
	{ text: "A year older, a year wiser. My commit history says otherwise", weight: 2 },
	{ text: "I'm the same age as my IDE. We're vintage", weight: 1 },
	{ text: "The only day I don't mind merge conflicts — there's cake", weight: 2 },
	{ text: "This is better than any Jira ticket being resolved", weight: 2 },
	{ text: "I asked for a bug-free release for my birthday but cake works too", weight: 2 },
	{ text: "Save me a corner piece. I'm serious", weight: 1 },
	{ text: "First the birthday, then back to breaking things", weight: 1 },
	{ text: "Year after year, the candles increase but the sprint capacity doesn't", weight: 2 },
	{ text: "I'm going to eat cake and pretend deploys don't exist for an hour", weight: 1 },
	{ text: "Thank you all. Even the person who approved that sketchy PR yesterday", weight: 2 },
	{ text: "Another trip around the sun and I still can't center a div", weight: 2 },
	{ text: "If anyone sings, I'm pushing to production during the chorus", weight: 2 },
	{ text: "Best birthday present would be zero Slack notifications. Second best is cake", weight: 1 },
	{ text: "This team. Seriously. You're the best", weight: 1 },
	{ text: "Making a wish... please let the tests pass tomorrow", weight: 2 },
	{ text: "You really didn't have to! But I'm very glad you did", weight: 1 },
];

// ── Power flicker ────────────────────────────────────────────────────

export const POWER_FLICKER_REACTION_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "?", weight: 1 },
	{ text: "Did the lights just flicker?", weight: 2 },
	{ text: "What was that?", weight: 1 },
	{ text: "Please tell me I didn't lose my work", weight: 2 },
	{ text: "Ctrl+S. Ctrl+S. Ctrl+S.", weight: 2 },
	{ text: "Ominous", weight: 1 },
	{ text: "That's not normal", weight: 1 },
	{ text: "My screen just blinked", weight: 1 },
	// --- new ---
	{ text: "I JUST had unsaved changes. I just had UNSAVED CHANGES", weight: 2 },
	{ text: "And this is why I commit every five minutes", weight: 2 },
	{ text: "Checking if the servers are still alive...", weight: 1 },
	{ text: "The UPS better be earning its keep right now", weight: 2 },
	{ text: "Someone check the server room", weight: 1 },
	{ text: "This is how horror movies start", weight: 2 },
	{ text: "I don't like this. I don't like this at all", weight: 1 },
	{ text: "Quick, everybody save your work!", weight: 1 },
	{ text: "Is it just us or is this building-wide?", weight: 1 },
	{ text: "My autosave interval better have been short enough", weight: 2 },
	{ text: "Already pulling up the infrastructure dashboard", weight: 1 },
	{ text: "If we lose power I'm going to the coffee shop", weight: 2 },
	{ text: "This is a sign. Of what, I'm not sure", weight: 1 },
	{ text: "I bet the build server is having a great time right now", weight: 2 },
	{ text: "Generator, don't fail me now", weight: 1 },
	{ text: "One flicker I can ignore. Two and I'm packing up", weight: 1 },
	{ text: "The cloud doesn't care about your local power grid. But I do", weight: 2 },
	{ text: "Saving everything to remote. Trust nothing local right now", weight: 1 },
	{ text: "I literally just started a database migration", weight: 2 },
	{ text: "Great. Love this. Love losing work. Very cool", weight: 2 },
	{ text: "Excuse me while I push every uncommitted change immediately", weight: 1 },
	{ text: "My laptop's on battery so I'm fine. Mentally? Less fine", weight: 2 },
];

export const POWER_FLICKER_RESOLVE_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "Just a blip. All good", weight: 2 },
	{ text: "False alarm. Power's stable", weight: 1 },
	{ text: "Crisis averted. The server lives", weight: 2 },
	{ text: "Checked the UPS — we're fine", weight: 1 },
	{ text: "It was nothing. Probably. Hopefully", weight: 2 },
	{ text: "Back to normal. My heart isn't though", weight: 1 },
	// --- new ---
	{ text: "All systems nominal. I've aged three years in ten seconds", weight: 2 },
	{ text: "Verified — nothing was lost. This time", weight: 2 },
	{ text: "Power's back. Time to configure more aggressive autosave", weight: 1 },
	{ text: "Server room says everything's fine. I choose to believe them", weight: 2 },
	{ text: "Checked every service. We're green. Deep breath", weight: 1 },
	{ text: "Apparently it was a squirrel on the transformer. Classic", weight: 2 },
	{ text: "UPS did its job. Good UPS. Best purchase ever", weight: 1 },
	{ text: "Facilities says it won't happen again. Sure", weight: 2 },
	{ text: "All clear. Adding 'survive power outage' to my standup tomorrow", weight: 1 },
	{ text: "Git push completed before the flicker. Lucky", weight: 2 },
	{ text: "Database migration survived intact. I may not have", weight: 2 },
	{ text: "Everything's fine but I'm saving every 30 seconds for the rest of the day", weight: 1 },
	{ text: "Backups verified. Paranoia justified and then resolved", weight: 1 },
	{ text: "We're good. Setting up that redundant power supply I've been putting off", weight: 1 },
	{ text: "Power stable again. My trust in the electrical grid is not", weight: 2 },
	{ text: "Disaster recovery plan: don't have unsaved work. Noted", weight: 1 },
	{ text: "All processes still running. Today we are blessed", weight: 1 },
	{ text: "Nothing lost. But I'm going to git commit every single file right now", weight: 2 },
];

// ── New PR ───────────────────────────────────────────────────────────

export const NEW_PR_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "New PR ready for review", weight: 1 },
	{ text: "Just opened a PR — who's got eyes?", weight: 2 },
	{ text: "PR is up. Please be gentle", weight: 2 },
	{ text: "Ready for review. Pretty proud of this one", weight: 1 },
	{ text: "Opened a PR. It's smaller than it looks", weight: 2 },
	{ text: "Code review time! Fresh PR incoming", weight: 1 },
	{ text: "PR submitted. Now we wait", weight: 1 },
	{ text: "This one's ready. Clean diff, good tests", weight: 2 },
	{ text: "Just pushed — take a look when you can", weight: 1 },
	{ text: "Review requested. I promise it's not 500 lines", weight: 2 },
	// --- new ---
	{ text: "It says 'one-liner' in the title. Don't look at the file count", weight: 2 },
	{ text: "Nervously hits 'Create Pull Request'. There's no going back", weight: 2 },
	{ text: "PR description is longer than the code change. As it should be", weight: 2 },
	{ text: "Requesting reviewers... specifically NOT the person who'll nitpick my naming", weight: 2 },
	{ text: "Draft PR for now. Still polishing. Don't judge the TODOs", weight: 1 },
	{ text: "This is the cleanest PR I've ever written. Screenshot it", weight: 2 },
	{ text: "Three commits. Could've been one but I like telling a story", weight: 1 },
	{ text: "Added tests before you ask. Yes, all edge cases. Mostly", weight: 2 },
	{ text: "PR is up. Hoping for approvals, expecting 47 comments", weight: 2 },
	{ text: "Changes: +2, -847. You're welcome", weight: 2 },
	{ text: "Please review before I lose the context of what I did", weight: 1 },
	{ text: "Fair warning: this one touches the config files", weight: 1 },
	{ text: "The diff is green. Net negative lines. Today is a good day", weight: 1 },
	{ text: "I wrote the PR description with my future self in mind", weight: 1 },
	{ text: "Opened the PR and immediately found something to fix. Classic", weight: 2 },
	{ text: "Tiny PR. In and out. No drama", weight: 1 },
	{ text: "It's behind a feature flag so... what's the worst that can happen?", weight: 2 },
	{ text: "Self-reviewed twice. Still nervous. Help", weight: 2 },
	{ text: "Linking the ticket, adding screenshots, writing notes... look, I care", weight: 1 },
	{ text: "If this gets approved today I'm buying lunch for the reviewer", weight: 1 },
];

// ── Tea time ─────────────────────────────────────────────────────────

export const TEA_TIME_TEMPLATES: readonly EventTemplate[] = [
	// --- original ---
	{ text: "Afternoon caffeine run, anyone?", weight: 2 },
	{ text: "Coffee break! Who's in?", weight: 1 },
	{ text: "That's my cue for a tea refill", weight: 1 },
	{ text: "Need a warm beverage to power through the afternoon", weight: 1 },
	{ text: "Third cup? Fourth? I've lost count", weight: 2 },
	{ text: "The afternoon slump calls for reinforcements", weight: 2 },
	{ text: "Coffee machine, here I come", weight: 1 },
	{ text: "Hot beverage therapy session in progress", weight: 1 },
	// --- new ---
	{ text: "Earl Grey. Hot. I know what I'm about", weight: 2 },
	{ text: "I used to be a coffee person. Tea changed me. I'm at peace now", weight: 2 },
	{ text: "Getting everyone's order — who wants what?", weight: 1 },
	{ text: "Oat milk latte. Don't at me", weight: 2 },
	{ text: "The 2pm energy cliff is real and caffeine is my climbing gear", weight: 2 },
	{ text: "Matcha today. Feeling fancy. Feeling green", weight: 1 },
	{ text: "Tea bag in, existential dread out. Simple process", weight: 2 },
	{ text: "I judge people by their beverage choices. No I won't elaborate", weight: 2 },
	{ text: "Black coffee. No sugar. Like my deployment logs", weight: 2 },
	{ text: "Making a fresh pot. This is a public service announcement", weight: 1 },
	{ text: "Chamomile because the build break raised my cortisol", weight: 2 },
	{ text: "The kettle is my most reliable piece of hardware", weight: 2 },
	{ text: "Stepping away from the code. Stepping toward the kettle", weight: 1 },
	{ text: "Who emptied the coffee pot and didn't make more? Confess", weight: 2 },
	{ text: "Herbal tea. Yes, I'm that person now. Growth is real", weight: 1 },
	{ text: "This is my 'thinking beverage'. All good ideas start here", weight: 1 },
	{ text: "Bringing back a round for the team. Brace for hot liquids", weight: 1 },
	{ text: "The afternoon isn't going to survive itself. Brew incoming", weight: 1 },
	{ text: "Double espresso. I have mass to push and entropy to fight", weight: 2 },
	{ text: "My mug says 'World's Best Developer'. The mug lies. But I love it", weight: 2 },
	{ text: "Green tea. Because I'm hydrating AND caffeinating. Efficiency", weight: 1 },
	{ text: "Five-minute break. The code will still be broken when I get back", weight: 1 },
];

// ── Picker helper with global dedup ──────────────────────────────────

const GLOBAL_RECENT_SIZE = 30;
const globalRecentPhrases: string[] = [];

/** Pick a random template from a pool using weighted selection, avoiding recently used phrases. */
export function pickTemplate(pool: readonly EventTemplate[]): string {
	const recentSet = new Set(globalRecentPhrases);
	// Filter out recently used, fall back to full pool if all filtered
	const filtered = pool.filter((t) => !recentSet.has(t.text));
	const source = filtered.length > 0 ? filtered : pool;
	const totalWeight = source.reduce((sum, t) => sum + t.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const t of source) {
		roll -= t.weight;
		if (roll <= 0) {
			globalRecentPhrases.push(t.text);
			if (globalRecentPhrases.length > GLOBAL_RECENT_SIZE) globalRecentPhrases.shift();
			return t.text;
		}
	}
	const fallback = source[source.length - 1].text;
	globalRecentPhrases.push(fallback);
	if (globalRecentPhrases.length > GLOBAL_RECENT_SIZE) globalRecentPhrases.shift();
	return fallback;
}
