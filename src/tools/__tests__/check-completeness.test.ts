import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkCompleteness,
  buildGenerationState,
} from "../check-completeness.js";
import type { HarnessDocument } from "../../types.js";

function createEmptyHarness(): Partial<HarnessDocument> {
  return {
    business_name: "空项目",
    principles: [],
    data_architecture: [],
    control_matrix: [],
    existing_skills: [],
    new_skills: [],
    scheduled_tasks: [],
    implementation_phases: [],
    communication_checklist: [],
    markdown_content: "",
  };
}

function createFullHarness(): Partial<HarnessDocument> {
  return {
    business_name: "完整项目",
    principles: ["原则1", "原则2", "原则3"],
    data_architecture: [{ name: "main", purpose: "主表", fields: [] }],
    control_matrix: [
      {
        stage: "s1",
        action: "a1",
        control_level: "human_confirmed",
        description: "d",
      },
    ],
    existing_skills: [],
    new_skills: [],
    scheduled_tasks: [{ name: "t1", frequency: "daily", description: "d" }],
    implementation_phases: [
      {
        number: 1,
        name: "p1",
        self_driven_tasks: [],
        needs_confirmation: [],
        completion_criteria: "done",
      },
    ],
    communication_checklist: [],
    markdown_content: "# Test",
    state_machine: {
      states: [
        {
          name: "s1",
          description: "d1",
          entry_actions: ["a"],
          exit_conditions: ["e"],
        },
        {
          name: "s2",
          description: "d2",
          entry_actions: ["a"],
          exit_conditions: ["终态"],
        },
      ],
      transitions: [
        { from: "s1", to: "s2", condition: "c", triggered_by: "scheduled" },
      ],
      trigger_rules: [{ name: "r1", condition: "c", action: "a" }],
    },
    data_bindings: {
      bitable_app_token: "test",
      table_bindings: { main: "tbl_test" },
    },
    forbidden_actions: ["禁1", "禁2", "禁3"],
    error_handling: {
      layers: [
        {
          level: "L1_log",
          mechanism: "m",
          trigger_condition: "t",
          recovery_action: "r",
        },
        {
          level: "L2_health_check",
          mechanism: "m",
          trigger_condition: "t",
          recovery_action: "r",
        },
        {
          level: "L3_auto_repair",
          mechanism: "m",
          trigger_condition: "t",
          recovery_action: "r",
        },
      ],
    },
    templates: [
      {
        name: "t1",
        purpose: "p",
        fields: [{ name: "f", type: "text", required: true }],
        used_in_stages: ["s1"],
      },
    ],
    skill_bindings: [{ action: "a1", skill_name: "s1" }],
    automation_rules: [
      {
        name: "r1",
        trigger: { type: "cron", spec: "0 9 * * *" },
        action_ref: "a",
        failure_policy: { max_retries: 1, on_failure: "log_only" },
      },
    ],
    builtin_evaluator: {
      checks: [
        {
          name: "c1",
          dimension: "safety",
          check_logic: "l",
          hard_threshold: "t",
          on_fail: "block",
        },
        {
          name: "c2",
          dimension: "completeness",
          check_logic: "l",
          hard_threshold: "t",
          on_fail: "warn_and_continue",
        },
      ],
      isolation_required: true,
      frequency: "per_milestone",
      escalation: "通知 HR",
    },
  };
}

describe("checkCompleteness", () => {
  it("empty harness → score near 0", () => {
    const r = checkCompleteness(createEmptyHarness());
    assert.ok(r.score <= 5, `Expected <= 5, got ${r.score}`);
    assert.ok(r.missing_fields.length >= 8);
  });

  it("full harness → score = 100", () => {
    const r = checkCompleteness(createFullHarness());
    assert.equal(r.score, 100);
    assert.equal(r.missing_fields.length, 0);
    assert.equal(r.pending_questions.length, 0);
  });

  it("missing only data_bindings → score near 85", () => {
    const h = createFullHarness();
    delete h.data_bindings;
    const r = checkCompleteness(h);
    // data_bindings weight = 15, so score = round((100-15)/100 * 100) = 85 or 86 depending on rounding
    assert.ok(r.score >= 84 && r.score <= 86, `Expected ~85, got ${r.score}`);
    assert.deepEqual(r.missing_fields, ["data_bindings"]);
  });

  it("missing only state_machine → score near 82", () => {
    const h = createFullHarness();
    delete h.state_machine;
    const r = checkCompleteness(h);
    // state_machine weight = 18, so score = round((100-18)/100 * 100) = 82 or 83
    assert.ok(r.score >= 81 && r.score <= 83, `Expected ~82, got ${r.score}`);
    assert.deepEqual(r.missing_fields, ["state_machine"]);
  });

  it("weights sum to 100", () => {
    // Test indirectly: full harness = 100, empty harness gets only
    // the fields that are present (principles has 0 items → fails)
    const full = checkCompleteness(createFullHarness());
    assert.equal(full.score, 100);
  });

  it("pending_questions have correct requires_human flags", () => {
    const r = checkCompleteness(createEmptyHarness());
    const humanQs = r.pending_questions.filter((q) => q.requires_human);
    const aiQs = r.pending_questions.filter((q) => !q.requires_human);
    // state_machine, data_bindings, forbidden_actions, control_matrix, builtin_evaluator = human
    assert.ok(humanQs.length >= 4);
    // error_handling, templates, skill_bindings, automation_rules, etc = AI
    assert.ok(aiQs.length >= 3);
  });
});

describe("buildGenerationState", () => {
  it("score 100 → complete", () => {
    const s = buildGenerationState(createFullHarness());
    assert.equal(s.status, "complete");
    assert.equal(s.completeness_score, 100);
  });

  it("only data_bindings missing → ready_to_provision", () => {
    const h = createFullHarness();
    delete h.data_bindings;
    const s = buildGenerationState(h);
    assert.equal(s.status, "ready_to_provision");
  });

  it("score 65 → needs_info", () => {
    const h = createFullHarness();
    delete h.state_machine;
    delete h.forbidden_actions;
    // 100 - 18 - 12 = 70... let's remove more
    delete h.builtin_evaluator;
    // 100 - 18 - 12 - 8 = 62
    const s = buildGenerationState(h);
    assert.equal(s.status, "needs_info");
    assert.ok(s.completeness_score >= 60 && s.completeness_score < 90);
  });

  it("score < 60 → drafting", () => {
    const s = buildGenerationState(createEmptyHarness());
    assert.equal(s.status, "drafting");
    assert.ok(s.completeness_score < 60);
  });
});
