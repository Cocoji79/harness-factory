import type { Store } from "../store/store.js";
import type { HarnessDocument } from "../types.js";

/**
 * HITL 硬门禁：generate_harness 之后、export_handbook 之前的人工审查。
 *
 * 自动从 harness 中提取所有需要人确认的决策点，生成精简审查清单。
 * export_handbook 会检查 human_review_status，未审查则拒绝导出。
 */

interface ReviewItem {
  category: string;
  items: string[];
  question: string;
}

function extractReviewChecklist(h: HarnessDocument): ReviewItem[] {
  const checklist: ReviewItem[] = [];

  // 1. control_matrix 中的 full_auto 项
  const fullAutoActions = h.control_matrix
    .filter((c) => c.control_level === "full_auto")
    .map((c) => `${c.stage} → ${c.action}：${c.description}`);
  if (fullAutoActions.length > 0) {
    checklist.push({
      category: "自动化权限",
      items: fullAutoActions,
      question: "以下动作设为全自动（AI 不需要人确认就能执行），请确认是否合理：",
    });
  }

  // 2. forbidden_actions
  if (h.forbidden_actions && h.forbidden_actions.length > 0) {
    checklist.push({
      category: "AI 底线红线",
      items: h.forbidden_actions,
      question: "AI 的禁止事项如下，请确认是否有遗漏：",
    });
  } else {
    checklist.push({
      category: "AI 底线红线",
      items: ["⚠️ 未定义任何 forbidden_actions"],
      question: "AI 没有设定任何底线红线，这是否合理？",
    });
  }

  // 3. 北极星指标（如果项目有定义）
  // This info is on the project level, not harness level — we check generation_state
  // for now just flag if principles mention metrics
  const metricPrinciples = h.principles.filter(
    (p) => p.includes("指标") || p.includes("北极星") || p.includes("评估"),
  );
  if (metricPrinciples.length > 0) {
    checklist.push({
      category: "评估指标",
      items: metricPrinciples,
      question: "以下评估相关原则是否正确反映了业务目标：",
    });
  }

  // 4. requires_human=true 但被 AI 代答的问题
  const aiOverrides = (h.generation_state?.answered_questions ?? []).filter(
    (aq) => {
      const pending = h.generation_state?.pending_questions?.find(
        (pq) => pq.id === aq.question_id,
      );
      // If the pending question required human but was answered by AI
      // (this shouldn't happen with the new blocking, but check historical data)
      return pending?.requires_human && aq.answered_by === "ai";
    },
  );
  if (aiOverrides.length > 0) {
    checklist.push({
      category: "AI 代答复核",
      items: aiOverrides.map((a) => `${a.question_id}：${a.answer.slice(0, 100)}`),
      question:
        "以下需人确认的问题被 AI 代答了（可能是历史数据），请复核：",
    });
  }

  // 5. builtin_evaluator 检查
  if (h.builtin_evaluator) {
    const blockingChecks = h.builtin_evaluator.checks
      .filter((c) => c.on_fail === "block")
      .map((c) => `${c.name}：${c.check_logic}（阈值：${c.hard_threshold}）`);
    if (blockingChecks.length > 0) {
      checklist.push({
        category: "系统自检阻断项",
        items: blockingChecks,
        question: "以下质量检查会阻断流程，请确认阈值是否合理：",
      });
    }
  }

  return checklist;
}

export const HUMAN_REVIEW_SCHEMA = {
  name: "human_review",
  description: `HITL 硬门禁：在 generate_harness 之后、export_handbook 之前插入的人工审查节点。

自动从 harness 中提取所有需要人确认的决策点，生成精简审查清单：
1. control_matrix 中所有 full_auto 项 → "以下动作设为全自动，请确认"
2. forbidden_actions 列表 → "AI 的底线红线，请确认是否遗漏"
3. 评估指标相关原则 → "请确认是否正确反映业务目标"
4. requires_human=true 但被 AI 代答的项 → "请复核"
5. builtin_evaluator 的阻断项 → "请确认阈值是否合理"

两阶段调用：
- 不传 human_decisions → 返回审查清单
- 传入 human_decisions → 标记已审查，解锁 export_handbook

⚠️ 这是硬门禁：export_handbook 会检查审查状态，未审查则拒绝导出。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
      human_decisions: {
        type: "object",
        description: "审查结果。不传则返回审查清单。",
        properties: {
          approved: {
            type: "boolean",
            description: "是否批准",
          },
          reviewer: {
            type: "string",
            description: "审查人姓名",
          },
          notes: {
            type: "string",
            description: "审查备注（可选）",
          },
          modifications: {
            type: "array",
            items: { type: "string" },
            description: "审查中发现需要修改的项（可选）",
          },
        },
        required: ["approved", "reviewer"],
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleHumanReview(
  store: Store,
  args: {
    project_id: string;
    human_decisions?: {
      approved: boolean;
      reviewer: string;
      notes?: string;
      modifications?: string[];
    };
  },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.harness) {
    return JSON.stringify({
      error: "该项目尚未生成 harness，请先调用 generate_harness",
    });
  }

  // Phase 2: 收到审查结果
  if (args.human_decisions) {
    const reviewRecord = {
      reviewed_at: new Date().toISOString(),
      ...args.human_decisions,
    };

    await store.saveProject({
      ...project,
      human_review_status: args.human_decisions.approved
        ? "approved"
        : "rejected",
      human_review: reviewRecord,
    } as typeof project & { human_review_status: string; human_review: typeof reviewRecord });

    if (args.human_decisions.approved) {
      return JSON.stringify(
        {
          project_id: project.id,
          status: "approved",
          reviewer: args.human_decisions.reviewer,
          message: "✅ 人工审查通过，export_handbook 已解锁",
          next_steps: ["调用 export_handbook 导出执行手册"],
        },
        null,
        2,
      );
    } else {
      return JSON.stringify(
        {
          project_id: project.id,
          status: "rejected",
          reviewer: args.human_decisions.reviewer,
          modifications: args.human_decisions.modifications ?? [],
          message:
            "❌ 人工审查未通过，请根据审查意见修改后重新提交",
          next_steps: [
            "根据 modifications 调用 answer_questions 修改相应字段",
            "修改后重新调用 evaluate_harness 评估",
            "再次调用 human_review 提交审查",
          ],
        },
        null,
        2,
      );
    }
  }

  // Phase 1: 生成审查清单
  const checklist = extractReviewChecklist(project.harness);

  return JSON.stringify(
    {
      project_id: project.id,
      status: "awaiting_review",
      message:
        "请审查以下关键决策点。确认后通过 human_decisions 参数提交审查结果。",
      checklist: checklist.map((c) => ({
        category: c.category,
        question: c.question,
        items: c.items,
      })),
      total_items: checklist.reduce((sum, c) => sum + c.items.length, 0),
      next_steps: [
        "逐项审查上述清单",
        "确认后调用 human_review(project_id, {approved: true, reviewer: '姓名'})",
        "如有需修改的项，在 modifications 中列出",
      ],
    },
    null,
    2,
  );
}
