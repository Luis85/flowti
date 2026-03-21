/**
 * social-system.ts — Proximity conversation detection between related agents.
 * Pure logic — no ExcaliburJS imports. Render adapter in main.ts.
 */

import type { BrainState } from "../brain/brain-types.js";

export interface SocialAgent {
	readonly socialRadius: number;
	readonly personality: readonly string[];
	readonly domain: string;
	readonly relationships: readonly { target: string; type: string }[];
}

interface SocialEntry extends SocialAgent {
	proximityTimers: Map<string, number>;
}

const PROXIMITY_THRESHOLD_MS = 4000;
const PAIR_COOLDOWN_MS = 60000;
const IDLE_STATES: readonly BrainState[] = ["idle", "on-break", "waiting"];

const CLUSTER_THRESHOLD_MS = 6000;
const CLUSTER_COOLDOWN_MS = 180000;
const CLUSTER_MIN_SIZE = 3;
const CLUSTER_MIN_FOCUS = 20;

type ConversationCallback = (agentA: string, agentB: string, lineA: string, lineB: string) => void;
type ClusterCallback = (members: string[]) => void;

interface AgentNeeds {
	readonly energy: number;
	readonly social: number;
	readonly focus: number;
	readonly morale: number;
}

const CONVERSATION_LINES: Record<string, readonly string[]> = {
	engineering: [
		"The build looks good today.", "Have you seen the latest test results?", "This architecture is clean.",
		"The pipeline is green.", "That refactor paid off.", "Coverage is looking solid.", "Clean commit history.",
		"Types are catching things early.", "The linter is happy.", "That's a nice abstraction.",
		"I love when the tests just pass.", "This module is getting tight.", "Zero warnings. Beautiful.",
		"The dependency graph is clean.", "That PR review was thorough.", "Good naming on that function.",
		"I refactored that whole module yesterday.", "The error handling is solid here.",
		"Immutability saves lives.", "Pure functions, pure joy.", "That was a one-line fix. The best kind.",
		"I think we can simplify this.", "The compiler is our friend.",
		"Wanna pair on this one?", "That generic type is doing heavy lifting.",
		"I just deleted 200 lines. Felt amazing.", "The API surface is nice and small.",
		"You ever just stare at a diff and smile?", "Who wrote this? Oh wait, that was me.",
		"I finally get monads. I think.", "This deserves a proper code review.",
		"The tree-shaking saved us 40kb.", "Deadlock-free and loving it.",
		"This interface is chef's kiss.", "Tail call optimization for the win.",
		"Hot take: tabs are better.", "The stack trace actually makes sense.",
		"I mapped it, filtered it, reduced it. Done.", "Enums or union types? Let's debate.",
		"That race condition was sneaky.", "Look at this before-and-after. Night and day.",
		"Memoization cut the render time in half.", "No side effects in this whole module.",
		"The generics infer perfectly now.", "Strict mode catches everything.",
		"Async iterators are underrated.", "That barrel export keeps things tidy.",
		"Watch me make this compile on the first try.", "The cache invalidation is elegant.",
		"This pattern composes beautifully.", "I documented the tricky parts.",
		"That fix was two characters. Two.", "Bundle size is trending down.",
		"The migration script ran clean.", "Lazy loading sped things up a lot.",
		"I love a well-scoped PR.", "The type inference is doing the work for us.",
		"No circular imports anymore.", "The retry logic is bulletproof now.",
		"I wrote a test that actually found a bug.", "Readable code is maintainable code.",
		"Check out this before-and-after benchmark.", "The event loop is breathing easy.",
		"This is the cleanest diff I've ever pushed.", "The config parser handles every edge case.",
		"Look, zero runtime dependencies.", "That helper function is so reusable.",
		"Seen the new debugger panel?", "You try the new IDE plugin?",
		"That meeting was something else.", "Solid standup today.",
		"Want to pair on this?", "Got a minute to review?",
		"The coffee machine is broken again.", "Nice weather for coding.",
		"Ever tried rubber duck debugging?", "The profiler found our bottleneck.",
		"That webhook handler is elegant.", "Who added these golden tests?",
		"The schema validator just saved us.", "Node 22 has some nice stuff.",
		"Our error boundaries actually caught it.", "That was a gnarly merge conflict.",
		"I automated the boring part.", "The decorator pattern clicked for me today.",
	],
	design: [
		"The flow feels intuitive now.", "I love how this looks.", "Users will appreciate this.",
		"Nice color choices.", "The spacing feels right.", "Good hierarchy here.", "This layout breathes.",
		"The micro-interactions are smooth.", "Accessibility is on point.", "Elegant solution.",
		"The grid is singing.", "That transition is buttery.", "Whitespace is doing the work here.",
		"The typography is crisp.", "Good contrast ratio.", "Responsive and clean.",
		"I sketched three versions before landing on this.", "The icon set is cohesive.",
		"Design system tokens are paying off.", "This feels delightful to use.",
		"Less chrome, more content.", "The animation timing is just right.",
		"The hover state needs a little love.", "Did you try the dark mode variant?",
		"Padding or margin? Margin.", "That border radius is so satisfying.",
		"I prototyped it in Figma first.", "The empty state tells a story now.",
		"We should A/B test that layout.", "The loading skeleton looks natural.",
		"That gradient is subtle. Perfect.", "The touch targets are generous.",
		"I stole this idea from a cookbook app.", "The onboarding flow is way smoother.",
		"Can you squint-test this real quick?", "Shadow depth says importance.",
		"Two columns or three? Let's try both.", "The brand colors pop without screaming.",
		"Error states need love too.", "That card layout is so scannable.",
		"Font pairing is underrated.", "The scroll behavior feels native.",
		"I spent an hour on just this icon.", "Progressive disclosure for the win.",
		"Mobile-first always pays off.", "The visual rhythm is consistent.",
		"Check the design in grayscale.", "That illustration adds warmth.",
		"I reduced the palette to five colors.", "The CTA really stands out now.",
		"Alignment is everything.", "Kerning matters more than people think.",
		"This modal doesn't feel intrusive.", "The breadcrumb trail is intuitive.",
		"Negative space is doing overtime here.", "Drag and drop feels natural.",
		"The status indicators read instantly.", "I tested this with a screen reader.",
		"That toast notification is non-disruptive.", "The tab order makes sense now.",
		"We nailed the information density.", "The focus ring is actually visible.",
		"Skeleton screens over spinners, always.", "This passes WCAG AA easily.",
		"The color system scales to any theme.", "Those subtle animations add polish.",
		"Have you seen the new component library?", "That prototype is clickable now.",
		"The design review went well.", "Good feedback from the usability test.",
		"Want to do a quick design crit?", "Got thoughts on this layout?",
		"Someone refilled the whiteboard markers.", "Love sketching on a rainy day.",
		"That icon library update is solid.", "The motion spec is really clear.",
		"Form validation feedback feels humane.", "Truncation handling looks clean.",
		"The style guide just got easier to use.", "Variable fonts are a game changer.",
		"Hick's law in action right there.", "The design handoff doc is thorough.",
		"Content-first design is paying off.", "That color-blind simulation was eye-opening.",
	],
	product: [
		"The roadmap is shaping up.", "Good progress on the scope.", "Let's review the backlog.",
		"The metrics look promising.", "Stakeholders will like this.", "Priorities are clear now.",
		"The acceptance criteria are tight.", "That scope decision was the right call.",
		"User feedback confirmed our hypothesis.", "The MVP is well-scoped.",
		"That feature flag approach is smart.", "Data is telling a clear story.",
		"The iteration goal is crisp.", "Good alignment across the board.",
		"Let's not overthink this one.", "Ship, measure, iterate.",
		"The customer journey is mapped.", "That's a strong value proposition.",
		"What did the user interviews reveal?", "The funnel is tightening up.",
		"We cut the right features.", "Retention is up week over week.",
		"That beta tester loved it.", "Let's revisit the persona.",
		"The competitive landscape shifted.", "Activation rate is climbing.",
		"Did you see that NPS score?", "We're solving a real problem here.",
		"Time to value just dropped.", "The experiment results are in.",
		"Churn is down. That's huge.", "Let's dogfood this ourselves.",
		"The pricing model makes sense now.", "Think bigger on this one.",
		"Three customers asked for this exact thing.", "The discovery phase paid off.",
		"Can we validate that assumption fast?", "The signal is strong from early adopters.",
		"Revenue impact looks significant.", "We need a story for the board.",
		"The north star metric is moving.", "Let's not build what nobody wants.",
		"That pivot was the right call.", "Our power users are vocal. Good.",
		"Onboarding conversion jumped 12%.", "The cohort data is encouraging.",
		"We should talk to more churned users.", "That integration unlocks a new market.",
		"The usage patterns are fascinating.", "Let's simplify the pricing page.",
		"Weekly active users hit a new high.", "Support tickets are trending down.",
		"The product-market fit survey looks great.", "Let's ship a quick win this week.",
		"That customer quote is gold.", "The feature adoption curve is healthy.",
		"We're ahead of the quarterly goal.", "The referral loop is working.",
		"Less features, more polish.", "User delight drives retention.",
		"The competitive moat is widening.", "That workflow saves users ten minutes.",
		"Seen the latest support thread?", "You check the analytics dashboard?",
		"That focus group was enlightening.", "Strong demo today.",
		"Want to review this spec together?", "Got five minutes for a priority check?",
		"The vending machine has new options.", "Perfect day for a brainstorm.",
		"The freemium conversion is climbing.", "Feature parity is almost there.",
		"Our time-to-first-value benchmark improved.", "The launch checklist is looking clean.",
		"That user story maps perfectly.", "Localization is opening new doors.",
		"The in-app guidance reduced tickets.", "Sunset plan is ready to go.",
		"Customer advisory board loved the preview.", "The waitlist is growing fast.",
	],
	management: [
		"Schedule looks on track.", "The team is in good shape.", "Risk register is clean.",
		"Delivery cadence is steady.", "Good velocity this iteration.", "Dependencies are resolved.",
		"The standup was efficient today.", "No impediments on the board.",
		"Resource allocation is balanced.", "The burndown looks healthy.",
		"Retro items are getting actioned.", "Communication is flowing well.",
		"Everyone knows their priorities.", "Capacity is well-distributed.",
		"Stakeholder update went smoothly.", "The process is serving us well.",
		"That was a productive planning session.", "Cross-team alignment is solid.",
		"Budget is tracking under forecast.", "The hiring pipeline is healthy.",
		"One-on-ones are making a difference.", "Team morale is high.",
		"We shipped ahead of schedule. Rare.", "The escalation path is clear.",
		"No scope creep this sprint.", "That conflict resolved itself.",
		"The new process is working already.", "Let's celebrate that milestone.",
		"Knowledge sharing session went great.", "The onboarding doc saved hours.",
		"We have buffer for unknowns.", "The RACI chart cleared things up.",
		"Meeting cadence feels right now.", "Everyone hit their commitments.",
		"The demo went over really well.", "Less meetings, more focus time.",
		"That blocker got unblocked fast.", "The decision log is helpful.",
		"Psychological safety is high here.", "We're ahead on all three OKRs.",
		"The retrospective surfaced good ideas.", "Handoff documentation is thorough.",
		"We protected the team from churn.", "The roadmap presentation landed well.",
		"Career growth conversations are happening.", "Workload balance looks fair.",
		"The all-hands had real substance.", "We shipped with zero overtime.",
		"The quarterly review was positive.", "That delegation paid off.",
		"Autonomy is up, micromanagement is gone.", "Team health check looks strong.",
		"We have the right people on this.", "The risk mitigation plan worked.",
		"Communication overhead is way down.", "The charter keeps us focused.",
		"Our cycle time improved by a day.", "Good energy in the room today.",
		"Stakeholders trust the process now.", "The war room resolved it in an hour.",
		"We're building a great culture here.", "Recognition matters. Let's do more.",
		"Seen the new org chart?", "Did you check the engagement survey?",
		"That skip-level meeting was insightful.", "Great all-hands presentation.",
		"Want to co-facilitate the retro?", "Got a minute to align on priorities?",
		"The AC in the meeting room is finally fixed.", "Nice day for a team outing.",
		"The mentoring program is gaining traction.", "Attrition is at an all-time low.",
		"Our Glassdoor reviews improved.", "The promotion cycle went smoothly.",
		"That cross-functional initiative is thriving.", "The intern cohort is impressive.",
		"Succession planning is in a good place.", "The offsite agenda looks solid.",
		"The new hire ramp-up was the fastest yet.", "Team rituals are really gelling.",
	],
	quality: [
		"Test coverage is solid.", "No regressions so far.", "Edge cases are covered.",
		"The test strategy is working.", "Found an interesting edge case.",
		"All green in CI.", "The flaky test is finally fixed.", "Mutation testing found a gap.",
		"Boundary conditions checked.", "The test pyramid is balanced.",
		"Integration tests are fast now.", "That was a sneaky bug. Good catch.",
		"Exploratory testing uncovered something.", "The test data is realistic.",
		"Contract tests are passing.", "Performance benchmarks are stable.",
		"Regression suite passed in four minutes.", "That assertion saved us in prod.",
		"I wrote a fuzzer for that input.", "The error messages are way clearer now.",
		"Load test results are within tolerance.", "Smoke tests caught it early.",
		"That null check was missing everywhere.", "We need more negative test cases.",
		"The snapshot tests are stable again.", "Visual regression test passed.",
		"I automated that manual test case.", "The chaos test survived gracefully.",
		"Memory leak? Not anymore.", "Accessibility audit came back clean.",
		"Test isolation is solid now.", "The mock is realistic enough.",
		"Stress testing revealed the limit.", "That timeout was way too generous.",
		"Cross-browser testing is green.", "The data generator is reliable.",
		"I found a race condition in the test.", "Test cleanup hooks are working.",
		"The coverage report tells a story.", "Concurrency tests all pass.",
		"Response time is under threshold.", "Security scan came back clean.",
		"The retry test proves resilience.", "Deterministic tests are the goal.",
		"Parameterized tests cover every combo.", "The happy path and sad path both work.",
		"That fixture data is reusable.", "End-to-end flow looks solid.",
		"We caught it before the user did.", "Test-driven development for the win.",
		"The test harness is flexible now.", "That edge case was wild.",
		"Zero flaky tests this week.", "The test suite inspires confidence.",
		"Seen the new test runner UI?", "You try the property-based testing lib?",
		"That bug bash was productive.", "Solid regression pass today.",
		"Want to review the test plan together?", "Got a sec to look at this flake?",
		"The break room coffee is fresh.", "Perfect quiet afternoon for testing.",
		"The API contract tests caught a drift.", "Our test matrix covers every OS now.",
		"Playwright made that scenario easy.", "The golden file approach is paying off.",
		"Mutation score jumped to 85%.", "We finally have a proper test seed.",
		"The error injection test is clever.", "Our canary assertions are airtight.",
		"Mocking at the boundary keeps it honest.", "That test refactor cut runtime in half.",
	],
	operations: [
		"Systems nominal.", "Dashboard is all green.", "Uptime looking good.",
		"The deploy went smooth.", "Monitoring is catching things early.",
		"Alert noise is down this week.", "The runbook worked perfectly.",
		"Auto-scaling kicked in right on time.", "Logs are clean.",
		"Incident response was fast.", "The recovery was seamless.",
		"Infrastructure costs are down.", "SSL certs are all current.",
		"Rollback took thirty seconds. Love it.", "The health check endpoint is solid.",
		"Canary deploy looks healthy.", "DNS propagated instantly.",
		"Container startup time is fast.", "The backup verified clean.",
		"Memory utilization is optimal.", "CPU is barely breaking a sweat.",
		"Rate limiting is doing its job.", "The CDN cache hit ratio is 98%.",
		"Zero downtime deployment. Nailed it.", "Disk usage is under control.",
		"The queue depth is stable.", "Failover tested and working.",
		"Latency P99 is looking tight.", "Connection pool is balanced.",
		"The circuit breaker tripped correctly.", "Secrets rotation went smooth.",
		"Load balancer health is perfect.", "Database replicas are in sync.",
		"The on-call was quiet last night.", "Network throughput is healthy.",
		"We hit five nines last month.", "The migration ran with zero hiccup.",
		"Dependency versions are all patched.", "Blue-green swap was instant.",
		"Observability stack is earning its keep.", "The alert thresholds are tuned.",
		"Log aggregation caught that spike.", "Resource limits are set correctly.",
		"The disaster recovery drill went well.", "Traffic spike handled gracefully.",
		"No orphaned resources this audit.", "Service mesh is routing cleanly.",
		"That hotfix deployed in under a minute.", "Infrastructure as code saves us daily.",
		"The staging environment mirrors prod now.", "Grafana dashboard is beautiful.",
		"SLA compliance is at 99.99%.", "The on-call runbook is comprehensive.",
		"Seen the new Prometheus dashboard?", "You try the chaos engineering toolkit?",
		"That incident review was constructive.", "Smooth rotation handoff today.",
		"Want to walk through the runbook?", "Got time to check the alert rules?",
		"The server room is surprisingly chilly.", "Nice and quiet on-call week.",
		"The Terraform plan applied cleanly.", "Our cold start time is sub-second now.",
		"The certificate renewal automated itself.", "Pod autoscaling is tuned perfectly.",
		"We finally automated the compliance checks.", "The network ACLs are airtight.",
		"Cost anomaly detection flagged a savings.", "The DR failover test was seamless.",
		"Our container images are minimal now.", "That post-incident timeline was thorough.",
	],
	orchestration: [
		"Everything is humming along.", "The workflow is smooth.", "Good coordination today.",
		"Systems are in sync.", "No blockers anywhere.", "All agents are productive.",
		"The handoffs are seamless.", "Integration points are solid.",
		"Parallel workstreams are converging.", "Dependencies are resolved upstream.",
		"The pipeline is flowing.", "Everyone's in their groove.",
		"The queue is draining nicely.", "Task distribution looks even.",
		"All stages are green-lit.", "The bottleneck cleared itself.",
		"Cross-team sync was painless.", "The scheduler is humming.",
		"Every step completed on time.", "Upstream and downstream are aligned.",
		"The DAG executed perfectly.", "Retry logic kicked in. Worked.",
		"The fan-out pattern is scaling.", "Jobs are finishing ahead of schedule.",
		"Resource contention? None today.", "The orchestrator is earning its keep.",
		"Event-driven flow is so clean.", "The saga completed without rollback.",
		"Throughput is at peak efficiency.", "The batch job finished early.",
		"Priority queue is balanced.", "Coordination overhead is minimal.",
		"The workflow engine just works.", "Message delivery is guaranteed.",
		"No stale tasks in the queue.", "Concurrency limits are respected.",
		"The dependency chain is tight.", "Service discovery is instant.",
		"Dead letter queue is empty.", "The circuit is healthy everywhere.",
		"Backpressure is handled gracefully.", "The cron jobs all fired on schedule.",
		"Task affinity is improving throughput.", "No orphaned processes.",
		"The heartbeat checks are passing.", "Every agent reported back on time.",
		"The fan-in aggregation is complete.", "Graceful degradation is working.",
		"The pipeline recovered automatically.", "Work distribution is optimal.",
		"The compensation logic never triggered.", "Everything converged on schedule.",
		"Seen the new workflow dashboard?", "You try the new task router?",
		"That coordination call was crisp.", "Solid sync across all teams today.",
		"Want to review the dependency map?", "Got a sec to check the queue depth?",
		"The office plants are thriving.", "Good day for system gardening.",
		"The new rate limiter distributes evenly.", "Our event sourcing is replay-safe.",
		"The idempotency keys are working great.", "Partition rebalancing was invisible.",
		"The outbox pattern eliminated lost messages.", "Leader election was instantaneous.",
		"Work-stealing improved tail latency.", "The bulkhead pattern contained the blast.",
		"Our semaphore pool is sized just right.", "That workflow migration was seamless.",
	],
	analysis: [
		"The data tells a clear story.", "Interesting trend here.", "The numbers check out.",
		"Statistical significance achieved.", "The cohort analysis is revealing.",
		"Outliers explained.", "The model is converging.", "Good signal-to-noise ratio.",
		"The dashboard is updated.", "Correlation confirmed with causation.",
		"The regression line fits beautifully.", "Sample size is large enough.",
		"That anomaly has an explanation.", "The distribution is normal.",
		"Variance is within acceptable range.", "The hypothesis holds up.",
		"I double-checked the data source.", "The funnel visualization is clear.",
		"Year over year, we're trending up.", "The pivot table tells the story.",
		"Query performance is acceptable.", "The ETL pipeline ran clean.",
		"Segmentation revealed two distinct groups.", "The forecast model is accurate.",
		"That correlation was surprising.", "The confidence interval is tight.",
		"Data quality checks passed.", "The metric definition is unambiguous.",
		"The A/B test has a clear winner.", "Feature importance ranking shifted.",
		"The heat map shows the pattern.", "Retention curves are improving.",
		"Time series decomposition is clean.", "The baseline was set correctly.",
		"Moving average smoothed the noise.", "Cross-validation confirms the model.",
		"The cluster analysis found four groups.", "Data freshness is within SLA.",
		"The summary statistics are interesting.", "We can trust this dataset.",
		"The dimensionality reduction worked.", "Attribution model is calibrated.",
		"The benchmark comparison is favorable.", "Real-time analytics are streaming.",
		"The drill-down reveals the cause.", "Seasonal adjustment makes sense now.",
		"Data lineage is fully documented.", "The insight is actionable.",
		"The trend is accelerating.", "That spike has a clear root cause.",
		"Predictive accuracy is above 90%.", "The data pipeline is bulletproof.",
		"Seen the new Tableau workspace?", "You try the updated SQL engine?",
		"That deep-dive presentation landed well.", "Great data review this morning.",
		"Want to pair on this query?", "Got a minute to sanity-check a metric?",
		"The espresso machine is back online.", "Clear head for number crunching today.",
		"The lookalike model is outperforming.", "Our DAU/MAU ratio is textbook healthy.",
		"The propensity score matching worked.", "Survival analysis shows strong retention.",
		"Our feature store is saving hours.", "The Bayesian model converged faster.",
		"Causal inference confirmed the impact.", "The data catalog is actually useful now.",
		"Our embedding vectors cluster beautifully.", "That cohort pivot was the right lens.",
	],
	general: [
		"How's it going?", "Good to see you.", "Making progress!", "Nice work today.",
		"What are you working on?", "Coffee break?", "Anything I can help with?",
		"The team is cooking.", "Good energy today.", "This is a good day.",
		"Lunch soon?", "Taking a breather.", "What a morning.", "Almost there.",
		"The vibes are right.", "Productive session.", "I needed that stretch.",
		"Good chat.", "Let's keep this momentum.", "Feeling focused.",
		"Hey, nice to see a friendly face.", "Quick break, then back at it.",
		"We're making real progress here.", "The office is buzzing today.",
		"I appreciate you.", "Teamwork makes the dream work.",
		"Solid effort all around.", "Couldn't do it without the team.",
		"Another day, another commit.", "Living the dream.",
		"Did someone say snacks?", "My brain needs fuel.",
		"That was satisfying.", "Time flies when you're in the zone.",
		"What a crew we've got.", "Everyone's bringing their A-game.",
		"Morning! Ready to roll?", "You look like you solved something.",
		"High five on that one.", "I just learned something new.",
		"That meeting was actually useful.", "Happy Friday vibes.",
		"Rain outside, productivity inside.", "Who's up for a walk?",
		"I think better after lunch.", "The music is helping me focus.",
		"You ever have one of those eureka moments?", "This is the good stuff.",
		"That whiteboard session was great.", "I needed that laugh.",
		"Back-to-back wins today.", "Hydration check. Drink some water.",
		"Someone's in the zone.", "We should do this more often.",
		"That was smoother than expected.", "Great question in that meeting.",
		"Let's wrap this up and celebrate.", "It's all coming together.",
		"I like how we work together.", "Mondays aren't so bad, honestly.",
		"Wednesday already? This week is flying.", "Small wins add up.",
		"That's the spirit.", "Good instinct on that call.",
		"Fresh air would do us good.", "Just hit a milestone.",
		"Everyone pulled their weight today.", "That was a satisfying click.",
		"Desk plants make everything better.", "Three o'clock slump? Not today.",
		"Keyboard sounds are oddly soothing.", "I'm stealing that approach.",
		"Positive vibes only right now.", "That was elegant. Just saying.",
		"We're on a roll this week.", "End of day feels earned today.",
		"This is why I like this team.", "Someone brought donuts. Hero.",
		"Short week, big results.", "Let's keep it simple.",
		"Good problems to have.", "New week, fresh start.",
		"Seen the new break room setup?", "You try that new lunch spot?",
		"That town hall was actually engaging.", "Solid vibe in here right now.",
		"Want to grab coffee after this?", "Got a second to bounce an idea?",
		"The wifi is blazing fast today.", "Sunset from the window is gorgeous.",
		"I found a shortcut in the tool.", "The new chairs are so comfortable.",
		"Shoutout to whoever restocked the fridge.", "That async update saved a meeting.",
		"My standing desk was a great call.", "Podcast recommendations anyone?",
		"The shared playlist is fire today.", "That team lunch was overdue.",
		"Whiteboard markers that actually work.", "Perfect temperature in here for once.",
	],
};

