---
name: topology
description: Swarm-IDE 核心框架：当用户需要创建多 Agent 协作、分解任务、构建液态拓扑时调用。讲解 create+send 极简原语、IM 系统与 Agent Loop 分离、递归生成属性。
auto-load: true
category: system
tags: [framework, multi-agent, collaboration, topology]
version: 1.1.0
---

# Swarm-IDE 框架：极简原语生成一切拓扑

## How to Help

这个 Skill 帮助用户理解和使用 Swarm-IDE 的核心协作框架。当你需要：

- 创建多 Agent 工作组
- 设计复杂的任务分解方案
- 理解 Agent 之间的消息流转
- 处理多层级嵌套的协作结构

调用这个 Skill 获取框架指导。

## Core Principles

### Principle 1: 极简原语

> "任何复杂的系统都可以由极少数的简单原语组合而成。" — Alan Kay

Swarm-IDE 只需要两个原语：

- **create**：生成新节点（Agent）
- **send**：在节点之间传递消息

**一切协作拓扑都由 create + send 组合而来。**

`create_group` / `send_group_message` 只是"多播容器"的便利工具，不改变最小原语的本质。

### Principle 2: IM 系统与 Agent Loop 分离

> "关注点分离是复杂系统设计的基石。"

两套系统相互独立：

- **IM 系统**：管理 `group` 与 `message`，只关心"谁发给谁"
- **Agent Loop**：管理 `llmHistory`、调用 LLM、执行工具、生成回应

唯一的桥接点：
- Agent 从 IM 系统**拉取未读消息**作为本轮 LLM 输入
- 只有显式 `send_*` 才会在 IM 系统**产生消息**

### Principle 3: 递归生成

> "道生一，一生二，二生三，三生万物。" — 老子

任何 Agent 都可以 `create` 新 Agent，并 `send` 给任意节点/群。新 Agent 运行**同一套 loop 逻辑**，再继续 `create` 与 `send`。

拓扑因此是**递归生成的**：没有中心控制器，只有不断扩展的节点网络。

## Questions to Help Users

在帮助用户设计协作拓扑时，问以下问题：

1. **任务分解**：这个复杂任务可以分成哪几个独立子任务？
2. **角色定义**：每个子任务需要什么专业能力的 Agent？
3. **通信模式**：Agent 之间需要如何共享信息？是一对一还是群聊？
4. **层级结构**：是否需要嵌套层级？还是扁平协作就够？
5. **人类介入**：用户需要在哪个层级保持介入能力？

## Common Mistakes to Flag

### Mistake 1: 假设 LLM 输出会自动传播

**问题**：认为 LLM 产生的内容会自动让其他人看到
**正确做法**：只有显式 `send_direct_message` / `send_group_message` 才会真正让他人"收到"

### Mistake 2: 混淆 llmHistory 与 messages

**问题**：`llmHistory` 是 Agent 内部记忆，不等于可见消息
**正确做法**：想让信息被他人看到，必须 send

### Mistake 3: 过度预设拓扑

**问题**：在开始前设计复杂的静态拓扑结构
**正确做法**：让拓扑根据任务需求**动态演化**，Agent 按需创建子节点

### Mistake 4: 忽视状态同步

**问题**：多个 Agent 并行工作，但没有共享状态，导致重复或冲突
**正确做法**：使用共享状态文件，每个 Agent 在阶段性推进时更新状态

## Deep Dive

### Agent Loop 的运作原理（内部视角）

每个 Agent 都重复相同循环：

```
1. 拉取在各 group 的未读消息
2. 将消息拼成 user content，追加到 llmHistory
3. 调用 LLM（可多轮工具调用）
4. 工具结果写回 llmHistory
5. 最终 assistant 输出写回 llmHistory
6. 需要对外可见时，再显式 send_*
```

### 消息与可见性规则

| 操作 | 影响范围 |
|------|----------|
| LLM 生成内容 | 仅更新自身 llmHistory |
| `send_direct_message` | 发送给特定 Agent |
| `send_group_message` | 发送给群组所有成员 |

**协作关键**：谁需要知道，就必须 send。

### 双角色思维

每个 Agent 同时有两个角色：

**作为 Parent**：
- 思考任务如何分解
- 委派 child Agent
- 发送初始指令和全局状态文件位置

**作为 Child**：
- 明确自己的任务边界
- 理解在团队中的位置
- 决定需要给谁发送结果

### 状态文件维护（防止发散）

所有参与的 Agent 都应**共同维护**一套轻量状态文件：

```markdown
# 全局状态文件

## Agent-001 (Orchestrator)
- 状态: 进行中
- 当前任务: 协调研究组
- 进展: 汇总各 Agent 报告
- 更新: 2026-03-19 10:30

## Agent-002 (Researcher)
- 状态: 完成
- 当前任务: 市场分析
- 进展: 报告已生成
- 更新: 2026-03-19 10:25
```

更新频率：阶段性推进或任务完成时写一次即可。

## 典型协作模式

### 模式 1: 主从协调

```
用户 → Orchestrator → 创建 Research Agent
                    → 创建 Dev Agent
                    → 创建 QA Agent
        ↓
   各 Agent 向 Orchestrator 汇报
        ↓
   Orchestrator 汇总结果返回用户
```

### 模式 2: 群聊协作

```
用户 → 创建群组 "研究组"
     → 添加 Agent-A, Agent-B, Agent-C
     → 发送任务消息

群组内: Agent 们自由讨论、分配任务、协作完成
```

### 模式 3: 递归树

```
用户 → Orchestrator
     → 创建 Manager-A (负责前端)
     → 创建 Manager-B (负责后端)
           ↓
     Manager-A → 创建 Frontend-1, Frontend-2
     Manager-B → 创建 Backend-1, Backend-2
           ↓
     各子 Agent 完成任务后逐级向上汇报
```

## Related Skills

- [agent-loop](/skills/system/agent-loop) - Agent 内部的 LLM 调用循环详解
- [communication](/skills/system/communication) - 消息传递的高级模式
- [testing](/skills/coding/testing) - 如何测试多 Agent 协作
