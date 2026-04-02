# 招聘流水线自动化 — Anya 执行手册

> 飞书文档: https://www.feishu.cn/docx/KkXadHxZMozEvGxaf9Zcsi6Cn3e
> 版本: v2.0
> 更新时间: 2026-04-02

<callout emoji="dart" background-color="light-blue">
你的任务：把公司的招聘流程构建成一条**自动化流水线**，从简历进入招聘邮箱到 Offer 审批发起，全程由你调度执行，HR 只在关键节点介入。
本文档告诉你：要做什么、怎么做、哪些你自己决定、哪些必须找 HR 确认。
</callout>

## 一、设计原则（Harness Engineering）
你不是在做一堆零散的自动化脚本，而是在构建一套**可观测、可审计、可调节的控制系统**。每一步设计都必须满足以下约束：

<lark-table rows="6" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      约束
    </lark-td>
    <lark-td>
      含义
    </lark-td>
    <lark-td>
      你的检查方式
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      状态可观测
    </lark-td>
    <lark-td>
      HR 打开多维表格就能看到每个候选人在哪个阶段
    </lark-td>
    <lark-td>
      每次状态变更都写入主数据表
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      决策可审计
    </lark-td>
    <lark-td>
      Agent 为什么做了这个判断，事后可查
    </lark-td>
    <lark-td>
      每次自动决策都写决策日志
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      失败可恢复
    </lark-td>
    <lark-td>
      任何一步出错不会搞崩整条线
    </lark-td>
    <lark-td>
      每步都有成功/失败/超时三种出口
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      控制权清晰
    </lark-td>
    <lark-td>
      哪些你自主跑、哪些等 HR 确认
    </lark-td>
    <lark-td>
      严格按控制权矩阵执行
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      配置驱动
    </lark-td>
    <lark-td>
      阈值、模板、人员这些 HR 能自己改
    </lark-td>
    <lark-td>
      所有可变参数放配置表，不写死在 Skill 里
    </lark-td>
  </lark-tr>
</lark-table>

---

## 二、数据架构
所有表格放在同一个飞书多维表格应用中，命名为**「招聘流水线」**。
### 表 1：候选人主数据表
这是整条流水线的中枢，每个候选人一行记录。

<lark-table rows="20" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      字段名
    </lark-td>
    <lark-td>
      类型
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      候选人姓名
    </lark-td>
    <lark-td>
      文本
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      邮箱
    </lark-td>
    <lark-td>
      文本
    </lark-td>
    <lark-td>
      同时用于去重判断
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      手机号
    </lark-td>
    <lark-td>
      文本
    </lark-td>
    <lark-td>
      辅助去重
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      应聘岗位
    </lark-td>
    <lark-td>
      单选
    </lark-td>
    <lark-td>
      选项从「岗位配置表」同步
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      当前状态
    </lark-td>
    <lark-td>
      单选
    </lark-td>
    <lark-td>
      见下方状态枚举
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      简历文件
    </lark-td>
    <lark-td>
      附件
    </lark-td>
    <lark-td>
      原始简历
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      简历来源
    </lark-td>
    <lark-td>
      单选
    </lark-td>
    <lark-td>
      邮箱投递 / 内推 / 猎头 / 其他
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      初筛评分
    </lark-td>
    <lark-td>
      数字
    </lark-td>
    <lark-td>
      AI 初筛分数（0-100）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      精筛评分
    </lark-td>
    <lark-td>
      数字
    </lark-td>
    <lark-td>
      AI 精筛分数（0-100）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      GitHub
    </lark-td>
    <lark-td>
      URL
    </lark-td>
    <lark-td>
      候选人 GitHub 地址
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      补充信息状态
    </lark-td>
    <lark-td>
      单选
    </lark-td>
    <lark-td>
      未请求 / 已发送 / 已回复 / 超时
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      补充信息发送时间
    </lark-td>
    <lark-td>
      日期
    </lark-td>
    <lark-td>
      用于超时判断
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      当前面试轮次
    </lark-td>
    <lark-td>
      数字
    </lark-td>
    <lark-td>
      0 / 1 / 2 / 3 / 4
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试结果
    </lark-td>
    <lark-td>
      单选
    </lark-td>
    <lark-td>
      各轮面试的最新结果
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      异常标记
    </lark-td>
    <lark-td>
      单选
    </lark-td>
    <lark-td>
      无 / 异常-需人工处理
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      异常原因
    </lark-td>
    <lark-td>
      文本
    </lark-td>
    <lark-td>
      出错时写入具体原因
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      决策日志
    </lark-td>
    <lark-td>
      文本（多行）
    </lark-td>
    <lark-td>
      每次自动决策追加一条记录
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      创建时间
    </lark-td>
    <lark-td>
      日期
    </lark-td>
    <lark-td>
      入表时间
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      最后更新时间
    </lark-td>
    <lark-td>
      日期
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
</lark-table>

**状态枚举（按流转顺序）：**
待初筛 → 初筛通过 → 待精筛 → 精筛通过 → 待补充信息 → 信息完整 → 待HR确认面试 → 待安排面试 → 面试已安排 → 面试中 → 面试通过-待下一轮 → 终面通过-待谈offer → Offer协商中 → Offer审批中 → 已录用
淘汰分支：初筛淘汰 / 精筛淘汰 / 面试淘汰 / 候选人放弃
异常分支：异常-需人工处理
### 表 2：岗位配置表

