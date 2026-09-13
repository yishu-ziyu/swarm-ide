# Swarm-IDE 独立二开与适配日志 (Developer Log)

**日期**: 2026-03-13 (以此阶段开发为准)
**目标**: 移除/适配原本的仅 Linux 运行强依赖，实现完全原生的 macOS 支持；同时为前端增加"Coding Pane"或"设置面板(Settings)"，允许用户通过 UI 即可动态输入大模型 API Key（而不需要再去改原本硬编码或 `.env` 环境变量中的配置），从而达成开箱即用的闭环测试。

---

## 阶段一：macOS 原生适配分析与实践
- **代码库排查**：对项目的系统依赖进行了全局排查。确认 Swarm-IDE 核心依赖主要是 Node.js/Bun 运行时环境、Next.js 框架以及 Docker (Redis、PostgreSQL 数据库)，并不存在只绑定在 Linux 系统底层的强行要求（原作者声明 Linux 环境主要因为他们优先使用了 Codespaces 虚拟机）。
- **文档更新**：更新了 `README.md` 与 `README_EN.md`，去除了"必须或者推荐使用 Linux"的硬性字眼，注明了系统原生支持 macOS 和 Linux。

## 阶段二：配置持久化与后端拦截
要实现前端界面动态录入大模型的 API，必须使得配置既能落盘（防止重启丢失），又能动态读取并覆盖旧的 `.env` 环境变量机制。

- **动态配置存储 (`src/lib/config.ts`)**：
  扩展了内部的 `AppConfig` 接口，新加入了 `llmProvider`，`glmApiKey`，`glmModel`，`openRouterApiKey`，`openRouterModel` 等字段。在此编写了对应的 `setConfig` 方法，将会更新合并前端传入的数据并持久化写入到 `backend/config/app.json` 中。
- **开放配置 API (`app/api/config/route.ts`)**：
  在该路由增加了一个 `POST` handler。此接口允许前端以 JSON 的形式推送新的配置，后端接收后调用 `setConfig` 把用户通过 UI 修改的大模型 Key 落盘保存。

## 阶段三：Agent 运行时逻辑的 Fallback 机制修改
Swarm 蜂群在生成思考以及流式输出时调用了大量底层运行时方法和接口。原本由于只支持写死的环境变量，在改用动态配置后需要替换这里的取值逻辑。
- **流式输出接口 (`app/api/glm/stream/route.ts`)**：
  将原来单纯读取 `process.env[key]` 的逻辑，替换为了优先调用 `getConfig()`。系统现在的加载顺序为：先读取 `app.json` 中的 UI 设置值，若为空，则 Fallback（回退）至读取 `.env.local`。
- **Agent Server Runtime (`src/runtime/agent-runtime.ts`)**：
  同样，确保 Agent 在进行后台工具调用、规划链请求时，获取大模型提供商的方法 `getLlmProvider()` 以及各个具体模型的 Config 拼装函数，全部都切换到优先取 `getConfig()` 动态配置的新逻辑。

## 阶段四：前端 UI 配置面板搭建
完成了环境和后端的改造，我们需要为前端接入数据下发入口（即用户提到的 Coding pane 配置项）。
- **组件引入 (`app/im/page.tsx`)**：
  在 IM 聊天主面板的主 Header（头部）工具栏里右侧，添加了一个齿轮图标（Settings）。
- **弹窗交互 (Settings Modal)**：
  点击设置图标后，会蒙版唤出一个简易美观的配置表单（暗色调符合 IDE 风格）。用户可以利用下拉框在 `GLM (Zhipu)` 和 `OpenRouter` 提供商中进行切换。并且可以录入各自对应的 API Key 与模型名称。
- **网络层联调**：
  在 `page` 挂载 `useEffect` 时向服务器请求 GET `/api/config` 填充默认数据；配置点选"Save Changes"后，执行 POST 请求，把当前的设定回传持久化。设置立即生效且不强制刷新节点。

## 阶段五：运行排坑与测试
在进行 MacOS 实际测试阶段时排查解决了以下几项系统阻塞问题：
1. **Node 依赖类型报错**：使用了 `npm i -D @types/node` 并通过 `--cache /tmp/empty-npm-cache` 绕过了受污染缓存带来的 `EPERM` 权限报错，打通了 TypeScript 对 `process` 变量等类型检查。
2. **Mac Keychain Docker Error解决**：发现了 macOS 常见的 Docker 凭据登录报错 `error getting credentials - err: exit status 1, out: Keychain Error. (-67674)`。通过清理并移除 `~/.docker/config.json` 内多余的 `credsStore: desktop` 字段完成了该异常拦截，使得后端的 `docker compose up -d` 得以顺利拉起 Redis 与 Postgres 镜像。
3. **数据库连接缺失**：发现项目需要 `.env.local` 文件配置 `DATABASE_URL` 环境变量。创建了该文件并配置了 PostgreSQL 和 Redis 连接字符串，解决了"Database not ready"错误。
4. **闭环测试**：验证了配置落盘机制，以及前后台数据流通。

---

## 阶段六：性能分析与优化建议 (2026-03-13)

### 当前性能瓶颈分析

通过日志分析和代码审查，发现以下潜在性能瓶颈：

