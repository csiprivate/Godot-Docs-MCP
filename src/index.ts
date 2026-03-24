#!/usr/bin/env node

import { fileURLToPath } from "url";
import { basename, dirname, extname, join, relative, resolve, sep } from "path";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from "@modelcontextprotocol/sdk/types.js";

type Section =
  | "all"
  | "root"
  | "about"
  | "community"
  | "engine_details"
  | "getting_started"
  | "tutorials"
  | "classes"
  | "readme";

type ConcreteSection = Exclude<Section, "all">;

interface DocEntry {
  absolutePath: string;
  relativePath: string;
  section: ConcreteSection;
  slug: string;
  title: string;
}

interface SearchHit {
  relativePath: string;
  section: ConcreteSection;
  line: number;
  text: string;
  onlineUrl: string | null;
}

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);
const workspaceRoot: string = resolve(__dirname, "..");
const repoRoot: string = process.env.GODOT_DOCS_REPO ?? resolve(workspaceRoot, "vendor", "godot-docs");
const docsBaseUrl: string = "https://docs.godotengine.org/en/stable";
const readmePath: string = join(repoRoot, "README.md");
const rootIndexPath: string = join(repoRoot, "index.rst");
let cachedEntries: DocEntry[] | null = null;

const sectionRoots: Record<ConcreteSection, string | null> = {
  root: null,
  about: "about",
  community: "community",
  engine_details: "engine_details",
  getting_started: "getting_started",
  tutorials: "tutorials",
  classes: "classes",
  readme: null
};

function assertRepoReady(): void {
  if (!existsSync(repoRoot)) {
    throw new McpError(
      ErrorCode.InternalError,
      `Godot-Doku-Repo nicht gefunden: ${repoRoot}. Fuehre scripts/update-godot-docs.ps1 oder scripts/update-godot-docs.sh aus.`
    );
  }
}

function walkFiles(rootPath: string, allowedExtensions: string[]): string[] {
  const results: string[] = [];
  if (!existsSync(rootPath)) {
    return results;
  }

  const entries = readdirSync(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(absolutePath, allowedExtensions));
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (allowedExtensions.includes(extension)) {
      results.push(absolutePath);
    }
  }

  return results;
}

function relativeForDisplay(pathValue: string): string {
  return relative(repoRoot, pathValue).split(sep).join("/");
}