<lark-table rows="7" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      字段名
    </lark-td>
    <lark-td>
      类型
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      岗位名称
    </lark-td>
    <lark-td>
      文本
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      初筛阈值
    </lark-td>
    <lark-td>
      数字
    </lark-td>
    <lark-td>
      低于此分数自动淘汰
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      精筛阈值
    </lark-td>
    <lark-td>
      数字
    </lark-td>
    <lark-td>
      低于此分数自动淘汰
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试轮次数
    </lark-td>
    <lark-td>
      数字
    </lark-td>
    <lark-td>
      该岗位需要几轮面试
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      岗位 JD
    </lark-td>
    <lark-td>
      文本（多行）
    </lark-td>
    <lark-td>
      供筛选 Skill 参考
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      是否开放
    </lark-td>
    <lark-td>
      复选框
    </lark-td>
    <lark-td>
      关闭后不再处理新简历
    </lark-td>
  </lark-tr>
</lark-table>

<callout emoji="clipboard" background-color="light-yellow">
**需要 HR 确认：** 请 HR 提供当前在招的岗位列表、每个岗位的 JD、初筛和精筛的分数阈值建议。如果 HR 暂时不确定阈值，建议初筛默认 60、精筛默认 75，跑两周后根据实际情况调整。
</callout>

### 表 3：面试官配置表

<lark-table rows="6" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      字段名
    </lark-td>
    <lark-td>
      类型
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试官姓名
    </lark-td>
    <lark-td>
      文本
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试官 open_id
    </lark-td>
    <lark-td>
      文本
    </lark-td>
    <lark-td>
      用于日历查询和消息通知
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      可面试岗位
    </lark-td>
    <lark-td>
      多选
    </lark-td>
    <lark-td>
      关联岗位配置表
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      负责轮次
    </lark-td>
    <lark-td>
      多选
    </lark-td>
    <lark-td>
      一面 / 二面 / 三面 / 终面
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      每周最大面试数
    </lark-td>
    <lark-td>
      数字
    </lark-td>
    <lark-td>
      防止过度安排
    </lark-td>
  </lark-tr>
</lark-table>

<callout emoji="clipboard" background-color="light-yellow">
**需要 HR 确认：** 请 HR 提供面试官名单，明确每个人负责哪些岗位的哪一轮面试，以及每周最多安排几场。
</callout>

### 表 4：邮件模板表

<lark-table rows="5" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      字段名
    </lark-td>
    <lark-td>
      类型
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      模板名称
    </lark-td>
    <lark-td>
      单选
    </lark-td>
    <lark-td>
      见下方模板清单
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      适用岗位
    </lark-td>
    <lark-td>
      多选
    </lark-td>
    <lark-td>
      留空表示通用
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      邮件主题
    </lark-td>
    <lark-td>
      文本
    </lark-td>
    <lark-td>
      支持变量替换
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      邮件正文
    </lark-td>
    <lark-td>
      文本（多行）
    </lark-td>
    <lark-td>
      支持变量替换
    </lark-td>
  </lark-tr>
</lark-table>

**需要的模板清单：**

<lark-table rows="8" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      模板名称
    </lark-td>
    <lark-td>
      触发时机
    </lark-td>
    <lark-td>
      变量
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      补充信息请求
    </lark-td>
    <lark-td>
      精筛通过后自动发送
    </lark-td>
    <lark-td>
      {候选人姓名}、{岗位名称}
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试邀请
    </lark-td>
    <lark-td>
      面试时间确认后发送
    </lark-td>
    <lark-td>
      {候选人姓名}、{岗位}、{时间}、{地点/会议链接}、{面试官}
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试改约
    </lark-td>
    <lark-td>
      面试时间变更
    </lark-td>
    <lark-td>
      同上
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试提醒
    </lark-td>
    <lark-td>
      面试前一天自动发送
    </lark-td>
    <lark-td>
      同上
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      初筛未通过
    </lark-td>
    <lark-td>
      初筛淘汰时发送
    </lark-td>
    <lark-td>
      {候选人姓名}、{岗位名称}
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试未通过
    </lark-td>
    <lark-td>
      面试淘汰时发送
    </lark-td>
    <lark-td>
      {候选人姓名}、{岗位名称}
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      补充信息催促
    </lark-td>
    <lark-td>
      超过 5 天未回复
    </lark-td>
    <lark-td>
      {候选人姓名}
    </lark-td>
  </lark-tr>
</lark-table>

<callout emoji="clipboard" background-color="light-yellow">
**需要 HR 确认：** 请 HR 提供每个模板的邮件内容。特别是拒信的措辞，需要 HR 审定后才能启用自动发送。先起草一版给 HR 过目，HR 确认后再写入模板表。
</callout>

### 表 5：操作日志表

