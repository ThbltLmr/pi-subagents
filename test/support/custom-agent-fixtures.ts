import * as fs from "node:fs";
import * as path from "node:path";

export function writeUserAgentFixtures(names?: string[]): void {
	const root = process.env.PI_CODING_AGENT_DIR ?? path.join(process.env.HOME!, ".pi", "agent");
	writeCustomAgentFixtures(path.join(root, "agents"), names);
}

// Explicit custom profiles for configuration tests; never installed or discovered by the plugin.
const metadata: Record<string, string> = {
	delegate: "tools: read, grep, find, ls, bash, edit, write, contact_supervisor",
	worker: "thinking: high\naliases: developer\ndefaultContext: fork\ndefaultReads: context.md, plan.md\ntools: read, grep, find, ls, bash, edit, write, contact_supervisor",
	reviewer: "thinking: high\ntools: read, grep, find, ls, contact_supervisor",
	oracle: "thinking: high\naliases: advisor\ndefaultContext: fork\ntools: read, grep, find, ls, bash",
	scout: "thinking: low\noutput: context.md\ntools: read, grep, find, ls, bash, write, contact_supervisor",
	researcher: "thinking: medium\noutput: research.md\ntools: read, write, web_search, fetch_content, get_search_content, source_check",
};

export function writeCustomAgentFixtures(directory: string, names = Object.keys(metadata)): void {
	fs.mkdirSync(directory, { recursive: true });
	for (const name of names) {
		fs.writeFileSync(path.join(directory, `${name}.md`), `---\nname: ${name}\ndescription: Custom ${name} fixture\nsystemPromptMode: append\ninheritProjectContext: true\n${metadata[name] ?? ""}\n---\n`);
	}
}
