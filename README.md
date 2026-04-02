# Harness Factory

[中文](#中文) | [English](#english)

---

## 中文

### 这是什么

Harness Factory 是一个 MCP（Model Context Protocol）服务，帮助 AI Agent 为任何业务流程生成自动化执行手册。

它实现了 **Harness Engineering** 方法论：不是简单地把现有流程数字化，而是先重新审视流程本身，再设计 AI 原生的自动化方案。

### 核心理念

> 数字化 ≠ 自动化现有流程。要先重新审视流程本身。

传统做法：让业务人员描述流程 → 逐步搬到线上。
Harness Factory：**三层输入 + 四维分析**。

| 输入层 | 来源 | 解决什么 |
|--------|------|----------|
| 战略视角 | 认知水平高的人（业务负责人、管理者） | 这件事 **应该** 怎么做 |
| 知识库 | 部门制度文档、SOP、飞书知识库 | 文档里 **写的** 怎么做 |
| 一线访谈 | 实际做业务的人的访谈记录 | 这件事 **实际** 怎么做 |

三者之间的偏差是最有价值的分析素材：
- 知识库有但没人看 → 文档过时或不实用
- 一线有变通做法但知识库没写 → 隐性知识未沉淀
- 知识库和实际不一样 → 流程已演化但文档没跟上
- 知识库有 SOP 但一线说痛苦 → SOP 本身需要重构

Agent 作为 **第四个分析者**，对比三层输入，做四维差距分析，然后精准追问。

### 工作流程

```
Step 1: ingest_vision          ← 接收战略视角
Step 2: ingest_knowledge_base  ← 接收知识库/制度文档（可多次）
Step 3: ingest_interview       ← 接收一线访谈（可多次）
Step 4: analyze_gaps           → 四维差距分析 + AI 原生流程重构
Step 5: Agent 精准追问          → 带着分析结果向业务方确认
Step 6: generate_harness       → 生成完整执行手册
Step 7: 发布 & 执行             → Agent 按手册逐阶段落地
```

### 提供的 Tool

| Tool | 用途 |
|------|------|
| `ingest_vision` | 接收战略视角（业务负责人描述 / 规划文档 / OKR） |
| `ingest_knowledge_base` | 接收知识库（飞书 Wiki / 制度文档 / SOP） |
| `ingest_interview` | 接收一线访谈记录（飞书妙记 / 文字记录 / 文档） |
| `analyze_gaps` | 四维差距分析——核心 Tool |
| `generate_harness` | 生成 Agent 执行手册 |
| `list_capabilities` | 查询 Agent 能力注册表 |
| `register_capability` | 注册新能力（驱动飞轮效应） |
| `list_projects` | 列出所有 Harness 项目 |
| `get_project` | 获取项目详情 |

### 提供的 Resource

| Resource | 用途 |
|----------|------|
| `harness-factory://capabilities` | Agent 能力注册表完整数据 |
| `harness-factory://workflow` | Harness Factory 使用流程说明 |

### Harness Engineering 五约束

每份生成的手册都必须满足：

| 约束 | 含义 |
|------|------|
| **状态可观测** | 业务方随时能看到每个对象在哪个阶段 |
| **决策可审计** | Agent 的每次判断都有据可查 |
| **失败可恢复** | 任何一步出错不会搞崩整条线 |
| **控制权清晰** | 全自动 vs 人工确认的边界明确且可调 |
| **配置驱动** | 阈值、模板、人员等参数业务方能自己改 |

### 飞轮效应

每做一个业务，能力注册表就变大。新建的 Skill 自动注册，下一个业务的 `analyze_gaps` 能匹配到更多已有能力。可复用模式（邮件闭环、调度器、异常处理）跨业务共享。

### 安装与使用

```bash
# 安装
git clone https://github.com/Cocoji79/harness-factory.git
cd harness-factory
npm install
npm run build

# 启动（通常由 MCP 客户端自动启动）
node dist/index.js
```

#### MCP 客户端配置

```json
{
  "mcpServers": {
    "harness-factory": {
      "command": "node",
      "args": ["/path/to/harness-factory/dist/index.js"]
    }
  }
}
```

#### 自定义数据目录

```bash
HARNESS_FACTORY_DATA_DIR=/path/to/data node dist/index.js
```

### 项目结构

```
harness-factory/
├── src/
│   ├── index.ts                 # MCP 服务入口
│   ├── types.ts                 # 类型定义
│   ├── store/store.ts           # 文件存储层
│   └── tools/
│       ├── ingest-vision.ts          # 战略视角输入
│       ├── ingest-knowledge-base.ts  # 知识库输入
│       ├── ingest-interview.ts       # 一线访谈输入
│       ├── analyze-gaps.ts           # 四维差距分析
│       ├── generate-harness.ts  # 手册生成
│       └── manage-registry.ts   # 能力注册表 + 项目管理
├── data/
│   ├── capabilities.json        # 预置能力注册表
│   └── projects/                # 项目数据
├── package.json
└── tsconfig.json
```

---

## English

### What is this

Harness Factory is an MCP (Model Context Protocol) service that helps AI Agents generate automation handbooks for any business process.

It implements the **Harness Engineering** methodology: instead of simply digitizing existing workflows, it first re-examines the process itself, then designs AI-native automation solutions.

### Core Philosophy

> Digitization ≠ automating existing processes. Re-examine the process first.

Traditional approach: ask staff to describe their workflow → move it online step by step.
Harness Factory: **three-layer input + four-dimensional analysis**.

| Input Layer | Source | What it solves |
|-------------|--------|----------------|
| Strategic Vision | High-level thinkers (business owners, managers) | How things **should** work |
| Knowledge Base | Department docs, SOPs, wiki | How things are **documented** |
| Frontline Interviews | People who actually do the work | How things **actually** work |

The gaps between these three layers are the most valuable analytical material:
- KB exists but nobody reads it → docs are stale or impractical
- Frontline has workarounds not in KB → tacit knowledge not captured
- KB differs from reality → process evolved but docs didn't follow
- KB has SOPs but frontline complains → the SOP itself needs redesign

The Agent acts as the **fourth analyst** — comparing all three layers, performing four-dimensional gap analysis, then asking targeted questions.

### Workflow

```
Step 1: ingest_vision          ← Receive strategic vision
Step 2: ingest_knowledge_base  ← Receive knowledge base docs (multiple)
Step 3: ingest_interview       ← Receive frontline interviews (multiple)
Step 4: analyze_gaps           → Four-dimensional gap analysis + AI-native redesign
Step 5: Agent asks targeted     → Confirm key decisions with stakeholders
        questions
Step 6: generate_harness       → Generate complete execution handbook
Step 7: Publish & Execute      → Agent executes phase by phase
```

### Tools

| Tool | Purpose |
|------|---------|
| `ingest_vision` | Receive strategic vision (descriptions / planning docs / OKRs) |
| `ingest_knowledge_base` | Receive knowledge base (wiki / policy docs / SOPs) |
| `ingest_interview` | Receive frontline interview transcripts |
| `analyze_gaps` | Four-dimensional gap analysis — the core Tool |
| `generate_harness` | Generate Agent execution handbook |
| `list_capabilities` | Query Agent capability registry |
| `register_capability` | Register new capabilities (flywheel effect) |
| `list_projects` | List all Harness projects |
| `get_project` | Get project details |

### Resources

| Resource | Purpose |
|----------|---------|
| `harness-factory://capabilities` | Full Agent capability registry |
| `harness-factory://workflow` | Harness Factory workflow guide |

### Harness Engineering: Five Constraints

Every generated handbook must satisfy:

| Constraint | Meaning |
|------------|---------|
| **Observable State** | Stakeholders can see where every object is at any time |
| **Auditable Decisions** | Every Agent judgment is traceable |
| **Recoverable Failures** | No single step failure crashes the pipeline |
| **Clear Control Rights** | Full-auto vs human-confirmed boundaries are explicit and adjustable |
| **Config-Driven** | Thresholds, templates, personnel — all adjustable without code changes |

### Flywheel Effect

Each business process grows the capability registry. New Skills are auto-registered; the next `analyze_gaps` matches more existing capabilities. Reusable patterns (email follow-up loops, dispatchers, error handling) are shared across business lines.

### Installation & Usage

```bash
# Install
git clone https://github.com/Cocoji79/harness-factory.git
cd harness-factory
npm install
npm run build

# Start (usually auto-started by MCP client)
node dist/index.js
```

#### MCP Client Configuration

```json
{
  "mcpServers": {
    "harness-factory": {
      "command": "node",
      "args": ["/path/to/harness-factory/dist/index.js"]
    }
  }
}
```

#### Custom Data Directory

```bash
HARNESS_FACTORY_DATA_DIR=/path/to/data node dist/index.js
```

### Project Structure

```
harness-factory/
├── src/
│   ├── index.ts                 # MCP server entry
│   ├── types.ts                 # Type definitions
│   ├── store/store.ts           # File-based storage
│   └── tools/
│       ├── ingest-vision.ts          # Strategic vision input
│       ├── ingest-knowledge-base.ts  # Knowledge base input
│       ├── ingest-interview.ts       # Frontline interview input
│       ├── analyze-gaps.ts           # Four-dimensional gap analysis
│       ├── generate-harness.ts  # Handbook generation
│       └── manage-registry.ts   # Capability registry + project mgmt
├── data/
│   ├── capabilities.json        # Pre-populated capability registry
│   └── projects/                # Project data
├── package.json
└── tsconfig.json
```

## Changelog

### 0.2.0 (2026-04-02)

- 12 MCP Tools + 2 Resources, full CRUD
- Three-layer input: strategic vision + knowledge base + frontline interviews
- Four-dimensional gap analysis (vision vs reality, docs vs reality, pain points, AI opportunities)
- Four expert identities in tool descriptions (domain expert, first-principles, long-term, AI capability)
- Pre-populated capability registry (24 Feishu skills)
- Handbook export (markdown / JSON)
- Immutable data patterns, defensive error handling, project ID validation

### 0.1.0 (2026-04-02)

- Initial MCP server with stdio transport
- Core workflow: vision → interview → analysis → handbook generation
- File-based project and capability storage

## License

MIT
