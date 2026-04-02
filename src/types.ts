// ── Project ──

export interface Project {
  id: string;
  business_name: string;
  created_at: string;
  updated_at: string;
  status: "gathering" | "analyzing" | "generating" | "published";
  vision?: VisionData;
  knowledge_bases: KnowledgeBaseData[];
  interviews: InterviewData[];
  analysis?: GapAnalysis;
  harness?: HarnessDocument;
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

// ── Capability Registry ──

export interface Capability {
  name: string;
  category: string;
  description: string;
  input: string;
  output: string;
  platform_apis: string[];
  reusable_patterns: string[];
}
