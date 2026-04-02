import { randomUUID } from "node:crypto";
import type { Store } from "../store/store.js";
import type { InterviewData, ActualProcessStep, TimeCost } from "../types.js";

export const INGEST_INTERVIEW_SCHEMA = {
  name: "ingest_interview",
  description: `接收一线业务人员的访谈记录。这个输入代表"这件事实际怎么做"的视角。

输入来源可以是：
- 飞书妙记的会议转写内容
- 人工访谈的文字记录（飞书文档）
- 多人访谈的汇总

这个 Tool 不只是提取流程步骤，你应该从访谈中提取：
1. 实际操作流程（他们现在怎么做的）
2. 痛点和抱怨（哪里效率低、哪里容易出错）
3. 隐性知识（"我们一般会..."、"如果遇到这种情况就..."）
4. 变通做法（正式流程和实际执行的偏差）
5. 时间成本（每个环节花多少时间）

一个项目可以输入多份访谈记录。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID（必须先通过 ingest_vision 创建项目）",
      },
      interviewee_role: {
        type: "string",
        description: "被访谈人的角色/职位，如「HR专员」「销售经理」「财务主管」",
      },
      source_type: {
        type: "string",
        enum: ["transcript", "feishu_minutes", "document"],
        description: "来源类型：transcript=访谈文字记录，feishu_minutes=飞书妙记，document=飞书文档",
      },
      content: {
        type: "string",
        description: "访谈的原始内容（转写文本、文档内容等）",
      },
      actual_process: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            time_spent: { type: "string" },
            frequency: { type: "string" },
            tools_used: { type: "string" },
            problems: { type: "array", items: { type: "string" } },
          },
          required: ["name", "description"],
        },
        description: "从访谈中提取的实际操作流程步骤",
      },
      pain_points: {
        type: "array",
        items: { type: "string" },
        description: "痛点和抱怨",
      },
      implicit_knowledge: {
        type: "array",
        items: { type: "string" },
        description: "隐性知识（不成文的规则、经验判断等）",
      },
      workarounds: {
        type: "array",
        items: { type: "string" },
        description: "变通做法（绕过正式流程的实际做法）",
      },
      time_costs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            activity: { type: "string" },
            time_per_occurrence: { type: "string" },
            frequency: { type: "string" },
            notes: { type: "string" },
          },
          required: ["activity", "time_per_occurrence"],
        },
        description: "时间成本记录",
      },
    },
    required: ["project_id", "interviewee_role", "source_type", "content"],
  },
} as const;

export async function handleIngestInterview(
  store: Store,
  args: {
    project_id: string;
    interviewee_role: string;
    source_type: "transcript" | "feishu_minutes" | "document";
    content: string;
    actual_process?: ActualProcessStep[];
    pain_points?: string[];
    implicit_knowledge?: string[];
    workarounds?: string[];
    time_costs?: TimeCost[];
  }
): Promise<string> {
  const project = await store.getProject(args.project_id);

  const interview: InterviewData = {
    id: randomUUID().slice(0, 8),
    interviewee_role: args.interviewee_role,
    source_type: args.source_type,
    raw_content: args.content,
    actual_process: args.actual_process ?? [],
    pain_points: args.pain_points ?? [],
    implicit_knowledge: args.implicit_knowledge ?? [],
    workarounds: args.workarounds ?? [],
    time_costs: args.time_costs ?? [],
  };

  project.interviews.push(interview);
  await store.saveProject(project);

  const extractionGuidance: string[] = [];
  if (interview.actual_process.length === 0)
    extractionGuidance.push(
      "请从访谈内容中提取实际操作流程（actual_process），包括每个步骤的名称、描述、耗时、频率、使用的工具、遇到的问题"
    );
  if (interview.pain_points.length === 0)
    extractionGuidance.push("请从访谈内容中提取痛点（pain_points）——被访谈人提到的困难、低效、出错的环节");
  if (interview.implicit_knowledge.length === 0)
    extractionGuidance.push(
      '请提取隐性知识（implicit_knowledge）——那些"我们一般会..."、"遇到这种情况就..."的经验规则'
    );
  if (interview.workarounds.length === 0)
    extractionGuidance.push("请提取变通做法（workarounds）——正式流程和实际执行不一致的地方");
  if (interview.time_costs.length === 0)
    extractionGuidance.push("请提取时间成本（time_costs）——每个环节花多少时间、多久做一次");

  return JSON.stringify(
    {
      project_id: project.id,
      interview_id: interview.id,
      status: "interview_ingested",
      interview_summary: {
        interviewee_role: interview.interviewee_role,
        source_type: interview.source_type,
        content_length: interview.raw_content.length,
        process_steps_count: interview.actual_process.length,
        pain_points_count: interview.pain_points.length,
        implicit_knowledge_count: interview.implicit_knowledge.length,
        workarounds_count: interview.workarounds.length,
        time_costs_count: interview.time_costs.length,
      },
      total_interviews: project.interviews.length,
      extraction_guidance:
        extractionGuidance.length > 0
          ? extractionGuidance
          : ["访谈数据提取完整"],
      next_steps: [
        extractionGuidance.length > 0
          ? "请根据以上提示，从原始内容中提取结构化数据，再次调用 ingest_interview 更新"
          : null,
        "如果还有更多人需要访谈，继续调用 ingest_interview",
        "访谈数据收集完毕后，调用 analyze_gaps 进行三角差距分析",
      ].filter(Boolean),
    },
    null,
    2
  );
}
