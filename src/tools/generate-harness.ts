import type { Store } from "../store/store.js";
import type { HarnessDocument } from "../types.js";

export const GENERATE_HARNESS_SCHEMA = {
  name: "generate_harness",
  description: `基于分析结果生成完整的 Anya 执行手册（Harness Document）。

这是流水线的产出物——一份结构化的手册，Anya 看完后就能明确：
1. 要建什么数据表
2. 要构建/复用哪些 Skill
3. 每个动作的控制权（全自动 vs 人工确认）
4. 分几个阶段实施
5. 哪些事项需要跟业务方确认

调用前请确保已完成 analyze_gaps。

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
                  enum: ["full_auto", "auto_with_review", "human_confirmed", "human_only"],
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
                needs_confirmation: { type: "array", items: { type: "string" } },
                completion_criteria: { type: "string" },
              },
              required: ["number", "name", "self_driven_tasks", "needs_confirmation", "completion_criteria"],
            },
          },
          communication_checklist: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item: { type: "string" },
                priority: { type: "string", enum: ["before_start", "during", "after"] },
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
  }
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.analysis) {
    return JSON.stringify({
      error: "请先完成 analyze_gaps 再生成手册",
    });
  }

  project.harness = args.harness;
  project.status = "generating";
  await store.saveProject(project);

  // Update capability registry with new skills
  for (const skill of args.harness.new_skills) {
    await store.addCapability({
      name: skill.name,
      category: project.business_name,
      description: skill.purpose,
      input: skill.capabilities?.join(", ") ?? "",
      output: "",
      feishu_apis: [],
      reusable_patterns: [],
    });
  }

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
      new_skills_registered: args.harness.new_skills.map((s) => s.name),
      next_steps: [
        "手册已生成，可以调用 publish_handbook 发布为飞书文档",
        "发布后 Anya 可以按手册逐阶段执行",
      ],
    },
    null,
    2
  );
}