<lark-table rows="8" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      字段名
    </lark-td>
    <lark-td>
      类型
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      时间
    </lark-td>
    <lark-td>
      日期
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      候选人
    </lark-td>
    <lark-td>
      关联
    </lark-td>
    <lark-td>
      关联主数据表
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      操作类型
    </lark-td>
    <lark-td>
      单选
    </lark-td>
    <lark-td>
      入表 / 初筛 / 精筛 / 发邮件 / 安排面试 / 状态变更 / 异常
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      操作详情
    </lark-td>
    <lark-td>
      文本（多行）
    </lark-td>
    <lark-td>
      具体做了什么
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      决策依据
    </lark-td>
    <lark-td>
      文本（多行）
    </lark-td>
    <lark-td>
      AI 评分的细项、判断理由
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      执行结果
    </lark-td>
    <lark-td>
      单选
    </lark-td>
    <lark-td>
      成功 / 失败 / 超时
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      失败原因
    </lark-td>
    <lark-td>
      文本
    </lark-td>
    <lark-td>
      失败时填写
    </lark-td>
  </lark-tr>
</lark-table>

---

## 三、控制权矩阵
<callout emoji="gift" background-color="light-red">
**这是你最重要的执行准则。** 每个动作的控制权定义如下，严格遵守，不得擅自越权。
</callout>


<lark-table rows="20" cols="4" header-row="true" column-widths="183,183,183,183">

  <lark-tr>
    <lark-td>
      阶段
    </lark-td>
    <lark-td>
      动作
    </lark-td>
    <lark-td>
      控制权
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      简历入表
    </lark-td>
    <lark-td>
      提取邮箱简历、解析、写入主数据表
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
      去重后自动入表
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      简历入表
    </lark-td>
    <lark-td>
      重复简历处理
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
      更新已有记录，不创建新行
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      初筛
    </lark-td>
    <lark-td>
      AI 评分
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
      按岗位配置的阈值自动判断
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      初筛
    </lark-td>
    <lark-td>
      淘汰通知
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
      用模板发拒信（模板需 HR 预先审定）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      精筛
    </lark-td>
    <lark-td>
      AI 精筛评分
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
      调用 /ai-native-recruiter
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      精筛
    </lark-td>
    <lark-td>
      通过后发补充信息请求
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
      模板邮件，无风险
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      补充信息
    </lark-td>
    <lark-td>
      监听回复、回填信息
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      补充信息
    </lark-td>
    <lark-td>
      超时催促（5天）
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
      最多催促 2 次
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      补充信息
    </lark-td>
    <lark-td>
      催促无果后处理
    </lark-td>
    <lark-td>
      **通知 HR 决定**
    </lark-td>
    <lark-td>
      是继续等还是放弃
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      **面试决策**
    </lark-td>
    <lark-td>
      **精筛通过 → 是否安排面试**
    </lark-td>
    <lark-td>
      **HR 确认**
    </lark-td>
    <lark-td>
      推送精筛报告给 HR，等 HR 在表中改状态
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试安排
    </lark-td>
    <lark-td>
      查面试官空闲、协调时间
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试安排
    </lark-td>
    <lark-td>
      发面试邀请邮件
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试安排
    </lark-td>
    <lark-td>
      创建日程、预约会议室
    </lark-td>
    <lark-td>
      全自动
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试安排
    </lark-td>
    <lark-td>
      3 次协调失败
    </lark-td>
    <lark-td>
      **转 HR 人工处理**
    </lark-td>
    <lark-td>
      标异常，通知 HR
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试评价
    </lark-td>
    <lark-td>
      录入面试评价
    </lark-td>
    <lark-td>
      **面试官填写**
    </lark-td>
    <lark-td>
      面试结束后通知面试官填写
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      **轮次流转**
    </lark-td>
    <lark-td>
      **本轮通过 → 是否进入下一轮**
    </lark-td>
    <lark-td>
      **HR 确认**
    </lark-td>
    <lark-td>
      通知 HR，等 HR 决定
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      面试淘汰
    </lark-td>
    <lark-td>
      发拒信
    </lark-td>
    <lark-td>
      自动起草 → **HR 确认后发送**
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      Offer
    </lark-td>
    <lark-td>
      谈薪沟通
    </lark-td>
    <lark-td>
      **HR 人工**
    </lark-td>
    <lark-td>
      完全人工
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      Offer
    </lark-td>
    <lark-td>
      发起飞书审批
    </lark-td>
    <lark-td>
      自动填表 → **HR 确认提交**
    </lark-td>
    <lark-td>
      HR 核对后点提交
    </lark-td>
  </lark-tr>
</lark-table>

<callout emoji="clipboard" background-color="light-yellow">
**需要 HR 确认：** 请 HR 审阅以上控制权分配，特别确认：
1. 初筛淘汰的拒信是否可以全自动发送？还是也需要 HR 确认后再发？
1. 精筛通过后，是否必须 HR 确认才能进面试？还是评分超过某个高阈值（比如 90 分）可以自动进面试？
1. 面试淘汰的拒信，HR 是希望逐个确认，还是批量确认？
</callout>

---

## 四、需要构建的 Skill
### 已有 Skill（直接复用）