function parseRstTitle(pathValue: string): string {
  const content = readFileSync(pathValue, "utf8");
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = lines[index].trim();
    const next = lines[index + 1].trim();
    if (current.length === 0 || current.startsWith(":") || current.startsWith("..")) {
      continue;
    }
    if (/^[=\-~^`:#*+]+$/.test(next) && next.length >= Math.min(current.length, 3)) {
      return current;
    }
  }

  return basename(pathValue, extname(pathValue));
}

function titleFromPath(pathValue: string): string {
  const extension = extname(pathValue).toLowerCase();
  if (extension === ".rst") {
    return parseRstTitle(pathValue);
  }
  return basename(pathValue, extension);
}

function buildSlug(relativePathValue: string, title: string): string {
  if (relativePathValue === "index.rst") {
    return "index";
  }
  if (relativePathValue === "README.md") {
    return "readme";
  }
  if (relativePathValue.startsWith("classes/class_")) {
    return relativePathValue
      .replace(/^classes\/class_/i, "")
      .replace(/\.rst$/i, "")
      .toLowerCase();
  }
  return title.toLowerCase();
}

function classifyEntry(pathValue: string): DocEntry | null {
  const relativePathValue = relativeForDisplay(pathValue);

  if (relativePathValue === "README.md") {
    return {
      absolutePath: pathValue,
      relativePath: relativePathValue,
      section: "readme",
      slug: "readme",
      title: "README"
    };
  }

  if (relativePathValue === "index.rst") {
    return {
      absolutePath: pathValue,
      relativePath: relativePathValue,
      section: "root",
      slug: "index",
      title: titleFromPath(pathValue)
    };
  }

  const matchedSection = (Object.entries(sectionRoots) as Array<[ConcreteSection, string | null]>)
    .find(([, sectionPath]) => sectionPath !== null && relativePathValue.startsWith(`${sectionPath}/`));

  if (matchedSection === undefined) {
    return null;
  }

  const title = titleFromPath(pathValue);
  return {
    absolutePath: pathValue,
    relativePath: relativePathValue,
    section: matchedSection[0],
    slug: buildSlug(relativePathValue, title),
    title
  };
}

function loadEntries(): DocEntry[] {
  if (cachedEntries !== null) {
    return cachedEntries;
  }

  assertRepoReady();

  const files: string[] = [];
  if (existsSync(rootIndexPath)) {
    files.push(rootIndexPath);
  }
  if (existsSync(readmePath)) {
    files.push(readmePath);
  }

  for (const [section, rootDir] of Object.entries(sectionRoots) as Array<[ConcreteSection, string | null]>) {
    if (section === "root" || section === "readme" || rootDir === null) {
      continue;
    }
    files.push(...walkFiles(join(repoRoot, rootDir), [".rst"]));
  }

  const entries: DocEntry[] = [];
  for (const filePath of files) {
    const entry = classifyEntry(filePath);
    if (entry !== null) {
      entries.push(entry);
    }
  }

  entries.sort((left: DocEntry, right: DocEntry) => left.relativePath.localeCompare(right.relativePath));
  cachedEntries = entries;
  return cachedEntries;
}

function entryMatchesSection(entry: DocEntry, section: Section): boolean {
  return section === "all" ? true : entry.section === section;
}

function toOnlineUrl(entry: DocEntry): string | null {
  if (entry.section === "readme") {
    return "https://github.com/godotengine/godot-docs";
  }

  if (entry.section === "root") {
    return `${docsBaseUrl}/`;
  }

  if (entry.relativePath.endsWith(".rst")) {
    const pagePath = entry.relativePath.replace(/\.rst$/i, ".html");
    return `${docsBaseUrl}/${pagePath}`;
  }

  return null;
}

function listTopics(): string {
  const entries = loadEntries();
  const sections: ConcreteSection[] = [
    "root",
    "about",
    "community",
    "engine_details",
    "getting_started",
    "tutorials",
    "classes",
    "readme"
  ];

  const lines: string[] = [];
  for (const section of sections) {
    const scopedEntries = entries.filter((entry: DocEntry) => entry.section === section);
    lines.push(`${section} (${scopedEntries.length})`);

    let entriesToShow = scopedEntries;
    if (section === "classes") {
      const curatedSlugs = ["node", "node2d", "node3d", "characterbody2d", "characterbody3d", "tilemaplayer", "animationplayer", "animationtree", "camera2d", "camera3d", "area2d", "area3d", "input", "projectsettings"];
      const visibleEntries: DocEntry[] = scopedEntries.slice(0, 40);
      for (const slug of curatedSlugs) {
        const entry = scopedEntries.find((candidate: DocEntry) => candidate.slug === slug);
        if (entry !== undefined && !visibleEntries.some((candidate: DocEntry) => candidate.relativePath === entry.relativePath)) {
          visibleEntries.push(entry);
        }
      }
      entriesToShow = visibleEntries;
    }

    for (const entry of entriesToShow) {
      lines.push(`- ${entry.title}: ${entry.relativePath}`);
    }
    if (section === "classes" && scopedEntries.length > entriesToShow.length) {
      lines.push(`- ... ${scopedEntries.length - entriesToShow.length} more class entries`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function sanitizeQuery(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} muss ein String sein.`);
  }
  const query = value.trim();
  if (query.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} darf nicht leer sein.`);
  }
  return query;
}

function sanitizeSection(value: unknown): Section {
  if (value === undefined) {
    return "all";
  }
  const allowed: Section[] = ["all", "root", "about", "community", "engine_details", "getting_started", "tutorials", "classes", "readme"];
  if (typeof value !== "string" || !allowed.includes(value as Section)) {
    throw new McpError(ErrorCode.InvalidParams, `section muss einer von ${allowed.join(", ")} sein.`);
  }
  return value as Section;
}

function sanitizePositiveInteger(value: unknown, fallback: number, minimum: number, maximum: number, fieldName: string): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} muss eine Ganzzahl sein.`);
  }
  if (value < minimum || value > maximum) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} muss zwischen ${minimum} und ${maximum} liegen.`);
  }
  return value;
}

function searchDocs(query: string, section: Section, maxResults: number): SearchHit[] {
  const entries = loadEntries().filter((entry: DocEntry) => entryMatchesSection(entry, section));
  const needle = query.toLowerCase();
  const hits: SearchHit[] = [];

  for (const entry of entries) {
    const content = readFileSync(entry.absolutePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const lineText = lines[index];
      if (!lineText.toLowerCase().includes(needle)) {
        continue;
      }

      hits.push({
        relativePath: entry.relativePath,
        section: entry.section,
        line: index + 1,
        text: lineText.trim(),
        onlineUrl: toOnlineUrl(entry)
      });

      if (hits.length >= maxResults) {
        return hits;
      }
    }
  }

  return hits;
}

function resolveTarget(target: string): DocEntry {
  const normalizedTarget = target.trim().replace(/\\/g, "/").toLowerCase();
  if (normalizedTarget.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, "target darf nicht leer sein.");
  }

  const entries = loadEntries();

  const directMatch = entries.find((entry: DocEntry) => entry.relativePath.toLowerCase() === normalizedTarget);
  if (directMatch !== undefined) {
    return directMatch;
  }

  const preferredSectionOrder: ConcreteSection[] = [
    "classes",
    "getting_started",
    "tutorials",
    "engine_details",
    "about",
    "community",
    "root",
    "readme"
  ];

  const candidateMatches = entries
    .filter((entry: DocEntry) => entry.slug === normalizedTarget || entry.title.toLowerCase() === normalizedTarget)
    .sort((left: DocEntry, right: DocEntry) => preferredSectionOrder.indexOf(left.section) - preferredSectionOrder.indexOf(right.section));

  if (candidateMatches.length > 0) {
    return candidateMatches[0];
  }

  throw new McpError(
    ErrorCode.InvalidParams,
    `Kein Doku-Ziel gefunden fuer "${target}". Nutze list_topics oder einen relativen Pfad wie getting_started/first_2d_game/index.rst.`
  );
}

function readDoc(target: string, startLine: number, maxLines: number): string {
  const entry = resolveTarget(target);
  const content = readFileSync(entry.absolutePath, "utf8");
  const lines = content.split(/\r?\n/);
  const maxExistingLine = Math.max(1, lines.length);
  const firstLine = Math.min(Math.max(1, startLine), maxExistingLine);
  const lastLine = Math.min(lines.length, firstLine + maxLines - 1);
  const selected = lines.slice(firstLine - 1, lastLine);

  const header = [
    `Titel: ${entry.title}`,
    `Bereich: ${entry.section}`,
    `Pfad: ${entry.relativePath}`,
    `Online: ${toOnlineUrl(entry) ?? "-"}`,
    `Zeilen: ${firstLine}-${lastLine} von ${lines.length}`,
    ""
  ];

  const numberedLines = selected.map((lineText: string, index: number) => `${firstLine + index}: ${lineText}`);
  return [...header, ...numberedLines].join("\n");
}

function repoStatus(): string {
  assertRepoReady();
  const entries = loadEntries();
  const sourceStats = statSync(repoRoot);
  return [
    `Repo: ${repoRoot}`,
    `Dokumente: ${entries.length}`,
    `Stable-URL: ${docsBaseUrl}/`,
    `Letzte Änderung Mirror: ${sourceStats.mtime.toISOString()}`
  ].join("\n");
}

class GodotDocsServer {
  private readonly server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "godot-docs-mcp",
        version: "0.1.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.server.onerror = (error: unknown) => {
      console.error("[godot-docs-mcp]", error);
    };

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "godot_docs_search",
            description: "Durchsucht die offizielle lokale Godot stable Dokumentation per Volltext.",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Einfacher Suchtext." },
                section: {
                  type: "string",
                  enum: ["all", "root", "about", "community", "engine_details", "getting_started", "tutorials", "classes", "readme"]
                },
                max_results: { type: "integer", minimum: 1, maximum: 50 }
              },
              required: ["query"]
            }
          },
          {
            name: "godot_docs_read",
            description: "Liest eine konkrete Godot-Dokuseite anhand von Pfad, Seitentitel oder Klassenname.",
            inputSchema: {
              type: "object",
              properties: {
                target: { type: "string" },
                start_line: { type: "integer", minimum: 1, maximum: 100000 },
                max_lines: { type: "integer", minimum: 1, maximum: 400 }
              },
              required: ["target"]
            }
          },
          {
            name: "godot_docs_list_topics",
            description: "Listet die verfuegbaren Godot-Dokubereiche und Beispielseiten auf.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "godot_docs_status",
            description: "Zeigt den Status des lokalen Godot-Dokuspiegels.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments ?? {};

      if (toolName === "godot_docs_search") {
        const query = sanitizeQuery(args.query, "query");
        const section = sanitizeSection(args.section);
        const maxResults = sanitizePositiveInteger(args.max_results, 10, 1, 50, "max_results");
        const hits = searchDocs(query, section, maxResults);
        const text = hits.length === 0
          ? `Keine Treffer fuer "${query}" in ${section}.`
          : hits.map((hit: SearchHit) => {
              const urlPart = hit.onlineUrl ? ` | ${hit.onlineUrl}` : "";
              return `${hit.relativePath}:${hit.line} [${hit.section}] ${hit.text}${urlPart}`;
            }).join("\n");

        return {
          content: [{ type: "text", text }],
          structuredContent: {
            query,
            section,
            hits
          }
        };
      }

      if (toolName === "godot_docs_read") {
        const target = sanitizeQuery(args.target, "target");
        const startLine = sanitizePositiveInteger(args.start_line, 1, 1, 100000, "start_line");
        const maxLines = sanitizePositiveInteger(args.max_lines, 120, 1, 400, "max_lines");
        const text = readDoc(target, startLine, maxLines);
        return {
          content: [{ type: "text", text }]
        };
      }

      if (toolName === "godot_docs_list_topics") {
        return {
          content: [{ type: "text", text: listTopics() }]
        };
      }

      if (toolName === "godot_docs_status") {
        return {
          content: [{ type: "text", text: repoStatus() }]
        };
      }

      throw new McpError(ErrorCode.MethodNotFound, `Unbekanntes Tool: ${toolName}`);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new GodotDocsServer();
server.start().catch((error: unknown) => {
  console.error("[godot-docs-mcp] Start fehlgeschlagen", error);
  process.exit(1);
});
