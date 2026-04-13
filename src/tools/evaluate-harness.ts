import type { Store } from "../store/store.js";
import type { HarnessDocument } from "../types.js";

/**
 * Evaluator — Harness 质量评估工具
 *
 * 灵感来自 Anthropic 的 GAN 式三角架构：
 * Generator 不能评价自己的作品，需要独立的 Evaluator。
 *
 * 与 validate_harness 的区别：
 * - validate = 结构校验（字段有没有？格式对不对？）
 * - evaluate = 质量评估（内容好不好？能不能跑？会不会出事？）
 *
 * 五个评分维度（每个 0-20 分，总分 0-100）：
 * 1. 流程完整性 — 所有路径覆盖？有没有死路？
 * 2. 可执行性 — Anya 拿到能直接跑？
 * 3. 安全性 — 人机边界清晰？forbidden_actions 没有被绕过？
 * 4. 可演化性 — 配置驱动？有反馈闭环？
 * 5. 自检能力 — 系统有内建 Evaluator 吗？Generator 和 Evaluator 分离了吗？
 */

const DIMENSION_MAX = 20;

// ── Types ──

interface EvalFinding {
  dimension:
    | "completeness"
    | "executability"
    | "safety"
    | "evolvability"
    | "self_check";
  severity: "pass" | "warning" | "fail";
  criterion: string;
  finding: string;
  recommendation?: string;
}

interface DimensionScore {
  name: string;
  score: number;
  max: number;
  findings: EvalFinding[];
}

interface EvaluationResult {
  overall_score: number;
  dimensions: DimensionScore[];
  all_findings: EvalFinding[];
  critical_issues: EvalFinding[];
  summary: string;
}

// ── Dimension 1: Process Completeness (0-20) ──

function evaluateCompleteness(h: HarnessDocument): DimensionScore {
  const findings: EvalFinding[] = [];
  let score = DIMENSION_MAX;
  const dim = "completeness" as const;

  const sm = h.state_machine;
  if (!sm || sm.states.length === 0) {
    findings.push({
      dimension: dim,
      severity: "fail",
      criterion: "状态机存在",
      finding: "没有定义状态机，无法评估流程完整性",
    });
    return { name: "流程完整性", score: 0, max: DIMENSION_MAX, findings };
  }

  const stateNames = new Set(sm.states.map((s) => s.name));
  const terminalStates = new Set<string>();

  // Check: all transitions reference valid states
  for (const t of sm.transitions) {
    if (!stateNames.has(t.from)) {
      findings.push({
        dimension: dim,
        severity: "fail",
        criterion: "转移引用有效状态",
        finding: `transition from="${t.from}" 不是已定义的状态`,
        recommendation: `在 states 中添加 "${t.from}" 或修正 transition`,
      });
      score -= 3;
    }
    if (!stateNames.has(t.to)) {
      findings.push({
        dimension: dim,
        severity: "fail",
        criterion: "转移引用有效状态",
        finding: `transition to="${t.to}" 不是已定义的状态`,
        recommendation: `在 states 中添加 "${t.to}" 或修正 transition`,
      });
      score -= 3;
    }
  }

  // Check: reachability — all states reachable from first state
  const reachable = new Set<string>();
  const firstState = sm.states[0]?.name;
  if (firstState) {
    const queue = [firstState];
    reachable.add(firstState);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const t of sm.transitions.filter((tr) => tr.from === current)) {
        if (!reachable.has(t.to)) {
          reachable.add(t.to);
          queue.push(t.to);
        }
      }
    }
  }
  const unreachable = sm.states.filter((s) => !reachable.has(s.name));
  if (unreachable.length > 0) {
    findings.push({
      dimension: dim,
      severity: "fail",
      criterion: "所有状态可达",
      finding: `${unreachable.length} 个状态从初始状态不可达：${unreachable.map((s) => s.name).join(", ")}`,
      recommendation: "检查是否缺少转移规则，或这些状态已不需要",
    });
    score -= 4;
  }

  // Check: dead ends — non-terminal states with no outgoing transitions
  for (const state of sm.states) {
    const outgoing = sm.transitions.filter((t) => t.from === state.name);
    if (outgoing.length === 0) {
      terminalStates.add(state.name);
      const isIntendedTerminal =
        state.is_terminal === true ||
        state.exit_conditions.some(
          (c) =>
            c.includes("终态") ||
            c.includes("无出口") ||
            c.includes("terminal"),
        );
      if (!isIntendedTerminal) {
        findings.push({
          dimension: dim,
          severity: "warning",
          criterion: "非终态有出口",
          finding: `状态 "${state.name}" 没有任何出口转移，但也未标记为终态`,
          recommendation: `如果是终态，在 exit_conditions 中标注。如果不是，补充出口 transition`,
        });
        score -= 2;
      }
    }
  }

  // Check: trigger_rules are defined
  if (sm.trigger_rules.length === 0) {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "底线触发规则",
      finding: "没有定义底线触发规则（trigger_rules），异常情况无法提前干预",
      recommendation: "添加至少一条底线触发规则（如连续无产出、连续未达预期）",
    });
    score -= 2;
  }

  // Check: control_matrix stages vs state_machine states
  if (h.control_matrix.length > 0) {
    const cmStages = new Set(h.control_matrix.map((c) => c.stage));
    // Just check there's some overlap
    const overlap = [...cmStages].filter(
      (s) => stateNames.has(s) || [...stateNames].some((sn) => s.includes(sn)),
    );
    if (overlap.length === 0) {
      findings.push({
        dimension: dim,
        severity: "warning",
        criterion: "control_matrix 与 state_machine 一致性",
        finding:
          "control_matrix 的 stage 名称与 state_machine 的 state 名称完全不匹配",
        recommendation: "统一命名，或建立 stage → state 的映射关系",
      });
      score -= 2;
    }
  }

  if (findings.filter((f) => f.severity === "fail").length === 0) {
    findings.push({
      dimension: dim,
      severity: "pass",
      criterion: "整体",
      finding: `状态机包含 ${sm.states.length} 个状态、${sm.transitions.length} 条转移，${terminalStates.size} 个终态`,
    });
  }

  return {
    name: "流程完整性",
    score: Math.max(0, score),
    max: DIMENSION_MAX,
    findings,
  };
}

