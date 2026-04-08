import type { Store } from "../store/store.js";
import type { NorthStarDefinition } from "../types.js";

export const DEFINE_NORTH_STAR_SCHEMA = {
  name: "define_north_star",
  description: `为业务流程定义北极星指标。

核心原则：你衡量什么，你就变成什么。
一个错误的北极星指标不会让项目失败，它会让项目沿着错误的方向成功。

─── 第零步：确认终极价值 ───

在列候选指标之前，必须先向业务方确认：
1. 这个流程做成了，最终要实现什么？
2. "好"的定义是什么？
3. 这个流程的本质是培养（让人/事变得更好）还是筛选（留好的淘汰差的）？
   还是培养优先、淘汰兜底？
4. 如果是培养——培养的目标态是什么？用什么信号判断"培养成功了"？
5. 如果有淘汰——淘汰的判据是什么？在哪些节点做淘汰决定？

不同的价值定义会导向完全不同的指标。
不要跳过这一步直接列候选——这是最容易犯的错误。

─── 好指标的四条公理 ───

1. 反映终极价值，而非中间过程。
   "接入了多少数据源"是过程，不是价值。
   团队天然倾向于衡量自己能控制的东西（过程），
   而非自己只能影响的东西（结果）。

2. 变化必须能合理归因到产品本身。
   如果指标受太多外部因素影响，波动无法指导行动。

3. 必须能持续追踪。
   一次性调研数字没有意义，有意义的是趋势。

4. 必须能驱动正确行为。
   一个好指标在被团队极端优化的时候，
   仍然能把产品推向正确方向。

附加：指标应同时对管理层和一线员工有意义。

─── 指标选择流程 ───

第一步：列出候选指标
  从 analyze_gaps 的 redesigned_process 中，
  在四个层级上找候选：
  - 使用层：有没有人用（最容易测，但价值最低）
  - 效率层：用了有没有提速（开始触及价值）
  - 质量层：提速有没有转化为更好的结果（更接近本质）
  - 价值层：最终业务影响（最有意义，但最难测和归因）

第二步：四公理淘汰赛
  每个候选指标逐条过四公理。
  不合格的，判断它适合做什么：
  - 好故事但不好追踪 → 放入 stories
  - 有用但不反映终极价值 → 放入 observation_metrics
  - 完全不合格 → 放入 rejected_candidates 并记录原因

第三步：代理指标
  如果最好的指标无法低成本持续测量，
  找代理指标——一个可以低成本持续测量、
  与真正关心的东西有可靠相关性的替身。
  代理指标不追求精确，追求方向正确和成本可控。
  必须在 proxy_rationale 中说明代理关系。

第四步：选定 1+2 结构
  - 1个主指标：同时覆盖使用量和质量，
    上升意味着更多人用且用了有效，
    下降意味着没人用或效果差。
  - 1-2个护栏指标：防止主指标被游戏化。
    问自己：如果团队为了刷主指标作弊，
    哪个护栏会亮红灯？
  - 观察指标：不驱动决策，帮助理解深层模式。

第五步：故事素材
  把淘汰赛中发现的好故事单独保留。
  故事的作用不是日常追踪，
  而是在关键时刻提供叙事弹药：
  - 说服管理层继续投入
  - 让新部门产生试用意愿
  - 在全员会上让所有人理解价值

─── 注意事项 ───

- 不要追求完美指标。
  在信息匮乏时，一个方向正确的粗略信号，
  远比一个精确但姗姗来迟的完美分析更有价值。

- 反馈飞轮优先。
  如果某个指标的收集过程本身就能改进产品
  （如用户反馈按钮既收集数据又指导优化），
  优先选择它。

- 主指标必须填写 four_axiom_check，
  逐条说明为什么通过，写在 notes 中。

调用前请确保已完成 analyze_gaps。
你需要传入北极星定义（north_star 字段），因为指标选择需要 AI 的推理和判断——
请基于项目的分析结果，按上述流程完成指标定义后回传。`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "项目 ID",
      },
      north_star: {
        type: "object",
        description:
          "完整的北极星指标定义。如果不传，Tool 会返回项目分析数据供你思考后再回传。",
        properties: {
          primary_metric: {
            type: "object",
            description: "主指标——唯一的北极星",
            properties: {
              name: { type: "string", description: "指标名称" },
              definition: {
                type: "string",
                description: "精确定义，消除歧义",
              },
              measurement_method: {
                type: "string",
                description: "测量方法：日志统计/反馈按钮/飞书记录/代理指标...",
              },
              frequency: {
                type: "string",
                enum: ["daily", "weekly", "monthly"],
                description: "追踪频率",
              },
              direction: {
                type: "string",
                enum: ["up", "down"],
                description: "越高越好(up)还是越低越好(down)",
              },
              is_proxy: {
                type: "boolean",
                description: "是否是代理指标（测不了真正想测的，用相关替身）",
              },
              four_axiom_check: {
                type: "object",
                description: "四公理检验结果——主指标必填",
                properties: {
                  reflects_ultimate_value: {
                    type: "boolean",
                    description: "反映终极价值而非中间过程？",
                  },
                  attributable_to_product: {
                    type: "boolean",
                    description: "变化能归因到产品本身？",
                  },
                  continuously_trackable: {
                    type: "boolean",
                    description: "能持续追踪趋势？",
                  },
                  drives_correct_behavior: {
                    type: "boolean",
                    description: "被极端优化后仍驱动正确行为？",
                  },
                  meaningful_to_all_levels: {
                    type: "boolean",
                    description: "对管理层和一线都有意义？",
                  },
                  notes: {
                    type: "string",
                    description: "检验过程中的推理和思考",
                  },
                },
                required: [
                  "reflects_ultimate_value",
                  "attributable_to_product",
                  "continuously_trackable",
                  "drives_correct_behavior",
                  "meaningful_to_all_levels",
                  "notes",
                ],
              },
            },
            required: [
              "name",
              "definition",
              "measurement_method",
              "frequency",
              "direction",
              "is_proxy",
              "four_axiom_check",
            ],
          },
          guardrails: {
            type: "array",
            description: "护栏指标（1-2个），防止主指标被游戏化",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                definition: { type: "string" },
                threshold: {
                  type: "string",
                  description: "红线描述，如'不低于70%'",
                },
                prevents: {
                  type: "string",
                  description: "防止什么歪行为",
                },
              },
              required: ["name", "definition", "threshold", "prevents"],
            },
          },
          observation_metrics: {
            type: "array",
            description: "观察指标，不驱动决策，帮助理解深层模式",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                definition: { type: "string" },
                insight: {
                  type: "string",
                  description: "帮助理解什么深层模式",
                },
              },
              required: ["name", "definition", "insight"],
            },
          },
          stories: {
            type: "array",
            description: "故事素材——不是指标！用于关键时刻的叙事弹药",
            items: {
              type: "object",
              properties: {
                narrative: {
                  type: "string",
                  description: "故事内容，如'以前30分钟，现在30秒'",
                },
                use_case: {
                  type: "string",
                  description:
                    "适用场景：向管理层汇报/说服新部门试用/全员会展示价值...",
                },
              },
              required: ["narrative", "use_case"],
            },
          },
          proxy_rationale: {
            type: "string",
            description:
              "如果主指标是代理指标，说明它和真正想测的东西之间的关系",
          },
          rejected_candidates: {
            type: "array",
            description: "被淘汰的候选指标——保留推理过程，便于未来回顾",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                rejected_reason: {
                  type: "string",
                  description: "哪条公理没过、为什么不合格",
                },
                better_as: {
                  type: "string",
                  enum: ["story", "auxiliary", "none"],
                  description: "降级用途",
                },
              },
              required: ["name", "rejected_reason", "better_as"],
            },
          },
        },
        required: [
          "primary_metric",
          "guardrails",
          "observation_metrics",
          "stories",
          "rejected_candidates",
        ],
      },
    },
    required: ["project_id"],
  },
} as const;

