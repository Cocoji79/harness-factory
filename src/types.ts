// ── Project ──

export interface Project {
  id: string;
  business_name: string;
  created_at: string;
  updated_at: string;
  status: "gathering" | "analyzing" | "generated";
  human_review_status?: "pending" | "approved" | "rejected";
  human_review?: {
    reviewed_at: string;
    approved: boolean;
    reviewer: string;
    notes?: string;
    modifications?: string[];
  };
  vision?: VisionData;
  knowledge_bases: KnowledgeBaseData[];
  interviews: InterviewData[];
  analysis?: GapAnalysis;
  harness?: HarnessDocument;
  input_assessment?: InputAssessment;
  harness_validation?: HarnessValidation;
  health_reports: HealthReport[];
  north_star?: NorthStarDefinition;
}

// ── Knowledge Base ──

export interface KnowledgeBaseData {
  id: string;
  source_type: "feishu_wiki" | "feishu_doc" | "manual";
  source_url?: string;
  space_name?: string;
  raw_content: string;
  documented_processes: DocumentedProcess[];
  policies_and_rules: string[];
  sop_list: SOPItem[];
  forms_and_templates: string[];
  last_updated_hint?: string;
  staleness_notes: string[];
}

// ── Vision ──

export interface VisionData {
  source_type: "direct" | "document";
  raw_content: string;
  business_name: string;
  goals: string[];
  constraints: string[];
  stakeholders: Stakeholder[];
  ideal_process: ProcessStage[];
  ai_opportunities: string[];
}

export interface Stakeholder {
  role: string;
  responsibilities: string;
  automation_preference: "full_auto" | "semi_auto" | "human_in_loop";
}

export interface ProcessStage {
  name: string;
  description: string;
  input: string;
  output: string;
  should_automate: boolean;
  notes: string;
}

export interface DocumentedProcess {
  name: string;
  description: string;
  steps: string[];
  responsible_role: string;
  status: "active" | "outdated" | "draft";
}

export interface SOPItem {
  name: string;
  description: string;
  last_updated: string;
  compliance_required: boolean;
}

// ── Interview ──

export interface InterviewData {
  id: string;
  interviewee_role: string;
  source_type: "transcript" | "feishu_minutes" | "document";
  raw_content: string;
  actual_process: ActualProcessStep[];
  pain_points: string[];
  implicit_knowledge: string[];
  workarounds: string[];
  time_costs: TimeCost[];
}

export interface ActualProcessStep {
  name: string;
  description: string;
  time_spent: string;
  frequency: string;
  tools_used: string;
  problems: string[];
}

export interface TimeCost {
  activity: string;
  time_per_occurrence: string;
  frequency: string;
  notes: string;
}

// ── Gap Analysis ──

export interface GapAnalysis {
  vision_vs_reality: GapItem[];
  docs_vs_reality: DocsRealityGap[];
  pain_points_prioritized: PrioritizedItem[];
  ai_native_opportunities: AINativeOpportunity[];
  capability_matches: CapabilityMatch[];
  capability_gaps: CapabilityGap[];
  recommended_questions: TargetedQuestion[];
  redesigned_process: RedesignedStage[];
}

export interface DocsRealityGap {
  process_name: string;
  documented_version: string;
  actual_version: string;
  gap_type: "outdated" | "incomplete" | "ignored" | "missing_doc";
  severity: "high" | "medium" | "low";
  recommendation: string;
}

export interface GapItem {
  area: string;
  vision: string;
  reality: string;
  gap_type: "missing" | "inefficient" | "outdated" | "manual";
  severity: "high" | "medium" | "low";
  recommendation: string;
}

export interface PrioritizedItem {
  pain_point: string;
  impact: "high" | "medium" | "low";
  frequency: string;
  affected_stakeholders: string[];
  suggested_solution: string;
}

export interface AINativeOpportunity {
  current_approach: string;
  ai_native_approach: string;
  benefit: string;
  feasibility: "ready" | "needs_skill" | "needs_research";
  required_capabilities: string[];
}

export interface CapabilityMatch {
  process_stage: string;
  matched_skills: string[];
  coverage_percent: number;
  notes: string;
}

export interface CapabilityGap {
  process_stage: string;
  missing_capability: string;
  suggested_skill_name: string;
  complexity: "low" | "medium" | "high";
  dependencies: string[];
  description: string;
}

export interface TargetedQuestion {
  question: string;
  context: string;
  why_asking: string;
  for_stakeholder: string;
}