<lark-table rows="8" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      Skill
    </lark-td>
    <lark-td>
      用途
    </lark-td>
    <lark-td>
      在流水线中的位置
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      /lark-resume-pipeline
    </lark-td>
    <lark-td>
      邮箱简历提取 → 解析 → 入表
    </lark-td>
    <lark-td>
      阶段 1
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      /ai-native-recruiter
    </lark-td>
    <lark-td>
      简历评估评分
    </lark-td>
    <lark-td>
      阶段 2
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      /lark-mail
    </lark-td>
    <lark-td>
      收发邮件
    </lark-td>
    <lark-td>
      阶段 3、4
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      /lark-calendar
    </lark-td>
    <lark-td>
      日历忙闲查询、创建日程
    </lark-td>
    <lark-td>
      阶段 4
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      /lark-im
    </lark-td>
    <lark-td>
      飞书消息通知
    </lark-td>
    <lark-td>
      全流程
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      /lark-base
    </lark-td>
    <lark-td>
      多维表格读写
    </lark-td>
    <lark-td>
      全流程
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      /lark-contact
    </lark-td>
    <lark-td>
      查面试官信息
    </lark-td>
    <lark-td>
      阶段 4
    </lark-td>
  </lark-tr>
</lark-table>

### 需要新建的 Skill
#### Skill 1：/recruit-pipeline-init
**用途：** 初始化招聘流水线的全部数据表和配置。
**执行内容：**
1. 创建「招聘流水线」多维表格应用
1. 创建上述 5 张表，按规定字段建好
1. 与 HR 沟通，填入初始配置（岗位、面试官、邮件模板）
1. 创建看板视图（按状态分组）供 HR 日常使用
1. 验证所有表结构正确
**这个 Skill 只在初始化时运行一次。**
---

#### Skill 2：/recruit-dispatcher
**用途：** 招聘流水线的核心调度器。定时执行，扫描主数据表，按状态触发对应动作。
**执行频率：** 每 30 分钟执行一次（通过定时任务）。
**调度逻辑：**
**步骤 1 — 扫描招聘邮箱，提取新简历**
- 按邮箱/手机号去重
- 新候选人 → 入表，状态设为"待初筛"
- 已存在 → 更新附件，写日志"候选人重复投递"
**步骤 2 — 处理状态="待初筛"的记录**
- 读取该岗位的初筛阈值
- 调用 /ai-native-recruiter 评分
- 评分结果 + 评分细项 → 写入主数据表 + 操作日志
- 评分 ≥ 阈值 → 状态改为"初筛通过"→"待精筛"
- 评分 < 阈值 → 状态改为"初筛淘汰"→ 发拒信（按控制权矩阵）
**步骤 3 — 处理状态="待精筛"的记录**
- 调用 /ai-native-recruiter 精筛模式
- 写入评分 + 日志
- 评分 ≥ 阈值 → 状态改为"精筛通过"→"待补充信息"→ 发补充信息请求邮件
- 评分 < 阈值 → 状态改为"精筛淘汰"
**步骤 4 — 处理状态="待补充信息"的记录**
- 扫描邮箱，匹配候选人回复
- 有回复 → 提取信息 → 回填到表 → 状态改为"信息完整"→"待HR确认面试"
- 超过 5 天未回复且催促次数 < 2 → 发催促邮件，催促次数+1
- 超过 5 天未回复且已催促 2 次 → 标异常，通知 HR
**步骤 5 — 处理状态="待HR确认面试"的记录**
- 飞书消息推送给 HR："{候选人}精筛{分数}分，精筛报告见附件，是否安排面试？请在表中确认。"
- HR 在多维表格中手动将状态改为"待安排面试"后，下一轮调度会处理
**步骤 6 — 处理状态="待安排面试"的记录**
- 读取面试官配置表，找到该岗位+该轮次的面试官
- 查面试官日历空闲
- 生成 3 个候选时间段
- 邮件发候选人选择时间
**步骤 7 — 处理面试时间已确认但未创建日程的记录**
- 创建飞书日程
- 预约会议室（如线下面试）
- 发面试邀请邮件（含时间、地点、面试官信息）
- 飞书通知面试官
- 状态改为"面试已安排"
**步骤 8 — 处理面试日期=明天的记录**
- 发面试提醒邮件给候选人
- 飞书提醒面试官
**步骤 9 — 处理面试已完成但未收到评价的记录**
- 飞书消息提醒面试官填写评价
**步骤 10 — 汇总异常记录**
- 每日汇总一次，飞书消息推送给 HR
<callout emoji="gift" background-color="light-red">
**异常处理规则（必须遵守）：**
- 任何步骤执行失败 → 状态改为"异常-需人工处理"，异常原因写入备注，飞书通知 HR
- 自动重试：邮件发送失败自动重试 1 次，日历查询失败自动重试 1 次
- 重试仍失败 → 转异常
</callout>

<callout emoji="memo" background-color="light-green">
**日志规则（必须遵守）：**
- 每次状态变更都写操作日志
- AI 评分必须写入评分细项（不只是总分）
- 邮件发送记录邮件 ID，便于追溯
</callout>

---

#### Skill 3：/candidate-followup
**用途：** 管理与候选人的邮件沟通闭环。
**能力：**
1. 按模板发送邮件（从邮件模板表读取模板，替换变量）
1. 扫描招聘邮箱，按发件人邮箱匹配到候选人记录
1. 从候选人回复中提取关键信息：
  - GitHub URL（正则匹配 github.com/xxx）
  - 个人网站/作品集链接
  - 其他 HR 指定的信息字段
1. 提取的信息回填到主数据表
1. 更新补充信息状态
---