// ── Dimension 2: Executability (0-20) ──

function evaluateExecutability(h: HarnessDocument): DimensionScore {
  const findings: EvalFinding[] = [];
  let score = DIMENSION_MAX;
  const dim = "executability" as const;

  const sm = h.state_machine;

  // Check: every state has non-empty entry_actions
  if (sm) {
    const emptyActions = sm.states.filter((s) => s.entry_actions.length === 0);
    if (emptyActions.length > 0) {
      findings.push({
        dimension: dim,
        severity: "fail",
        criterion: "每个状态有 entry_actions",
        finding: `${emptyActions.length} 个状态缺少 entry_actions：${emptyActions.map((s) => s.name).join(", ")}`,
        recommendation:
          "Anya 进入这些状态时不知道该做什么。为每个状态列出具体动作",
      });
      score -= 5;
    }

    // Check: every non-terminal state has exit_conditions
    const noExit = sm.states.filter(
      (s) =>
        s.exit_conditions.length === 0 &&
        sm.transitions.some((t) => t.from === s.name),
    );
    if (noExit.length > 0) {
      findings.push({
        dimension: dim,
        severity: "warning",
        criterion: "非终态有 exit_conditions",
        finding: `${noExit.length} 个非终态缺少 exit_conditions：${noExit.map((s) => s.name).join(", ")}`,
        recommendation:
          "不知道什么条件满足才能离开该状态。补充 exit_conditions",
      });
      score -= 3;
    }
  } else {
    score -= 8;
  }

  // Check: templates exist and have fields
  if (h.templates && h.templates.length > 0) {
    const emptyTemplates = h.templates.filter((t) => t.fields.length === 0);
    if (emptyTemplates.length > 0) {
      findings.push({
        dimension: dim,
        severity: "warning",
        criterion: "模板有具体字段",
        finding: `${emptyTemplates.length} 个模板没有定义 fields：${emptyTemplates.map((t) => t.name).join(", ")}`,
        recommendation: "空模板无法被系统化处理。定义每个模板的具体字段",
      });
      score -= 2;
    }
  } else {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "有可填写模板",
      finding: "没有定义任何结构化模板",
      recommendation:
        "评估表、改进计划等应有结构化模板，降低填写摩擦，便于数据分析",
    });
    score -= 3;
  }

  // Check: data_bindings (real resources)
  if (h.data_bindings?.bitable_app_token) {
    const bindingCount = Object.keys(h.data_bindings.table_bindings).length;
    findings.push({
      dimension: dim,
      severity: "pass",
      criterion: "数据绑定真实资源",
      finding: `已绑定 Bitable app_token，${bindingCount} 张表有真实 table_id`,
    });
  } else {
    findings.push({
      dimension: dim,
      severity: "fail",
      criterion: "数据绑定真实资源",
      finding: "data_bindings 为空，系统运行时无法读写数据",
      recommendation: "让 Anya 创建 Bitable 后回填 app_token 和 table_id",
    });
    score -= 5;
  }

  // Check: skill_bindings cover control_matrix actions
  if (h.skill_bindings && h.skill_bindings.length > 0) {
    const boundActions = new Set(h.skill_bindings.map((b) => b.action));
    const matrixActions = h.control_matrix
      .filter((c) => c.control_level !== "human_only")
      .map((c) => c.action);
    const unbound = matrixActions.filter((a) => !boundActions.has(a));
    if (unbound.length > 0 && unbound.length <= 3) {
      findings.push({
        dimension: dim,
        severity: "warning",
        criterion: "action → skill 绑定覆盖",
        finding: `${unbound.length} 个自动化 action 缺少 skill 绑定`,
        recommendation: `为以下 action 添加 skill_binding：${unbound.slice(0, 3).join(", ")}`,
      });
      score -= 2;
    } else if (unbound.length > 3) {
      findings.push({
        dimension: dim,
        severity: "fail",
        criterion: "action → skill 绑定覆盖",
        finding: `${unbound.length} 个自动化 action 缺少 skill 绑定，覆盖率低`,
      });
      score -= 4;
    }
  } else {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "skill 绑定存在",
      finding: "没有定义任何 skill_bindings",
      recommendation:
        "Anya 执行时要猜用哪个 skill。为 control_matrix 中的 action 绑定 skill",
    });
    score -= 3;
  }

  // Check: automation_rules for scheduled transitions
  const scheduledTransitions = h.state_machine?.transitions.filter(
    (t) => t.triggered_by === "scheduled",
  );
  if (scheduledTransitions && scheduledTransitions.length > 0) {
    const hasRules =
      (h.automation_rules && h.automation_rules.length > 0) ||
      (h.scheduled_tasks && h.scheduled_tasks.length > 0);
    if (!hasRules) {
      findings.push({
        dimension: dim,
        severity: "fail",
        criterion: "定时触发有对应规则",
        finding: `有 ${scheduledTransitions.length} 条 scheduled transition，但没有定义 automation_rules 或 scheduled_tasks`,
        recommendation: "定时触发的转移需要 cron job 支撑，否则不会自动执行",
      });
      score -= 3;
    }
  }

  return {
    name: "可执行性",
    score: Math.max(0, score),
    max: DIMENSION_MAX,
    findings,
  };
}