#### 1. MCP 工具加载耗时
```
[00:07:57.091] Server  INFO    [mcp] loading with timeout 2000ms
[00:08:05.599] Server  INFO    [mcp] tavily tools: 4
[00:08:11.035] Server  INFO    [mcp] chrome-devtools tools: 29
[00:08:11.632] Server  INFO    [mcp] total tools loaded: 44
```
- MCP 工具首次加载耗时约 **14秒**
- 每次工具调用都有网络开销

#### 2. Agent 循环处理机制
- `processUntilIdle()` 使用 `while(true)` 持续轮询未读消息
- `runWithTools()` 最多进行 3 轮工具调用 (maxToolRounds = 3)
- 每个工具调用都是串行执行

#### 3. 数据库查询
- 每次消息处理都涉及多次数据库读写
- `listUnreadByGroup` 轮询机制可能产生不必要的数据库查询

#### 4. 前端 Hydration 警告
```
[00:19:01.505] Browser ERROR   In HTML, %s cannot be a descendant of <%s>.
button <button>
```
- 按钮嵌套导致的 Hydration 错误

### 优化建议

#### 短期优化 (立即可做)
1. **MCP 工具缓存**：将 MCP 工具列表缓存在内存中，避免每次请求重新加载
2. **轮询间隔调整**：将 `processUntilIdle()` 的轮询间隔从立即改为 100-500ms
3. **数据库连接池**：确认 PostgreSQL 连接池配置合理

#### 中期优化 (1-2周)
1. **WebSocket 替代轮询**：将消息处理改为 WebSocket 推送
2. **工具并行执行**：同一轮工具调用可并行执行（不相互依赖时）
3. **历史消息裁剪**：对过长的 LLM history 进行压缩或摘要

#### 长期优化 (架构层面)
1. **Redis 缓存层**：将热点数据（workspace、agent元数据）缓存到 Redis
2. **流式响应优化**：减少 SSE 事件的粒度，提升传输效率
3. **前端组件优化**：修复按钮嵌套问题，使用 React Server Components

---

至此，Swarm-IDE 目前已经成功拓展为跨平台的界面级配置项目，用户使用门槛得以大幅度平移和降低。

---

## 阶段七：二次开发基线整理 (2026-05-10)

### 目标

以 `/Users/mahaoxuan/Desktop/AI产品经理/swarm-ide_副本` 作为后续二次开发主目录，建立一个更适合持续迭代、便于排查问题、且尽量减少噪音文件干扰的开发基线。

### 本轮盘点结论

- **主目录选择**：确认以 `swarm-ide_副本` 作为二开主目录。原因是该目录已经额外具备 `Agent` 管理、`Tool` 抽象、`Permission` 权限、`Mailbox` 通信、`dev-dashboard` 开发面板等更完整的扩展基础设施。
- **迁移核对**：对 `research`、`academic`、`docs/specs`、`README` 等二开常用内容进行了逐项核对。当前这些文件在 `swarm-ide` 与 `swarm-ide_副本` 中内容一致，因此本轮**不需要重复迁移**，避免无效覆盖。
- **开发日志入口**：继续沿用仓库根目录 `DEV_LOG.md` 作为人工维护的开发日志主入口，不与运行时自动生成日志混用。

### 本轮整理动作

1. 将本次“二开基线整理”结论写入 `DEV_LOG.md`，确保后续可追踪。
2. 补充 `.gitignore`，忽略运行期自动生成的 agent 调试日志与 TypeScript 增量编译产物。
3. 清理当前已生成的临时 agent 日志文件，减少工作区噪音。

### 当前保留策略

- **保留**：`backend/app/im` 下的新 UI 试验文件、`docs/火山引擎CodingPlan_*` 文档、`backend/src/lib` 中的 Agent/Tool/Permission 架构层代码。
- **不迁移**：`swarm-ide` 中与 `_副本` 已同版的 `research` / `academic` / `docs/specs` 内容。
- **不删除**：任何可能是手工开发中的 UI 组件和业务文件，仅清理自动生成日志。

### 下一步建议

1. 对 `backend/app/im` 的 V2 组件进行归档或命名统一，减少正式入口与实验入口混杂。
2. 明确 `dev-dashboard` 与主 IM 页面之间的职责边界，避免重复调试入口。
3. 在完成基线整理后，再开始新的二开功能分支。

---

## 阶段八：IM 双入口与实验开关设计定稿 (2026-05-10)

### 目标

为二次开发建立更清晰的 IM 路由边界：

- `/im` 保持正式入口
- `/im-lab` 承载实验 UI
- 通过配置项控制实验入口是否开放

### 本轮决定

- 采用“双入口并存”方案，而不是直接用实验版本替换正式入口。
- 采用“可配置开关”方案，而不是仅靠隐藏链接或环境变量控制。
- 保持现有实验组件文件不删除，仅将其后续承接到 `im-lab` 路由下。

### 设计文档

- 已新增设计文档：`docs/superpowers/specs/2026-05-10-im-lab-dual-entry-design.md`
- 文档中明确了目标、非目标、配置结构、路由行为、组件边界、测试策略与验收标准。

### 说明

这一阶段先完成设计落盘与边界确认，待文档确认后再进入实现与重构阶段，避免在现有 IM 页面上继续叠加混合逻辑。
