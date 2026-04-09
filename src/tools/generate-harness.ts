import type { Store } from "../store/store.js";
import type { HarnessDocument } from "../types.js";
import { buildGenerationState } from "./check-completeness.js";

export const GENERATE_HARNESS_SCHEMA = {
  name: "generate_harness",
  description: `基于分析结果生成完整的 Agent 执行手册（Harness Document）。

这是流水线的产出物——一份结构化的手册，Agent 看完后就能明确：
1. 要建什么数据表
2. 要构建/复用哪些 Skill
3. 每个动作的控制权（全自动 vs 人工确认）
4. 分几个阶段实施
5. 哪些事项需要跟业务方确认

调用前请确保已完成 analyze_gaps。

生成手册时，继续保持 analyze_gaps 中的四重身份：
1. **领域专家** — 手册中的术语、流程设计要符合该行业的专业实践
2. **第一性原理** — 控制权矩阵和流程设计要回到本质，不要照搬旧流程
3. **长期发展** — 数据架构和 Skill 设计要留有扩展空间
4. **AI 能力边界** — 控制权分配要诚实：AI 能做好的放手，AI 做不好的明确标注人工介入

## 评估与进化章节

如果项目已定义了北极星指标（通过 define_north_star），
手册的 markdown_content 中**必须**包含「评估与进化」章节，内容包括：

1. **北极星指标**：主指标名称、定义、测量方法、追踪频率
2. **护栏指标**：每个护栏的名称、红线阈值、防止什么歪行为
3. **观察指标**：帮助理解深层模式的辅助信号
4. **迭代规则**：
   - 每次 Skill 迭代必须保留变更前后的指标对比数据
   - 主指标连续两个追踪周期恶化 → 回滚到上一版本
   - 护栏指标触及红线 → 立即暂停并排查
5. **故事素材清单**：用于向管理层汇报和说服新部门的叙事弹药

如果项目未定义北极星指标，在手册中提示"建议调用 define_north_star 定义评估指标"。

你需要传入完整的 harness 文档结构（包含 markdown_content），
因为手册生成需要 AI 的写作能力来产出高质量的飞书文档内容。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
      harness: {
        type: "object",
        description: "完整的执行手册结构",
        properties: {
          business_name: { type: "string" },
          principles: {
            type: "array",
            items: { type: "string" },
            description: "设计原则列表（Harness Engineering 约束）",
          },
          data_architecture: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                purpose: { type: "string" },
                fields: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      type: { type: "string" },
                      description: { type: "string" },
                      required: { type: "boolean" },
                    },
                    required: ["name", "type", "description"],
                  },
                },
              },
              required: ["name", "purpose", "fields"],
            },
          },
          control_matrix: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stage: { type: "string" },
                action: { type: "string" },
                control_level: {
                  type: "string",
                  enum: [
                    "full_auto",
                    "auto_with_review",
                    "human_confirmed",
                    "human_only",
                  ],
                },
                description: { type: "string" },
              },
              required: ["stage", "action", "control_level", "description"],
            },
          },
          existing_skills: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                purpose: { type: "string" },
                pipeline_stage: { type: "string" },
              },
              required: ["name", "purpose", "pipeline_stage"],
            },
          },
          new_skills: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                purpose: { type: "string" },
                complexity: { type: "string", enum: ["low", "medium", "high"] },
                capabilities: { type: "array", items: { type: "string" } },
                dependencies: { type: "array", items: { type: "string" } },
              },
              required: ["name", "purpose", "complexity"],
            },
          },
          scheduled_tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                frequency: { type: "string" },
                description: { type: "string" },
              },
              required: ["name", "frequency", "description"],
            },
          },
          implementation_phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "number" },
                name: { type: "string" },
                self_driven_tasks: { type: "array", items: { type: "string" } },
                needs_confirmation: {
                  type: "array",
                  items: { type: "string" },
                },
                completion_criteria: { type: "string" },
              },
              required: [
                "number",
                "name",
                "self_driven_tasks",
                "needs_confirmation",
                "completion_criteria",
              ],
            },
          },
          communication_checklist: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item: { type: "string" },
                priority: {
                  type: "string",
                  enum: ["before_start", "during", "after"],
                },
                status: { type: "string", enum: ["pending", "confirmed"] },
              },
              required: ["item", "priority"],
            },
          },
          markdown_content: {
            type: "string",
            description:
              "完整的飞书文档 Markdown 内容（Lark-flavored Markdown）。这是最终产出物，应包含所有章节。",
          },
        },
        required: [
          "business_name",
          "principles",
          "data_architecture",
          "control_matrix",
          "existing_skills",
          "new_skills",
          "implementation_phases",
          "communication_checklist",
          "markdown_content",
        ],
      },
    },
    required: ["project_id", "harness"],
  },
} as const;

export async function handleGenerateHarness(
  store: Store,
  args: {
    project_id: string;
    harness: HarnessDocument;
  },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.analysis) {
    return JSON.stringify({
      error: "请先完成 analyze_gaps 再生成手册",
    });
  }

  if (!project.north_star) {
    // Not blocking, but warn
    console.error(
      `[harness-factory] Warning: project ${args.project_id} has no north_star defined. Recommend calling define_north_star first.`,
    );
  }

  // Phase 1: 生成后立即做完整度检查，写入 generation_state
  const generation_state = buildGenerationState(args.harness);

  const harnessWithState: HarnessDocument = {
    ...args.harness,
    generation_state,
  };

  const updated = {
    ...project,
    harness: harnessWithState,
    status: "generated" as const,
  };
  await store.saveProject(updated);

  // Register new skills to capability registry (flywheel effect)
  for (const skill of args.harness.new_skills) {
    await store.addCapability({
      name: skill.name,
      category: project.business_name,
      description: skill.purpose,
      input: skill.dependencies?.join(", ") ?? "",
      output: skill.capabilities?.join(", ") ?? "",
      feishu_apis: [],
      reusable_patterns: skill.capabilities ?? [],
    });
  }

  // Phase 1: 根据完整度生成 next_steps 引导
  const nextSteps: string[] = [];
  if (generation_state.status === "drafting") {
    nextSteps.push(
      `⚠️ 完整度仅 ${generation_state.completeness_score}/100，系统无法执行。请查看 pending_questions，逐一回答关键字段`,
    );
  } else if (generation_state.status === "needs_info") {
    nextSteps.push(
      `🟡 完整度 ${generation_state.completeness_score}/100，还有 ${generation_state.pending_questions.length} 个字段待补全。混合模式：requires_human=false 的可由 AI 先填，=true 的必须问真人`,
    );
  } else if (generation_state.status === "ready_to_provision") {
    nextSteps.push(
      `🟢 完整度 ${generation_state.completeness_score}/100，系统规格完整，仅差数据绑定。请让 Anya 创建 Bitable 后回填 data_bindings`,
    );
  } else {
    nextSteps.push(
      `✅ 完整度 ${generation_state.completeness_score}/100，可执行系统规格已就绪`,
    );
  }
  nextSteps.push("调用 validate_harness 做质量自检");
  nextSteps.push("通过后调用 export_handbook 导出");

  return JSON.stringify(
    {
      project_id: project.id,
      status: "harness_generated",
      summary: {
        business_name: args.harness.business_name,
        tables_count: args.harness.data_architecture.length,
        control_matrix_entries: args.harness.control_matrix.length,
        existing_skills_count: args.harness.existing_skills.length,
        new_skills_count: args.harness.new_skills.length,
        scheduled_tasks_count: args.harness.scheduled_tasks?.length ?? 0,
        phases_count: args.harness.implementation_phases.length,
        checklist_items: args.harness.communication_checklist.length,
        markdown_length: args.harness.markdown_content.length,
      },
      // Phase 1 新增：完整度检查结果
      generation_state: {
        status: generation_state.status,
        completeness_score: generation_state.completeness_score,
        missing_fields: generation_state.missing_fields,
        pending_questions_count: generation_state.pending_questions.length,
        pending_questions: generation_state.pending_questions,
      },
      new_skills_registered: args.harness.new_skills.map((s) => s.name),
      north_star: project.north_star
        ? {
            primary_metric: project.north_star.primary_metric.name,
            guardrails: project.north_star.guardrails.map((g) => g.name),
            included_in_handbook: true,
          }
        : {
            included_in_handbook: false,
            recommendation:
              "建议调用 define_north_star 定义评估指标，让手册自带进化机制",
          },
      next_steps: nextSteps,
    },
    null,
    2,
  );
}
