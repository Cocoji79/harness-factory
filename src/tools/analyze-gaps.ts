import type { Store } from "../store/store.js";
import type { GapAnalysis } from "../types.js";

export const ANALYZE_GAPS_SCHEMA = {
  name: "analyze_gaps",
  description: `三角差距分析——这是整个 Harness Factory 的核心 Tool。

它做的不是简单匹配，而是四维分析：

1. 战略视角（应该怎么做）vs 一线访谈（实际怎么做）→ 找出愿景与现实的差距
2. 知识库（文档里怎么写的）vs 一线访谈（实际怎么做）→ 找出文档与执行的偏差
3. 一线访谈中的痛点 → 识别效率最低、最该自动化的环节
4. Anya 能力池（能做什么）→ 发现 AI 原生的可能性

四维分析的价值：
- 知识库有但没人看 → 文档过时或不实用
- 一线有变通做法但知识库没写 → 隐性知识未沉淀
- 知识库和实际不一样 → 流程已演化但文档没跟上
- 知识库有 SOP 但一线说痛苦 → SOP 本身需要重构
- 知识库中的合规要求 → 自动化时必须保留的硬约束

输出的不是"现有流程的自动化方案"，而是"重构后的流程 + 自动化方案"。

调用前请确保已通过 ingest_vision、ingest_knowledge_base、ingest_interview 输入了足够的数据。
其中 ingest_knowledge_base 强烈建议但不强制——没有知识库数据也可以分析，但会缺少文档视角。

你需要传入分析结果（gap_analysis 字段），因为深度分析需要 AI 推理能力——
请基于项目中的 vision、knowledge_bases、interviews 数据，以及返回的能力注册表信息，完成分析后回传。`,
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
                gap_type: {
                  type: "string",
                  enum: ["missing", "inefficient", "outdated", "manual"],
                },
                severity: { type: "string", enum: ["high", "medium", "low"] },
                recommendation: { type: "string" },
              },
              required: [
                "area",
                "vision",
                "reality",
                "gap_type",
                "severity",
                "recommendation",
              ],
            },
          },
          docs_vs_reality: {
            type: "array",
            description:
              "知识库文档 vs 一线实际执行的差距。关注：文档过时、流程已变、隐性知识未沉淀、SOP不实用",
            items: {
              type: "object",
              properties: {
                process_name: { type: "string" },
                documented_version: { type: "string" },
                actual_version: { type: "string" },
                gap_type: {
                  type: "string",
                  enum: ["outdated", "incomplete", "ignored", "missing_doc"],
                },
                severity: { type: "string", enum: ["high", "medium", "low"] },
                recommendation: { type: "string" },
              },
              required: [
                "process_name",
                "documented_version",
                "actual_version",
                "gap_type",
                "severity",
                "recommendation",
              ],
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
                affected_stakeholders: {
                  type: "array",
                  items: { type: "string" },
                },
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
                feasibility: {
                  type: "string",
                  enum: ["ready", "needs_skill", "needs_research"],
                },
                required_capabilities: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "current_approach",
                "ai_native_approach",
                "benefit",
                "feasibility",
              ],
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
              required: [
                "process_stage",
                "missing_capability",
                "suggested_skill_name",
                "complexity",
              ],
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
              required: [
                "question",
                "context",
                "why_asking",
                "for_stakeholder",
              ],
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
                  enum: [
                    "full_auto",
                    "auto_with_review",
                    "human_confirmed",
                    "human_only",
                  ],
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
  },
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
          docs_vs_reality_gaps: project.analysis.docs_vs_reality?.length ?? 0,
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
      2,
    );
  }

  // If no analysis provided, return data for the caller to analyze
  const capabilities = await store.getCapabilities();

  const readinessCheck: string[] = [];
  if (!project.vision)
    readinessCheck.push("缺少战略视角数据，请先调用 ingest_vision");
  if (project.interviews.length === 0)
    readinessCheck.push("缺少访谈记录，请先调用 ingest_interview");

  if (readinessCheck.length > 0) {
    return JSON.stringify(
      { error: "数据不足", missing: readinessCheck },
      null,
      2,
    );
  }

  const advisories: string[] = [];
  if (project.knowledge_bases.length === 0)
    advisories.push(
      "未录入知识库数据。建议调用 ingest_knowledge_base 录入部门知识库/制度文档，可以发现文档与实际执行的偏差。不强制，但会让分析更完整。",
    );

  return JSON.stringify(
    {
      project_id: project.id,
      status: "awaiting_analysis",
      message:
        "请基于以下数据进行四维差距分析，完成后将分析结果通过 gap_analysis 参数回传。",
      advisories,
      analysis_framework: {
        step_1:
          "对比战略视角（vision）和一线访谈（interviews），找出愿景与现实的差距（vision_vs_reality）",
        step_2:
          "对比知识库文档（knowledge_bases）和一线访谈，找出文档与执行的偏差（docs_vs_reality）——文档过时、流程已变、隐性知识未沉淀、SOP不实用",
        step_3: "从访谈中的痛点出发，按影响程度排序（pain_points_prioritized）",
        step_4:
          "思考 AI 时代的原生做法——哪些环节不应该简单数字化，而应该重新设计（ai_native_opportunities）。注意：知识库中的合规要求是硬约束，必须保留",
        step_5:
          "将重构后的流程与 Anya 能力注册表匹配（capability_matches + capability_gaps）",
        step_6:
          "生成精准追问——带着分析结果，向业务方确认关键决策点（recommended_questions）",
        step_7:
          "输出重构后的流程设计（redesigned_process）——每个阶段明确控制权级别",
      },
      vision: project.vision,
      knowledge_bases: project.knowledge_bases.map((kb) => ({
        id: kb.id,
        source_type: kb.source_type,
        space_name: kb.space_name,
        documented_processes: kb.documented_processes,
        policies_and_rules: kb.policies_and_rules,
        sop_list: kb.sop_list,
        forms_and_templates: kb.forms_and_templates,
        staleness_notes: kb.staleness_notes,
        last_updated_hint: kb.last_updated_hint,
      })),
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
    2,
  );
}
