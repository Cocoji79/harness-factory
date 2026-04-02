import type { Store } from "../store/store.js";
import type { HarnessValidation, ValidationIssue } from "../types.js";

export const VALIDATE_HARNESS_SCHEMA = {
  name: "validate_harness",
  description: `对已生成的执行手册做结构性质量自检。

这是 generate_harness 之后的质量门禁。它检查手册的七个维度：

1. **控制权覆盖**：每个流程阶段都有控制权定义吗？有没有遗漏？
2. **失败处理**：每个自动化环节都有失败兜底吗？有没有"一步出错全线崩溃"的风险？
3. **人工确认点**：有没有至少一个人工确认点？纯全自动的流水线通常不可信。
4. **配置外置**：阈值、模板这些可变参数是在配置表里还是写死在 Skill 描述里？
5. **实施可行性**：每个阶段有可验证的完成标志吗？需要确认的事项完整吗？
6. **数据架构**：有没有主数据表？日志表？状态枚举？
7. **依赖闭环**：新建 Skill 的依赖是否都在能力注册表中？

你需要传入验证结果（validation 字段），因为质量判断需要 AI 理解手册内容的语义——
请基于项目中的 harness 数据和能力注册表，完成验证后回传。

评分标准：
- 90-100：手册质量高，可以直接交付执行
- 70-89：基本可用，有 warning 需关注
- 50-69：有 critical 问题，建议修订后再交付
- 0-49：手册质量不合格，需要重新生成`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
      validation: {
        type: "object",
        description:
          "完整的手册验证结果。如果不传，返回手册数据和能力注册表供你验证后回传。",
        properties: {
          overall_score: { type: "number", description: "总分 0-100" },
          is_valid: {
            type: "boolean",
            description: "是否通过验证（无 critical issue）",
          },
          control_coverage: {
            type: "object",
            properties: {
              total_stages: { type: "number" },
              covered_stages: { type: "number" },
              uncovered: { type: "array", items: { type: "string" } },
              passed: { type: "boolean" },
            },
            required: ["total_stages", "covered_stages", "uncovered", "passed"],
          },
          failure_handling: {
            type: "object",
            properties: {
              auto_stages: { type: "number" },
              with_failure_handling: { type: "number" },
              missing: { type: "array", items: { type: "string" } },
              passed: { type: "boolean" },
            },
            required: ["auto_stages", "with_failure_handling", "missing", "passed"],
          },
          human_checkpoints: {
            type: "object",
            properties: {
              has_human_checkpoint: { type: "boolean" },
              human_confirmed_count: { type: "number" },
              auto_only_risk: { type: "boolean" },
              passed: { type: "boolean" },
            },
            required: ["has_human_checkpoint", "human_confirmed_count", "passed"],
          },
          config_externalization: {
            type: "object",
            properties: {
              hardcoded_values: { type: "array", items: { type: "string" } },
              externalized_count: { type: "number" },
              passed: { type: "boolean" },
            },
            required: ["hardcoded_values", "externalized_count", "passed"],
          },
          implementation_feasibility: {
            type: "object",
            properties: {
              phases_with_completion_criteria: { type: "number" },
              phases_total: { type: "number" },
              phases_with_confirmation: { type: "number" },
              passed: { type: "boolean" },
            },
            required: ["phases_total", "passed"],
          },
          data_architecture: {
            type: "object",
            properties: {
              has_main_table: { type: "boolean" },
              has_log_table: { type: "boolean" },
              has_status_enum: { type: "boolean" },
              passed: { type: "boolean" },
            },
            required: ["has_main_table", "has_log_table", "has_status_enum", "passed"],
          },
          dependency_check: {
            type: "object",
            properties: {
              new_skills: { type: "array", items: { type: "string" } },
              missing_dependencies: { type: "array", items: { type: "string" } },
              passed: { type: "boolean" },
            },
            required: ["new_skills", "missing_dependencies", "passed"],
          },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                severity: {
                  type: "string",
                  enum: ["critical", "warning", "info"],
                },
                category: { type: "string" },
                message: { type: "string" },
                suggestion: { type: "string" },
              },
              required: ["severity", "category", "message", "suggestion"],
            },
          },
        },
        required: [
          "overall_score",
          "is_valid",
          "control_coverage",
          "failure_handling",
          "human_checkpoints",
          "config_externalization",
          "implementation_feasibility",
          "data_architecture",
          "dependency_check",
          "issues",
        ],
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleValidateHarness(
  store: Store,
  args: {
    project_id: string;
    validation?: HarnessValidation;
  },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.harness) {
    return JSON.stringify({
      error: "该项目尚未生成执行手册，请先调用 generate_harness",
    });
  }

  if (args.validation) {
    const updated = { ...project, harness_validation: args.validation };
    await store.saveProject(updated);

    const criticals = args.validation.issues.filter(
      (i) => i.severity === "critical",
    );
    const warnings = args.validation.issues.filter(
      (i) => i.severity === "warning",
    );

    return JSON.stringify(
      {
        project_id: project.id,
        status: "validation_saved",
        overall_score: args.validation.overall_score,
        is_valid: args.validation.is_valid,
        checks: {
          control_coverage: args.validation.control_coverage.passed
            ? "✓"
            : "✗",
          failure_handling: args.validation.failure_handling.passed
            ? "✓"
            : "✗",
          human_checkpoints: args.validation.human_checkpoints.passed
            ? "✓"
            : "✗",
          config_externalization: args.validation.config_externalization.passed
            ? "✓"
            : "✗",
          implementation_feasibility:
            args.validation.implementation_feasibility.passed ? "✓" : "✗",
          data_architecture: args.validation.data_architecture.passed
            ? "✓"
            : "✗",
          dependency_check: args.validation.dependency_check.passed
            ? "✓"
            : "✗",
        },
        critical_issues: criticals.length,
        warnings: warnings.length,
        next_steps: args.validation.is_valid
          ? [
              "手册通过验证，可以调用 export_handbook 导出并交付执行",
              warnings.length > 0
                ? `有 ${warnings.length} 条 warning，建议关注但不阻塞`
                : null,
            ].filter(Boolean)
          : [
              `有 ${criticals.length} 个 critical 问题需要修复：`,
              ...criticals.map((c) => `- [${c.category}] ${c.message}`),
              "修复后请重新调用 generate_harness 生成手册，再次验证",
            ],
      },
      null,
      2,
    );
  }

  // Return data for validation
  const capabilities = await store.getCapabilities();

  return JSON.stringify(
    {
      project_id: project.id,
      status: "awaiting_validation",
      message:
        "请基于以下手册数据进行七维度质量验证，完成后将结果通过 validation 参数回传。",
      validation_checklist: {
        control_coverage:
          "检查 control_matrix 是否覆盖了 redesigned_process（如有）或 implementation_phases 中的所有阶段",
        failure_handling:
          "检查 control_level 为 full_auto 或 auto_with_review 的阶段，是否在 markdown 或 phase 描述中提到了失败处理",
        human_checkpoints:
          "检查是否至少有一个 human_confirmed 或 human_only 的控制权。如果全是 full_auto，标记为 critical",
        config_externalization:
          "检查 markdown 或 skill 描述中是否有写死的数字（阈值、天数、次数等），这些应该放在配置表中",
        implementation_feasibility:
          "检查每个 phase 是否有 completion_criteria、needs_confirmation 是否覆盖了关键确认项",
        data_architecture:
          "检查 data_architecture 是否包含主数据表（核心业务对象）、操作日志表、状态枚举定义",
        dependency_check:
          "检查 new_skills 的 dependencies 是否都在能力注册表或 existing_skills 中",
      },
      harness: {
        business_name: project.harness.business_name,
        principles: project.harness.principles,
        data_architecture: project.harness.data_architecture,
        control_matrix: project.harness.control_matrix,
        existing_skills: project.harness.existing_skills,
        new_skills: project.harness.new_skills,
        scheduled_tasks: project.harness.scheduled_tasks,
        implementation_phases: project.harness.implementation_phases,
        communication_checklist: project.harness.communication_checklist,
      },
      capability_registry_names: capabilities.map((c) => c.name),
    },
    null,
    2,
  );
}