export async function handleDefineNorthStar(
  store: Store,
  args: {
    project_id: string;
    north_star?: NorthStarDefinition;
  },
): Promise<string> {
  const project = await store.getProject(args.project_id);

  if (!project.analysis) {
    return JSON.stringify({
      error: "请先完成 analyze_gaps 再定义北极星指标",
    });
  }

  // Second pass: save the north star definition
  if (args.north_star) {
    const updated = {
      ...project,
      north_star: args.north_star,
    };
    await store.saveProject(updated);

    const axiomCheck = args.north_star.primary_metric.four_axiom_check;
    const allPassed =
      axiomCheck.reflects_ultimate_value &&
      axiomCheck.attributable_to_product &&
      axiomCheck.continuously_trackable &&
      axiomCheck.drives_correct_behavior &&
      axiomCheck.meaningful_to_all_levels;

    return JSON.stringify(
      {
        project_id: project.id,
        status: "north_star_defined",
        summary: {
          primary_metric: args.north_star.primary_metric.name,
          is_proxy: args.north_star.primary_metric.is_proxy,
          frequency: args.north_star.primary_metric.frequency,
          direction: args.north_star.primary_metric.direction,
          four_axiom_all_passed: allPassed,
          guardrails_count: args.north_star.guardrails.length,
          observation_metrics_count: args.north_star.observation_metrics.length,
          stories_count: args.north_star.stories.length,
          rejected_candidates_count: args.north_star.rejected_candidates.length,
        },
        warnings: [
          ...(!allPassed
            ? [
                "主指标未通过全部四公理检验，请确认这是有意为之（如确实找不到更好的指标）还是需要重新选择",
              ]
            : []),
          ...(args.north_star.primary_metric.is_proxy &&
          !args.north_star.proxy_rationale
            ? ["主指标标记为代理指标但未填写 proxy_rationale，建议补充"]
            : []),
          ...(args.north_star.guardrails.length === 0
            ? ["未定义护栏指标，主指标有被游戏化的风险"]
            : []),
        ],
        next_steps: [
          "北极星指标已定义，调用 generate_harness 生成执行手册",
          "手册将自动包含'评估与进化'章节，引用北极星指标定义",
        ],
      },
      null,
      2,
    );
  }

  // First pass: return data for the AI to think about metrics
  return JSON.stringify(
    {
      project_id: project.id,
      status: "awaiting_north_star",
      message:
        "请基于以下分析结果，按照指标选择流程（确认终极价值→列出候选→四公理淘汰→代理指标→1+2结构→故事素材）定义北极星指标。注意：必须先完成第零步（与业务方确认终极价值），再开始列候选。完成后通过 north_star 参数回传。",
      metric_selection_guide: {
        step_0:
          "【必须先做】向业务方确认终极价值：这个流程的本质是培养（让人/事变好）还是筛选（淘汰不合格）？还是培养优先、淘汰兜底？'成功'长什么样？不同的价值定义导向完全不同的指标——不要跳过这一步。",
        step_1:
          "从 redesigned_process 的各阶段中，在使用层、效率层、质量层、价值层四个层级上列出所有候选指标",
        step_2:
          "每个候选指标逐条过四公理：反映终极价值？能归因？能持续追踪？驱动正确行为？不合格的分流到 stories / observation_metrics / rejected_candidates",
        step_3:
          "如果最好的指标无法低成本持续测量，找代理指标并说明代理关系（proxy_rationale）",
        step_4:
          "选定1个主指标 + 1-2个护栏（防游戏化）+ 观察指标（理解深层模式）",
        step_5:
          "把淘汰赛中发现的好故事保留到 stories——故事用于叙事弹药，不是日常追踪",
      },
      vision: {
        business_name: project.vision?.business_name,
        goals: project.vision?.goals,
        constraints: project.vision?.constraints,
      },
      gap_analysis: {
        redesigned_process: project.analysis.redesigned_process,
        pain_points_prioritized: project.analysis.pain_points_prioritized,
        ai_native_opportunities: project.analysis.ai_native_opportunities,
        vision_vs_reality: project.analysis.vision_vs_reality,
      },
      existing_north_star: project.north_star ?? null,
    },
    null,
    2,
  );
}