// ── Dimension 3: Safety (0-20) ──

function evaluateSafety(h: HarnessDocument): DimensionScore {
  const findings: EvalFinding[] = [];
  let score = DIMENSION_MAX;
  const dim = "safety" as const;

  // Check: forbidden_actions exist and are sufficient
  if (!h.forbidden_actions || h.forbidden_actions.length === 0) {
    findings.push({
      dimension: dim,
      severity: "fail",
      criterion: "禁止事项已定义",
      finding: "没有定义任何 forbidden_actions",
      recommendation: "AI 系统必须有明确的负向边界。至少列出3条不可逾越的底线",
    });
    score -= 6;
  } else if (h.forbidden_actions.length < 3) {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "禁止事项充分",
      finding: `仅有 ${h.forbidden_actions.length} 条 forbidden_actions，建议至少3条`,
    });
    score -= 3;
  } else {
    findings.push({
      dimension: dim,
      severity: "pass",
      criterion: "禁止事项已定义",
      finding: `${h.forbidden_actions.length} 条 forbidden_actions 已定义`,
    });
  }

  // Check: human_confirmed exists on critical paths
  const humanConfirmedCount = h.control_matrix.filter(
    (c) =>
      c.control_level === "human_confirmed" || c.control_level === "human_only",
  ).length;
  const fullAutoCount = h.control_matrix.filter(
    (c) => c.control_level === "full_auto",
  ).length;

  if (humanConfirmedCount === 0) {
    findings.push({
      dimension: dim,
      severity: "fail",
      criterion: "有人工确认节点",
      finding: "control_matrix 中没有任何 human_confirmed 或 human_only 节点",
      recommendation: "纯自动化流程不可信。关键决策点必须有人工确认",
    });
    score -= 5;
  } else {
    const ratio = humanConfirmedCount / h.control_matrix.length;
    findings.push({
      dimension: dim,
      severity: "pass",
      criterion: "人工确认节点",
      finding: `${humanConfirmedCount}/${h.control_matrix.length} 个节点需人工确认（${Math.round(ratio * 100)}%）`,
    });
  }

  // Check: all human_decision transitions have a corresponding human_confirmed control
  if (h.state_machine) {
    const humanDecisionCount = h.state_machine.transitions.filter(
      (t) => t.triggered_by === "human_decision",
    ).length;
    if (humanDecisionCount > 0 && humanConfirmedCount === 0) {
      findings.push({
        dimension: dim,
        severity: "fail",
        criterion: "人工决策有控制权保障",
        finding: `${humanDecisionCount} 条转移由 human_decision 触发，但 control_matrix 中无 human_confirmed 节点`,
        recommendation:
          "状态机中的人工决策需要在 control_matrix 中有对应的人工确认控制",
      });
      score -= 4;
    }
  }

  // Check: forbidden_actions vs control_matrix consistency
  // Look for patterns where forbidden says "don't do X" but control_matrix has "full_auto" on something like X
  if (h.forbidden_actions && h.forbidden_actions.length > 0) {
    const forbidJudgment = h.forbidden_actions.some(
      (f) => f.includes("判断") || f.includes("评价") || f.includes("决策"),
    );
    const autoJudgmentActions = h.control_matrix.filter(
      (c) =>
        c.control_level === "full_auto" &&
        (c.is_judgment === true ||
          c.action.includes("评价") ||
          c.action.includes("判断") ||
          c.action.includes("决定") ||
          c.action.includes("Go/No-Go")),
    );
    if (forbidJudgment && autoJudgmentActions.length > 0) {
      findings.push({
        dimension: dim,
        severity: "fail",
        criterion: "forbidden_actions 与 control_matrix 一致性",
        finding: `forbidden_actions 禁止 AI 做判断/决策，但 control_matrix 中有 ${autoJudgmentActions.length} 个判断类 action 设为 full_auto`,
        recommendation: `将以下 action 改为 human_confirmed：${autoJudgmentActions.map((a) => a.action).join(", ")}`,
      });
      score -= 5;
    }
  }

  // Check: trigger_rules safety
  if (h.state_machine?.trigger_rules) {
    const hasEscalation = h.state_machine.trigger_rules.some(
      (r) =>
        r.has_escalation_path === true ||
        r.action.includes("通知") ||
        r.action.includes("面谈") ||
        r.action.includes("升级"),
    );
    if (!hasEscalation) {
      findings.push({
        dimension: dim,
        severity: "warning",
        criterion: "底线触发有升级路径",
        finding: "trigger_rules 中没有明确的升级路径（通知谁？面谈谁？）",
        recommendation:
          "底线触发后应有明确的升级链：通知谁 → 面谈谁 → 最终决策权",
      });
      score -= 2;
    }
  }

  return {
    name: "安全性",
    score: Math.max(0, score),
    max: DIMENSION_MAX,
    findings,
  };
}

