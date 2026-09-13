/**
 * Internationalization (i18n) module for Swarm-IDE
 * Supports English and Chinese languages
 */

export type Language = "en" | "zh";

export interface Translations {
  // Common
  language: string;
  selectLanguage: string;

  // Home page
  agentWechat: string;
  mvpUI: string;
  databaseNotReady: string;
  tryTheseSteps: string;
  step1: string;
  step2: string;
  step3: string;
  refresh: string;
  openIM: string;
  openGraph: string;
  createWorkspace: string;
  workspaceName: string;
  workspaceNamePlaceholder: string;
  create: string;
  admin: string;
  resetDbAndRedis: string;
  resetting: string;
  workspaces: string;
  workspacesTip: string;
  recent: string;
  noWorkspaces: string;
  noWorkspacesTip: string;

  // IM page
  newMessage: string;
  send: string;
  noMessagesYet: string;
  selectAgent: string;
  groups: string;
  noGroups: string;
  agents: string;
  noAgents: string;
  createAgent: string;
  agentRole: string;
  agentRolePlaceholder: string;
  createAgentButton: string;
  thinking: string;
  tools: string;
  toolResult: string;
  sending: string;
  connected: string;
  disconnected: string;
  reconnecting: string;

  // Graph page
  agentGraph: string;
  loadingGraph: string;
  noGraphData: string;

  // Errors
  error: string;
  networkError: string;
  unknownError: string;

  // Status
  idle: string;
  busy: string;
  waking: string;

  // Confirmations
  resetConfirmTitle: string;
  resetConfirmMessage: string;
  yes: string;
  no: string;

  // Additional UI
  workspace: string;
  stopAllAgents: string;
  stoppingAgents: string;
  settings: string;
  loading: string;

  // IM panels
  llmHistory: string;
  realtimeContent: string;
  realtimeReasoning: string;
  realtimeTools: string;
  collapse: string;
  expand: string;
  stopAll: string;

  // IM group labels
  group: string;
  p2pHumanAssistant: string;
  groupWithCount: string;

  // IM composer
  messagePlaceholder: string;
  agentDetails: string;
  streamingFrom: string;

  // Settings modal
  llmProviderSettings: string;
  failedToSaveSettings: string;
  subAgentRole: string;
  cancel: string;
  saveChanges: string;
  provider: string;
  apiKey: string;
  model: string;

  // Home page (extended)
  readyForOrchestration: string;
  concurrency: string;
  messages: string;
  realtime: string;
  enter: string;
  imCardDescription: string;
  graphCardDescription: string;

  // Theme toggle
  switchToLight: string;
  switchToDark: string;

  // Graph page (extended)
  edges: string;
  agentNodes: string;
  messageConnections: string;
  messagesWillAppearHere: string;
  recentActivity: string;
  connections: string;

  // IM navigation
  inbox: string;
  projects: string;
  sessions: string;
  docs: string;
  newSession: string;
  fleet: string;
  modules: string;
  terminal: string;
  logs: string;
  deploy: string;
  deployAgent: string;
  system: string;
  help: string;
  chat: string;
  canvas: string;
  searchAgents: string;
  agentNetwork: string;
  deployFirstAgent: string;
  agentCount: string;
  active: string;

  // Canvas
  quickChat: string;
  zoomIn: string;
  zoomOut: string;
  resetView: string;
  addNode: string;
  newAgentNode: string;
  canvasNodeOrchestrating: string;
  canvasNodeTelemetry: string;
  canvasNodeDocs: string;
  canvasNodeAnomaly: string;
  noMessages: string;
  sessionNotReady: string;
  sessionNotReadyDetail: string;
  sendFailed: string;
  waitingForReply: string;

  // Focus mode
  exitFocus: string;
  focusLeft: string;
  focusMiddle: string;
  focusRight: string;

  // IM runtime labels
  loadingGroups: string;
  loadingMessages: string;
  eventStream: string;
  noEvents: string;
  scrollZoomHint: string;
  reset: string;
  context: string;
  usageCreateRole: string;
  vizCreated: string;
  vizMessage: string;
  llmStart: string;
  llmEnd: string;
  toolStart: string;
  toolEnd: string;
  stopAllAgentsEvent: string;
  defaultWorkspaceName: string;
  newWorkspaceName: string;
  arkApiKeyPlaceholder: string;
  openRouterApiKeyPlaceholder: string;
  minimaxApiKeyPlaceholder: string;
}

