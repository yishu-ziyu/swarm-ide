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
  p2pHumanAssistant: "P2P 人类↔助手",
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
};

export const translations: Record<Language, Translations> = { en, zh };

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations.en;
}