#### Skill 4：/interview-scheduler
**用途：** 面试时间协调与日程管理。
**能力：**
1. 根据岗位+轮次，从面试官配置表查找可用面试官
1. 检查面试官本周已安排的面试数量，不超过上限
1. 查询面试官日历空闲时段
1. 生成 3 个候选时间段（工作日 10:00-18:00，避开午休 12:00-14:00）
1. 发邮件给候选人，请候选人回复选择的时间编号
1. 解析候选人回复，确认时间
1. 创建飞书日程（邀请面试官+候选人邮箱）
1. 预约会议室（如需线下）
1. 协调失败（候选人 3 天未回复 / 无可用时段）→ 标异常通知 HR
<callout emoji="clipboard" background-color="light-yellow">
**需要 HR 确认：**
1. 面试时间范围：工作日 10:00-18:00 是否合适？是否避开特定时段？
1. 线上面试还是线下？还是不同轮次不同方式？
1. 面试时长：各轮次默认多长时间？（建议一面 45 分钟，二面 60 分钟，终面 60 分钟）
</callout>

---

#### Skill 5：/recruit-hr-notify
**用途：** 在需要 HR 介入的节点，发送结构化通知。

<lark-table rows="6" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      触发条件
    </lark-td>
    <lark-td>
      通知内容
    </lark-td>
    <lark-td>
      通知方式
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      精筛通过，待 HR 确认面试
    </lark-td>
    <lark-td>
      候选人信息摘要 + 精筛报告 + 评分细项
    </lark-td>
    <lark-td>
      飞书消息（卡片）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      某轮面试通过，待 HR 决定下一轮
    </lark-td>
    <lark-td>
      面试评价摘要 + 历史轮次汇总
    </lark-td>
    <lark-td>
      飞书消息（卡片）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      终面通过
    </lark-td>
    <lark-td>
      全流程汇总（各轮评分+评价）
    </lark-td>
    <lark-td>
      飞书消息（卡片）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      异常发生
    </lark-td>
    <lark-td>
      异常候选人 + 原因 + 建议操作
    </lark-td>
    <lark-td>
      飞书消息
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      每日汇总
    </lark-td>
    <lark-td>
      今日新增候选人数、各阶段人数、异常数
    </lark-td>
    <lark-td>
      飞书消息（定时推送）
    </lark-td>
  </lark-tr>
</lark-table>

<callout emoji="clipboard" background-color="light-yellow">
**需要 HR 确认：** 这些通知发到哪里？HR 个人聊天窗口？还是一个专门的招聘群？请提供接收通知的群聊或个人信息。
</callout>

---

## 五、定时任务配置

<lark-table rows="6" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      任务名
    </lark-td>
    <lark-td>
      执行频率
    </lark-td>
    <lark-td>
      执行内容
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      招聘流水线-主调度
    </lark-td>
    <lark-td>
      每 30 分钟
    </lark-td>
    <lark-td>
      /recruit-dispatcher 全量扫描
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      招聘流水线-邮箱监听
    </lark-td>
    <lark-td>
      每 15 分钟
    </lark-td>
    <lark-td>
      扫描招聘邮箱新邮件（简历+候选人回复）
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      招聘流水线-每日汇总
    </lark-td>
    <lark-td>
      每天 09:00
    </lark-td>
    <lark-td>
      汇总昨日数据，推送给 HR
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      招聘流水线-面试提醒
    </lark-td>
    <lark-td>
      每天 09:00
    </lark-td>
    <lark-td>
      检查明天的面试，发提醒
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      招聘流水线-超时检查
    </lark-td>
    <lark-td>
      每天 10:00
    </lark-td>
    <lark-td>
      检查补充信息超时、面试时间确认超时
    </lark-td>
  </lark-tr>
</lark-table>

---

## 六、实施步骤
按以下顺序执行，每完成一个阶段都要通知 HR 确认。
### 第一阶段：搭地基（数据表 + 配置）
**你自主完成：**
1. 创建「招聘流水线」多维表格
1. 建好 5 张表的全部字段
1. 创建看板视图（按候选人状态分组）
1. 创建面试官配置视图
1. 创建异常看板视图（只显示异常记录）
<callout emoji="clipboard" background-color="light-yellow">
**需要找 HR 确认：**
- 提供目前在招岗位列表和 JD
- 提供面试官名单（姓名 + 负责岗位 + 负责轮次 + 每周上限）
- 确认初筛/精筛分数阈值（或同意使用默认值 60/75）
- 确认通知接收方式（个人/群聊）
</callout>

**完成标志：** HR 打开多维表格，能看到完整的表结构和看板视图。
---

### 第二阶段：打通入口（简历自动入表）
**你自主完成：**
1. 在现有 /lark-resume-pipeline 基础上，增加去重逻辑
1. 入表后自动设置状态="待初筛"
1. 写入操作日志
1. 配置定时任务，每 15 分钟扫描招聘邮箱
1. 测试：手动往招聘邮箱发一封带简历的邮件，验证能否自动入表
<callout emoji="clipboard" background-color="light-yellow">
**需要找 HR 确认：**
- 确认招聘邮箱地址
- 测试入表后让 HR 看一下结果是否符合预期
</callout>

**完成标志：** 简历邮件发出后 15 分钟内自动出现在多维表格中。
---

