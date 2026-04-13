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
import {
  INGEST_VISION_SCHEMA,
  handleIngestVision,
} from "./tools/ingest-vision.js";
import {
  INGEST_INTERVIEW_SCHEMA,
  handleIngestInterview,
} from "./tools/ingest-interview.js";
import {
  INGEST_KNOWLEDGE_BASE_SCHEMA,
  handleIngestKnowledgeBase,
} from "./tools/ingest-knowledge-base.js";
import {
  ANALYZE_GAPS_SCHEMA,
  handleAnalyzeGaps,
} from "./tools/analyze-gaps.js";
import {
  GENERATE_HARNESS_SCHEMA,
  handleGenerateHarness,
} from "./tools/generate-harness.js";
import {
  ANSWER_QUESTIONS_SCHEMA,
  handleAnswerQuestions,
} from "./tools/answer-questions.js";
import {
  ASSESS_INPUTS_SCHEMA,
  handleAssessInputs,
} from "./tools/assess-inputs.js";
import {
  VALIDATE_HARNESS_SCHEMA,
  handleValidateHarness,
} from "./tools/validate-harness.js";
import {
  EVALUATE_HARNESS_SCHEMA,
  handleEvaluateHarness,
} from "./tools/evaluate-harness.js";
import {
  HEALTH_CHECK_SCHEMA,
  handleHealthCheck,
} from "./tools/health-check.js";
import {
  DEFINE_NORTH_STAR_SCHEMA,
  handleDefineNorthStar,
} from "./tools/define-north-star.js";
import {
  LIST_CAPABILITIES_SCHEMA,
  REGISTER_CAPABILITY_SCHEMA,
  REMOVE_CAPABILITY_SCHEMA,
  LIST_PROJECTS_SCHEMA,
  GET_PROJECT_SCHEMA,
  DELETE_PROJECT_SCHEMA,
  EXPORT_HANDBOOK_SCHEMA,
  handleListCapabilities,
  handleRegisterCapability,
  handleRemoveCapability,
  handleListProjects,
  handleGetProject,
  handleDeleteProject,
  handleExportHandbook,
} from "./tools/manage-registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR =
  process.env.HARNESS_FACTORY_DATA_DIR ?? join(__dirname, "..", "data");

const store = new Store(DATA_DIR);

