import type { Store } from "../store/store.js";
import type {
  HarnessDocument,
  AnsweredQuestion,
  StateMachine,
  DataBindings,
  ErrorHandling,
  FormTemplate,
  SkillBinding,
  AutomationRule,
  DataTable,
  ControlMatrixEntry,
  Phase,
} from "../types.js";
import { buildGenerationState } from "./check-completeness.js";

/**
 * Phase 2: 对话式收敛工具
 *
 * 用途：接收对 generate_harness 返回的 pending_questions 的回答，
 * 把答案写入 harness 对应字段，重新计算完整度。
 *
 * 调用时机：
 * 1. generate_harness 返回 pending_questions 后
 * 2. 调用方（Claude / Anya / 其他 AI agent）收集了部分或全部答案
 * 3. 通过本工具把答案交回，驱动 generation_state 向 complete 收敛
 *
 * 支持增量收敛：不需要一次性回答所有问题，可以多次调用。
 */

/**
 * 字段设置器：从 field_name 映射到 immutable 更新函数
 * 每个 setter 只负责把 answer_value 写入 harness 的对应字段
 * 类型断言发生在这里——调用方必须传入结构正确的答案
 */
const FIELD_SETTERS: Record<
  string,
  (harness: HarnessDocument, value: unknown) => HarnessDocument
> = {
  state_machine: (h, v) => ({ ...h, state_machine: v as StateMachine }),
  data_bindings: (h, v) => ({ ...h, data_bindings: v as DataBindings }),
  forbidden_actions: (h, v) => ({ ...h, forbidden_actions: v as string[] }),
  error_handling: (h, v) => ({ ...h, error_handling: v as ErrorHandling }),
  templates: (h, v) => ({ ...h, templates: v as FormTemplate[] }),
  skill_bindings: (h, v) => ({ ...h, skill_bindings: v as SkillBinding[] }),
  automation_rules: (h, v) => ({
    ...h,
    automation_rules: v as AutomationRule[],
  }),
  data_architecture: (h, v) => ({
    ...h,
    data_architecture: v as DataTable[],
  }),
  control_matrix: (h, v) => ({
    ...h,
    control_matrix: v as ControlMatrixEntry[],
  }),
  implementation_phases: (h, v) => ({
    ...h,
    implementation_phases: v as Phase[],
  }),
  principles: (h, v) => ({ ...h, principles: v as string[] }),
};

/**
 * 从 question_id 提取字段名。
 * 约定：question_id 格式为 `q_<field_name>`
 */
function questionIdToField(questionId: string): string | null {
  if (!questionId.startsWith("q_")) return null;
  return questionId.slice(2);
}

export const ANSWER_QUESTIONS_SCHEMA = {
  name: "answer_questions",
  description: `Phase 2: 对话式收敛工具。

用途：回答 generate_harness 返回的 pending_questions，驱动 harness 从 drafting 状态向 complete 状态收敛。

典型工作流：
1. 调用 generate_harness → 返回 generation_state.pending_questions
2. 对每个问题判断：
   - requires_human=true → 必须问真人（业务决策：淘汰流程、薪资、隐私等）
   - requires_human=false → AI 可根据 suggested_answer 和上下文自动填写
3. 调用 answer_questions 把答案交回，更新对应字段
4. 重复 2-3 直到 generation_state.status = "complete" 或 "ready_to_provision"

支持增量：不需要一次性回答所有问题，可以多次调用。
每次调用后会重新跑完整度检查，返回新的 generation_state。

重要约定：
- question_id 格式为 q_<field_name>，例如 q_state_machine
- answer_value 的结构必须匹配目标字段的类型定义
- answered_by 标记答案来源：ai（AI 推断/自动填充）或 human（真人确认）`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
      answers: {
        type: "array",
        description: "本次要提交的答案列表，支持一次提交多个",
        items: {
          type: "object",
          properties: {
            question_id: {
              type: "string",
              description:
                "对应 pending_question.id，格式为 q_<field_name>",
            },
            answer_value: {
              description:
                "答案值。结构必须匹配目标字段的类型。例如 state_machine 必须是 {states, transitions, trigger_rules} 对象，forbidden_actions 必须是 string[]",
            },
            answered_by: {
              type: "string",
              enum: ["ai", "human"],
              description:
                "答案来源：ai=AI 自动推断/填充；human=真人确认",
            },
            note: {
              type: "string",
              description: "可选备注，说明答案的推导依据",
            },
          },
          required: ["question_id", "answer_value", "answered_by"],
        },
      },
    },
    required: ["project_id", "answers"],
  },
} as const;