### 第三阶段：自动筛选
**你自主完成：**
1. 在调度器中实现初筛逻辑：扫描"待初筛"→ 调用评分 → 写回分数+细项+日志
1. 实现精筛逻辑：扫描"待精筛"→ 调用精筛 → 写回分数+细项+日志
1. 阈值从岗位配置表读取，不写死
1. 测试：用几份真实简历跑一遍，检查评分和日志
<callout emoji="clipboard" background-color="light-yellow">
**需要找 HR 确认：**
- 给 HR 看 3-5 个候选人的评分结果和评分细项
- 让 HR 判断评分是否合理，阈值是否需要调整
- 确认淘汰拒信模板内容
</callout>

**完成标志：** HR 确认评分结果合理，调度器能自动完成初筛+精筛全流程。
---

### 第四阶段：沟通闭环
**你自主完成：**
1. 构建 /candidate-followup Skill
1. 起草全部邮件模板初稿，写入邮件模板表
1. 实现：精筛通过 → 自动发补充信息请求邮件
1. 实现：扫描邮箱 → 匹配候选人回复 → 提取信息 → 回填
1. 实现：超时催促逻辑（5天未回复发催促，最多2次）
1. 实现：精筛通过 → 推送通知给 HR，等 HR 确认是否面试
<callout emoji="clipboard" background-color="light-yellow">
**需要找 HR 确认：**
- 审阅全部邮件模板，修改后确认
- 确认补充信息请求中要问候选人哪些问题（GitHub? 作品集? 期望薪资? 到岗时间?）
- 测试一轮完整的邮件沟通流程
</callout>

**完成标志：** 从精筛通过到 HR 收到面试确认通知，全流程自动。
---

### 第五阶段：面试自动化
**你自主完成：**
1. 构建 /interview-scheduler Skill
1. 实现面试官匹配 → 时间协调 → 日程创建全流程
1. 实现面试提醒（前一天提醒候选人和面试官）
1. 实现面试结束后自动提醒面试官填写评价
1. 实现多轮面试串联：本轮评价录入 → 通知 HR → HR 确认 → 自动安排下一轮
<callout emoji="clipboard" background-color="light-yellow">
**需要找 HR 确认：**
- 面试时间范围、时长、线上/线下
- 面试邀请邮件模板确认
- 用 1-2 个真实候选人测试完整的面试安排流程
</callout>

**完成标志：** HR 在表中点"确认面试"后，面试安排全自动完成。
---

### 第六阶段：收尾（Offer + 日报）
**你自主完成：**
1. 实现终面通过通知（汇总全流程信息）
1. 实现 Offer 审批自动填表（HR 确认后提交）
1. 配置每日汇总通知
1. 整体联调测试
<callout emoji="clipboard" background-color="light-yellow">
**需要找 HR 确认：**
- Offer 审批流程在飞书审批中是否已建好？审批表单字段是什么？
- 每日汇总的推送时间和接收人确认
- 全流程端到端测试
</callout>

**完成标志：** 整条流水线从简历入表到 Offer 审批全部打通。
---

## 七、与 HR 的沟通清单（汇总）
以下是所有需要 HR 提供或确认的事项，按优先级排列。你在第一阶段开始前，先把高优先级的问题一次性问清楚。
### 必须先确认（开工前）
<callout emoji="red_circle" background-color="light-red">
1. 当前在招岗位列表 + 各岗位 JD
1. 面试官名单（姓名、负责岗位、负责轮次、每周上限）
1. 招聘邮箱地址
1. 通知接收方式（发到哪个群/哪个人）
1. 初筛/精筛分数阈值（或同意默认值 60/75）
</callout>

### 过程中确认（边做边问）
<callout emoji="gift" background-color="light-yellow">
1. 邮件模板内容（你先起草，HR 修改确认）
1. 补充信息要问候选人哪些问题
1. 面试时间范围、时长、线上/线下
1. 初筛淘汰拒信是否可全自动发送
1. 面试淘汰拒信是逐个确认还是批量确认
</callout>

### 后期确认
<callout emoji="gift" background-color="light-green">
1. Offer 审批表单字段和流程
1. 控制权矩阵整体审阅
1. 全流程端到端测试验收
</callout>

---

## 八、运行后的持续优化
流水线上线后，你需要：
1. **每周生成一次流水线运行报告**：各阶段转化率、平均停留时间、异常率
1. **根据 HR 反馈调整**：阈值不合理就改配置表，模板不好就改模板表
1. **异常模式识别**：如果某类异常反复出现，主动分析原因并建议改进
<callout emoji="clipboard" background-color="light-yellow">
**首次运行后找 HR 确认：** 跑完第一批 10-20 个候选人后，请 HR 整体评估：评分准不准、流程顺不顺、通知及不及时、有没有漏掉的环节。根据反馈做第一轮调优。
</callout>

---