// ── Dimension 4: Evolvability (0-20) ──

function evaluateEvolvability(h: HarnessDocument): DimensionScore {
  const findings: EvalFinding[] = [];
  let score = DIMENSION_MAX;
  const dim = "evolvability" as const;

  // Check: error_handling layers
  if (h.error_handling && h.error_handling.layers.length >= 3) {
    findings.push({
      dimension: dim,
      severity: "pass",
      criterion: "错误处理分层",
      finding: `${h.error_handling.layers.length} 层错误处理策略已定义`,
    });
  } else if (h.error_handling && h.error_handling.layers.length > 0) {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "错误处理分层",
      finding: `仅 ${h.error_handling.layers.length} 层错误处理，建议至少3层（日志→健康检查→自动修复）`,
    });
    score -= 3;
  } else {
    findings.push({
      dimension: dim,
      severity: "fail",
      criterion: "错误处理存在",
      finding: "没有定义任何错误处理策略",
      recommendation: "建议 L1-L5 五层自我修复策略",
    });
    score -= 6;
  }

  // Check: config table exists in data_architecture
  const hasConfigTable = h.data_architecture.some(
    (t) =>
      t.name.includes("config") ||
      t.name.includes("配置") ||
      t.purpose.includes("配置"),
  );
  if (hasConfigTable) {
    findings.push({
      dimension: dim,
      severity: "pass",
      criterion: "配置驱动",
      finding: "数据架构中包含配置表，参数可调",
    });
  } else {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "配置驱动",
      finding: "data_architecture 中没有配置表",
      recommendation:
        "阈值、频率、提醒对象等可变参数应集中在配置表中，HR 可自行调整",
    });
    score -= 4;
  }

  // Check: implementation_phases have completion_criteria
  if (h.implementation_phases.length > 0) {
    const noCriteria = h.implementation_phases.filter(
      (p) => !p.completion_criteria || p.completion_criteria.trim() === "",
    );
    if (noCriteria.length > 0) {
      findings.push({
        dimension: dim,
        severity: "warning",
        criterion: "阶段有完成标准",
        finding: `${noCriteria.length} 个实施阶段缺少 completion_criteria`,
        recommendation: "没有完成标准就无法判断一个阶段是否真正完成",
      });
      score -= 2;
    }
  }

  // Check: feedback loop exists
  const hasFeedbackLoop =
    h.state_machine?.states.some((s) =>
      s.entry_actions.some(
        (a) =>
          a.includes("校准") ||
          a.includes("反馈") ||
          a.includes("calibrat") ||
          a.includes("retrospect"),
      ),
    ) ?? false;

  if (hasFeedbackLoop) {
    findings.push({
      dimension: dim,
      severity: "pass",
      criterion: "反馈闭环",
      finding: "状态机中包含校准/反馈动作，系统可自我进化",
    });
  } else {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "反馈闭环",
      finding: "没有发现明确的反馈闭环机制（面试校准、指标迭代等）",
      recommendation:
        "没有反馈闭环的系统无法进化。建议在终态添加校准动作，反哺上游",
    });
    score -= 4;
  }

  // Check: communication_checklist completeness
  if (h.communication_checklist.length > 0) {
    const pending = h.communication_checklist.filter(
      (c) => c.status === "pending",
    );
    if (pending.length > 0) {
      findings.push({
        dimension: dim,
        severity: "warning",
        criterion: "沟通清单完成度",
        finding: `communication_checklist 还有 ${pending.length} 项 pending`,
        recommendation: "上线前确认所有沟通事项",
      });
      score -= 2;
    }
  }

  // Check: automation_rules have failure_policy
  if (h.automation_rules && h.automation_rules.length > 0) {
    const noPolicy = h.automation_rules.filter(
      (r) => !r.failure_policy || r.failure_policy.max_retries === undefined,
    );
    if (noPolicy.length > 0) {
      findings.push({
        dimension: dim,
        severity: "warning",
        criterion: "自动化规则有失败策略",
        finding: `${noPolicy.length} 条 automation_rules 缺少 failure_policy`,
        recommendation: "每条自动化规则都应有失败降级策略",
      });
      score -= 2;
    }
  }

  return {
    name: "可演化性",
    score: Math.max(0, score),
    max: DIMENSION_MAX,
    findings,
  };
}

