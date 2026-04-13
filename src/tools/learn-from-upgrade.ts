import { randomUUID } from "node:crypto";
import type { Store } from "../store/store.js";
import type { HarnessDocument, HarnessPattern } from "../types.js";

/**
 * Phase 4: 共创平台闭环 — 从 harness 升级中提取可复用 pattern
 *
 * 当 Anya 把 v1.0 harness 升级到 v2.0 时，升级中蕴含的经验
 * 不应该只存在于那个项目里。learn_from_upgrade 提取这些经验，
 * 存入 pattern library，下次生成同类 harness 时自动推荐。
 *
 * 工作流（两阶段，类似 validate_harness）：
 * 1. 首次调用不传 patterns → 返回 v1→v2 的结构化 diff，供 AI 分析
 * 2. AI 提取 patterns 后回传 → 存入 pattern library
 *
 * 设计原则：
 * - diff 计算是确定性的（代码做），pattern 提取是智能的（AI 做）
 * - pattern 的 applicability 必须是可判断的（下次看到类似项目能匹配上）
 * - 每个 pattern 标注来源项目，可追溯
 */

/**
 * 计算两个 harness 之间的结构化 diff
 */
function computeDiff(
  before: HarnessDocument,
  after: HarnessDocument,
): DiffResult {
  const changes: DiffEntry[] = [];

  // 检查新增的 Phase 1 字段
  const newFields: Array<{
    field: string;
    label: string;
    getValue: (h: HarnessDocument) => unknown;
  }> = [
    {
      field: "state_machine",
      label: "状态机",
      getValue: (h) => h.state_machine,
    },
    {
      field: "data_bindings",
      label: "数据绑定",
      getValue: (h) => h.data_bindings,
    },
    {
      field: "forbidden_actions",
      label: "禁止事项",
      getValue: (h) => h.forbidden_actions,
    },
    {
      field: "error_handling",
      label: "错误处理",
      getValue: (h) => h.error_handling,
    },
    { field: "templates", label: "结构化模板", getValue: (h) => h.templates },
    {
      field: "skill_bindings",
      label: "Skill 绑定",
      getValue: (h) => h.skill_bindings,
    },
    {
      field: "automation_rules",
      label: "自动化规则",
      getValue: (h) => h.automation_rules,
    },
  ];

  for (const { field, label, getValue } of newFields) {
    const beforeVal = getValue(before);
    const afterVal = getValue(after);
    const beforeEmpty =
      !beforeVal || (Array.isArray(beforeVal) && beforeVal.length === 0);
    const afterEmpty =
      !afterVal || (Array.isArray(afterVal) && afterVal.length === 0);

    if (beforeEmpty && !afterEmpty) {
      changes.push({
        field,
        label,
        type: "added",
        before_summary: "不存在",
        after_summary: summarizeValue(afterVal),
      });
    } else if (!beforeEmpty && !afterEmpty) {
      const beforeStr = JSON.stringify(beforeVal);
      const afterStr = JSON.stringify(afterVal);
      if (beforeStr !== afterStr) {
        changes.push({
          field,
          label,
          type: "changed",
          before_summary: summarizeValue(beforeVal),
          after_summary: summarizeValue(afterVal),
        });
      }
    }
  }

  // 检查原有字段的变化
  const existingFields: Array<{
    field: string;
    label: string;
    beforeVal: unknown;
    afterVal: unknown;
  }> = [
    {
      field: "principles",
      label: "设计原则",
      beforeVal: before.principles,
      afterVal: after.principles,
    },
    {
      field: "data_architecture",
      label: "数据架构",
      beforeVal: before.data_architecture,
      afterVal: after.data_architecture,
    },
    {
      field: "control_matrix",
      label: "控制权矩阵",
      beforeVal: before.control_matrix,
      afterVal: after.control_matrix,
    },
    {
      field: "scheduled_tasks",
      label: "定时任务",
      beforeVal: before.scheduled_tasks,
      afterVal: after.scheduled_tasks,
    },
  ];

  for (const { field, label, beforeVal, afterVal } of existingFields) {
    const beforeLen = Array.isArray(beforeVal) ? beforeVal.length : 0;
    const afterLen = Array.isArray(afterVal) ? afterVal.length : 0;
    if (
      beforeLen !== afterLen ||
      JSON.stringify(beforeVal) !== JSON.stringify(afterVal)
    ) {
      changes.push({
        field,
        label,
        type: "changed",
        before_summary: `${beforeLen} 项`,
        after_summary: `${afterLen} 项`,
      });
    }
  }

  return {
    before_business: before.business_name,
    after_business: after.business_name,
    total_changes: changes.length,
    changes,
  };
}

