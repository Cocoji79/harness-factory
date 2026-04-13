import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Project, Capability, HarnessPattern } from "../types.js";

/**
 * File-based storage layer for projects and capabilities.
 *
 * NOTE: Read-modify-write operations (addCapability, removeCapability) are NOT
 * concurrency-safe. This is acceptable for single-client stdio transport, but
 * must be addressed if the server is used with SSE/multi-client transport.
 */
export class Store {
  private readonly dataDir: string;
  private readonly projectsDir: string;
  private readonly registryPath: string;
  private readonly patternsPath: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.projectsDir = join(dataDir, "projects");
    this.registryPath = join(dataDir, "capabilities.json");
    this.patternsPath = join(dataDir, "patterns.json");
  }

  async init(): Promise<void> {
    await mkdir(this.projectsDir, { recursive: true });
  }

  // ── Projects ──

  private generateId(): string {
    return randomUUID().slice(0, 12);
  }

  private validateId(id: string): void {
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error(
        `无效的项目 ID: "${id}"，只允许字母、数字、下划线和连字符`,
      );
    }
  }

  async createProject(businessName: string): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: this.generateId(),
      business_name: businessName,
      created_at: now,
      updated_at: now,
      status: "gathering",
      knowledge_bases: [],
      interviews: [],
      health_reports: [],
    };
    await this.saveProject(project);
    return project;
  }

  async getProject(id: string): Promise<Project> {
    this.validateId(id);
    const path = join(this.projectsDir, `${id}.json`);
    try {
      const data = await readFile(path, "utf-8");
      return JSON.parse(data) as Project;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`项目 ${id} 不存在`);
      }
      throw error;
    }
  }

  async saveProject(project: Project): Promise<void> {
    const updated = { ...project, updated_at: new Date().toISOString() };
    const path = join(this.projectsDir, `${updated.id}.json`);
    await writeFile(path, JSON.stringify(updated, null, 2), "utf-8");
  }

  async listProjects(): Promise<
    Array<{
      id: string;
      business_name: string;
      status: string;
      updated_at: string;
    }>
  > {
    let files: string[];
    try {
      files = await readdir(this.projectsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const projects = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const data = await readFile(join(this.projectsDir, f), "utf-8");
          const p = JSON.parse(data) as Project;
          return {
            id: p.id,
            business_name: p.business_name,
            status: p.status,
            updated_at: p.updated_at,
          };
        }),
    );
    return projects;
  }

  async deleteProject(id: string): Promise<void> {
    this.validateId(id);
    const path = join(this.projectsDir, `${id}.json`);
    try {
      await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`项目 ${id} 不存在`);
      }
      throw error;
    }
  }

  // ── Generic JSON file helpers ──

  private async readJsonArray<T>(path: string): Promise<T[]> {
    try {
      const data = await readFile(path, "utf-8");
      return JSON.parse(data) as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async writeJsonArray<T>(path: string, items: T[]): Promise<void> {
    await writeFile(path, JSON.stringify(items, null, 2), "utf-8");
  }

  // ── Capability Registry ──

  async getCapabilities(): Promise<Capability[]> {
    return this.readJsonArray<Capability>(this.registryPath);
  }

  async saveCapabilities(capabilities: Capability[]): Promise<void> {
    await this.writeJsonArray(this.registryPath, capabilities);
  }

  async addCapability(capability: Capability): Promise<void> {
    const capabilities = await this.getCapabilities();
    const existingIndex = capabilities.findIndex(
      (c) => c.name === capability.name,
    );
    const updated =
      existingIndex >= 0
        ? capabilities.map((c, i) => (i === existingIndex ? capability : c))
        : [...capabilities, capability];
    await this.saveCapabilities(updated);
  }

  async removeCapability(name: string): Promise<boolean> {
    const capabilities = await this.getCapabilities();
    const filtered = capabilities.filter((c) => c.name !== name);
    if (filtered.length === capabilities.length) return false;
    await this.saveCapabilities(filtered);
    return true;
  }

  // ── Pattern Library ──

  async getPatterns(): Promise<HarnessPattern[]> {
    return this.readJsonArray<HarnessPattern>(this.patternsPath);
  }

  async savePatterns(patterns: HarnessPattern[]): Promise<void> {
    await this.writeJsonArray(this.patternsPath, patterns);
  }

  async addPattern(pattern: HarnessPattern): Promise<void> {
    const patterns = await this.getPatterns();
    const existing = patterns.findIndex((p) => p.id === pattern.id);
    const updated =
      existing >= 0
        ? patterns.map((p, i) => (i === existing ? pattern : p))
        : [...patterns, pattern];
    await this.savePatterns(updated);
  }

  async searchCapabilities(query: string): Promise<Capability[]> {
    const capabilities = await this.getCapabilities();
    const lower = query.toLowerCase();
    return capabilities.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower) ||
        c.category.toLowerCase().includes(lower) ||
        c.reusable_patterns.some((p) => p.toLowerCase().includes(lower)),
    );
  }
}