export interface RedesignedStage {
  name: string;
  description: string;
  control_level:
    | "full_auto"
    | "auto_with_review"
    | "human_confirmed"
    | "human_only";
  skills_used: string[];
  new_skills_needed: string[];
  data_in: string;
  data_out: string;
  failure_handling: string;
}

// ── Harness Document ──

export interface HarnessDocument {
  business_name: string;
  principles: string[];
  data_architecture: DataTable[];
  control_matrix: ControlMatrixEntry[];
  existing_skills: SkillRef[];
  new_skills: NewSkillSpec[];
  scheduled_tasks: ScheduledTask[];
  implementation_phases: Phase[];
  communication_checklist: ChecklistItem[];
  markdown_content: string;

  // ── Phase 1 新增：可执行系统的核心字段（全部 optional，向后兼容）──

  /** 状态机：定义系统有哪些状态、如何转移、底线触发规则 */
  state_machine?: StateMachine;

  /** 数据绑定：真实的 Bitable app_token 和 table_id 映射 */
  data_bindings?: DataBindings;

  /** 禁止事项：Anya 在任何情况下都不得做的事 */
  forbidden_actions?: string[];

  /** 错误处理与降级策略：L1-L5 五层自我修复 */
  error_handling?: ErrorHandling;

  /** 可填写模板：评估表、改进计划等结构化表单 */
  templates?: FormTemplate[];

  /** Skill 调用规则：control_matrix 中每个 action 绑定哪个 skill */
  skill_bindings?: SkillBinding[];

  /** 自动化规则：升级版 scheduled_tasks，支持 cron/event/state_entry 触发 + lookback */
  automation_rules?: AutomationRule[];

  /** 生成状态：追踪对话式收敛进度 */
  generation_state?: GenerationState;

  /** Pattern 来源：本次生成用了哪些从历史项目学到的 pattern */
  pattern_source?: string[];

  /** 系统内建 Evaluator：分形递归——产品层也用三角架构 */
  builtin_evaluator?: BuiltinEvaluator;
}

// ── 系统内建 Evaluator（产品层的质量检查机制）──

export interface BuiltinEvaluator {
  /** Evaluator 检查项列表，每项有硬性阈值 */
  checks: EvaluatorCheck[];
  /** Evaluator 是否必须在独立上下文中运行（防止 Generator 自我宽容） */
  isolation_required: boolean;
  /** 检查频率 */
  frequency: "per_action" | "per_stage" | "per_milestone";
  /** 不通过时的升级路径 */
  escalation: string;
}

export type EvalDimension =
  | "completeness"
  | "executability"
  | "safety"
  | "evolvability"
  | "self_check";

export interface EvaluatorCheck {
  /** 检查名称 */
  name: string;
  /** 属于哪个质量维度 */
  dimension: EvalDimension;
  /** 检查逻辑：Evaluator 要检查什么 */
  check_logic: string;
  /** 硬性及格线 */
  hard_threshold: string;
  /** 不通过时怎么办 */
  on_fail: "block" | "warn_and_continue" | "escalate_to_human";
}

// ── 状态机 ──

export interface StateMachine {
  states: StateDefinition[];
  transitions: Transition[];
  trigger_rules: TriggerRule[];
}

export interface StateDefinition {
  name: string;
  description: string;
  entry_actions: string[];
  exit_conditions: string[];
  is_terminal?: boolean;
}

export interface Transition {
  from: string;
  to: string;
  condition: string;
  triggered_by: "scheduled" | "human_decision" | "data_event";
}

export interface TriggerRule {
  name: string;
  condition: string;
  action: string;
  has_escalation_path?: boolean;
}

// ── 数据绑定 ──

export interface DataBindings {
  bitable_app_token?: string;
  table_bindings: Record<string, string>;
  document_templates?: Record<string, string>;
}

// ── 错误处理 ──

export interface ErrorHandling {
  layers: ErrorLayer[];
}

export interface ErrorLayer {
  level:
    | "L1_log"
    | "L2_health_check"
    | "L3_auto_repair"
    | "L4_retrospection"
    | "L5_monitoring";
  mechanism: string;
  trigger_condition: string;
  recovery_action: string;
}

// ── 可填写模板 ──

export interface FormTemplate {
  name: string;
  purpose: string;
  fields: TemplateField[];
  used_in_stages: string[];
}

export interface TemplateField {
  name: string;
  type: "text" | "number" | "select" | "multiselect" | "date" | "boolean";
  required: boolean;
  options?: string[];
  help_text?: string;
}

