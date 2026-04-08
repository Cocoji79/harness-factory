import type { Store } from "../store/store.js";
import type { HealthReport } from "../types.js";

export const HEALTH_CHECK_SCHEMA = {
  name: "health_check",
  description: `生成流水线运行时的健康报告。这是手册交付执行后的持续自省机制。

在 Agent 按手册执行一段时间后，调用此 Tool 输入运行数据，生成健康报告。
健康报告回答五个核心问题：

1. **各阶段转化率如何？** 哪个阶段漏斗最大？哪里有堆积？
2. **异常率多高？** 哪些阶段产生异常最多？Top 异常原因是什么？
3. **自动化真的有效吗？** 标为"全自动"的环节，实际有多少次需要人工干预？
4. **配置稳定吗？** 阈值、模板被频繁修改说明初始设计不合理。
5. **北极星指标趋势如何？** 如果项目定义了北极星指标，必须报告主指标和护栏的当前值，并与上次健康检查对比，判断趋势是向好还是恶化。主指标连续两个周期恶化 → 建议 needs_revision。护栏触及红线 → 标记 critical。

如果健康报告判定"需要修订手册"（needs_revision=true），说明手册设计本身有问题，
应该回到 analyze_gaps → generate_harness 重新迭代。

这就是 Harness Engineering 的自省闭环：
生成手册 → 执行 → 观察运行数据 → 发现问题 → 修订手册 → 再执行

你需要传入运行数据和健康评估（report 字段），因为健康判断需要 AI 理解业务语境——
请基于实际运行数据完成评估后回传。

健康等级：
- healthy（≥80分）：运行良好，无需修订
- degraded（50-79分）：有问题但可运行，建议优化
- unhealthy（<50分）：严重问题，需要修订手册`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
      report: {
        type: "object",
        description: "完整的健康报告。",
        properties: {
          project_id: { type: "string" },
          report_time: { type: "string" },
          overall_health: {
            type: "string",
            enum: ["healthy", "degraded", "unhealthy"],
          },
          overall_score: { type: "number", description: "0-100" },
          stage_metrics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stage: { type: "string" },
                objects_entered: { type: "number" },
                objects_completed: { type: "number" },
                objects_stuck: { type: "number" },
                conversion_rate: {
                  type: "number",
                  description: "0-1，完成数/进入数",
                },
                avg_duration_hours: { type: "number" },
                max_duration_hours: { type: "number" },
                is_bottleneck: { type: "boolean" },
              },
              required: [
                "stage",
                "objects_entered",
                "objects_completed",
                "conversion_rate",
                "is_bottleneck",
              ],
            },
          },
          anomaly_summary: {
            type: "object",
            properties: {
              total_anomalies: { type: "number" },
              by_stage: {
                type: "object",
                additionalProperties: { type: "number" },
              },
              top_reasons: { type: "array", items: { type: "string" } },
              anomaly_rate: {
                type: "number",
                description: "0-1，异常数/总处理数",
              },
            },
            required: ["total_anomalies", "anomaly_rate"],
          },
          automation_effectiveness: {
            type: "object",
            properties: {
              full_auto_stages: { type: "number" },
              full_auto_with_manual_override: { type: "number" },
              override_rate: {
                type: "number",
                description: "0-1，需要人工干预的全自动阶段占比",
              },
              stages_needing_reclassification: {
                type: "array",
                items: { type: "string" },
                description: "建议从 full_auto 改为 human_confirmed 的阶段",
              },
            },
            required: ["full_auto_stages", "override_rate"],
          },
          config_stability: {
            type: "object",
            properties: {
              changes_last_7_days: { type: "number" },
              changes_last_30_days: { type: "number" },
              frequently_changed_configs: {
                type: "array",
                items: { type: "string" },
              },
              is_stable: { type: "boolean" },
            },
            required: ["changes_last_30_days", "is_stable"],
          },
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                priority: {
                  type: "string",
                  enum: ["critical", "high", "medium", "low"],
                },
                area: { type: "string" },
                finding: { type: "string" },
                suggestion: { type: "string" },
              },
              required: ["priority", "area", "finding", "suggestion"],
            },
          },
          needs_revision: {
            type: "boolean",
            description:
              "是否需要回到 analyze_gaps → generate_harness 修订手册",
          },
          revision_reasons: {
            type: "array",
            items: { type: "string" },
            description: "需要修订的理由（当 needs_revision=true 时必填）",
          },
          north_star_tracking: {
            type: "object",
            description: "北极星指标追踪（仅当项目定义了北极星指标时填写）",
            properties: {
              primary_metric_value: {
                type: "number",
                description: "主指标当前值",
              },
              primary_metric_previous: {
                type: "number",
                description: "主指标上次健康检查时的值（首次填 null）",
              },
              primary_metric_trend: {
                type: "string",
                enum: ["improving", "stable", "declining"],
                description: "主指标趋势",
              },
              guardrail_values: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    current_value: { type: "string" },
                    threshold_breached: { type: "boolean" },
                  },
                  required: ["name", "current_value", "threshold_breached"],
                },
              },
              consecutive_decline_count: {
                type: "number",
                description:
                  "主指标连续恶化的周期数。>=2 时建议 needs_revision",
              },
            },
            required: [
              "primary_metric_value",
              "primary_metric_trend",
              "guardrail_values",
              "consecutive_decline_count",
            ],
          },
        },
        required: [
          "project_id",
          "report_time",
          "overall_health",
          "overall_score",
          "stage_metrics",
          "anomaly_summary",
          "automation_effectiveness",
          "config_stability",
          "recommendations",
          "needs_revision",
          "revision_reasons",
        ],
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleHealthCheck(
  store: Store,
  args: {
    project_id: string;
    report?: HealthReport;
  },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.harness) {
    return JSON.stringify({
      error: "该项目尚未生成执行手册，无法进行健康检查",
    });
  }

  if (args.report) {
    const report = { ...args.report, project_id: project.id };
    const updated = {
      ...project,
      health_reports: [...project.health_reports, report],
    };
    await store.saveProject(updated);

    const criticals = report.recommendations.filter(
      (r) => r.priority === "critical",
    );
    const bottlenecks = report.stage_metrics.filter((s) => s.is_bottleneck);

    return JSON.stringify(
      {
        project_id: project.id,
        status: "health_report_saved",
        report_number: updated.health_reports.length,
        overall_health: report.overall_health,
        overall_score: report.overall_score,
        key_findings: {
          bottleneck_stages: bottlenecks.map((b) => b.stage),
          anomaly_rate: `${(report.anomaly_summary.anomaly_rate * 100).toFixed(1)}%`,
          automation_override_rate: `${(report.automation_effectiveness.override_rate * 100).toFixed(1)}%`,
          config_stable: report.config_stability.is_stable,
          critical_recommendations: criticals.length,
        },
        needs_revision: report.needs_revision,
        next_steps: report.needs_revision
          ? [
              "健康报告表明手册需要修订：",
              ...report.revision_reasons.map((r) => `- ${r}`),
              "建议重新调用 analyze_gaps 更新分析，然后 generate_harness 生成新版手册",
            ]
          : [
              report.overall_health === "healthy"
                ? "流水线运行健康，继续保持"
                : "流水线有退化迹象，建议关注以下问题：",
              ...criticals.map((c) => `- [${c.area}] ${c.finding}`),
              `建议 ${report.overall_health === "healthy" ? "1个月" : "2周"}后再次进行健康检查`,
            ],
      },
      null,
      2,
    );
  }

  // Return context for health assessment
  const previousReports = project.health_reports;
  const latestReport =
    previousReports.length > 0
      ? previousReports[previousReports.length - 1]
      : null;

  return JSON.stringify(
    {
      project_id: project.id,
      status: "awaiting_health_report",
      message:
        "请收集流水线的运行数据，基于实际表现完成健康评估后通过 report 参数回传。",
      assessment_guide: {
        stage_metrics:
          "从主数据表中统计每个阶段的进入数、完成数、滞留数、平均停留时间。转化率低于 70% 或平均停留时间超过预期 2 倍的标记为瓶颈。",
        anomaly_summary:
          "统计异常标记的记录数，按阶段分组。异常率超过 15% 标记为 degraded，超过 30% 标记为 unhealthy。",
        automation_effectiveness:
          "检查控制权为 full_auto 的阶段，有多少次实际需要人工干预。干预率超过 20% 说明该阶段不应该是 full_auto。",
        config_stability:
          "检查配置表（阈值、模板等）在过去 30 天被修改了多少次。超过 5 次说明初始设计不合理。",
        needs_revision:
          "如果异常率 >30%，或有阶段转化率 <50%，或自动化干预率 >30%，建议标记 needs_revision=true。",
        north_star_tracking:
          "如果项目定义了北极星指标，必须填写 north_star_tracking：报告主指标当前值、与上次对比的趋势、护栏是否触及红线、连续恶化周期数。主指标连续 ≥2 个周期恶化 → 建议 needs_revision。护栏触及红线 → recommendations 中标记 critical。",
      },
      harness_summary: {
        business_name: project.harness.business_name,
        control_matrix_entries: project.harness.control_matrix.length,
        phases: project.harness.implementation_phases.length,
        scheduled_tasks: project.harness.scheduled_tasks?.length ?? 0,
      },
      previous_reports_count: previousReports.length,
      latest_report_summary: latestReport
        ? {
            time: latestReport.report_time,
            health: latestReport.overall_health,
            score: latestReport.overall_score,
            needed_revision: latestReport.needs_revision,
          }
        : null,
      north_star: project.north_star
        ? {
            primary_metric: project.north_star.primary_metric.name,
            definition: project.north_star.primary_metric.definition,
            frequency: project.north_star.primary_metric.frequency,
            direction: project.north_star.primary_metric.direction,
            guardrails: project.north_star.guardrails.map((g) => ({
              name: g.name,
              threshold: g.threshold,
            })),
          }
        : null,
    },
    null,
    2,
  );
}
