import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export const __piSubagentsTestShim = true;

export function getMarkdownTheme() { return {}; }
export function keyText(keybinding) { return keybinding === "app.tools.expand" ? "configured-expand-key" : ""; }
export function initTheme() {}
export function getLanguageFromPath(filePath) { return path.extname(String(filePath)).slice(1) || undefined; }
export function highlightCode(source) { return String(source).split("\n"); }
export function convertToLlm(value) { return value; }
export function createReadOnlyTools(_cwd, _options) {
	// These mirror the model-facing declarations only; the shim never runs host tools.
	const unavailable = async () => {
		throw new Error("Read-only tools are not executable in the Pi test shim.");
	};
	const string = (description) => ({ type: "string", description });
	const number = (description) => ({ type: "number", description });
	const object = (properties, required = []) => ({
		type: "object",
		...(required.length > 0 ? { required } : {}),
		properties,
	});

	return [
		{
			name: "read",
			label: "read",
			description: "Read the contents of a file. Supports text files and images (jpg, png, gif, webp, bmp). Images are sent as attachments. For text files, output is truncated to 2000 lines or 50KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.",
			parameters: object({
				path: string("Path to the file to read (relative or absolute)"),
				offset: number("Line number to start reading from (1-indexed)"),
				limit: number("Maximum number of lines to read"),
			}, ["path"]),
			constrainedSampling: { type: "json_schema", strict: "prefer" },
			execute: unavailable,
		},
		{
			name: "grep",
			label: "grep",
			description: "Search file contents for a pattern. Returns matching lines with file paths and line numbers. Respects .gitignore. Output is truncated to 100 matches or 50KB (whichever is hit first). Long lines are truncated to 500 chars.",
			parameters: object({
				pattern: string("Search pattern (regex or literal string)"),
				path: string("Directory or file to search (default: current directory)"),
				glob: string("Filter files by glob pattern, e.g. '*.ts' or '**/*.spec.ts'"),
				ignoreCase: { type: "boolean", description: "Case-insensitive search (default: false)" },
				literal: { type: "boolean", description: "Treat pattern as literal string instead of regex (default: false)" },
				context: number("Number of lines to show before and after each match (default: 0)"),
				limit: number("Maximum number of matches to return (default: 100)"),
			}, ["pattern"]),
			execute: unavailable,
		},
		{
			name: "find",
			label: "find",
			description: "Search for files by glob pattern. Returns matching file paths relative to the search directory. Respects .gitignore. Output is truncated to 1000 results or 50KB (whichever is hit first).",
			parameters: object({
				pattern: string("Glob pattern to match files, e.g. '*.ts', '**/*.json', or 'src/**/*.spec.ts'"),
				path: string("Directory to search in (default: current directory)"),
				limit: number("Maximum number of results (default: 1000)"),
			}, ["pattern"]),
			execute: unavailable,
		},
		{
			name: "ls",
			label: "ls",
			description: "List directory contents. Returns entries sorted alphabetically, with '/' suffix for directories. Includes dotfiles. Output is truncated to 500 entries or 50KB (whichever is hit first).",
			parameters: object({
				path: string("Directory to list (default: current directory)"),
				limit: number("Maximum number of entries to return (default: 500)"),
			}),
			execute: unavailable,
		},
	];
}
export function rawKeyHint(keys, label) { return `${keys} ${label}`; }
export function keyHint(_binding, label) { return label; }

export class DynamicBorder {
	constructor(style = (value) => value) { this.style = style; }
	render(width = 1) { return [this.style("─".repeat(Math.max(1, width)))]; }
	invalidate() {}
}

function writeSession(filePath, header, entries) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${[header, ...entries].map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf-8");
}

function readSession(filePath) {
	const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
	const [header, ...entries] = lines;
	return { header, entries };
}

export class SessionManager {
	constructor(cwd, sessionDir, filePath, header, entries = []) {
		this.cwd = cwd;
		this.sessionDir = sessionDir;
		this.filePath = filePath;
		this.header = header;
		this.entries = entries;
	}

	static create(cwd, sessionDir = path.join(cwd, ".pi", "sessions")) {
		const id = randomUUID();
		return new SessionManager(cwd, sessionDir, path.join(sessionDir, `${id}.jsonl`), { type: "session", version: 1, id, timestamp: new Date().toISOString(), cwd });
	}

	static open(filePath, sessionDir = path.dirname(filePath)) {
		const { header, entries } = readSession(filePath);
		return new SessionManager(header.cwd ?? process.cwd(), sessionDir, filePath, header, entries);
	}

	appendMessage(message) {
		const previous = this.entries.at(-1);
		const id = randomUUID().slice(0, 8);
		this.entries.push({ type: "message", id, parentId: previous?.id ?? null, timestamp: new Date().toISOString(), message });
		if (message?.role === "assistant" || fs.existsSync(this.filePath)) writeSession(this.filePath, this.header, this.entries);
	}

	getSessionFile() { return this.filePath; }
	getLeafId() { return this.entries.at(-1)?.id ?? null; }
	getSessionDir() { return this.sessionDir; }
	getHeader() { return this.header; }
	getEntries() { return this.entries; }

	createBranchedSession(leafId) {
		const id = randomUUID();
		const branchFile = path.join(this.sessionDir, `${id}.jsonl`);
		const leafIndex = this.entries.findIndex((entry) => entry.id === leafId);
		const entries = leafIndex >= 0 ? this.entries.slice(0, leafIndex + 1) : [...this.entries];
		writeSession(branchFile, { ...this.header, id, parentSession: this.filePath }, entries);
		return branchFile;
	}
}

export function createEventBus() {
	// Keep only active subscriptions; events are dispatched immediately and never queued.
	const emitter = new EventEmitter();
	return {
		emit(channel, data) {
			emitter.emit(channel, data);
		},
		on(channel, handler) {
			const safeHandler = async (data) => {
				try {
					await handler(data);
				} catch (error) {
					console.error(`Event handler error (${channel}):`, error);
				}
			};
			emitter.on(channel, safeHandler);
			return () => emitter.off(channel, safeHandler);
		},
		clear() {
			emitter.removeAllListeners();
		},
	};
}

export class DefaultResourceLoader {}
export class ModelRuntime {}
export class SettingsManager {}

export function createAgentSession() {
	throw new Error("Real Pi session tests require the real @earendil-works/pi-coding-agent package.");
}