export class SocialSystem {
	private readonly entries = new Map<string, SocialEntry>();
	private readonly pairCooldowns = new Map<string, number>();
	private callback: ConversationCallback | null = null;
	private clusterCallback: ClusterCallback | null = null;
	/** Per-cluster proximity timers keyed by sorted-name hash. */
	private readonly clusterTimers = new Map<string, number>();
	/** Cooldowns for cluster compositions already fired. */
	private readonly clusterCooldowns = new Map<string, number>();

	onConversation(cb: ConversationCallback): void {
		this.callback = cb;
	}

	onCluster(cb: ClusterCallback): void {
		this.clusterCallback = cb;
	}

	register(name: string, agent: SocialAgent): void {
		this.entries.set(name, { ...agent, proximityTimers: new Map() });
	}

	unregister(name: string): void {
		this.entries.delete(name);
	}

	update(
		deltaMs: number,
		getPosition: (name: string) => { x: number; y: number },
		getState: (name: string) => BrainState,
		getNeeds: (name: string) => AgentNeeds,
	): void {
		// Decrement pair cooldowns
		for (const [key, remaining] of this.pairCooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.pairCooldowns.delete(key);
			else this.pairCooldowns.set(key, updated);
		}

		// Decrement cluster cooldowns
		for (const [key, remaining] of this.clusterCooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.clusterCooldowns.delete(key);
			else this.clusterCooldowns.set(key, updated);
		}

		const names = [...this.entries.keys()];
		/** Adjacency set of pairs within social radius (used for cluster detection). */
		const proximatePairs = new Set<string>();

		for (let i = 0; i < names.length; i++) {
			const nameA = names[i];
			const entryA = this.entries.get(nameA)!;
			if (!IDLE_STATES.includes(getState(nameA))) continue;
			const posA = getPosition(nameA);

			for (let j = i + 1; j < names.length; j++) {
				const nameB = names[j];
				const entryB = this.entries.get(nameB)!;
				if (!IDLE_STATES.includes(getState(nameB))) continue;

				const pairKey = `${nameA}|${nameB}`;

				const posB = getPosition(nameB);
				const dx = posA.x - posB.x;
				const dy = posA.y - posB.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				const maxRadius = Math.max(entryA.socialRadius, entryB.socialRadius);

				if (dist > maxRadius) {
					entryA.proximityTimers.delete(nameB);
					continue;
				}

				// Within radius — track for both pair conversations and cluster detection
				proximatePairs.add(pairKey);

				if (!this.pairCooldowns.has(pairKey)) {
					const timer = (entryA.proximityTimers.get(nameB) ?? 0) + deltaMs;
					entryA.proximityTimers.set(nameB, timer);

					if (timer >= PROXIMITY_THRESHOLD_MS) {
						entryA.proximityTimers.delete(nameB);
						this.pairCooldowns.set(pairKey, PAIR_COOLDOWN_MS);

						const lineA = this.pickLine(entryA.domain, entryA.personality);
						const lineB = this.pickLine(entryB.domain, entryB.personality);
						this.callback?.(nameA, nameB, lineA, lineB);
					}
				}
			}
		}

		// Cluster detection — find connected components of 3+ idle, high-focus agents
		if (this.clusterCallback) {
			this.updateClusters(deltaMs, names, proximatePairs, getState, getNeeds);
		}
	}

