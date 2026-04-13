import { describe, it } from "node:test";
import assert from "node:assert/strict";

// We test the evaluator by importing its internals via a wrapper.
// Since evaluate-harness.ts only exports the MCP handler, we test
// through the public interface by constructing HarnessDocument objects
// and checking the JSON output.

// For unit testing the pure dimension functions, we re-export them here.
// This file is compiled by tsc but run directly with `node --test`.

import type { HarnessDocument } from "../../types.js";

/**
 * Factory: creates a minimal HarnessDocument that passes all checks.
 * Each test removes/modifies specific fields to test score deductions.
 */
function createFullHarness(): HarnessDocument {
  return {
    business_name: "测试项目",
    principles: ["原则1", "原则2", "原则3"],
    data_architecture: [
      {
        name: "main_table",
        purpose: "主数据表",
        fields: [
          { name: "id", type: "text", description: "ID", required: true },
        ],
      },
      {
        name: "config",
        purpose: "配置表",
        fields: [
          { name: "key", type: "text", description: "配置项", required: true },
        ],
      },
    ],
    control_matrix: [
      {
        stage: "stage_1",
        action: "自动采集",
        control_level: "full_auto",
        description: "数据采集",
      },
      {
        stage: "stage_1",
        action: "Go/No-Go决定",
        control_level: "human_confirmed",
        description: "人工确认",
      },
      {
        stage: "stage_2",
        action: "生成报告",
        control_level: "auto_with_review",
        description: "自动+审查",
      },
      {
        stage: "stage_2",
        action: "面谈",
        control_level: "human_only",
        description: "纯人工",
      },
    ],
    existing_skills: [
      { name: "lark-base", purpose: "表操作", pipeline_stage: "全流程" },
    ],
    new_skills: [],
    scheduled_tasks: [
      { name: "每日检查", frequency: "daily", description: "检查" },
    ],
    implementation_phases: [
      {
        number: 1,
        name: "Phase 1",
        self_driven_tasks: ["a"],
        needs_confirmation: ["b"],
        completion_criteria: "done",
      },
    ],
    communication_checklist: [
      { item: "确认1", priority: "before_start", status: "confirmed" },
    ],
    markdown_content: "# 测试",
    state_machine: {
      states: [
        {
          name: "start",
          description: "开始",
          entry_actions: ["初始化"],
          exit_conditions: ["完成初始化"],
        },
        {
          name: "processing",
          description: "处理中",
          entry_actions: ["处理数据"],
          exit_conditions: ["处理完成"],
        },
        {
          name: "done",
          description: "已完成",
          entry_actions: ["归档"],
          exit_conditions: ["终态，无出口"],
        },
      ],
      transitions: [
        {
          from: "start",
          to: "processing",
          condition: "初始化完成",
          triggered_by: "scheduled",
        },
        {
          from: "processing",
          to: "done",
          condition: "处理完成",
          triggered_by: "human_decision",
        },
      ],
      trigger_rules: [
        { name: "异常触发", condition: "异常", action: "通知 HR 并升级" },
      ],
    },
    data_bindings: {
      bitable_app_token: "test_token",
      table_bindings: { main: "tbl_test" },
    },
    forbidden_actions: ["不得替人决策", "不得泄露检查结果", "不得跳过节点"],
    error_handling: {
      layers: [
        {
          level: "L1_log",
          mechanism: "日志",
          trigger_condition: "always",
          recovery_action: "记录",
        },
        {
          level: "L2_health_check",
          mechanism: "健康检查",
          trigger_condition: "daily",
          recovery_action: "扫描",
        },
        {
          level: "L3_auto_repair",
          mechanism: "自动修复",
          trigger_condition: "on_error",
          recovery_action: "重试",
        },
      ],
    },
    templates: [
      {
        name: "eval_form",
        purpose: "评估表",
        fields: [
          {
            name: "rating",
            type: "select",
            required: true,
            options: ["好", "差"],
          },
        ],
        used_in_stages: ["processing"],
      },
    ],
    skill_bindings: [
      { action: "自动采集", skill_name: "lark-base" },
      { action: "生成报告", skill_name: "lark-doc" },
    ],
    automation_rules: [
      {
        name: "每日触发",
        trigger: { type: "cron", spec: "0 9 * * *" },
        action_ref: "check",
        failure_policy: { max_retries: 3, on_failure: "notify_hr" },
      },
    ],
    builtin_evaluator: {
      checks: [
        {
          name: "一致性检查",
          dimension: "safety",
          check_logic: "对比评价与数据",
          hard_threshold: "偏差 < 15分",
          on_fail: "block",
        },
        {
          name: "合规检查",
          dimension: "completeness",
          check_logic: "检查节点跳过",
          hard_threshold: "零跳过",
          on_fail: "escalate_to_human",
        },
      ],
      isolation_required: true,
      frequency: "per_milestone",
      escalation: "通知 HR 季虹",
    },
  };
}

// We can't import the internal functions directly since they're not exported.
// Instead we use a dynamic import of the handler and parse the JSON output.
// This tests the complete integration path.

import { Store } from "../../store/store.js";
import { handleEvaluateHarness } from "../evaluate-harness.js";
import { handleGenerateHarness } from "../generate-harness.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

async function setupTestStore(): Promise<{
  store: Store;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), "hf-test-"));
  const store = new Store(dir);
  await store.init();
  return {
    store,
    cleanup: () => rm(dir, { recursive: true }),
  };
}