## 附录：状态流转全图
**主线流程：**
邮箱简历 → **待初筛** → AI评分 → 评分≥阈值 → **初筛通过** → **待精筛** → AI精筛 → 评分≥阈值 → **精筛通过** → **待补充信息** → 候选人回复 → **信息完整** → **待HR确认面试**（HR介入点）→ HR确认 → **待安排面试** → 自动协调 → **面试已安排** → 面试完成 → 面试官填评价 → 通过
通过后分支：
- 还有下一轮 → **待HR确认下一轮**（HR介入点）→ 循环回"待安排面试"
- 无下一轮（终面通过）→ **终面通过-待谈offer**（HR介入点）→ HR人工谈薪 → **Offer审批中** → 审批通过 → **已录用**
**淘汰分支：**
- 初筛评分 < 阈值 → **初筛淘汰** → 自动拒信
- 精筛评分 < 阈值 → **精筛淘汰**
- 面试不通过 → **面试淘汰** → HR确认后发拒信
**异常分支：**
- 任何步骤执行失败 → **异常-需人工处理** → 通知HR
- 补充信息催促2次无果 → **异常-需人工处理** → 通知HR
- 面试协调3次失败 → **异常-需人工处理** → 通知HR
---

<callout emoji="rocket" background-color="light-blue">
**Anya，以上就是你的完整执行蓝图。从第一阶段开始，先找 HR 确认"必须先确认"清单中的 5 个问题，然后开始搭建数据表。每完成一个阶段，通知 HR 验收后再进入下一个阶段。**
</callout>

---

## 九、Anya 的角色定义（补充）
<callout emoji="brain" background-color="light-blue">
在执行本手册的全过程中，你必须以以下四重身份思考，而不是机械地搬运流程：
</callout>

**1. HR 领域专家**你不是通用的流程搬运工。在招聘场景中，你是 HR 领域的专家。用专业视角判断每个环节的合理性：初筛阈值设成 60 分合不合理？面试轮次能不能根据岗位动态调整？候选人体验在流程设计中有没有被考虑到？
**2. 第一性原理思考**不要接受"我们一直这么做"作为理由。每个环节都追问：这个步骤解决的本质问题是什么？有没有完全不同的方式？例如：为什么要人工筛选简历？AI 初筛后人只看有争议的 20%，是不是更好？
**3. 长期发展眼光**设计的方案不只是解决今天的问题：
- 招聘量增长 10 倍后，这条流水线还能跑吗？
- 如果新增一个岗位类型，需要改多少配置？
- 数据表结构能支撑后续做招聘漏斗分析吗？
**4. AI 能力边界的诚实判断**清楚 AI 能做什么、不能做什么：
- AI 筛简历很好 → 全自动
- AI 评估候选人"文化匹配度" → 不靠谱，留给人
- AI 协调面试时间 → 可以，但候选人 3 次不回复就该转人工不要把 AI 不擅长的事情设计成全自动，也不要把 AI 明显能做好的事情留给人工。
---

## 十、知识库作为输入源（补充）
<callout emoji="books" background-color="light-blue">
在执行本手册之前，你应该先阅读 HR 部门的知识库/制度文档/SOP，作为理解业务的第三个视角。
</callout>

三层输入的关系：

<lark-table rows="4" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      输入
    </lark-td>
    <lark-td>
      视角
    </lark-td>
    <lark-td>
      典型发现
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      本手册（战略视角）
    </lark-td>
    <lark-td>
      招聘流程应该怎么做
    </lark-td>
    <lark-td>
      理想化设计，可能脱离实际
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      知识库/制度文档
    </lark-td>
    <lark-td>
      文档里写的怎么做
    </lark-td>
    <lark-td>
      可能过时、可能没人看
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      一线 HR 的实际操作
    </lark-td>
    <lark-td>
      实际怎么做
    </lark-td>
    <lark-td>
      有变通、有隐性知识
    </lark-td>
  </lark-tr>
</lark-table>

三者之间的偏差本身就是最有价值的分析素材：
- 知识库有但没人看 → 文档过时或不实用，不要数字化它
- 一线有变通做法但知识库没写 → 隐性知识未沉淀，要捕捉
- 知识库和实际不一样 → 流程已演化但文档没跟上，以实际为准
- 知识库有合规要求 → 自动化时必须保留的硬约束
**执行要求：** 在开始第一阶段之前，先通过 harness-factory 的 ingest_knowledge_base 工具录入 HR 部门的知识库内容。
---

## 十一、质量门禁（补充）
本手册的执行不是一条直线，而是有三道质量门禁：
### 门禁 1：输入质量评估（开工前）
在进入第一阶段之前，先评估输入是否充分。调用 harness-factory 的 assess_inputs 工具，检查：

<lark-table rows="5" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      检查项
    </lark-td>
    <lark-td>
      标准
    </lark-td>
    <lark-td>
      不达标怎么办
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      战略视角完整度
    </lark-td>
    <lark-td>
      目标具体可衡量、干系人覆盖关键角色、理想流程已定义
    </lark-td>
    <lark-td>
      找 HR 负责人补充
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      知识库覆盖度
    </lark-td>
    <lark-td>
      有已文档化的流程、有制度规则、有 SOP
    </lark-td>
    <lark-td>
      录入 HR 知识库内容
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      访谈覆盖度
    </lark-td>
    <lark-td>
      至少访谈 HR 专员 + 面试官两个角色、有痛点和时间成本数据
    </lark-td>
    <lark-td>
      安排访谈
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      交叉验证
    </lark-td>
    <lark-td>
      战略和访谈不矛盾、知识库和实际差距已识别
    </lark-td>
    <lark-td>
      针对性追问
    </lark-td>
  </lark-tr>
</lark-table>

<callout emoji="gift" background-color="light-red">
**规则：输入质量评分低于 70 分，不要强行开工。** 低质量输入会导致手册设计偏离实际，返工成本更高。
</callout>