export async function handleAnswerQuestions(
  store: Store,
  args: {
    project_id: string;
    answers: Array<{
      question_id: string;
      answer_value: unknown;
      answered_by: "ai" | "human";
      note?: string;
    }>;
  },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.harness) {
    return JSON.stringify({
      error:
        "项目尚未生成 harness。请先调用 generate_harness，再对返回的 pending_questions 调用本工具",
    });
  }

  // 逐个应用答案，immutable 更新 harness
  let harness: HarnessDocument = project.harness;
  const appliedAnswers: AnsweredQuestion[] = [];
  const rejectedAnswers: Array<{ question_id: string; reason: string }> = [];

  for (const answer of args.answers) {
    const fieldName = questionIdToField(answer.question_id);
    if (!fieldName) {
      rejectedAnswers.push({
        question_id: answer.question_id,
        reason: "question_id 格式错误，应为 q_<field_name>",
      });
      continue;
    }

    const setter = FIELD_SETTERS[fieldName];
    if (!setter) {
      rejectedAnswers.push({
        question_id: answer.question_id,
        reason: `字段 '${fieldName}' 没有对应的 setter，可能是未知字段`,
      });
      continue;
    }

    if (answer.answer_value === null || answer.answer_value === undefined) {
      rejectedAnswers.push({
        question_id: answer.question_id,
        reason: "answer_value 不能为 null 或 undefined",
      });
      continue;
    }

    // 应用 setter（immutable）
    harness = setter(harness, answer.answer_value);
    appliedAnswers.push({
      question_id: answer.question_id,
      answer: JSON.stringify(answer.answer_value),
      answered_by: answer.answered_by,
      answered_at: new Date().toISOString(),
    });
  }

  // 合并历史 answered_questions
  const allAnswered: AnsweredQuestion[] = [
    ...(harness.generation_state?.answered_questions ?? []),
    ...appliedAnswers,
  ];

  // 重新计算完整度
  const newGenerationState = buildGenerationState({
    ...harness,
    generation_state: {
      status: "drafting",
      pending_questions: [],
      answered_questions: allAnswered,
      completeness_score: 0,
      missing_fields: [],
      last_checked_at: new Date().toISOString(),
    },
  });

  // 写回 generation_state
  const updatedHarness: HarnessDocument = {
    ...harness,
    generation_state: newGenerationState,
  };

  await store.saveProject({
    ...project,
    harness: updatedHarness,
  });

  // 构造回复的 next_steps
  const nextSteps: string[] = [];
  if (newGenerationState.status === "complete") {
    nextSteps.push(
      `✅ 完整度 ${newGenerationState.completeness_score}/100，系统规格已就绪`,
    );
    nextSteps.push("建议调用 validate_harness 做最终质量自检");
    nextSteps.push("通过后调用 export_handbook 导出");
  } else if (newGenerationState.status === "ready_to_provision") {
    nextSteps.push(
      `🟢 完整度 ${newGenerationState.completeness_score}/100，仅差数据绑定`,
    );
    nextSteps.push(
      "请让 Anya 创建真实 Bitable 后，通过 answer_questions 回填 data_bindings",
    );
  } else if (newGenerationState.status === "needs_info") {
    nextSteps.push(
      `🟡 完整度 ${newGenerationState.completeness_score}/100，还有 ${newGenerationState.pending_questions.length} 个字段待补全`,
    );
    nextSteps.push("继续回答剩余问题");
  } else {
    nextSteps.push(
      `⚠️ 完整度仅 ${newGenerationState.completeness_score}/100，还有大量字段缺失`,
    );
  }

  return JSON.stringify(
    {
      project_id: project.id,
      status: "answers_applied",
      applied_count: appliedAnswers.length,
      rejected_count: rejectedAnswers.length,
      rejected_answers: rejectedAnswers,
      generation_state: {
        status: newGenerationState.status,
        completeness_score: newGenerationState.completeness_score,
        missing_fields: newGenerationState.missing_fields,
        pending_questions_count: newGenerationState.pending_questions.length,
        pending_questions: newGenerationState.pending_questions,
        answered_count: newGenerationState.answered_questions.length,
      },
      next_steps: nextSteps,
    },
    null,
    2,
  );
}
