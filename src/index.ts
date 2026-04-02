#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Store } from "./store/store.js";
import { INGEST_VISION_SCHEMA, handleIngestVision } from "./tools/ingest-vision.js";
import { INGEST_INTERVIEW_SCHEMA, handleIngestInterview } from "./tools/ingest-interview.js";
import { ANALYZE_GAPS_SCHEMA, handleAnalyzeGaps } from "./tools/analyze-gaps.js";
import { GENERATE_HARNESS_SCHEMA, handleGenerateHarness } from "./tools/generate-harness.js";
import {
  LIST_CAPABILITIES_SCHEMA,
  REGISTER_CAPABILITY_SCHEMA,
  LIST_PROJECTS_SCHEMA,
  GET_PROJECT_SCHEMA,
  handleListCapabilities,
  handleRegisterCapability,
  handleListProjects,
  handleGetProject,
} from "./tools/manage-registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = process.env.HARNESS_FACTORY_DATA_DIR ?? join(__dirname, "..", "data");

const store = new Store(DATA_DIR);

const server = new Server(
  {
    name: "harness-factory",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ── Tools ──

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    INGEST_VISION_SCHEMA,
    INGEST_INTERVIEW_SCHEMA,
    ANALYZE_GAPS_SCHEMA,
    GENERATE_HARNESS_SCHEMA,
    LIST_CAPABILITIES_SCHEMA,
    REGISTER_CAPABILITY_SCHEMA,
    LIST_PROJECTS_SCHEMA,
    GET_PROJECT_SCHEMA,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case "ingest_vision":
        result = await handleIngestVision(store, args as Parameters<typeof handleIngestVision>[1]);
        break;
      case "ingest_interview":
        result = await handleIngestInterview(store, args as Parameters<typeof handleIngestInterview>[1]);
        break;
      case "analyze_gaps":
        result = await handleAnalyzeGaps(store, args as Parameters<typeof handleAnalyzeGaps>[1]);
        break;
      case "generate_harness":
        result = await handleGenerateHarness(store, args as Parameters<typeof handleGenerateHarness>[1]);
        break;
      case "list_capabilities":
        result = await handleListCapabilities(store, args as Parameters<typeof handleListCapabilities>[1]);
        break;
      case "register_capability":
        result = await handleRegisterCapability(
          store,
          args as Parameters<typeof handleRegisterCapability>[1]
        );
        break;
      case "list_projects":
        result = await handleListProjects(store);
        break;
      case "get_project":
        result = await handleGetProject(store, args as Parameters<typeof handleGetProject>[1]);
        break;
      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text" as const, text: result }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Resources ──

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "harness-factory://capabilities",
      name: "Anya 能力注册表",
      description: "Anya 所有已注册的能力（Skill）清单，包含分类、描述、可复用模式",
      mimeType: "application/json",
    },
    {
      uri: "harness-factory://workflow",
      name: "Harness Factory 使用流程",
      description: "如何使用 Harness Factory 的完整工作流说明",
      mimeType: "text/markdown",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "harness-factory://capabilities") {
    const capabilities = await store.getCapabilities();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(capabilities, null, 2),
        },
      ],
    };
  }

  if (uri === "harness-factory://workflow") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: WORKFLOW_DOC,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

const WORKFLOW_DOC = `# Harness Factory 使用流程

## 概述

Harness Factory 是一个 MCP 服务，帮助 Anya 为任何业务流程生成自动化执行手册（Harness）。
它将 Harness Engineering 方法论标准化为可调用的工具链。

## 核心理念

**数字化 ≠ 自动化现有流程。** 要先重新审视流程本身。

两层输入：
1. **战略视角**（认知水平高的人）→ 这件事 **应该** 怎么做
2. **一线访谈**（实际做业务的人）→ 这件事 **实际** 怎么做

Anya 的角色是 **第三个分析者**——拿到两层输入后，做三角差距分析，再精准追问。

## 工作流

### Step 1: 接收战略视角
\`\`\`
调用 ingest_vision
← 业务负责人的描述 / 规划文档 / OKR
→ 结构化的战略视角
\`\`\`

### Step 2: 接收一线访谈
\`\`\`
调用 ingest_interview（可多次）
← 访谈文字记录 / 飞书妙记转写 / 文档
→ 结构化的现实视角（流程、痛点、隐性知识、变通做法）
\`\`\`

### Step 3: 三角差距分析
\`\`\`
调用 analyze_gaps
→ 第一次调用：返回项目数据 + 能力注册表，供 Anya 分析
← 第二次调用：传入分析结果
→ 精准追问列表
\`\`\`

### Step 4: 精准追问
\`\`\`
Anya 带着分析结果向业务方确认：
- 控制权边界（哪些全自动、哪些人工确认）
- AI 原生方案是否可接受
- 关键决策点
\`\`\`

### Step 5: 生成执行手册
\`\`\`
调用 generate_harness
← 完整的手册结构 + Markdown 内容
→ 存储手册，注册新能力到注册表
\`\`\`

### Step 6: 发布 & 执行
\`\`\`
Anya 将手册发布为飞书文档
按手册逐阶段执行
\`\`\`

## Harness Engineering 五约束

每份手册都必须满足：

| 约束 | 含义 |
|------|------|
| 状态可观测 | 业务方随时能看到每个对象在哪个阶段 |
| 决策可审计 | Agent 的每次判断都有据可查 |
| 失败可恢复 | 任何一步出错不会搞崩整条线 |
| 控制权清晰 | 全自动 vs 人工确认的边界明确且可调 |
| 配置驱动 | 阈值、模板、人员等参数业务方能自己改 |

## 飞轮效应

每做一个业务，能力注册表就变大：
- 新建的 Skill 会自动注册
- 下一个业务的 analyze_gaps 能匹配到更多已有能力
- 可复用模式（邮件闭环、调度器、异常处理）跨业务共享
`;

// ── Start ──

async function main() {
  await store.init();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
