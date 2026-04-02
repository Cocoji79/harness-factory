import type { Store } from "../store/store.js";
import type { VisionData, ProcessStage, Stakeholder } from "../types.js";

export const INGEST_VISION_SCHEMA = {
  name: "ingest_vision",
  description: `接收业务战略视角输入。来源可以是业务负责人的直接描述，或一份已有的规划文档。
这个输入代表"这件事应该怎么做"的视角——来自认知水平较高的人，而非简单数字化现有流程。

输入可以是：
- 业务负责人与 Agent 的对话内容
- 战略规划文档、OKR、业务方向说明
- 对未来流程的构想

调用后会创建一个新项目（或更新已有项目），并返回结构化的战略视角数据。

重要：business_name 决定了你在后续分析中的领域专家角色。
例如 business_name="招聘" → 你是 HR 领域专家；business_name="合同审批" → 你是法务/合规专家。
请在理解战略视角时就切换到对应的专业视角，用第一性原理思考这个业务本质上要解决什么问题。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "已有项目 ID（如果是更新已有项目）。留空则创建新项目。",
      },
      business_name: {
        type: "string",
        description: "业务名称，如「招聘」「客户跟进」「合同审批」",
      },
      source_type: {
        type: "string",
        enum: ["direct", "document"],
        description: "输入来源类型：direct=直接对话描述，document=文档内容",
      },
      content: {
        type: "string",
        description: "战略视角的原始内容（对话记录、文档内容等）",
      },
      goals: {
        type: "array",
        items: { type: "string" },
        description: "业务目标列表（可选，如果在 content 中已包含可不填）",
      },
      constraints: {
        type: "array",
        items: { type: "string" },
        description: "约束条件列表（可选）",
      },
      stakeholders: {
        type: "array",
        items: {
          type: "object",
          properties: {
            role: { type: "string" },
            responsibilities: { type: "string" },
            automation_preference: {
              type: "string",
              enum: ["full_auto", "semi_auto", "human_in_loop"],
            },
          },
          required: ["role", "responsibilities"],
        },
        description: "相关干系人列表（可选）",
      },
      ideal_process: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            input: { type: "string" },
            output: { type: "string" },
            should_automate: { type: "boolean" },
            notes: { type: "string" },
          },
          required: ["name", "description"],
        },
        description: "理想流程阶段列表（可选）",
      },
      ai_opportunities: {
        type: "array",
        items: { type: "string" },
        description: "AI 时代可以重新设计的机会点（可选）",
      },
    },
    required: ["business_name", "source_type", "content"],
  },
} as const;

export async function handleIngestVision(
  store: Store,
  args: {
    project_id?: string;
    business_name: string;
    source_type: "direct" | "document";
    content: string;
    goals?: string[];
    constraints?: string[];
    stakeholders?: Stakeholder[];
    ideal_process?: ProcessStage[];
    ai_opportunities?: string[];
  },
): Promise<string> {
  let project;

  if (args.project_id) {
    project = await store.getProject(args.project_id);
  } else {
    project = await store.createProject(args.business_name);
  }

  const vision: VisionData = {
    source_type: args.source_type,
    raw_content: args.content,
    business_name: args.business_name,
    goals: args.goals ?? [],
    constraints: args.constraints ?? [],
    stakeholders: args.stakeholders ?? [],
    ideal_process: args.ideal_process ?? [],
    ai_opportunities: args.ai_opportunities ?? [],
  };

  const updated = { ...project, vision, status: "gathering" as const };
  await store.saveProject(updated);

  const missingInfo: string[] = [];
  if (vision.goals.length === 0) missingInfo.push("业务目标尚未明确，请补充");
  if (vision.stakeholders.length === 0)
    missingInfo.push("干系人尚未识别，请补充涉及哪些角色");
  if (vision.ideal_process.length === 0)
    missingInfo.push("理想流程阶段尚未定义，请描述期望的流程是什么样的");
  if (vision.ai_opportunities.length === 0)
    missingInfo.push("AI 机会点尚未识别，请思考哪些环节在 AI 时代可以重新设计");

  return JSON.stringify(
    {
      project_id: project.id,
      business_name: project.business_name,
      status: "vision_ingested",
      vision_summary: {
        source_type: vision.source_type,
        goals_count: vision.goals.length,
        stakeholders_count: vision.stakeholders.length,
        process_stages_count: vision.ideal_process.length,
        ai_opportunities_count: vision.ai_opportunities.length,
      },
      missing_info: missingInfo,
      next_steps: [
        missingInfo.length > 0
          ? "请补充以上缺失信息（可通过再次调用 ingest_vision 更新）"
          : null,
        "建议先调用 ingest_knowledge_base 输入部门知识库/制度文档/SOP（强烈推荐，用于发现文档与实际的偏差）",
        "然后调用 ingest_interview 输入一线人员的访谈记录（飞书妙记转写、人工访谈文字记录、或飞书文档）",
      ].filter(Boolean),
    },
    null,
    2,
  );
}
