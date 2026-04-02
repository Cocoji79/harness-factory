import { randomUUID } from "node:crypto";
import type { Store } from "../store/store.js";
import type { KnowledgeBaseData, DocumentedProcess, SOPItem } from "../types.js";

export const INGEST_KNOWLEDGE_BASE_SCHEMA = {
  name: "ingest_knowledge_base",
  description: `接收部门知识库内容。这是第三个视角——"官方文档里怎么写的"。

三层输入的关系：
- 战略视角（ingest_vision）：这件事应该怎么做
- 知识库（ingest_knowledge_base）：文档里写的怎么做
- 一线访谈（ingest_interview）：实际怎么做

三者之间的偏差本身就是最有价值的分析素材：
- 知识库有但没人看 → 文档过时或不实用
- 一线有变通做法但知识库没写 → 隐性知识未沉淀
- 知识库写的和实际不一样 → 流程已经演化但文档没跟上
- 知识库有完整 SOP 但一线说痛苦 → SOP 本身可能就需要重构

输入来源可以是：
- 飞书知识库（Wiki）的内容
- 飞书文档
- 手动整理的流程文档、制度文件、SOP

一个项目可以输入多份知识库内容（不同子主题、不同文档）。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID（必须先通过 ingest_vision 创建项目）",
      },
      source_type: {
        type: "string",
        enum: ["feishu_wiki", "feishu_doc", "manual"],
        description: "来源类型：feishu_wiki=飞书知识库，feishu_doc=飞书文档，manual=手动整理的文档",
      },
      source_url: {
        type: "string",
        description: "来源 URL（飞书知识库或文档链接，可选）",
      },
      space_name: {
        type: "string",
        description: "知识空间名称（可选，如「HR 制度库」「销售流程库」）",
      },
      content: {
        type: "string",
        description: "知识库的原始内容（文档文本）",
      },
      documented_processes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            steps: { type: "array", items: { type: "string" } },
            responsible_role: { type: "string" },
            status: {
              type: "string",
              enum: ["active", "outdated", "draft"],
            },
          },
          required: ["name", "description"],
        },
        description: "从知识库中提取的已文档化流程",
      },
      policies_and_rules: {
        type: "array",
        items: { type: "string" },
        description: "制度和规则（审批权限、合规要求、操作红线等）",
      },
      sop_list: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            last_updated: { type: "string" },
            compliance_required: { type: "boolean" },
          },
          required: ["name", "description"],
        },
        description: "SOP（标准操作流程）清单",
      },
      forms_and_templates: {
        type: "array",
        items: { type: "string" },
        description: "表单和模板（审批表、检查清单、报告模板等）",
      },
      last_updated_hint: {
        type: "string",
        description: "知识库最后更新时间的线索（如「上次更新是2024年」「不确定」）",
      },
      staleness_notes: {
        type: "array",
        items: { type: "string" },
        description: "过时迹象（如「提到了已下线的系统」「引用了旧版审批流程」）",
      },
    },
    required: ["project_id", "source_type", "content"],
  },
} as const;

export async function handleIngestKnowledgeBase(
  store: Store,
  args: {
    project_id: string;
    source_type: "feishu_wiki" | "feishu_doc" | "manual";
    source_url?: string;
    space_name?: string;
    content: string;
    documented_processes?: DocumentedProcess[];
    policies_and_rules?: string[];
    sop_list?: SOPItem[];
    forms_and_templates?: string[];
    last_updated_hint?: string;
    staleness_notes?: string[];
  }
): Promise<string> {
  const project = await store.getProject(args.project_id);

  const kb: KnowledgeBaseData = {
    id: randomUUID().slice(0, 12),
    source_type: args.source_type,
    source_url: args.source_url,
    space_name: args.space_name,
    raw_content: args.content,
    documented_processes: args.documented_processes ?? [],
    policies_and_rules: args.policies_and_rules ?? [],
    sop_list: args.sop_list ?? [],
    forms_and_templates: args.forms_and_templates ?? [],
    last_updated_hint: args.last_updated_hint,
    staleness_notes: args.staleness_notes ?? [],
  };

  const updated = {
    ...project,
    knowledge_bases: [...project.knowledge_bases, kb],
  };
  await store.saveProject(updated);

  const extractionGuidance: string[] = [];
  if (kb.documented_processes.length === 0)
    extractionGuidance.push(
      "请从知识库内容中提取已文档化的流程（documented_processes），包括名称、步骤、负责角色、是否仍在执行"
    );
  if (kb.policies_and_rules.length === 0)
    extractionGuidance.push(
      "请提取制度和规则（policies_and_rules）——审批权限、合规要求、操作红线等硬性约束"
    );
  if (kb.sop_list.length === 0)
    extractionGuidance.push("请提取 SOP 清单（sop_list）——标准操作流程，注意标注最后更新时间");
  if (kb.staleness_notes.length === 0)
    extractionGuidance.push(
      "请检查过时迹象（staleness_notes）——是否提到已下线的系统、旧版流程、离职人员等"
    );

  return JSON.stringify(
    {
      project_id: project.id,
      knowledge_base_id: kb.id,
      status: "knowledge_base_ingested",
      summary: {
        source_type: kb.source_type,
        space_name: kb.space_name ?? "(未指定)",
        content_length: kb.raw_content.length,
        documented_processes_count: kb.documented_processes.length,
        policies_count: kb.policies_and_rules.length,
        sop_count: kb.sop_list.length,
        forms_count: kb.forms_and_templates.length,
        staleness_notes_count: kb.staleness_notes.length,
        last_updated_hint: kb.last_updated_hint ?? "未知",
      },
      total_knowledge_bases: updated.knowledge_bases.length,
      extraction_guidance:
        extractionGuidance.length > 0 ? extractionGuidance : ["知识库数据提取完整"],
      cross_reference_hints: [
        "将知识库中的流程与一线访谈对比，关注：文档写的步骤 vs 实际执行的步骤",
        "关注知识库中的制度约束——这些在自动化时必须保留（合规红线）",
        "标记知识库中过时的内容——这些在重构时应该丢弃而非数字化",
      ],
      next_steps: [
        extractionGuidance.length > 0
          ? "请根据以上提示，从原始内容中提取结构化数据，再次调用 ingest_knowledge_base 更新"
          : null,
        "如果还有更多知识库文档需要录入，继续调用 ingest_knowledge_base",
        "数据收集完毕后，调用 analyze_gaps 进行三角差距分析",
      ].filter(Boolean),
    },
    null,
    2
  );
}
