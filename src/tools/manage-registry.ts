import type { Store } from "../store/store.js";
import type { Capability } from "../types.js";

export const LIST_CAPABILITIES_SCHEMA = {
  name: "list_capabilities",
  description: `列出 Agent 的能力注册表中所有已注册的能力。
支持按分类或关键词筛选。用于在分析阶段了解 Agent 能做什么。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        description:
          "按分类筛选（可选），如「飞书文档」「HR/招聘」「核心能力」",
      },
      search: {
        type: "string",
        description: "关键词搜索（可选），搜索名称、描述、可复用模式",
      },
    },
  },
} as const;

export const REGISTER_CAPABILITY_SCHEMA = {
  name: "register_capability",
  description: `向 Agent 的能力注册表中添加或更新一个能力。
当 Agent 新建了一个 Skill，或者发现了一个可复用的模式时，应注册到这里。
这样后续的 analyze_gaps 能自动匹配到这些新能力。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "能力名称，如 /interview-scheduler",
      },
      category: {
        type: "string",
        description: "分类，如「HR/招聘」「客户管理」",
      },
      description: { type: "string", description: "能力描述" },
      input: { type: "string", description: "输入描述" },
      output: { type: "string", description: "输出描述" },
      feishu_apis: {
        type: "array",
        items: { type: "string" },
        description: "依赖的飞书 API",
      },
      reusable_patterns: {
        type: "array",
        items: { type: "string" },
        description: "可复用模式标签，如「邮件沟通闭环」「定时调度」",
      },
    },
    required: ["name", "category", "description"],
  },
} as const;

export const LIST_PROJECTS_SCHEMA = {
  name: "list_projects",
  description: "列出所有已创建的 Harness 项目及其状态。",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
} as const;

export const GET_PROJECT_SCHEMA = {
  name: "get_project",
  description:
    "获取指定项目的完整数据，包括战略视角、访谈记录、分析结果和手册。",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleListCapabilities(
  store: Store,
  args: { category?: string; search?: string },
): Promise<string> {
  let capabilities: Capability[];

  if (args.search) {
    capabilities = await store.searchCapabilities(args.search);
  } else {
    capabilities = await store.getCapabilities();
  }

  if (args.category) {
    capabilities = capabilities.filter((c) =>
      c.category.toLowerCase().includes(args.category!.toLowerCase()),
    );
  }

  const categories = [...new Set(capabilities.map((c) => c.category))];

  return JSON.stringify(
    {
      total: capabilities.length,
      categories,
      capabilities: capabilities.map((c) => ({
        name: c.name,
        category: c.category,
        description: c.description,
        reusable_patterns: c.reusable_patterns,
      })),
    },
    null,
    2,
  );
}

export async function handleRegisterCapability(
  store: Store,
  args: {
    name: string;
    category: string;
    description: string;
    input?: string;
    output?: string;
    feishu_apis?: string[];
    reusable_patterns?: string[];
  },
): Promise<string> {
  const capability: Capability = {
    name: args.name,
    category: args.category,
    description: args.description,
    input: args.input ?? "",
    output: args.output ?? "",
    feishu_apis: args.feishu_apis ?? [],
    reusable_patterns: args.reusable_patterns ?? [],
  };

  await store.addCapability(capability);

  return JSON.stringify({
    status: "registered",
    capability: {
      name: capability.name,
      category: capability.category,
      description: capability.description,
      reusable_patterns: capability.reusable_patterns,
    },
  });
}

export async function handleListProjects(store: Store): Promise<string> {
  const projects = await store.listProjects();
  return JSON.stringify({ total: projects.length, projects }, null, 2);
}

export async function handleGetProject(
  store: Store,
  args: { project_id: string },
): Promise<string> {
  const project = await store.getProject(args.project_id);
  return JSON.stringify(project, null, 2);
}

// ── Delete Project ──

export const DELETE_PROJECT_SCHEMA = {
  name: "delete_project",
  description:
    "删除指定项目及其所有数据（战略视角、访谈记录、分析结果、手册）。此操作不可逆。",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleDeleteProject(
  store: Store,
  args: { project_id: string },
): Promise<string> {
  await store.deleteProject(args.project_id);
  return JSON.stringify({ status: "deleted", project_id: args.project_id });
}

// ── Remove Capability ──

export const REMOVE_CAPABILITY_SCHEMA = {
  name: "remove_capability",
  description: "从 Agent 能力注册表中移除一个能力。",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "要移除的能力名称",
      },
    },
    required: ["name"],
  },
} as const;

export async function handleRemoveCapability(
  store: Store,
  args: { name: string },
): Promise<string> {
  const removed = await store.removeCapability(args.name);
  if (removed) {
    return JSON.stringify({ status: "removed", name: args.name });
  }
  return JSON.stringify({ status: "not_found", name: args.name });
}

// ── Export Handbook ──

export const EXPORT_HANDBOOK_SCHEMA = {
  name: "export_handbook",
  description: `导出项目的执行手册内容。支持 markdown 和 json 两种格式。
不依赖任何特定平台，可以用于任何文档系统。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
      format: {
        type: "string",
        enum: ["markdown", "json"],
        description:
          "导出格式：markdown=纯 Markdown 文本，json=完整结构化数据。默认 markdown。",
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleExportHandbook(
  store: Store,
  args: { project_id: string; format?: "markdown" | "json" },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.harness) {
    return JSON.stringify({
      error: "该项目尚未生成执行手册，请先调用 generate_harness",
    });
  }

  const format = args.format ?? "markdown";

  if (format === "markdown") {
    return project.harness.markdown_content;
  }

  return JSON.stringify(
    {
      business_name: project.harness.business_name,
      principles: project.harness.principles,
      data_architecture: project.harness.data_architecture,
      control_matrix: project.harness.control_matrix,
      existing_skills: project.harness.existing_skills,
      new_skills: project.harness.new_skills,
      scheduled_tasks: project.harness.scheduled_tasks,
      implementation_phases: project.harness.implementation_phases,
      communication_checklist: project.harness.communication_checklist,
    },
    null,
    2,
  );
}
