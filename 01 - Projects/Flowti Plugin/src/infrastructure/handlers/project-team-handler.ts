import type { IProjectService, ProjectDetailElement, TeamRoleSlot } from "../../domain/projects/types.js";

export interface TeamHandlerDeps {
	readonly el: ProjectDetailElement;
	readonly signal: AbortSignal;
	readonly projectService: IProjectService;
	readonly getCurrentProject: () => string;
	readonly startProjectHubWork: (label: string) => void;
	readonly appendProjectHubLog: (line: string) => void;
	readonly endProjectHubWork: (result: { ok: boolean; error?: string }) => void;
}

export class TeamHandler {
	private readonly deps: TeamHandlerDeps;

	constructor(deps: TeamHandlerDeps) {
		this.deps = deps;
		this.wireEvents();
	}

	dispose(): void {}

	private wireEvents(): void {
		const { el, signal } = this.deps;

		el.addEventListener("team-roster-save", ((e: CustomEvent) => {
			if (el.projectHubBusy) return;
			const slots = (e.detail?.slots ?? []) as TeamRoleSlot[];
			this.deps.startProjectHubWork("Saving team roster");
			void this.deps.projectService.saveTeamRoster(this.deps.getCurrentProject(), slots, (l) => this.deps.appendProjectHubLog(l))
				.then((r) => this.deps.endProjectHubWork(r));
		}) as EventListener, { signal });

		el.addEventListener("team-create-agent", ((e: CustomEvent) => {
			if (el.projectHubBusy) return;
			const d = e.detail as { roleId?: string; agentName?: string; slots?: TeamRoleSlot[] };
			const roleId = String(d?.roleId ?? "");
			const agentName = String(d?.agentName ?? "");
			const slots = Array.isArray(d?.slots) ? d.slots : undefined;
			el.agentCreationContext = { roleId, agentName };
			this.deps.startProjectHubWork(`Saving agent "${agentName}"…`);
			this.deps.appendProjectHubLog(`Starting — create or update vault note for "${agentName}", then refresh the roster.`);
			void this.deps.projectService
				.createAgentFromRole(this.deps.getCurrentProject(), roleId, agentName, (l) => this.deps.appendProjectHubLog(l), slots)
				.then((r) => this.deps.endProjectHubWork(r))
				.finally(() => { if (!this.deps.signal.aborted) el.agentCreationContext = null; });
		}) as EventListener, { signal });

		el.addEventListener("team-refresh-agents", (() => {
			void this.deps.projectService.listVaultAgents().then((a) => {
				if (!this.deps.signal.aborted) el.vaultAgents = [...a];
			});
		}) as EventListener, { signal });

		el.addEventListener("team-roster-error", ((e: CustomEvent) => {
			if (this.deps.signal.aborted) return;
			const msg = String((e.detail as { message?: string })?.message ?? "Team roster error");
			el.statusMessage = msg;
			setTimeout(() => { if (!this.deps.signal.aborted && el.statusMessage === msg) el.statusMessage = ""; }, 5000);
		}) as EventListener, { signal });
	}
}