// ── Dimension 5: Self-Check Capability (0-20) ──

function evaluateSelfCheck(h: HarnessDocument): DimensionScore {
  const findings: EvalFinding[] = [];
  let score = DIMENSION_MAX;
  const dim = "self_check" as const;

  const ev = h.builtin_evaluator;

  // Check: builtin_evaluator exists
  if (!ev || ev.checks.length === 0) {
    findings.push({
      dimension: dim,
      severity: "fail",
      criterion: "内建 Evaluator 存在",
      finding:
        "系统没有内建 Evaluator。Generator（做事的 Anya）和 Evaluator（检查的 Anya）没有分离",
      recommendation:
        "定义 builtin_evaluator，包含至少 2 项独立质量检查，每项有硬性及格线。" +
        "Evaluator 必须在独立上下文中运行，防止 Generator 自我宽容",
    });
    return { name: "自检能力", score: 0, max: DIMENSION_MAX, findings };
  }

  // Check: at least 2 checks defined
  if (ev.checks.length < 2) {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "检查项充分",
      finding: `仅 ${ev.checks.length} 项检查，建议至少 2 项覆盖不同维度`,
    });
    score -= 4;
  } else {
    findings.push({
      dimension: dim,
      severity: "pass",
      criterion: "检查项充分",
      finding: `${ev.checks.length} 项质量检查已定义`,
    });
  }

  // Check: isolation_required is true
  if (!ev.isolation_required) {
    findings.push({
      dimension: dim,
      severity: "fail",
      criterion: "Generator-Evaluator 隔离",
      finding: "isolation_required 为 false。同一上下文中做事又评价会自我宽容",
      recommendation:
        "设置 isolation_required: true，确保 Evaluator 在独立对话上下文中运行",
    });
    score -= 6;
  } else {
    findings.push({
      dimension: dim,
      severity: "pass",
      criterion: "Generator-Evaluator 隔离",
      finding:
        "isolation_required: true — Generator 和 Evaluator 在独立上下文中运行",
    });
  }

  // Check: each check has a hard_threshold
  const noThreshold = ev.checks.filter(
    (c) => !c.hard_threshold || c.hard_threshold.trim() === "",
  );
  if (noThreshold.length > 0) {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "硬性及格线",
      finding: `${noThreshold.length} 项检查缺少 hard_threshold`,
      recommendation:
        "没有硬性及格线的检查形同虚设。每项检查都需要明确的通过/不通过标准",
    });
    score -= 3;
  }

  // Check: at least one check has on_fail = "block"
  const hasBlocking = ev.checks.some((c) => c.on_fail === "block");
  if (!hasBlocking) {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "有阻断能力",
      finding: "没有任何检查项设置 on_fail='block'",
      recommendation:
        "至少有一项关键检查能阻断流程。纯 warn 的 Evaluator 没有牙齿",
    });
    score -= 3;
  }

  // Check: escalation defined
  if (!ev.escalation || ev.escalation.trim() === "") {
    findings.push({
      dimension: dim,
      severity: "warning",
      criterion: "升级路径",
      finding: "Evaluator 没有定义不通过时的升级路径",
      recommendation: "定义 Evaluator 发现问题后通知谁、怎么升级",
    });
    score -= 2;
  }

  return {
    name: "自检能力",
    score: Math.max(0, score),
    max: DIMENSION_MAX,
    findings,
  };
}