const server = new Server(
  {
    name: "harness-factory",
    version: "0.4.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// ── Tools ──

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    INGEST_VISION_SCHEMA,
    INGEST_KNOWLEDGE_BASE_SCHEMA,
    INGEST_INTERVIEW_SCHEMA,
    ASSESS_INPUTS_SCHEMA,
    ANALYZE_GAPS_SCHEMA,
    DEFINE_NORTH_STAR_SCHEMA,
    GENERATE_HARNESS_SCHEMA,
    ANSWER_QUESTIONS_SCHEMA,
    VALIDATE_HARNESS_SCHEMA,
    EVALUATE_HARNESS_SCHEMA,
    HEALTH_CHECK_SCHEMA,
    LIST_CAPABILITIES_SCHEMA,
    REGISTER_CAPABILITY_SCHEMA,
    REMOVE_CAPABILITY_SCHEMA,
    LIST_PROJECTS_SCHEMA,
    GET_PROJECT_SCHEMA,
    DELETE_PROJECT_SCHEMA,
    EXPORT_HANDBOOK_SCHEMA,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case "ingest_vision":
        result = await handleIngestVision(
          store,
          args as Parameters<typeof handleIngestVision>[1],
        );
        break;
      case "ingest_knowledge_base":
        result = await handleIngestKnowledgeBase(
          store,
          args as Parameters<typeof handleIngestKnowledgeBase>[1],
        );
        break;
      case "ingest_interview":
        result = await handleIngestInterview(
          store,
          args as Parameters<typeof handleIngestInterview>[1],
        );
        break;
      case "assess_inputs":
        result = await handleAssessInputs(
          store,
          args as Parameters<typeof handleAssessInputs>[1],
        );
        break;
      case "analyze_gaps":
        result = await handleAnalyzeGaps(
          store,
          args as Parameters<typeof handleAnalyzeGaps>[1],
        );
        break;
      case "define_north_star":
        result = await handleDefineNorthStar(
          store,
          args as Parameters<typeof handleDefineNorthStar>[1],
        );
        break;
      case "generate_harness":
        result = await handleGenerateHarness(
          store,
          args as Parameters<typeof handleGenerateHarness>[1],
        );
        break;
      case "answer_questions":
        result = await handleAnswerQuestions(
          store,
          args as Parameters<typeof handleAnswerQuestions>[1],
        );
        break;
      case "validate_harness":
        result = await handleValidateHarness(
          store,
          args as Parameters<typeof handleValidateHarness>[1],
        );
        break;
      case "evaluate_harness":
        result = await handleEvaluateHarness(
          store,
          args as Parameters<typeof handleEvaluateHarness>[1],
        );
        break;
      case "health_check":
        result = await handleHealthCheck(
          store,
          args as Parameters<typeof handleHealthCheck>[1],
        );
        break;
      case "list_capabilities":
        result = await handleListCapabilities(
          store,
          args as Parameters<typeof handleListCapabilities>[1],
        );
        break;
      case "register_capability":
        result = await handleRegisterCapability(
          store,
          args as Parameters<typeof handleRegisterCapability>[1],
        );
        break;
      case "list_projects":
        result = await handleListProjects(store);
        break;
      case "get_project":
        result = await handleGetProject(
          store,
          args as Parameters<typeof handleGetProject>[1],
        );
        break;
      case "delete_project":
        result = await handleDeleteProject(
          store,
          args as Parameters<typeof handleDeleteProject>[1],
        );
        break;
      case "remove_capability":
        result = await handleRemoveCapability(
          store,
          args as Parameters<typeof handleRemoveCapability>[1],
        );
        break;
      case "export_handbook":
        result = await handleExportHandbook(
          store,
          args as Parameters<typeof handleExportHandbook>[1],
        );
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
      name: "Agent 能力注册表",
      description:
        "Agent 所有已注册的能力（Skill）清单，包含分类、描述、可复用模式",
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

Harness Factory 是一个 MCP 服务，帮助 Agent 为任何业务流程生成自动化执行手册（Harness）。
它将 Harness Engineering 方法论标准化为可调用的工具链。

## 核心理念

**数字化 ≠ 自动化现有流程。** 要先重新审视流程本身。

三层输入：
1. **战略视角**（认知水平高的人）→ 这件事 **应该** 怎么做
2. **知识库**（部门制度文档、SOP）→ 文档里 **写的** 怎么做
3. **一线访谈**（实际做业务的人）→ 这件事 **实际** 怎么做

三者之间的偏差本身就是最有价值的分析素材：
- 知识库有但没人看 → 文档过时或不实用
- 一线有变通做法但知识库没写 → 隐性知识未沉淀
- 知识库写的和实际不一样 → 流程已演化但文档没跟上
- 知识库有 SOP 但一线说痛苦 → SOP 本身需要重构

Agent 的角色是 **第四个分析者**——拿到三层输入后，做四维差距分析，再精准追问。

## 工作流

### Step 1: 接收战略视角
\`\`\`
调用 ingest_vision
← 业务负责人的描述 / 规划文档 / OKR
→ 结构化的战略视角
\`\`\`

### Step 2: 接收知识库
\`\`\`
调用 ingest_knowledge_base（可多次）
← 飞书知识库 / 制度文档 / SOP
→ 结构化的文档视角（流程、制度、SOP、表单模板、过时迹象）
\`\`\`

### Step 3: 接收一线访谈
\`\`\`
调用 ingest_interview（可多次）
← 访谈文字记录 / 飞书妙记转写 / 文档
→ 结构化的现实视角（流程、痛点、隐性知识、变通做法）
\`\`\`

### Step 4: 输入质量门禁 🚦
\`\`\`
调用 assess_inputs
→ 评估三层输入的完整度和质量
→ 如果评分 ≥70 且无阻塞问题 → 继续
→ 如果评分 <70 或有阻塞问题 → 回到 Step 1-3 补充
\`\`\`

### Step 5: 四维差距分析
\`\`\`
调用 analyze_gaps
→ 第一次调用：返回项目数据 + 能力注册表，供 Agent 分析
← 第二次调用：传入分析结果（含 docs_vs_reality）
→ 精准追问列表
\`\`\`

### Step 6: 精准追问
\`\`\`
Agent 带着分析结果向业务方确认：
- 控制权边界（哪些全自动、哪些人工确认）
- AI 原生方案是否可接受
- 知识库中哪些合规约束必须保留
- 关键决策点
\`\`\`

### Step 6.5: 定义北极星指标 ⭐
\`\`\`
调用 define_north_star
→ 第一次调用：返回分析结果，供 Agent 按四公理筛选指标
← 第二次调用：传入北极星定义（1个主指标 + 护栏 + 观察指标 + 故事素材）

核心原则：你衡量什么，你就变成什么。
选对指标，每次优化都创造真实价值。选错指标，团队越努力离正确方向越远。
\`\`\`

### Step 7: 生成执行手册
\`\`\`
调用 generate_harness
← 完整的手册结构 + Markdown 内容
→ 存储手册，注册新能力到注册表
\`\`\`

### Step 8: 手册质量自检 🚦
\`\`\`
调用 validate_harness
→ 七维度结构性检查（控制权覆盖、失败处理、人工确认点、配置外置、实施可行性、数据架构、依赖闭环）
→ 如果通过（无 critical）→ 继续发布
→ 如果不通过 → 回到 Step 7 修订
\`\`\`

### Step 9: 发布 & 执行
\`\`\`
调用 export_handbook → 导出 Markdown 或 JSON
Agent 将手册发布为飞书文档
按手册逐阶段执行
\`\`\`

### Step 10: 运行时健康检查 🔄
\`\`\`
定期调用 health_check
→ 收集运行数据（转化率、异常率、人工干预率、配置变更）
→ 生成健康报告
→ 如果 needs_revision=true → 回到 Step 5 重新分析和修订
\`\`\`

## 质量自省闭环

\`\`\`
输入质量门禁 → 分析 → 定义北极星 → 生成 → 手册质量自检 → 执行 → 健康检查
     ↑                                                              │
     └──────────────── needs_revision=true ←────────────────────────┘
\`\`\`

四层质量控制：
1. **assess_inputs** — 生成前：输入够不够好？
2. **define_north_star** — 分析后：用什么衡量成败？（你衡量什么，你就变成什么）
3. **validate_harness** — 生成后：手册质量过不过关？
4. **health_check** — 运行时：北极星指标趋势如何？需不需要修订？

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