### 门禁 2：手册质量自检（生成后）
本手册生成后（以及每次重大修订后），必须通过 validate_harness 做七维度自检：

<lark-table rows="8" cols="3" header-row="true" column-widths="244,244,244">

  <lark-tr>
    <lark-td>
      维度
    </lark-td>
    <lark-td>
      检查内容
    </lark-td>
    <lark-td>
      不通过的后果
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      控制权覆盖
    </lark-td>
    <lark-td>
      每个流程阶段都有控制权定义吗？
    </lark-td>
    <lark-td>
      遗漏的阶段可能失控
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      失败处理
    </lark-td>
    <lark-td>
      每个自动化环节都有失败兜底吗？
    </lark-td>
    <lark-td>
      一步出错全线崩溃
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      人工确认点
    </lark-td>
    <lark-td>
      至少有一个 human_confirmed 的阶段
    </lark-td>
    <lark-td>
      纯全自动的流水线不可信
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      配置外置
    </lark-td>
    <lark-td>
      阈值、模板、人员写在配置表里而非 Skill 代码里
    </lark-td>
    <lark-td>
      HR 改不了参数
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      实施可行性
    </lark-td>
    <lark-td>
      每阶段有可验证的完成标志和需确认事项
    </lark-td>
    <lark-td>
      无法判断阶段是否真正完成
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      数据架构
    </lark-td>
    <lark-td>
      有主数据表、操作日志表、状态枚举
    </lark-td>
    <lark-td>
      缺少可观测性
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      依赖闭环
    </lark-td>
    <lark-td>
      新 Skill 的依赖都在能力注册表中
    </lark-td>
    <lark-td>
      执行时才发现能力缺失
    </lark-td>
  </lark-tr>
</lark-table>

<callout emoji="gift" background-color="light-red">
**规则：有 critical 级别问题时，不交付执行。** 修复后重新自检。
</callout>

### 门禁 3：运行时健康检查（执行中）
流水线上线运行后，必须定期做健康检查。调用 harness-factory 的 health_check 工具。
**检查频率：**
- 上线后第一周：每天检查
- 第 2-4 周：每周检查
- 稳定后：每月检查
**核心健康指标：**

<lark-table rows="6" cols="4" header-row="true" column-widths="183,183,183,183">

  <lark-tr>
    <lark-td>
      指标
    </lark-td>
    <lark-td>
      健康标准
    </lark-td>
    <lark-td>
      退化信号
    </lark-td>
    <lark-td>
      不健康信号
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      阶段转化率
    </lark-td>
    <lark-td>
      ≥80%
    </lark-td>
    <lark-td>
      70-80%
    </lark-td>
    <lark-td>
      <70%
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      异常率
    </lark-td>
    <lark-td>
      <5%
    </lark-td>
    <lark-td>
      5-15%
    </lark-td>
    <lark-td>
      >15%
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      全自动环节人工干预率
    </lark-td>
    <lark-td>
      <10%
    </lark-td>
    <lark-td>
      10-20%
    </lark-td>
    <lark-td>
      >20%
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      配置变更频率（30天）
    </lark-td>
    <lark-td>
      ≤3次
    </lark-td>
    <lark-td>
      4-8次
    </lark-td>
    <lark-td>
      >8次
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      平均阶段停留时间
    </lark-td>
    <lark-td>
      ≤预期1.5倍
    </lark-td>
    <lark-td>
      1.5-2倍
    </lark-td>
    <lark-td>
      >2倍
    </lark-td>
  </lark-tr>
</lark-table>

**触发手册修订的条件（任一满足）：**
- 异常率持续 >15% 超过 2 周
- 某阶段转化率 <50%
- 全自动环节人工干预率 >30%
- 同一配置项 30 天内被修改 >5 次
<callout emoji="arrows_counterclockwise" background-color="light-green">
**自省闭环：** 健康检查发现需要修订时 → 重新调用 analyze_gaps 更新分析 → generate_harness 生成新版手册 → validate_harness 自检 → 发布新版。
</callout>

---

## 十二、完整工作流（修订版）
结合质量门禁后，完整的工作流如下：
**准备阶段：**
1. 录入战略视角（本手册已提供）
1. 录入 HR 部门知识库
1. 完成一线 HR + 面试官访谈，录入访谈记录
1. **🚦 输入质量门禁** — assess_inputs 评分 ≥70 才继续
**分析阶段：**5. 四维差距分析（analyze_gaps）6. 精准追问 — 带着分析结果找 HR 确认关键决策7. 生成执行手册（generate_harness）8. **🚦 手册质量自检** — validate_harness 无 critical 才交付
**执行阶段：**9. 按第一至第六阶段逐步实施10. 每阶段完成后通知 HR 验收
**自省阶段：**11. 上线后按频率做 **🔄 健康检查**（health_check）12. 发现 needs_revision → 回到步骤 5 重新分析修订
---

<callout emoji="rocket" background-color="light-blue">
**Anya，以上九至十二章是对原手册的补充。在执行时，请将这些要求与前八章合并理解：先过输入质量门禁，再按阶段执行，执行后持续健康检查。质量自省不是额外负担，而是确保你产出的东西真正有效的保障。**
</callout>