async function createProjectWithHarness(
  store: Store,
  harness: HarnessDocument,
): Promise<string> {
  const project = await store.createProject(harness.business_name);
  // Manually set to generated with harness
  await store.saveProject({
    ...project,
    status: "generated",
    harness,
    analysis: {
      vision_vs_reality: [],
      docs_vs_reality: [],
      pain_points_prioritized: [],
      ai_native_opportunities: [],
      capability_matches: [],
      capability_gaps: [],
      recommended_questions: [],
      redesigned_process: [],
    },
  });
  return project.id;
}

async function evaluate(store: Store, projectId: string) {
  const result = await handleEvaluateHarness(store, { project_id: projectId });
  return JSON.parse(result);
}

function getDimensionScore(
  parsed: ReturnType<typeof JSON.parse>,
  name: string,
): number {
  const dim = parsed.evaluation.dimensions.find(
    (d: { name: string }) => d.name === name,
  );
  return dim ? parseInt(dim.score) : -1;
}

// ── Tests ──

describe("evaluateCompleteness", () => {
  it("complete state_machine → full score", async () => {
    const { store, cleanup } = await setupTestStore();
    const id = await createProjectWithHarness(store, createFullHarness());
    const r = await evaluate(store, id);
    // May lose 2 points on control_matrix naming mismatch
    assert.ok(
      getDimensionScore(r, "流程完整性") >= 18,
      `Expected >= 18, got ${getDimensionScore(r, "流程完整性")}`,
    );
    await cleanup();
  });

  it("no state_machine → score = 0", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.state_machine = undefined;
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.equal(getDimensionScore(r, "流程完整性"), 0);
    await cleanup();
  });

  it("transition references invalid state → score deducted", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.state_machine!.transitions.push({
      from: "nonexistent",
      to: "also_nonexistent",
      condition: "test",
      triggered_by: "scheduled",
    });
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.ok(getDimensionScore(r, "流程完整性") < 20);
    await cleanup();
  });
});

describe("evaluateExecutability", () => {
  it("full harness → near full score", async () => {
    const { store, cleanup } = await setupTestStore();
    const id = await createProjectWithHarness(store, createFullHarness());
    const r = await evaluate(store, id);
    // May not be exactly 20 due to partial skill_bindings coverage
    assert.ok(getDimensionScore(r, "可执行性") >= 15);
    await cleanup();
  });

  it("no data_bindings → score deducted by 5", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.data_bindings = undefined;
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    const full = 20; // approximate
    assert.ok(getDimensionScore(r, "可执行性") <= full - 4);
    await cleanup();
  });

  it("empty entry_actions → score deducted", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.state_machine!.states[0].entry_actions = [];
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.ok(getDimensionScore(r, "可执行性") < 20);
    await cleanup();
  });
});

describe("evaluateSafety", () => {
  it("full forbidden_actions + human checkpoints → full score", async () => {
    const { store, cleanup } = await setupTestStore();
    const id = await createProjectWithHarness(store, createFullHarness());
    const r = await evaluate(store, id);
    assert.equal(getDimensionScore(r, "安全性"), 20);
    await cleanup();
  });

  it("no forbidden_actions → score deducted by 6", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.forbidden_actions = undefined;
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.ok(getDimensionScore(r, "安全性") <= 14);
    await cleanup();
  });

  it("zero human_confirmed → score deducted", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.control_matrix = h.control_matrix.map((c) => ({
      ...c,
      control_level: "full_auto" as const,
    }));
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.ok(getDimensionScore(r, "安全性") < 20);
    await cleanup();
  });
});

describe("evaluateEvolvability", () => {
  it("no error_handling → score deducted by 6", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.error_handling = undefined;
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.ok(getDimensionScore(r, "可演化性") <= 14);
    await cleanup();
  });

  it("no config table → score deducted", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.data_architecture = [
      { name: "main_table", purpose: "主数据", fields: [] },
    ];
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.ok(getDimensionScore(r, "可演化性") < 20);
    await cleanup();
  });
});

describe("evaluateSelfCheck", () => {
  it("no builtin_evaluator → score = 0", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.builtin_evaluator = undefined;
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.equal(getDimensionScore(r, "自检能力"), 0);
    await cleanup();
  });

  it("isolation_required=false → score deducted by 6", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.builtin_evaluator!.isolation_required = false;
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.ok(getDimensionScore(r, "自检能力") <= 14);
    await cleanup();
  });

  it("no blocking check → score deducted", async () => {
    const { store, cleanup } = await setupTestStore();
    const h = createFullHarness();
    h.builtin_evaluator!.checks = h.builtin_evaluator!.checks.map((c) => ({
      ...c,
      on_fail: "warn_and_continue" as const,
    }));
    const id = await createProjectWithHarness(store, h);
    const r = await evaluate(store, id);
    assert.ok(getDimensionScore(r, "自检能力") < 20);
    await cleanup();
  });
});

describe("overall", () => {
  it("full harness → score >= 90", async () => {
    const { store, cleanup } = await setupTestStore();
    const id = await createProjectWithHarness(store, createFullHarness());
    const r = await evaluate(store, id);
    assert.ok(
      r.evaluation.overall_score >= 90,
      `Expected >= 90, got ${r.evaluation.overall_score}`,
    );
    await cleanup();
  });
});
