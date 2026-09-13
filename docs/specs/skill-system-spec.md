# Skill 系统规格文档

## 概述

Swarm-IDE 的 Skill 系统为 Agent 提供结构化的专业知识与指导原则。每个 Skill 是一个独立的能力模块，可按需注入到 Agent 的上下文中。

---

## Skill 结构

每个 Skill 文件位于 `backend/skills/[category]/[skill-name]/SKILL.md`，采用以下格式：

```markdown
---
name: [skill-name]
description: [一句话描述技能用途]
auto-load: [true/false]  # 是否自动注入到新 Agent
category: [coding|pm|system|domain|other]
tags: [tag1, tag2]
version: 1.0.0
---

# Skill 标题

## How to Help
[简短描述这个 Skill 如何帮助用户]

## Core Principles
[核心原则，带专家引言]

## Questions to Help Users
[帮助用户时的典型问题]

## Common Mistakes to Flag
[常见错误及如何避免]

## Deep Dive
[深入的技术细节或流程说明]

## Related Skills
[关联的其他 Skills]
```

---

## 目录结构

```
backend/skills/
├── coding/
│   ├── code-review/
│   │   └── SKILL.md
│   ├── refactor/
│   │   └── SKILL.md
│   └── testing/
│       └── SKILL.md
├── pm/
│   ├── product-vision/
│   │   └── SKILL.md
│   ├── prioritization/
│   │   └── SKILL.md
│   └── user-research/
│       └── SKILL.md
├── system/
│   ├── topology/          # 已存在
│   │   └── SKILL.md
│   ├── agent-loop/
│   │   └── SKILL.md
│   └── communication/
│       └── SKILL.md
└── domain/
    └── [专业领域]/
        └── SKILL.md
```

---

## Frontmatter 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | 是 | Skill 唯一标识符 |
| `description` | string | 是 | 一句话描述，用于 Agent 理解何时使用 |
| `auto-load` | boolean | 否 | 默认为 false，新 Agent 不会自动加载 |
| `category` | string | 否 | 分类：coding/pm/system/domain/other |
| `tags` | string[] | 否 | 标签，用于搜索和过滤 |
| `version` | string | 否 | 版本号，格式：x.y.z |

---

## Skill 生命周期

### 1. 创建（Create）
- 在对应目录下创建 `SKILL.md`
- 编写完整的 Skill 内容
- 添加 frontmatter 元数据

### 2. 加载（Load）
```
Agent 初始化时扫描 skills/ 目录
    │
    ▼
读取所有 SKILL.md 的 frontmatter
    │
    ▼
根据 auto-load 决定是否注入
    │
    ▼
Agent 可通过 get_skill 获取完整内容
```

### 3. 使用（Use）
- Agent 在需要时调用 `get_skill(skill_name)`
- 系统返回 Skill 完整内容
- Skill 内容作为上下文传递给 LLM

### 4. 更新（Update）
- 修改 `SKILL.md` 文件
- Agent 在下次初始化时获取新版本
- 支持版本控制（未来特性）

---

## 自动加载机制

### 条件
- `auto-load: true` 在 frontmatter 中设置
- 文件位于默认扫描路径或 `AGENT_SKILLS_DIR` 指定路径

### 行为
- 新 Agent 创建时，自动注入该 Skill 到系统提示
- Agent 可以立即使用该 Skill 提供的知识
- 不需要手动调用 `get_skill`

### 示例
```markdown
---
name: topology
description: Explain the IM+Agent framework: create+send as minimal primitives...
auto-load: true
---
```

---

## get_skill 工具

### 工具定义
```typescript
interface GetSkillParams {
  skill_name: string;  // Skill 名称（非路径）
}

// 返回：Skill 的完整 markdown 内容
```

### 使用方式
```
用户/Agent: "我需要了解怎么创建多层级 Agent"
系统: 调用 get_skill("topology")
返回: topology Skill 的完整内容
```

---

## Skill 分类指南

### coding/ - 编程相关
- 代码审查、重构、测试
- 特定语言最佳实践
- 代码质量标准

### pm/ - 产品管理相关
- 产品愿景与策略
- 需求优先级
- 用户研究方法

### system/ - Swarm-IDE 系统相关
- 框架哲学
- Agent 协作模式
- 通信机制

### domain/ - 专业领域
- 特定行业知识
- 垂直领域专长

---

## Skill 编写最佳实践

### 描述清晰
- 第一行应该是完整的句子，描述 Skill 做什么
- 避免过度简洁或技术术语堆砌

### 结构完整
- 包含所有标准章节
- 每个章节有实质内容

### 实用导向
- 提供具体的指导，不是抽象理论
- 包含示例和常见场景

### 适度长度
- 核心内容：500-1500 字
- 过于冗长会稀释重点
- 深入内容放在 Deep Dive 章节

---

## Skill 模板

```markdown
---
name: [skill-name]
description: [一句话描述这个 Skill 如何帮助用户]
auto-load: false
category: [category]
tags: [tag1, tag2]
version: 1.0.0
---

# [Skill 标题]

## How to Help

[1-2 段：描述这个 Skill 的核心用途和使用场景]

## Core Principles

### Principle 1: [原则名称]
[简短描述]

> "专家引言或经典论述" — [来源]

### Principle 2: [原则名称]
[简短描述]

## Questions to Help Users

在帮助用户时，考虑问以下问题：

1. [问题 1]
2. [问题 2]
3. [问题 3]

## Common Mistakes to Flag

### Mistake 1: [错误名称]
**问题**：[描述问题]
**正确做法**：[如何避免或纠正]

### Mistake 2: [错误名称]
**问题**：[描述问题]
**正确做法**：[如何避免或纠正]

## Deep Dive

[可选：深入的技术细节、实现说明、最佳实践]

## Related Skills

- [关联 Skill 1](/skills/[path1])
- [关联 Skill 2](/skills/[path2])
```

---

## 未来增强（Roadmap）

### v2.0
- Skill 版本控制和更新检测
- Skill 依赖管理
- Skill 评分和评价系统

### v3.0
- Skill 市场/社区分享
- Skill 自动生成（基于成功案例）
- Skill 性能分析

---

## 迁移指南

对于现有的非结构化 Skill，需要：

1. 添加 frontmatter 元数据
2. 按模板结构重组内容
3. 确保 description 清晰准确
4. 测试 `auto-load` 行为