	private updateClusters(
		deltaMs: number,
		names: string[],
		proximatePairs: Set<string>,
		getState: (name: string) => BrainState,
		getNeeds: (name: string) => AgentNeeds,
	): void {
		// Filter to idle agents with sufficient focus
		const eligible = names.filter(
			(n) => IDLE_STATES.includes(getState(n)) && getNeeds(n).focus >= CLUSTER_MIN_FOCUS,
		);

		// Build adjacency from proximate pairs among eligible agents
		const adjacency = new Map<string, Set<string>>();
		for (const name of eligible) {
			adjacency.set(name, new Set());
		}
		for (const name of eligible) {
			for (const other of eligible) {
				if (name >= other) continue;
				const key = `${name}|${other}`;
				if (proximatePairs.has(key)) {
					adjacency.get(name)!.add(other);
					adjacency.get(other)!.add(name);
				}
			}
		}

		// Find connected components via BFS
		const visited = new Set<string>();
		const components: string[][] = [];
		for (const start of eligible) {
			if (visited.has(start)) continue;
			const component: string[] = [];
			const queue: string[] = [start];
			visited.add(start);
			while (queue.length > 0) {
				const current = queue.shift()!;
				component.push(current);
				for (const neighbor of adjacency.get(current) ?? []) {
					if (!visited.has(neighbor)) {
						visited.add(neighbor);
						queue.push(neighbor);
					}
				}
			}
			components.push(component);
		}

		// Update cluster timers and fire callback when threshold met
		for (const component of components) {
			if (component.length < CLUSTER_MIN_SIZE) continue;
			const clusterKey = [...component].sort().join("|");
			if (this.clusterCooldowns.has(clusterKey)) continue;

			const elapsed = (this.clusterTimers.get(clusterKey) ?? 0) + deltaMs;
			this.clusterTimers.set(clusterKey, elapsed);

			if (elapsed >= CLUSTER_THRESHOLD_MS) {
				this.clusterTimers.delete(clusterKey);
				this.clusterCooldowns.set(clusterKey, CLUSTER_COOLDOWN_MS);
				this.clusterCallback?.(component.sort());
			}
		}

		// Clean up stale cluster timers for groups no longer proximate
		for (const [key] of this.clusterTimers) {
			const members = key.split("|");
			const stillTogether = members.every((m) => eligible.includes(m)) &&
				members.every((m, _i) =>
					members.every((other) => {
						if (m >= other) return true;
						return proximatePairs.has(`${m}|${other}`);
					})
				);
			if (!stillTogether) {
				this.clusterTimers.delete(key);
			}
		}
	}

	private pickLine(domain: string, personality: readonly string[]): string {
		// 20% chance to use a personality quote
		if (personality.length > 0 && Math.random() < 0.2) {
			return personality[Math.floor(Math.random() * personality.length)];
		}
		// Use domain-specific lines, fall back to general
		const pool = CONVERSATION_LINES[domain] ?? CONVERSATION_LINES["general"];
		return pool[Math.floor(Math.random() * pool.length)];
	}
}
