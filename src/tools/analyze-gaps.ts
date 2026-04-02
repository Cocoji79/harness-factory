import type { Store } from "../store/store.js";
import type { GapAnalysis } from "../types.js";

export const ANALYZE_GAPS_SCHEMA = {
  name: "analyze_gaps",
  description: `三角差距分析——这是整个 Harness Factory 的核心 Tool。

它做的不是简单匹配，而是三角分析：

1. 战略视角（应该怎么做）vs 一线访谈（实际怎么做）→ 找出愿景与现实的差距
2. 一线访谈中的痛点 → 识别效率最低、最该自动化的环节
3. Anya 能力池（能做什么）→ 发现 AI 原生的可能性

输出的不是"现有流程的自动化方案"，而是"重构后的流程 + 自动化方案"。

调用前请确保已经通过 ingest_vision 和 ingest_interview 输入了足够的数据。

你需要传入分析结果（gap_analysis 字段），因为深度分析需要 AI 推理能力——
请基于项目中的 vision 和 interviews 数据，以及返回的能力注册表信息，完成分析后回传。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
      gap_analysis: {
        type: "object",
        description:
          "完整的差距分析结果。如果不传，Tool 会返回项目数据和能力注册表，供你分析后再回传。",
        properties: {
          vision_vs_reality: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string" },
                vision: { type: "string" },
                reality: { type: "string" },
                gap_type: { type: "string", enum: ["missing", "inefficient", "outdated", "manual"] },
                severity: { type: "string", enum: ["high", "medium", "low"] },
                recommendation: { type: "string" },
              },
              required: ["area", "vision", "reality", "gap_type", "severity", "recommendation"],
            },
          },
          pain_points_prioritized: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pain_point: { type: "string" },
                impact: { type: "string", enum: ["high", "medium", "low"] },
                frequency: { type: "string" },
                affected_stakeholders: { type: "array", items: { type: "string" } },
                suggested_solution: { type: "string" },
              },
              required: ["pain_point", "impact", "suggested_solution"],
            },
          },
          ai_native_opportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                current_approach: { type: "string" },
                ai_native_approach: { type: "string" },
                benefit: { type: "string" },
                feasibility: { type: "string", enum: ["ready", "needs_skill", "needs_research"] },
                required_capabilities: { type: "array", items: { type: "string" } },
              },
              required: ["current_approach", "ai_native_approach", "benefit", "feasibility"],
            },
          },
          capability_matches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                process_stage: { type: "string" },
                matched_skills: { type: "array", items: { type: "string" } },
                coverage_percent: { type: "number" },
                notes: { type: "string" },
              },
              required: ["process_stage", "matched_skills", "coverage_percent"],
            },
          },
          capability_gaps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                process_stage: { type: "string" },
                missing_capability: { type: "string" },
                suggested_skill_name: { type: "string" },
                complexity: { type: "string", enum: ["low", "medium", "high"] },
                dependencies: { type: "array", items: { type: "string" } },
                description: { type: "string" },
              },
              required: ["process_stage", "missing_capability", "suggested_skill_name", "complexity"],
            },
          },
          recommended_questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                context: { type: "string" },
                why_asking: { type: "string" },
                for_stakeholder: { type: "string" },
              },
              required: ["question", "context", "why_asking", "for_stakeholder"],
            },
          },
          redesigned_process: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                control_level: {
                  type: "string",
                  enum: ["full_auto", "auto_with_review", "human_confirmed", "human_only"],
                },
                skills_used: { type: "array", items: { type: "string" } },
                new_skills_needed: { type: "array", items: { type: "string" } },
                data_in: { type: "string" },
                data_out: { type: "string" },
                failure_handling: { type: "string" },
              },
              required: ["name", "description", "control_level"],
            },
          },
        },
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleAnalyzeGaps(
  store: Store,
  args: {
    project_id: string;
    gap_analysis?: GapAnalysis;
  }
): Promise<string> {
  const project = await store.getProject(args.project_id);

  // If analysis is provided, save it
  if (args.gap_analysis) {
    project.analysis = args.gap_analysis;
    project.status = "analyzing";
    await store.saveProject(project);

    return JSON.stringify(
      {
        project_id: project.id,
        status: "analysis_saved",
        summary: {
          gaps_found: project.analysis.vision_vs_reality.length,
          pain_points: project.analysis.pain_points_prioritized.length,
          ai_opportunities: project.analysis.ai_native_opportunities.length,
          capability_matches: project.analysis.capability_matches.length,
          capability_gaps: project.analysis.capability_gaps.length,
          targeted_questions: project.analysis.recommended_questions.length,
          redesigned_stages: project.analysis.redesigned_process.length,
        },
        next_steps: [
          project.analysis.recommended_questions.length > 0
            ? `有 ${project.analysis.recommended_questions.length} 个精准追问需要向业务方确认`
            : null,
          "确认完毕后，调用 generate_harness 生成执行手册",
        ].filter(Boolean),
      },
      null,
      2
    );
  }

  // If no analysis provided, return data for the caller to analyze
  const capabilities = await store.getCapabilities();

  const readinessCheck: string[] = [];
  if (!project.vision) readinessCheck.push("缺少战略视角数据，请先调用 ingest_vision");
  if (project.interviews.length === 0) readinessCheck.push("缺少访谈记录，请先调用 ingest_interview");

  if (readinessCheck.length > 0) {
    return JSON.stringify({ error: "数据不足", missing: readinessCheck }, null, 2);
  }

  return JSON.stringify(
    {
      project_id: project.id,
      status: "awaiting_analysis",
      message:
        "请基于以下数据进行三角差距分析，完成后将分析结果通过 gap_analysis 参数回传。",
      analysis_framework: {
        step_1:
          "对比战略视角（vision）和一线访谈（interviews），找出愿景与现实的差距（vision_vs_reality）",
        step_2:
          "从访谈中的痛点出发，按影响程度排序（pain_points_prioritized）",
        step_3:
          "思考 AI 时代的原生做法——哪些环节不应该简单数字化，而应该重新设计（ai_native_opportunities）",
        step_4:
          "将重构后的流程与 Anya 能力注册表匹配（capability_matches + capability_gaps）",
        step_5:
          "生成精准追问——带着分析结果，向业务方确认关键决策点（recommended_questions）",
        step_6:
          "输出重构后的流程设计（redesigned_process）——每个阶段明确控制权级别",
      },
      vision: project.vision,
      interviews: project.interviews.map((i) => ({
        id: i.id,
        role: i.interviewee_role,
        actual_process: i.actual_process,
        pain_points: i.pain_points,
        implicit_knowledge: i.implicit_knowledge,
        workarounds: i.workarounds,
        time_costs: i.time_costs,
      })),
      capability_registry: capabilities,
    },
    null,
    2
  );
}
