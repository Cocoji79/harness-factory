import type {
  HarnessDocument,
  PendingQuestion,
  GenerationState,
} from "../types.js";

/**
 * 完整度检查器
 *
 * 目的：让 harness-factory 知道生成的 harness 距离"可执行系统"还差什么。
 *
 * 设计原则：
 * 1. 所有检查规则都是纯函数，无副作用
 * 2. 每条规则同时产出「检查函数」和「问题模板」——缺失时直接生成 pending_question
 * 3. 权重反映该字段对"系统可执行性"的贡献度
 * 4. requires_human 标识是否需要真人回答（业务决策 vs 技术细节）
 */

interface CompletenessRule {
  field: string;
  weight: number; // 0-100
  check: (h: Partial<HarnessDocument>) => boolean;
  question: Omit<PendingQuestion, "id">;
}

/**
 * 规则表：每条规则检查一个字段，缺失时生成对应的 pending_question。
 *
 * 权重总和 = 100。权重越高，该字段对可执行性的影响越大。
 */
const RULES: CompletenessRule[] = [
  // ── P0：必需字段（系统无法运行）──
  {
    field: "state_machine",
    weight: 18,
    check: (h) => (h.state_machine?.states?.length ?? 0) >= 2,
    question: {
      category: "state_machine",
      question:
        "这个系统有哪些状态？每个状态下 Anya 要做什么？下一步可以转移到哪里？",
      why_asking:
        "没有状态机，Anya 不知道当前处在哪个阶段，也不知道下一步能去哪——只能每次从 markdown 里猜",
      blocking_field: "state_machine",
      requires_human: true,
      confidence: "low",
    },
  },
  {
    field: "data_bindings",
    weight: 15,
    check: (h) => !!h.data_bindings?.bitable_app_token,
    question: {
      category: "data_binding",
      question:
        "多维表格是否已创建？如已创建，请提供 app_token 和各表的 table_id；如未创建，请让 Anya 创建后回填",
      why_asking:
        "没有真实的 Bitable token，系统运行时无法读写数据——这是『能跑起来』和『只是文档』的分界线",
      blocking_field: "data_bindings.bitable_app_token",
      requires_human: true,
      confidence: "low",
    },
  },
  {
    field: "forbidden_actions",
    weight: 12,
    check: (h) => (h.forbidden_actions?.length ?? 0) >= 3,
    question: {
      category: "forbidden_actions",
      question: "这个系统里 Anya 绝对不能做哪些事？（至少列 3 条底线）",
      why_asking:
        "只定义『应该做什么』不够，还必须定义『绝对不能做什么』。这是给 AI 系统的安全栏",
      blocking_field: "forbidden_actions",
      requires_human: true,
      suggested_answer:
        "常见底线参考：① 不得替主管/决策者做出评价判断 ② 不得在没有人工确认的情况下通知当事人关键结果 ③ 不得跳过任何审核节点 ④ 不得修改已填写的关键记录",
      confidence: "medium",
    },
  },

  // ── P1：核心字段（缺失会导致系统不完整）──
  {
    field: "error_handling",
    weight: 10,
    check: (h) => (h.error_handling?.layers?.length ?? 0) >= 3,
    question: {
      category: "error_handling",
      question: "系统出错时如何降级？建议采用 L1-L5 五层自我修复策略",
      why_asking:
        "没有错误处理策略，异常情况下系统会直接卡死。五层策略能让 Anya 自己从大多数故障中恢复",
      blocking_field: "error_handling",
      requires_human: false,
      suggested_answer:
        "L1 操作日志全记录 / L2 定期健康检查扫描 / L3 自动重试+人工兜底 / L4 节点遗漏回溯（每日检查过去N天应触发未触发的节点）/ L5 关键响应率监控（如主管响应率低于阈值自动升级）",
      confidence: "high",
    },
  },
  {
    field: "templates",
    weight: 10,
    check: (h) => (h.templates?.length ?? 0) >= 1,
    question: {
      category: "template",
      question:
        "系统需要哪些可填写的结构化模板？（如评估表、改进计划、简历自更新等）",
      why_asking:
        "结构化模板让填写者降低摩擦，也让 Anya 能读取数据做后续分析。散落在 markdown 里的文字无法被系统化处理",
      blocking_field: "templates",
      requires_human: false,
      confidence: "medium",
    },
  },
  {
    field: "skill_bindings",
    weight: 10,
    check: (h) => (h.skill_bindings?.length ?? 0) > 0,
    question: {
      category: "skill_binding",
      question: "control_matrix 里每个 action 具体调用哪个 skill？",
      why_asking:
        "没有 action → skill 的映射，Anya 执行时要猜用哪个 skill。这是从『知道要做什么』到『知道怎么做』的关键",
      blocking_field: "skill_bindings",
      requires_human: false,
      confidence: "high",
    },
  },
  {
    field: "builtin_evaluator",
    weight: 8,
    check: (h) => (h.builtin_evaluator?.checks?.length ?? 0) >= 2,
    question: {
      category: "other",
      question:
        "这个系统需要哪些独立的质量检查？Evaluator 要检查什么？每项检查的硬性及格线是什么？不通过时怎么办？",
      why_asking:
        "没有内建 Evaluator 的系统无法自我纠错。Generator（做事的 Anya）和 Evaluator（检查的 Anya）必须分离——同一个 agent 干活又评价自己的活会自我宽容",
      blocking_field: "builtin_evaluator",
      requires_human: true,
      suggested_answer:
        "参考：① 一致性检查（主管评价 vs 客观数据，偏差超过阈值→告警 HR）② 模板完整性（主管填表有空项或维度单一→要求补充）③ 流程合规（跳过节点或超时未处理→阻断并升级）",
      confidence: "medium",
    },
  },
  {
    field: "automation_rules",
    weight: 6,
    check: (h) =>
      (h.automation_rules?.length ?? 0) > 0 ||
      (h.scheduled_tasks?.length ?? 0) > 0,
    question: {
      category: "automation",
      question: "哪些动作需要定时或事件触发？每个触发的失败降级策略是什么？",
      why_asking:
        "定时任务是 Anya 的心跳，没有就不会主动动作。升级版 automation_rules 还支持 lookback 回溯错过的节点",
      blocking_field: "automation_rules",
      requires_human: false,
      confidence: "medium",
    },
  },

  // ── P2：基础字段（当前 schema 已有，但要验证非空）──
  {
    field: "data_architecture",
    weight: 7,
    check: (h) => (h.data_architecture?.length ?? 0) > 0,
    question: {
      category: "other",
      question: "这个系统需要哪些数据表？每张表存什么？",
      why_asking: "连数据表都没定义，系统无法存储任何状态",
      blocking_field: "data_architecture",
      requires_human: false,
      confidence: "high",
    },
  },
  {
    field: "control_matrix",
    weight: 5,
    check: (h) => (h.control_matrix?.length ?? 0) > 0,
    question: {
      category: "other",
      question: "每个动作是全自动、半自动、人工确认还是纯人工？",
      why_asking:
        "控制权矩阵决定 Anya 在每一步的自主性边界，缺失就无法知道『我可以做到哪里』",
      blocking_field: "control_matrix",
      requires_human: true,
      confidence: "low",
    },
  },
  {
    field: "implementation_phases",
    weight: 3,
    check: (h) => (h.implementation_phases?.length ?? 0) > 0,
    question: {
      category: "other",
      question: "系统实施分哪几个阶段？每个阶段的完成标准是什么？",
      why_asking: "没有实施阶段划分，全部一次上线风险太大",
      blocking_field: "implementation_phases",
      requires_human: false,
      confidence: "medium",
    },
  },
  {
    field: "principles",
    weight: 2,
    check: (h) => (h.principles?.length ?? 0) >= 3,
    question: {
      category: "other",
      question: "这个系统遵循哪些设计原则？",
      why_asking:
        "原则是无法穷举规则时的判断依据，Anya 遇到边界情况时靠原则决策",
      blocking_field: "principles",
      requires_human: false,
      confidence: "high",
    },
  },
];