const en: Translations = {
  // Common
  language: "Language",
  selectLanguage: "Select Language",

  // Home page
  agentWechat: "Agent Wechat",
  mvpUI: "Multi-Agent Orchestration Interface",
  databaseNotReady: "Database not ready",
  tryTheseSteps: "Try these steps:",
  step1: "Start database: cd backend && docker compose up -d",
  step2: "Initialize schema: curl -X POST http://localhost:3017/api/admin/init-db",
  step3: "Refresh the page",
  refresh: "Refresh",
  openIM: "Open IM",
  openGraph: "Open Graph",
  createWorkspace: "Create Workspace",
  workspaceName: "Workspace name",
  workspaceNamePlaceholder: "Enter workspace name",
  create: "Create",
  admin: "Admin",
  resetDbAndRedis: "Reset DB + Redis",
  resetting: "Resetting...",
  workspaces: "Workspaces",
  workspacesTip: "Click to open IM with the selected workspace.",
  recent: "Recent",
  noWorkspaces: "No workspaces yet",
  noWorkspacesTip: "Open IM to create one.",

  // IM page
  newMessage: "Type a message...",
  send: "Send",
  noMessagesYet: "No messages yet. Start the conversation!",
  selectAgent: "Select an agent to chat",
  groups: "Groups",
  noGroups: "No groups",
  agents: "Agents",
  noAgents: "No agents",
  createAgent: "Create Agent",
  agentRole: "Role",
  agentRolePlaceholder: "e.g. researcher, writer",
  createAgentButton: "Create",
  thinking: "Thinking...",
  tools: "Tools",
  toolResult: "Tool Result",
  sending: "Sending...",
  connected: "Connected",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting...",

  // Graph page
  agentGraph: "Agent Graph",
  loadingGraph: "Loading graph...",
  noGraphData: "No graph data available",

  // Errors
  error: "Error",
  networkError: "Network error",
  unknownError: "Unknown error",

  // Status
  idle: "Idle",
  busy: "Busy",
  waking: "Waking",

  // Confirmations
  resetConfirmTitle: "Reset Confirmation",
  resetConfirmMessage: "This will DELETE all data in Postgres and Redis, then re-initialize the schema. Continue?",
  yes: "Yes",
  no: "No",

  // Additional UI
  workspace: "Workspace",
  stopAllAgents: "Stop All",
  stoppingAgents: "Stopping...",
  settings: "Settings",
  loading: "Loading...",

  // IM panels
  llmHistory: "LLM History",
  realtimeContent: "Realtime Content",
  realtimeReasoning: "Realtime Reasoning",
  realtimeTools: "Realtime Tools",
  collapse: "Collapse",
  expand: "Expand",
  stopAll: "Stop All",

  // IM group labels
  group: "Group",
  p2pHumanAssistant: "P2P Human ↔ Assistant",
  groupWithCount: "Group (%d)",

  // IM composer
  messagePlaceholder: "Type a message… (Ctrl/Cmd+Enter to send)",
  agentDetails: "Agent Details",
  streamingFrom: "Streaming from:",

  // Settings modal
  llmProviderSettings: "LLM Provider Settings",
  failedToSaveSettings: "Failed to save settings",
  subAgentRole: "Sub-agent role",
  cancel: "Cancel",
  saveChanges: "Save Changes",
  provider: "Provider",
  apiKey: "API Key",
  model: "Model",

  // Home page (extended)
  readyForOrchestration: "Ready for orchestration",
  concurrency: "Concurrency",
  messages: "Messages",
  realtime: "Realtime",
  enter: "Enter",
  imCardDescription: "Collaborate with multiple AI agents in real time, with streaming output and tool calls.",
  graphCardDescription: "Visualize agent collaboration and message flows.",

  // Theme toggle
  switchToLight: "Switch to light mode",
  switchToDark: "Switch to dark mode",

  // Graph page (extended)
  edges: "Edges",
  agentNodes: "Agent Nodes",
  messageConnections: "Message Connections",
  messagesWillAppearHere: "Messages between agents will appear here",
  recentActivity: "Recent Activity",
  connections: "connections",

  // IM navigation
  inbox: "Inbox",
  projects: "Projects",
  sessions: "Sessions",
  docs: "Docs",
  newSession: "New Session",
  fleet: "Fleet",
  modules: "Modules",
  terminal: "Terminal",
  logs: "Logs",
  deploy: "Deploy",
  deployAgent: "Deploy Agent",
  system: "System",
  help: "Help",
  chat: "Chat",
  canvas: "Canvas",
  searchAgents: "Search agents...",
  agentNetwork: "Agent Network",
  deployFirstAgent: "Deploy your first agent",
  agentCount: "agents",
  active: "active",

  // Canvas
  quickChat: "Quick Chat",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  resetView: "Reset View",
  addNode: "Add Node",
  newAgentNode: "New agent node",
  canvasNodeOrchestrating: "Orchestrating agent workflows and token distribution.",
  canvasNodeTelemetry: "Real-time telemetry and error pattern matching.",
  canvasNodeDocs: "Syncing with latest v1.0.4 docs.",
  canvasNodeAnomaly: "Anomaly detected in session 0x44F.",
  noMessages: "No messages",
  sessionNotReady: "Session not ready",
  sessionNotReadyDetail: "Session not ready: missing groupId or senderId",
  sendFailed: "Send failed:",
  waitingForReply: "Waiting for reply...",

  // Focus mode
  exitFocus: "Exit Focus",
  focusLeft: "Left",
  focusMiddle: "Center",
  focusRight: "Right",

  // IM runtime labels
  loadingGroups: "Loading groups...",
  loadingMessages: "Loading messages...",
  eventStream: "Event Stream",
  noEvents: "No events",
  scrollZoomHint: "⌘ Scroll to zoom",
  reset: "Reset",
  context: "Context",
  usageCreateRole: "Usage: /create <role>",
  vizCreated: "Created",
  vizMessage: "Message",
  llmStart: "LLM started",
  llmEnd: "LLM finished",
  toolStart: "Tool started",
  toolEnd: "Tool finished",
  stopAllAgentsEvent: "Stop All Agents",
  defaultWorkspaceName: "Default Workspace",
  newWorkspaceName: "New Workspace",
  arkApiKeyPlaceholder: "Ark API Key",
  openRouterApiKeyPlaceholder: "OpenRouter API Key",
  minimaxApiKeyPlaceholder: "MiniMax API Key",
};

