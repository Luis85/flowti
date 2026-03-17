import { TaskContext, ResolutionRecord } from "src/models/Task";

export class TaskStore {
  tasksById = new Map<string, TaskContext>();
  resolutionsByTaskId = new Map<string, ResolutionRecord>();
  resolutionLog: ResolutionRecord[] = [];

  hasResolved(taskId: string) {
    return this.resolutionsByTaskId.has(taskId);
  }

  appendResolution(r: ResolutionRecord) {
    this.resolutionsByTaskId.set(r.taskId, r);
    this.resolutionLog.push(r);
  }
}