// ── Main Evaluator ──

function evaluateHarness(h: HarnessDocument): EvaluationResult {
  const dimensions = [
    evaluateCompleteness(h),
    evaluateExecutability(h),
    evaluateSafety(h),
    evaluateEvolvability(h),
    evaluateSelfCheck(h),
  ];

  const overall_score = dimensions.reduce((sum, d) => sum + d.score, 0);
  const all_findings = dimensions.flatMap((d) => d.findings);
  const critical_issues = all_findings.filter((f) => f.severity === "fail");

  let summary: string;
  if (overall_score >= 90) {
    summary = `✅ 评分 ${overall_score}/100 — 系统规格质量高，可交付执行`;
  } else if (overall_score >= 70) {
    summary = `🟡 评分 ${overall_score}/100 — 基本可用，有 ${critical_issues.length} 个问题需关注`;
  } else if (overall_score >= 50) {
    summary = `🟠 评分 ${overall_score}/100 — 有明显短板，建议修订后再交付`;
  } else {
    summary = `🔴 评分 ${overall_score}/100 — 质量不合格，需要大幅改进`;
  }

  return { overall_score, dimensions, all_findings, critical_issues, summary };
}

// ── MCP Tool ──

export const EVALUATE_HARNESS_SCHEMA = {
  name: "evaluate_harness",
  description: `Evaluator — 对已生成的 harness 做质量评估（不是结构校验）。

灵感来自 Anthropic 的 GAN 式三角架构（Planner → Generator → Evaluator）。
与 validate_harness（结构校验）不同，evaluate_harness 模拟走状态机、交叉验证字段、
检查人机边界一致性，输出具体的改进建议。

五个评分维度（每个 0-20 分，总分 0-100）：

1. **流程完整性** — 所有状态可达？有没有死路？transition 引用有效？trigger_rules 完整？
2. **可执行性** — entry_actions 非空？模板有字段？data_bindings 有真实 token？skill 绑定覆盖？
3. **安全性** — forbidden_actions 充分？人工确认节点够？与 control_matrix 无冲突？
4. **可演化性** — 错误处理分层？配置驱动？有反馈闭环？通信清单完成？
5. **自检能力** — 系统有内建 Evaluator？Generator-Evaluator 隔离？检查项有硬性及格线？有阻断能力？

每条发现附带具体 criterion、finding、recommendation。
Generator（调用方）可根据 Evaluator 的反馈调用 answer_questions 迭代改进。

推荐工作流：
  generate_harness → evaluate_harness → 根据反馈改进 → 再评估 → 直到满意`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleEvaluateHarness(
  store: Store,
  args: { project_id: string },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.harness) {
    return JSON.stringify({
      error: "该项目尚未生成执行手册，请先调用 generate_harness",
    });
  }

  const result = evaluateHarness(project.harness);

  return JSON.stringify(
    {
      project_id: project.id,
      business_name: project.harness.business_name,
      evaluation: {
        overall_score: result.overall_score,
        summary: result.summary,
        dimensions: result.dimensions.map((d) => ({
          name: d.name,
          score: `${d.score}/${d.max}`,
          fail_count: d.findings.filter((f) => f.severity === "fail").length,
          warning_count: d.findings.filter((f) => f.severity === "warning")
            .length,
        })),
        critical_issues: result.critical_issues.map((f) => ({
          dimension: f.dimension,
          criterion: f.criterion,
          finding: f.finding,
          recommendation: f.recommendation,
        })),
        all_findings: result.all_findings.map((f) => ({
          dimension: f.dimension,
          severity: f.severity,
          criterion: f.criterion,
          finding: f.finding,
          recommendation: f.recommendation,
        })),
      },
      next_steps:
        result.critical_issues.length > 0
          ? [
              `有 ${result.critical_issues.length} 个 critical 问题需修复`,
              "根据 Evaluator 的具体反馈调用 answer_questions 改进",
              "改进后再次调用 evaluate_harness 重新评估",
            ]
          : result.overall_score >= 90
            ? ["质量达标，可以调用 export_handbook 导出交付"]
            : [
                "无 critical 问题，但有改进空间",
                "建议根据 warning 级别的反馈优化后再导出",
              ],
    },
    null,
    2,
  );
}
