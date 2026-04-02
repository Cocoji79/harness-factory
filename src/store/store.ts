import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Project, Capability } from "../types.js";

export class Store {
  private readonly dataDir: string;
  private readonly projectsDir: string;
  private readonly registryPath: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.projectsDir = join(dataDir, "projects");
    this.registryPath = join(dataDir, "capabilities.json");
  }

  async init(): Promise<void> {
    await mkdir(this.projectsDir, { recursive: true });
  }

  // ── Projects ──

  async createProject(businessName: string): Promise<Project> {
    const project: Project = {
      id: randomUUID().slice(0, 8),
      business_name: businessName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "gathering",
      knowledge_bases: [],
      interviews: [],
    };
    await this.saveProject(project);
    return project;
  }

  private validateId(id: string): void {
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error(
        `无效的项目 ID: "${id}"，只允许字母、数字、下划线和连字符`,
      );
    }
  }

  async getProject(id: string): Promise<Project> {
    this.validateId(id);
    const path = join(this.projectsDir, `${id}.json`);
    const data = await readFile(path, "utf-8");
    return JSON.parse(data) as Project;
  }

  async saveProject(project: Project): Promise<void> {
    project.updated_at = new Date().toISOString();
    const path = join(this.projectsDir, `${project.id}.json`);
    await writeFile(path, JSON.stringify(project, null, 2), "utf-8");
  }

  async listProjects(): Promise<
    Array<{
      id: string;
      business_name: string;
      status: string;
      updated_at: string;
    }>
  > {
    try {
      const files = await readdir(this.projectsDir);
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
    } catch {
      return [];
    }
  }

  async deleteProject(id: string): Promise<void> {
    this.validateId(id);
    const path = join(this.projectsDir, `${id}.json`);
    await unlink(path);
  }

  // ── Capability Registry ──

  async getCapabilities(): Promise<Capability[]> {
    try {
      const data = await readFile(this.registryPath, "utf-8");
      return JSON.parse(data) as Capability[];
    } catch {
      return [];
    }
  }

  async saveCapabilities(capabilities: Capability[]): Promise<void> {
    await writeFile(
      this.registryPath,
      JSON.stringify(capabilities, null, 2),
      "utf-8",
    );
  }

  async addCapability(capability: Capability): Promise<void> {
    const capabilities = await this.getCapabilities();
    const existingIndex = capabilities.findIndex(
      (c) => c.name === capability.name,
    );
    if (existingIndex >= 0) {
      capabilities[existingIndex] = capability;
    } else {
      capabilities.push(capability);
    }
    await this.saveCapabilities(capabilities);
  }

  async removeCapability(name: string): Promise<boolean> {
    const capabilities = await this.getCapabilities();
    const index = capabilities.findIndex((c) => c.name === name);
    if (index < 0) return false;
    capabilities.splice(index, 1);
    await this.saveCapabilities(capabilities);
    return true;
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
