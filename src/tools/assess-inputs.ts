import type { Store } from "../store/store.js";
import type {
  InputAssessment,
  VisionScore,
  KnowledgeBaseScore,
  InterviewScore,
  CrossValidation,
} from "../types.js";

export const ASSESS_INPUTS_SCHEMA = {
  name: "assess_inputs",
  description: `评估项目三层输入（战略视角 + 知识库 + 一线访谈）的质量和完整度。

这是 analyze_gaps 之前的质量门禁。它检查：
1. 战略视角是否完整（目标、干系人、理想流程、AI 机会点）
2. 知识库是否充分（流程文档、制度规则、SOP、新鲜度）
3. 访谈是否覆盖关键角色（痛点、隐性知识、变通做法、时间成本）
4. 三层输入之间是否能交叉验证

如果评估结果为"不建议继续"，应先补充缺失输入再做分析。

你需要传入评估结果（assessment 字段），因为质量判断需要 AI 理解内容语义——
请基于项目数据，按照以下标准完成评估后回传。

评分标准：
- 90-100：输入充分，可以产出高质量手册
- 70-89：基本可用，但有明显缺失，手册质量可能受影响
- 50-69：勉强可用，建议补充后再分析
- 0-49：输入严重不足，不建议继续`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
      assessment: {
        type: "object",
        description:
          "完整的输入质量评估结果。如果不传，返回项目数据供你评估后回传。",
        properties: {
          overall_score: {
            type: "number",
            description: "总分 0-100",
          },
          ready_to_analyze: {
            type: "boolean",
            description: "是否建议继续进行 analyze_gaps",
          },
          vision_score: {
            type: "object",
            properties: {
              score: { type: "number" },
              has_goals: { type: "boolean" },
              has_stakeholders: { type: "boolean" },
              has_ideal_process: { type: "boolean" },
              has_ai_opportunities: { type: "boolean" },
              has_constraints: { type: "boolean" },
              issues: { type: "array", items: { type: "string" } },
            },
            required: ["score", "issues"],
          },
          knowledge_base_score: {
            type: "object",
            properties: {
              score: { type: "number" },
              count: { type: "number" },
              has_documented_processes: { type: "boolean" },
              has_policies: { type: "boolean" },
              has_sops: { type: "boolean" },
              staleness_risk: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
              issues: { type: "array", items: { type: "string" } },
            },
            required: ["score", "issues"],
          },
          interview_score: {
            type: "object",
            properties: {
              score: { type: "number" },
              count: { type: "number" },
              roles_covered: { type: "array", items: { type: "string" } },
              has_pain_points: { type: "boolean" },
              has_implicit_knowledge: { type: "boolean" },
              has_workarounds: { type: "boolean" },
              has_time_costs: { type: "boolean" },
              issues: { type: "array", items: { type: "string" } },
            },
            required: ["score", "issues"],
          },
          cross_validation: {
            type: "object",
            properties: {
              vision_interview_alignment: {
                type: "string",
                enum: ["aligned", "partial", "conflicting", "unknown"],
              },
              docs_reality_gap: {
                type: "string",
                enum: ["small", "moderate", "large", "unknown"],
              },
              issues: { type: "array", items: { type: "string" } },
            },
            required: ["vision_interview_alignment", "docs_reality_gap", "issues"],
          },
          blocking_issues: {
            type: "array",
            items: { type: "string" },
            description: "必须解决才能继续的阻塞问题",
          },
          recommendations: {
            type: "array",
            items: { type: "string" },
            description: "改进建议",
          },
        },
        required: [
          "overall_score",
          "ready_to_analyze",
          "vision_score",
          "knowledge_base_score",
          "interview_score",
          "cross_validation",
          "blocking_issues",
          "recommendations",
        ],
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleAssessInputs(
  store: Store,
  args: {
    project_id: string;
    assessment?: InputAssessment;
  },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (args.assessment) {
    const updated = { ...project, input_assessment: args.assessment };
    await store.saveProject(updated);

    return JSON.stringify(
      {
        project_id: project.id,
        status: "assessment_saved",
        overall_score: args.assessment.overall_score,
        ready_to_analyze: args.assessment.ready_to_analyze,
        scores: {
          vision: args.assessment.vision_score.score,
          knowledge_base: args.assessment.knowledge_base_score.score,
          interviews: args.assessment.interview_score.score,
        },
        blocking_issues_count: args.assessment.blocking_issues.length,
        next_steps: args.assessment.ready_to_analyze
          ? [
              "输入质量达标，可以调用 analyze_gaps 进行四维差距分析",
              args.assessment.recommendations.length > 0
                ? `有 ${args.assessment.recommendations.length} 条改进建议，建议参考但不阻塞`
                : null,
            ].filter(Boolean)
          : [
              "输入质量不足，建议先解决以下阻塞问题：",
              ...args.assessment.blocking_issues,
            ],
      },
      null,
      2,
    );
  }

  // Return data for assessment
  const quickCheck = {
    has_vision: !!project.vision,
    vision_goals: project.vision?.goals.length ?? 0,
    vision_stakeholders: project.vision?.stakeholders.length ?? 0,
    vision_process_stages: project.vision?.ideal_process.length ?? 0,
    vision_ai_opportunities: project.vision?.ai_opportunities.length ?? 0,
    knowledge_bases_count: project.knowledge_bases.length,
    total_documented_processes: project.knowledge_bases.reduce(
      (sum, kb) => sum + kb.documented_processes.length,
      0,
    ),
    total_policies: project.knowledge_bases.reduce(
      (sum, kb) => sum + kb.policies_and_rules.length,
      0,
    ),
    total_sops: project.knowledge_bases.reduce(
      (sum, kb) => sum + kb.sop_list.length,
      0,
    ),
    staleness_notes: project.knowledge_bases.flatMap((kb) => kb.staleness_notes),
    interviews_count: project.interviews.length,
    interview_roles: project.interviews.map((i) => i.interviewee_role),
    total_pain_points: project.interviews.reduce(
      (sum, i) => sum + i.pain_points.length,
      0,
    ),
    total_implicit_knowledge: project.interviews.reduce(
      (sum, i) => sum + i.implicit_knowledge.length,
      0,
    ),
    total_workarounds: project.interviews.reduce(
      (sum, i) => sum + i.workarounds.length,
      0,
    ),
    total_time_costs: project.interviews.reduce(
      (sum, i) => sum + i.time_costs.length,
      0,
    ),
  };

  return JSON.stringify(
    {
      project_id: project.id,
      status: "awaiting_assessment",
      message:
        "请基于以下数据评估输入质量，完成后将评估结果通过 assessment 参数回传。",
      assessment_criteria: {
        vision:
          "检查目标是否具体可衡量、干系人是否覆盖关键角色、理想流程是否定义、AI 机会点是否有洞察力（不只是泛泛而谈）",
        knowledge_base:
          "检查文档化流程是否覆盖核心环节、制度规则是否明确边界、SOP 是否可执行、有无过时迹象",
        interviews:
          "检查访谈角色是否覆盖关键干系人、痛点是否具体（不是泛泛抱怨）、有无隐性知识和变通做法、有无时间成本数据",
        cross_validation:
          "对比战略视角和访谈内容是否矛盾、知识库文档和访谈描述的实际做法差距有多大",
      },
      quick_check: quickCheck,
      vision: project.vision,
      knowledge_bases: project.knowledge_bases,
      interviews: project.interviews,
    },
    null,
    2,
  );
}