// ── Skill 调用绑定 ──

export interface SkillBinding {
  action: string;
  skill_name: string;
  input_mapping?: string;
  output_mapping?: string;
}

// ── 自动化规则 ──

export interface AutomationRule {
  name: string;
  trigger: AutomationTrigger;
  action_ref: string;
  lookback_days?: number;
  failure_policy: FailurePolicy;
}

export interface AutomationTrigger {
  type: "cron" | "event" | "state_entry";
  spec: string;
}

export interface FailurePolicy {
  max_retries: number;
  on_failure: "notify_hr" | "notify_manager" | "escalate" | "log_only";
  escalation_hours?: number;
}

// ── 生成状态（对话式收敛） ──

export interface GenerationState {
  status: "drafting" | "needs_info" | "ready_to_provision" | "complete";
  pending_questions: PendingQuestion[];
  answered_questions: AnsweredQuestion[];
  completeness_score: number;
  missing_fields: string[];
  last_checked_at: string;
}

export interface PendingQuestion {
  id: string;
  category:
    | "state_machine"
    | "data_binding"
    | "template"
    | "error_handling"
    | "forbidden_actions"
    | "skill_binding"
    | "automation"
    | "other";
  question: string;
  why_asking: string;
  blocking_field: string;
  requires_human: boolean;
  suggested_answer?: string;
  answer_source?: "ai_inferred" | "human_confirmed" | "pattern_library";
  confidence?: "high" | "medium" | "low";
}

export interface AnsweredQuestion {
  question_id: string;
  answer: string;
  answered_by: "ai" | "human";
  answered_at: string;
}

export interface DataTable {
  name: string;
  purpose: string;
  fields: TableField[];
}

export interface TableField {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface ControlMatrixEntry {
  stage: string;
  action: string;
  control_level:
    | "full_auto"
    | "auto_with_review"
    | "human_confirmed"
    | "human_only";
  description: string;
  is_judgment?: boolean;
}

export interface SkillRef {
  name: string;
  purpose: string;
  pipeline_stage: string;
}

export interface NewSkillSpec {
  name: string;
  purpose: string;
  complexity: "low" | "medium" | "high";
  capabilities: string[];
  dependencies: string[];
}

export interface ScheduledTask {
  name: string;
  frequency: string;
  description: string;
}

export interface Phase {
  number: number;
  name: string;
  self_driven_tasks: string[];
  needs_confirmation: string[];
  completion_criteria: string;
}

export interface ChecklistItem {
  item: string;
  priority: "before_start" | "during" | "after";
  status: "pending" | "confirmed";
}

// ── Quality Assessment ──

export interface InputAssessment {
  overall_score: number; // 0-100
  ready_to_analyze: boolean;
  vision_score: VisionScore;
  knowledge_base_score: KnowledgeBaseScore;
  interview_score: InterviewScore;
  cross_validation: CrossValidation;
  blocking_issues: string[];
  recommendations: string[];
}

export interface VisionScore {
  score: number;
  has_goals: boolean;
  has_stakeholders: boolean;
  has_ideal_process: boolean;
  has_ai_opportunities: boolean;
  has_constraints: boolean;
  issues: string[];
}

export interface KnowledgeBaseScore {
  score: number;
  count: number;
  has_documented_processes: boolean;
  has_policies: boolean;
  has_sops: boolean;
  staleness_risk: "low" | "medium" | "high";
  issues: string[];
}

export interface InterviewScore {
  score: number;
  count: number;
  roles_covered: string[];
  has_pain_points: boolean;
  has_implicit_knowledge: boolean;
  has_workarounds: boolean;
  has_time_costs: boolean;
  issues: string[];
}

export interface CrossValidation {
  vision_interview_alignment: "aligned" | "partial" | "conflicting" | "unknown";
  docs_reality_gap: "small" | "moderate" | "large" | "unknown";
  issues: string[];
}

export interface HarnessValidation {
  overall_score: number; // 0-100
  is_valid: boolean;
  control_coverage: ControlCoverageCheck;
  failure_handling: FailureHandlingCheck;
  human_checkpoints: HumanCheckpointCheck;
  config_externalization: ConfigCheck;
  implementation_feasibility: FeasibilityCheck;
  data_architecture: DataArchCheck;
  dependency_check: DependencyCheck;
  issues: ValidationIssue[];
}

export interface ControlCoverageCheck {
  total_stages: number;
  covered_stages: number;
  uncovered: string[];
  passed: boolean;
}

export interface FailureHandlingCheck {
  auto_stages: number;
  with_failure_handling: number;
  missing: string[];
  passed: boolean;
}

export interface HumanCheckpointCheck {
  has_human_checkpoint: boolean;
  human_confirmed_count: number;
  auto_only_risk: boolean;
  passed: boolean;
}

export interface ConfigCheck {
  hardcoded_values: string[];
  externalized_count: number;
  passed: boolean;
}

export interface FeasibilityCheck {
  phases_with_completion_criteria: number;
  phases_total: number;
  phases_with_confirmation: number;
  passed: boolean;
}

export interface DataArchCheck {
  has_main_table: boolean;
  has_log_table: boolean;
  has_status_enum: boolean;
  passed: boolean;
}

export interface DependencyCheck {
  new_skills: string[];
  missing_dependencies: string[];
  passed: boolean;
}

export interface ValidationIssue {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  suggestion: string;
}

export interface HealthReport {
  project_id: string;
  report_time: string;
  overall_health: "healthy" | "degraded" | "unhealthy";
  overall_score: number; // 0-100
  stage_metrics: StageMetric[];
  anomaly_summary: AnomalySummary;
  automation_effectiveness: AutomationEffectiveness;
  config_stability: ConfigStability;
  recommendations: HealthRecommendation[];
  needs_revision: boolean;
  revision_reasons: string[];
  north_star_tracking?: NorthStarTracking;
}

export interface NorthStarTracking {
  primary_metric_value: number;
  primary_metric_previous?: number;
  primary_metric_trend: "improving" | "stable" | "declining";
  guardrail_values: GuardrailValue[];
  consecutive_decline_count: number;
}

export interface GuardrailValue {
  name: string;
  current_value: string;
  threshold_breached: boolean;
}

export interface StageMetric {
  stage: string;
  objects_entered: number;
  objects_completed: number;
  objects_stuck: number;
  conversion_rate: number;
  avg_duration_hours: number;
  max_duration_hours: number;
  is_bottleneck: boolean;
}

export interface AnomalySummary {
  total_anomalies: number;
  by_stage: Record<string, number>;
  top_reasons: string[];
  anomaly_rate: number;
}

export interface AutomationEffectiveness {
  full_auto_stages: number;
  full_auto_with_manual_override: number;
  override_rate: number;
  stages_needing_reclassification: string[];
}

export interface ConfigStability {
  changes_last_7_days: number;
  changes_last_30_days: number;
  frequently_changed_configs: string[];
  is_stable: boolean;
}

export interface HealthRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  area: string;
  finding: string;
  suggestion: string;
}

