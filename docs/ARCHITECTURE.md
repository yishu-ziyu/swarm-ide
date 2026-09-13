# Swarm-IDE 二开复盘与架构总览

> 更新：2026-09-13 · 分支 feat/academic-research · 给新会话的 agent 和未来的自己

## 一、这是什么产品

上游（chmod777john/swarm-ide）是一个多 Agent 群聊协作平台：用户下达指令，蜂群自动分解任务、分配角色、像微信群一样协作。技术栈：Next.js 16 App Router 单体（React 19 + Tailwind 4），PostgreSQL(drizzle) + Redis(Upstash)，LLM 多 provider（MiniMax 默认），skill auto-load + MCP 工具扩展。启动：`cd backend && docker compose up -d && npm run dev`，端口 3017。

本仓库的二次开发给它选定了一个真实场景：**学术研究模式**。差异化论点：主流 deep research 产品（OpenAI/Gemini/Kimi）全是黑箱跑十分钟不能纠偏，而本产品的 IM 对话 + /graph 拓扑让研究过程**可观察、可干预、引文可审计**——竞品调研确认「自托管 + 多 agent 过程可视化 + IM 可干预 + 学术研究模式」四合一无人做（最近的对手 Ai2 Asta 不做过程协作 UI）。注意窗口期：Asta 同方向赛跑，开源基线（LangChain open_deep_research、STORM、GPT Researcher）免费可用，必须赢在过程交互和证据可信度，不做模式包装。

## 二、二开的三层意义（复盘）

1. **使能层**（DEV_LOG 阶段一~五，2026-02）：macOS 适配、配置持久化、runtime fallback 修复、配置面板、排坑——从「能看」到「能用」。
2. **理解层**（阶段六~七）：性能分析、基线整理。二开过程吃透了 agent loop、工具注册、SSE 三路流式、skill 注入、MCP——本仓库是后续所有 agent 项目方法论的母本（agent-contract-workflow、Android Agent 指南均引用）。
3. **产品层**（学术研究模式 + 2026-09 重启）：契约化开发（`.dev/` 下验收契约 + check 脚本），已落地安全清理、Search→MCP→Citation 闭环、紧凑苹果风设计系统（DESIGN.md §41）、技术债清偿。

## 三、代码架构（2026-09-13 清债后）

```
swarm-ide/
├── backend/                        ← 单体全栈（Next.js 16 App Router）
│   ├── app/                        【呈现层】compact-apple 设计系统（SF Pro/三灰/12-13-14-24/圆角 8-16-胶囊）
│   │   ├── page.tsx                  落地页（拼贴风，设计规范豁免区）
│   │   ├── im/                       主产品窗：page.tsx 装配 + 双视图
│   │   │                             IMShell + PixelHeader(V1 主) + PixelNavSidebar(V1 主/V2 canvas 侧)
│   │   │                             + IMMessageList(V1, renderContent→Streamdown) + CanvasView(已接后端)
│   │   ├── graph/                    Agent 拓扑实时可视化
│   │   ├── dev-dashboard/            运维面板（日志 SSE）
│   │   ├── i18n.ts                   双语系统
│   │   └── api/                    【API 层】workspaces/groups/agents(context-stream SSE)/
│   │                                 agent-graph/ui-stream/config/dev-logs/research/citations/
│   │                                 search/llm/admin/health
│   ├── src/
│   │   ├── runtime/                【运行时核心】agent-runtime.ts（中枢：拼 prompt→LLM→
│   │   │                             分发 tool call→SSE 三路流 content/reasoning/tool）、
│   │   │                             mcp.ts（注册表+env 插值）、skill-loader.ts、event-bus/ui-bus
│   │   ├── lib/tools/builtInTools/ 【工具层】Agent/Task/Bash/FileRead/FileWrite/Glob
│   │   │                             + SearchTool(web_search→MCP tavily→落引文)
│   │   ├── research/               【研究域】research-runtime.ts（状态机+引文模型）
│   │   │                             + citation-store.ts（搜索→引文粘合，CitationManager 单例）
│   │   └── lib/                    【支撑层】storage.ts（PG/drizzle，游标分页 limit/beforeTime
│   │                                 已透传）、config.ts（app.json 动态配置）、openai-stream.ts
│   ├── skills/                     【能力声明层】research（研究循环）/academic（论文写作/APA）/
│   │                                 topology（协作原语）——SKILL.md auto-load 进 system prompt
│   ├── mcp.json                    【工具声明层】tavily(启用)/exa/chrome-devtools，密钥走 ${ENV}
│   └── docker-compose.yml          PG + Redis
├── docs/ DEV_LOG.md specs/ whitepaper-site/   过程档案
└── .dev/（gitignore，本地）         验收资产：acceptance-*.md ×3 + check-*.mjs ×3 + screenshots/
```

**一条消息的旅程**：/im 输入研究需求 → IMShell → agents API → agent-runtime 拼 system prompt（skill 注入）→ LLM（openai-stream SSE）→ `web_search` tool call → SearchTool 经 MCP 层调 tavily → citation-store 落 CitationManager → `GET /api/research/citations?agentId=` 可查；/graph 读 /api/agent-graph 画协作拓扑。

**设计哲学**：skill 层声明能力（prompt）→ 工具层提供行动（MCP）→ 运行时层编排循环 → 研究域沉淀产物（引文）。四层各管一段。

## 四、技术债处置记录（2026-09-13，commit 0e8c592）

| 债 | 处置 |
|---|---|
| tsconfig 遮蔽的死模块（memory/director/lib/context/lib/runtime 等 6 路径，36 条历史类型错误） | 全部删除，exclude 收敛为仅 node_modules，tsc 全量覆盖 0 错误 |
| src/lib/agents/ 死集群（AgentRunner/AgentContext/AgentManager/builtInAgents/coordinator，6 文件） | 实现时发现同属死代码（集群外零引用），一并删除（validator 独立验证成立） |
| tools/registry.ts 死链 | 删除，Tool 类型本在 Tool.ts 无需迁移 |
| app/im 死组件（IMMessageListV2/IMHistoryList/PixelAgentCard/AgentGraphPanel——均只有 import 无 JSX 使用） | 删除；现役 V1 四件套保留（V2 无等价能力：renderContent/theme toggle 等） |
| CanvasView MiniChatWidget 未接后端 | 已接 /api/groups/[groupId]/messages（GET 拉取 + POST 发送 + 轮询等回复 + 错误红框） |
| 消息游标分页未生效 | route 已透传 limit/beforeTime（带防护）到 store.listMessages |
| mcp.json 明文密钥/公网 IP、global_state.txt、.dev-log.json、.gstack 残留 | 均已清理（commit acf4109 + 0e8c592） |

## 五、遗留与路线

- **外部阻塞**：Tavily/Exa key 均 402 credits 用尽——端到端搜索复验需充值/换 key（`.env.local` 换 key 即可，代码不用动）
- **UI 债**：dev-dashboard 硬编码文件树字符串仍列已删文件（page.tsx:191-209）；im.png 顶部 swap_vert 芯片裁切；font-weight 未强制 regular/medium 两档（契约可补 B7）
- **路线**：③ im-lab 双入口收敛（V1/V2 按视图分流已部分达成，DEV_LOG 阶段八设计待全量落地）④ 学术语料 API 接入（Semantic Scholar 类源是检索质量上限，最大风险项）⑤ Canvas 与主对话的状态打通
- 验收方法论：任何新开发先写 `.dev/acceptance-*.md` 契约（可证伪检查项）+ check 脚本（出数字），implementer 实现、validator 独立验收
