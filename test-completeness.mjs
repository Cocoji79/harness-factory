#!/usr/bin/env node
// Phase 1 验证脚本：用 v1.0 真实数据跑完整度检查

import { readFileSync } from "node:fs";
import { checkCompleteness } from "./dist/tools/check-completeness.js";

const v1 = JSON.parse(readFileSync("./test-harness-input.json", "utf-8"));

console.log("=".repeat(60));
console.log("Phase 1 验证：v1.0 (造场蓄势·试用期转正) 完整度检查");
console.log("=".repeat(60));

const result = checkCompleteness(v1);

console.log(`\n📊 完整度分数：${result.score}/100`);
console.log(`\n🔴 缺失字段 (${result.missing_fields.length} 个)：`);
for (const f of result.missing_fields) {
  console.log(`  - ${f}`);
}

console.log(`\n❓ 待回答问题 (${result.pending_questions.length} 个)：\n`);
for (const q of result.pending_questions) {
  const humanFlag = q.requires_human ? "👤 必须问真人" : "🤖 AI可自动填";
  console.log(`【${q.category}】${humanFlag}  confidence=${q.confidence}`);
  console.log(`  Q: ${q.question}`);
  console.log(`  Why: ${q.why_asking}`);
  if (q.suggested_answer) {
    console.log(`  建议答案: ${q.suggested_answer.slice(0, 80)}...`);
  }
  console.log();
}

console.log("=".repeat(60));
console.log("模拟 v2.0（Anya 升级版）完整度检查");
console.log("=".repeat(60));

// 模拟 v2.0 补齐的字段
const v2 = {
  ...v1,
  state_machine: {
    states: [
      { name: "plan_pending", description: "入职待定方案", entry_actions: [], exit_conditions: [] },
      { name: "month_1", description: "1月评估", entry_actions: [], exit_conditions: [] },
      { name: "month_3", description: "3月评估", entry_actions: [], exit_conditions: [] },
      { name: "month_6", description: "6月转正", entry_actions: [], exit_conditions: [] },
      { name: "passed", description: "已转正", entry_actions: [], exit_conditions: [] },
      { name: "terminated", description: "已劝退", entry_actions: [], exit_conditions: [] },
    ],
    transitions: [],
    trigger_rules: [],
  },
  data_bindings: {
    bitable_app_token: "Cwmcb0z3FarRxTs4OzZccBFqnrb",
    table_bindings: {
      probation_main: "tbllJY6KbyPYYgsF",
      evaluation_log: "tbliO3NXcT910NoA",
      config: "tblnNmoaFAj34bOi",
      operation_log: "tbl2j8tdUz5hQfmL",
    },
  },
  forbidden_actions: [
    "Anya 不得替主管做出评价判断",
    "Anya 不得将一致性检查结果发给主管或员工",
    "Anya 不得在没有HR确认的情况下通知员工Go/No-Go结果",
    "Anya 不得跳过任何评估节点",
    "Anya 不得修改主管已填写的评估内容",
  ],
  error_handling: {
    layers: [
      { level: "L1_log", mechanism: "操作日志全记录", trigger_condition: "always", recovery_action: "持久化到 operation_log" },
      { level: "L2_health_check", mechanism: "定期健康检查", trigger_condition: "daily", recovery_action: "扫描异常状态" },
      { level: "L3_auto_repair", mechanism: "自动修复+人工兜底", trigger_condition: "on_error", recovery_action: "重试+通知HR" },
      { level: "L4_retrospection", mechanism: "节点遗漏回溯", trigger_condition: "daily", recovery_action: "回溯过去7天" },
      { level: "L5_monitoring", mechanism: "响应率监控", trigger_condition: "weekly", recovery_action: "主管响应率低于阈值自动升级" },
    ],
  },
  templates: [
    { name: "m1_evaluation_form", purpose: "M1评估表", fields: [], used_in_stages: ["month_1"] },
    { name: "improvement_plan", purpose: "改进计划模板", fields: [], used_in_stages: ["month_1_nogo"] },
    { name: "m3_evaluation_form", purpose: "M3评估表", fields: [], used_in_stages: ["month_3"] },
    { name: "m6_evaluation_form", purpose: "M6转正评估表", fields: [], used_in_stages: ["month_6"] },
  ],
  skill_bindings: [
    { action: "创建试用期记录", skill_name: "lark-base" },
    { action: "发送评估通知", skill_name: "lark-im" },
    { action: "生成评估报告", skill_name: "lark-doc" },
  ],
  automation_rules: [
    {
      name: "每日评估触发器",
      trigger: { type: "cron", spec: "0 9 * * *" },
      action_ref: "check_probation_nodes",
      lookback_days: 7,
      failure_policy: { max_retries: 3, on_failure: "notify_hr", escalation_hours: 24 },
    },
  ],
};

const result2 = checkCompleteness(v2);
console.log(`\n📊 完整度分数：${result2.score}/100`);
console.log(`🔴 缺失字段：${result2.missing_fields.length > 0 ? result2.missing_fields.join(", ") : "无"}`);

console.log("\n" + "=".repeat(60));
console.log(`📈 v1.0 → v2.0 完整度提升：${result.score} → ${result2.score}（+${result2.score - result.score}）`);
console.log("=".repeat(60));