function summarizeValue(val: unknown): string {
  if (Array.isArray(val)) {
    return `${val.length} 项`;
  }
  if (typeof val === "object" && val !== null) {
    const keys = Object.keys(val);
    if (
      "states" in val &&
      Array.isArray((val as Record<string, unknown>).states)
    ) {
      return `${(val as Record<string, unknown[]>).states.length} 个状态`;
    }
    if (
      "layers" in val &&
      Array.isArray((val as Record<string, unknown>).layers)
    ) {
      return `${(val as Record<string, unknown[]>).layers.length} 层`;
    }
    if ("bitable_app_token" in val) {
      return "已绑定真实 Bitable";
    }
    return `object(${keys.join(", ")})`;
  }
  return String(val);
}

interface DiffEntry {
  field: string;
  label: string;
  type: "added" | "changed" | "removed";
  before_summary: string;
  after_summary: string;
}

interface DiffResult {
  before_business: string;
  after_business: string;
  total_changes: number;
  changes: DiffEntry[];
}

export const LEARN_FROM_UPGRADE_SCHEMA = {
  name: "learn_from_upgrade",
  description: `Phase 4: 共创平台闭环 — 从 harness 升级中提取可复用的 pattern。

当 Anya 把 v1.0 执行手册升级到 v2.0 时，升级中蕴含的经验应该被学习和复用。
本工具计算 v1→v2 的结构化 diff，供 AI 分析后提取 pattern 存入 pattern library。

两阶段工作流：
1. 不传 patterns → 返回结构化 diff + 提取指引
2. AI 提取 patterns 后回传 → 存入 pattern library

下次 generate_harness 运行时，可从 pattern library 获取建议，
避免重复犯同样的"缺失"错误。

例如：如果在试用期项目中学到"应该有 forbidden_actions"，
下次生成一个新的业务流程 harness 时，会自动建议加上这个字段。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID（必须已有 harness）",
      },
      upgraded_harness: {
        type: "object",
        description:
          "升级后的 harness。如不传，使用项目当前保存的 harness 作为「after」（适用于 answer_questions 已迭代后的场景）",
      },
      original_harness: {
        type: "object",
        description:
          "升级前的 harness。如不传，尝试从项目历史中推断（如无历史则要求传入）",
      },
      patterns: {
        type: "array",
        description:
          "AI 提取的 pattern 列表。第一次调用不传，拿到 diff 后分析提取再回传",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Pattern 名称" },
            description: {
              type: "string",
              description: "Pattern 描述",
            },
            category: {
              type: "string",
              enum: [
                "state_machine",
                "safety",
                "error_handling",
                "template",
                "data_model",
                "automation",
                "process_design",
                "other",
              ],
            },
            pattern_type: {
              type: "string",
              enum: ["addition", "refinement", "restructure"],
            },
            before_summary: { type: "string" },
            after_summary: { type: "string" },
            extracted_rule: {
              type: "string",
              description: "提炼出的可复用规则。应是通用的，不限于当前项目",
            },
            applicability: {
              type: "string",
              description:
                "什么时候该应用这个 pattern？（项目类型、场景、条件）",
            },
          },
          required: [
            "name",
            "description",
            "category",
            "pattern_type",
            "before_summary",
            "after_summary",
            "extracted_rule",
            "applicability",
          ],
        },
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleLearnFromUpgrade(
  store: Store,
  args: {
    project_id: string;
    upgraded_harness?: HarnessDocument;
    original_harness?: HarnessDocument;
    patterns?: Array<
      Omit<HarnessPattern, "id" | "source_project" | "learned_at">
    >;
  },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.harness) {
    return JSON.stringify({
      error: "该项目尚未生成 harness",
    });
  }

  // Phase 2: 收到 AI 提取的 patterns，存入 library
  if (args.patterns && args.patterns.length > 0) {
    const now = new Date().toISOString();
    const newPatterns: HarnessPattern[] = args.patterns.map((p) => ({
      id: randomUUID().slice(0, 12),
      source_project: project.id,
      learned_at: now,
      ...p,
    }));

    // Batch write: read once, append all, write once (fixes N+1)
    const existing = await store.getPatterns();
    await store.savePatterns([...existing, ...newPatterns]);

    // 如果有 upgraded_harness，标记 pattern_source
    if (args.upgraded_harness) {
      const updatedHarness: HarnessDocument = {
        ...project.harness,
        ...args.upgraded_harness,
        pattern_source: [
          ...(project.harness.pattern_source ?? []),
          `learned_${args.patterns.length}_patterns_from_upgrade`,
        ],
      };
      await store.saveProject({ ...project, harness: updatedHarness });
    }

    const totalCount = existing.length + newPatterns.length;

    return JSON.stringify(
      {
        project_id: project.id,
        status: "patterns_saved",
        saved_count: newPatterns.length,
        total_patterns_in_library: totalCount,
        saved_patterns: args.patterns.map((p) => ({
          name: p.name,
          category: p.category,
          extracted_rule: p.extracted_rule,
        })),
        next_steps: [
          `${args.patterns.length} 个 pattern 已存入 library`,
          "下次 generate_harness 时可查询 pattern library 获取建议",
          "使用 list_patterns 查看所有已学到的 pattern",
        ],
      },
      null,
      2,
    );
  }

  // Phase 1: 计算 diff，返回给 AI 分析
  const isSyntheticBaseline = !args.original_harness;
  const before = args.original_harness ?? createMinimalHarness(project.harness);
  const after = args.upgraded_harness ?? project.harness;

  const diff = computeDiff(before, after);

  return JSON.stringify(
    {
      project_id: project.id,
      status: "diff_computed",
      synthetic_baseline: isSyntheticBaseline,
      message: isSyntheticBaseline
        ? "⚠️ 未提供 original_harness，使用合成基线（剥离所有 Phase 1 字段）。diff 中 Phase 1 字段全部显示为 added，这不代表真实升级——提取 pattern 时请忽略纯结构性新增，只关注内容层面的设计决策。"
        : "以下是 v1→v2 的结构化 diff。请分析每条变更，提取可复用的 pattern，然后通过 patterns 参数回传。",
      diff,
      extraction_guide: {
        instructions: [
          "对每条变更问：这个改进是否对其他类似项目也有价值？",
          "如果是，提取为一条通用规则（不限于当前项目）",
          "标注 applicability：什么类型的项目/场景适用",
          "标注 category：属于哪个维度的改进",
          "忽略项目特有的细节（如具体表名、人名），提取通用原理",
        ],
        example_pattern: {
          name: "AI 系统必须有禁止事项清单",
          description: "v1 只定义了'应该做什么'，v2 补充了'绝对不能做什么'",
          category: "safety",
          pattern_type: "addition",
          before_summary: "无 forbidden_actions",
          after_summary: "5 条禁止事项",
          extracted_rule:
            "任何 AI 执行系统都应包含负向边界清单（forbidden_actions），至少 3 条。正向规则告诉 AI 做什么，负向规则告诉它不越界",
          applicability: "所有包含 AI 自动执行环节的业务流程 harness",
        },
      },
    },
    null,
    2,
  );
}

/**
 * 当没有提供 original_harness 时，构造一个"最小版"作为对比基线
 * 只保留原始字段，清除所有 Phase 1 新增字段
 */
function createMinimalHarness(current: HarnessDocument): HarnessDocument {
  return {
    business_name: current.business_name,
    principles: current.principles,
    data_architecture: current.data_architecture,
    control_matrix: current.control_matrix,
    existing_skills: current.existing_skills,
    new_skills: current.new_skills,
    scheduled_tasks: current.scheduled_tasks,
    implementation_phases: current.implementation_phases,
    communication_checklist: current.communication_checklist,
    markdown_content: current.markdown_content,
  };
}
