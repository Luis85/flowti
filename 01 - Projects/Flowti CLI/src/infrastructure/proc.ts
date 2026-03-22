/**
 * proc.ts — Centralized process operations.
 *
 * All process.exit(), process.argv, and process.cwd() calls
 * should go through this service for testability.
 */

import type { IProcess, IPidOps } from "./types.js";

class NodeProcess implements IProcess {
	exit(code: number): never {
		process.exit(code);
	}

	argv(): string[] {
		return process.argv.slice(2);
	}

	cwd(): string {
		return process.cwd();
	}

	env(): Record<string, string | undefined> {
		return process.env;
	}
}

export const proc: IProcess = new NodeProcess();

import { execSync } from "node:child_process";
import net from "node:net";

class NodePidOps implements IPidOps {
	isPidAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}

	isPortListening(port: number): Promise<boolean> {
		return new Promise((resolve) => {
			const sock = net.createConnection({ port, host: "127.0.0.1" });
			sock.setTimeout(1000);
			sock.on("connect", () => { sock.destroy(); resolve(true); });
			sock.on("error", () => { resolve(false); });
			sock.on("timeout", () => { sock.destroy(); resolve(false); });
		});
	}

	killPid(pid: number): boolean {
		try {
			if (process.platform === "win32") {
				execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore", windowsHide: true });
			} else {
				process.kill(pid, "SIGTERM");
			}
			return true;
		} catch {
			return false;
		}
	}
}

export const pidOps: IPidOps = new NodePidOps();