/**
 * 检查 harness 的完整度，返回分数、缺失字段列表和待回答问题。
 */
export function checkCompleteness(harness: Partial<HarnessDocument>): {
  score: number;
  missing_fields: string[];
  pending_questions: PendingQuestion[];
} {
  let totalWeight = 0;
  let earnedWeight = 0;
  const missing: string[] = [];
  const questions: PendingQuestion[] = [];

  for (const rule of RULES) {
    totalWeight += rule.weight;
    const passed = rule.check(harness);
    if (passed) {
      earnedWeight += rule.weight;
    } else {
      missing.push(rule.field);
      questions.push({
        id: `q_${rule.field}`,
        ...rule.question,
      });
    }
  }

  const score = Math.round((earnedWeight / totalWeight) * 100);

  return {
    score,
    missing_fields: missing,
    pending_questions: questions,
  };
}

/**
 * 根据完整度构造 GenerationState，用于写回 harness.generation_state。
 */
export function buildGenerationState(
  harness: Partial<HarnessDocument>,
): GenerationState {
  const { score, missing_fields, pending_questions } =
    checkCompleteness(harness);

  // 状态判定：
  // 1. 完全无缺失 → complete
  // 2. 只差 data_bindings → ready_to_provision（技术规格已全，只等真实资源）
  // 3. 分数 >= 60 → needs_info（有部分字段待补）
  // 4. 分数 < 60 → drafting（初始草稿）
  let status: GenerationState["status"];
  if (missing_fields.length === 0) {
    status = "complete";
  } else if (
    missing_fields.length === 1 &&
    missing_fields[0] === "data_bindings"
  ) {
    status = "ready_to_provision";
  } else if (score >= 60) {
    status = "needs_info";
  } else {
    status = "drafting";
  }

  return {
    status,
    pending_questions,
    answered_questions: harness.generation_state?.answered_questions ?? [],
    completeness_score: score,
    missing_fields,
    last_checked_at: new Date().toISOString(),
  };
}