// ── North Star Metrics ──

export interface NorthStarDefinition {
  primary_metric: PrimaryMetric;
  guardrails: GuardrailMetric[];
  observation_metrics: ObservationMetric[];
  stories: NarrativeStory[];
  proxy_rationale?: string;
  rejected_candidates: RejectedCandidate[];
}

export interface PrimaryMetric {
  name: string;
  definition: string;
  measurement_method: string;
  frequency: "daily" | "weekly" | "monthly";
  direction: "up" | "down";
  is_proxy: boolean;
  four_axiom_check: FourAxiomCheck;
}

export interface FourAxiomCheck {
  reflects_ultimate_value: boolean;
  attributable_to_product: boolean;
  continuously_trackable: boolean;
  drives_correct_behavior: boolean;
  meaningful_to_all_levels: boolean;
  notes: string;
}

export interface GuardrailMetric {
  name: string;
  definition: string;
  threshold: string;
  prevents: string;
}

export interface ObservationMetric {
  name: string;
  definition: string;
  insight: string;
}

export interface NarrativeStory {
  narrative: string;
  use_case: string;
}

export interface RejectedCandidate {
  name: string;
  rejected_reason: string;
  better_as: "story" | "auxiliary" | "none";
}

// ── Harness Pattern（共创平台：从升级中学到的模式）──

export interface HarnessPattern {
  id: string;
  name: string;
  description: string;
  source_project: string;
  category:
    | "state_machine"
    | "safety"
    | "error_handling"
    | "template"
    | "data_model"
    | "automation"
    | "process_design"
    | "other";
  pattern_type: "addition" | "refinement" | "restructure";
  before_summary: string;
  after_summary: string;
  extracted_rule: string;
  applicability: string;
  learned_at: string;
}

// ── Capability Registry ──

export interface Capability {
  name: string;
  category: string;
  description: string;
  input: string;
  output: string;
  feishu_apis: string[];
  reusable_patterns: string[];
}