const zh: Translations = {
  // Common
  language: "语言",
  selectLanguage: "选择语言",

  // Home page
  agentWechat: "智能体对话",
  mvpUI: "多智能体编排界面",
  databaseNotReady: "数据库未就绪",
  tryTheseSteps: "请尝试以下步骤：",
  step1: "启动数据库：cd backend && docker compose up -d",
  step2: "初始化数据库：curl -X POST http://localhost:3017/api/admin/init-db",
  step3: "刷新页面",
  refresh: "刷新",
  openIM: "打开消息",
  openGraph: "打开图谱",
  createWorkspace: "创建工作空间",
  workspaceName: "工作空间名称",
  workspaceNamePlaceholder: "输入工作空间名称",
  create: "创建",
  admin: "管理",
  resetDbAndRedis: "重置数据库",
  resetting: "重置中...",
  workspaces: "工作空间",
  workspacesTip: "点击打开对应工作空间的对话界面",
  recent: "最近",
  noWorkspaces: "暂无工作空间",
  noWorkspacesTip: "打开消息界面即可创建",

  // IM page
  newMessage: "输入消息...",
  send: "发送",
  noMessagesYet: "暂无消息，开始对话吧！",
  selectAgent: "选择智能体对话",
  groups: "群组",
  noGroups: "暂无群组",
  agents: "智能体",
  noAgents: "暂无智能体",
  createAgent: "创建智能体",
  agentRole: "角色",
  agentRolePlaceholder: "如：研究员、写作助手",
  createAgentButton: "创建",
  thinking: "思考中...",
  tools: "工具",
  toolResult: "工具结果",
  sending: "发送中...",
  connected: "已连接",
  disconnected: "已断开",
  reconnecting: "重连中...",

  // Graph page
  agentGraph: "智能体图谱",
  loadingGraph: "加载图谱中...",
  noGraphData: "暂无图谱数据",

  // Errors
  error: "错误",
  networkError: "网络错误",
  unknownError: "未知错误",

  // Status
  idle: "空闲",
  busy: "忙碌",
  waking: "唤醒中",

  // Confirmations
  resetConfirmTitle: "确认重置",
  resetConfirmMessage: "这将删除 Postgres 和 Redis 中的所有数据，然后重新初始化数据库架构。确定要继续吗？",
  yes: "是",
  no: "否",

  // Additional UI
  workspace: "工作空间",
  stopAllAgents: "停止全部",
  stoppingAgents: "停止中...",
  settings: "设置",
  loading: "加载中...",

  // IM panels
  llmHistory: "LLM 历史",
  realtimeContent: "实时内容",
  realtimeReasoning: "实时推理",
  realtimeTools: "实时工具",
  collapse: "收起",
  expand: "展开",
  stopAll: "停止全部",

  // IM group labels
  group: "群组",
  p2pHumanAssistant: "P2P 人类↔助手",
  groupWithCount: "群组 (%d)",

  // IM composer
  messagePlaceholder: "输入消息... (Ctrl/Cmd+Enter 发送)",
  agentDetails: "智能体详情",
  streamingFrom: "正在接收:",

  // Settings modal
  llmProviderSettings: "LLM 提供商设置",
  failedToSaveSettings: "保存设置失败",
  subAgentRole: "子智能体角色",
  cancel: "取消",
  saveChanges: "保存更改",
  provider: "提供商",
  apiKey: "API 密钥",
  model: "模型",

  // Home page (extended)
  readyForOrchestration: "编排就绪",
  concurrency: "并发",
  messages: "消息",
  realtime: "实时",
  enter: "进入",
  imCardDescription: "与多个 AI 智能体实时协作，支持流式输出与工具调用",
  graphCardDescription: "可视化智能体之间的协作关系与消息流向",

  // Theme toggle
  switchToLight: "切换到浅色模式",
  switchToDark: "切换到暗色模式",

  // Graph page (extended)
  edges: "边数",
  agentNodes: "智能体节点",
  messageConnections: "消息连接",
  messagesWillAppearHere: "智能体之间的消息将显示在这里",
  recentActivity: "最近活动",
  connections: "条连接",

  // IM navigation
  inbox: "收件箱",
  projects: "项目",
  sessions: "会话",
  docs: "文档",
  newSession: "新建会话",
  fleet: "集群",
  modules: "模块",
  terminal: "终端",
  logs: "日志",
  deploy: "部署",
  deployAgent: "部署智能体",
  system: "系统",
  help: "帮助",
  chat: "对话",
  canvas: "画布",
  searchAgents: "搜索智能体...",
  agentNetwork: "智能体网络",
  deployFirstAgent: "部署第一个智能体",
  agentCount: "个智能体",
  active: "活跃",

  // Canvas
  quickChat: "快捷对话",
  zoomIn: "放大",
  zoomOut: "缩小",
  resetView: "重置视图",
  addNode: "添加节点",
  newAgentNode: "新建智能体节点",
  canvasNodeOrchestrating: "编排智能体工作流与令牌分配。",
  canvasNodeTelemetry: "实时遥测与错误模式匹配。",
  canvasNodeDocs: "正在同步最新的 v1.0.4 文档。",
  canvasNodeAnomaly: "检测到会话 0x44F 异常。",
  noMessages: "暂无消息",
  sessionNotReady: "会话未就绪",
  sessionNotReadyDetail: "会话未就绪：缺少 groupId 或 senderId",
  sendFailed: "发送失败:",
  waitingForReply: "等待回复...",

  // Focus mode
  exitFocus: "退出专注",
  focusLeft: "左侧",
  focusMiddle: "中间",
  focusRight: "右侧",

  // IM runtime labels
  loadingGroups: "加载群组中...",
  loadingMessages: "加载消息中...",
  eventStream: "事件流",
  noEvents: "暂无事件",
  scrollZoomHint: "⌘ 滚轮缩放",
  reset: "重置",
  context: "上下文",
  usageCreateRole: "用法：/create <角色>",
  vizCreated: "创建",
  vizMessage: "消息",
  llmStart: "LLM 开始",
  llmEnd: "LLM 结束",
  toolStart: "工具开始",
  toolEnd: "工具结束",
  stopAllAgentsEvent: "停止全部 Agent",
  defaultWorkspaceName: "默认工作空间",
  newWorkspaceName: "新建工作空间",
  arkApiKeyPlaceholder: "Ark API 密钥",
  openRouterApiKeyPlaceholder: "OpenRouter API 密钥",
  minimaxApiKeyPlaceholder: "MiniMax API 密钥",
};

export const translations: Record<Language, Translations> = { en, zh };

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations.en;
}
