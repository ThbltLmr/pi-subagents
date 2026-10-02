import * as path from "node:path";
import { CHILD_SESSION_NAME_MAX_CHARS } from "../../shared/child-session-name.ts";

export const HERDR_PI_PROTOCOL = 1;
export const HERDR_PI_MAX_FRAME_BYTES = 1024 * 1024;
export const HERDR_PI_MODE_ENV = "PI_SUBAGENTS_HERDR_BRIDGE";
export const HERDR_PI_RUN_ENV = "PI_SUBAGENTS_HERDR_RUN_ID";
export const HERDR_PI_RUNTIME_DIR_ENV = "PI_SUBAGENTS_HERDR_RUNTIME_DIR";
const SAFE_ID = /^[A-Za-z0-9_-]{8,96}$/u;

export function validateHerdrPiRunId(value: unknown): string {
	if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error("Herdr Pi bridge run identity is invalid.");
	return value;
}

export function herdrPiRuntimeRoot(agentDir: string): string {
	return path.join(agentDir, "pi-subagents", "herdr-runs");
}

export function herdrPiRunDir(agentDir: string, runId: string): string {
	return path.join(herdrPiRuntimeRoot(agentDir), validateHerdrPiRunId(runId));
}

/** Private launch identity; taskOnly is not a selectable remote profile name. */
export type HerdrPiResources = ({ agent: string; taskOnly?: never } | { taskOnly: true; agent?: never }) & {
	skills?: string[];
	toolCeiling?: string[];
	reads?: string[] | false;
};

export function assertHerdrPiResources(value: unknown): asserts value is HerdrPiResources {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Remote logical resource names are invalid.");
	const resources = value as Record<string, unknown>;
	const logicalName = (name: unknown) => typeof name === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(name);
	const validIdentity = resources.taskOnly === true ? resources.agent === undefined : resources.taskOnly === undefined && logicalName(resources.agent);
	if (!validIdentity
		|| (resources.skills !== undefined && (!Array.isArray(resources.skills) || resources.skills.some((name) => !logicalName(name))))
		|| (resources.toolCeiling !== undefined && (!Array.isArray(resources.toolCeiling) || resources.toolCeiling.some((name) => typeof name !== "string" || !/^[A-Za-z0-9_-]{1,64}$/u.test(name))))
		|| (resources.reads !== undefined && resources.reads !== false && (!Array.isArray(resources.reads) || resources.reads.some((name) => typeof name !== "string" || Buffer.byteLength(name) > 4096)))) {
		throw new Error("Remote logical resource names are invalid.");
	}
}

export function assertHerdrPiSessionName(value: unknown): asserts value is string | undefined {
	if (value !== undefined && (typeof value !== "string" || !value.trim() || value.length > CHILD_SESSION_NAME_MAX_CHARS || /[\r\n\x00]/u.test(value))) throw new Error("Remote display session title is invalid.");
}

export interface HerdrPiFrame {
	protocol: number;
	runId: string;
	type: string;
	requestId?: string;
	[key: string]: unknown;
}

export function encodeHerdrPiFrame(frame: HerdrPiFrame): Buffer {
	const data = Buffer.from(`${JSON.stringify(frame)}\n`, "utf8");
	if (data.byteLength > HERDR_PI_MAX_FRAME_BYTES) throw new Error(`Herdr Pi frame exceeds ${HERDR_PI_MAX_FRAME_BYTES} bytes.`);
	return data;
}

export class HerdrPiFrameDecoder {
	#buffer = Buffer.alloc(0);
	push(chunk: Buffer): HerdrPiFrame[] {
		this.#buffer = Buffer.concat([this.#buffer, chunk]);
		if (this.#buffer.byteLength > HERDR_PI_MAX_FRAME_BYTES) throw new Error(`Herdr Pi frame exceeds ${HERDR_PI_MAX_FRAME_BYTES} bytes.`);
		const frames: HerdrPiFrame[] = [];
		for (;;) {
			const newline = this.#buffer.indexOf(10);
			if (newline < 0) break;
			const line = this.#buffer.subarray(0, newline);
			this.#buffer = this.#buffer.subarray(newline + 1);
			let value: unknown;
			try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(line)) as unknown; } catch { throw new Error("Herdr Pi bridge emitted malformed JSON or UTF-8."); }
			if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Herdr Pi bridge frame must be an object.");
			const frame = value as HerdrPiFrame;
			if (frame.protocol !== HERDR_PI_PROTOCOL || typeof frame.type !== "string") throw new Error("Herdr Pi bridge protocol mismatch.");
			validateHerdrPiRunId(frame.runId);
			frames.push(frame);
		}
		return frames;
	}
	end(): void { if (this.#buffer.byteLength) throw new Error("Herdr Pi bridge ended with a partial frame."); }
}
