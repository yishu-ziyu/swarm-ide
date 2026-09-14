---
name: research
description: 学术研究 Agent - 当用户需要进行深度研究、搜索学术论文、收集参考资料时调用。支持神经搜索、内容提取、引用追踪、多步研究循环。
auto-load: true
category: research
tags: [research, academic, search, citations, neural-search]
version: 1.0.0
---

# 学术研究 Agent

## How to Help

这个 Skill 帮助用户进行深度学术研究。当你需要：

- 搜索学术论文和研究资料
- 收集和组织研究参考文献
- 生成带引用的研究报告
- 验证信息准确性和来源可靠性
- 进行多轮研究迭代

调用这个 Skill 获取研究流程指导。

## Core Research Workflow

### 研究循环（Research Loop）

学术研究采用迭代式研究循环：

```
1. 主题定义 (Topic Definition)
   - 明确研究问题
   - 确定研究范围和边界

2. 搜索 (Search)
   - 使用 Tavily 进行网络搜索
   - 使用 Exa 进行学术论文搜索
   - 收集相关来源

3. 筛选 (Filtering)
   - 评估来源可靠性
   - 过滤不相关结果
   - 按相关性排序

4. 分析 (Analysis)
   - 提取关键信息
   - 识别主要观点
   - 标记重要引用

5. 合成 (Synthesis)
   - 整合多来源信息
   - 生成结构化报告
   - 添加行内引用
```

### 搜索策略

#### Tavily 搜索（网络资源）

```
搜索维度：
- 新闻和最新报道
- 技术博客和教程
- 行业分析报告
- 百科知识

最佳实践：
- 使用精确关键词
- 限定时间范围（近1年/近3年）
- 添加 site:xxx 限定来源
```

#### Exa 搜索（学术论文）

```
搜索类型：
- 论文搜索 (paper)
- 文章搜索 (article)
- 全文搜索 (fulltext)

过滤参数：
- 学术来源优先 (high_quality)
- 同行评审论文 (peer_reviewed)
- 最新发表 (from_date)

返回字段：
- title, url, published_date
- authors, journal, abstract
- highlights, scores
```

### 引用格式规范 (APA 7th Edition)

#### 文内引用

| 类型 | 格式 | 示例 |
|------|------|------|
| 单作者 | (姓, 年份) | (Smith, 2023) |
| 双作者 | (姓 & 姓, 年份) | (Smith & Jones, 2023) |
| 三作者及以上 | (姓等, 年份) | (Smith et al., 2023) |
| 直接引用 | (姓, 年份, p.页码) | (Smith, 2023, p.45) |

#### 参考文献格式

```
期刊文章：
姓, 名首字母. (年份). 文章标题. 期刊名, 卷(期), 页码. DOI

示例：
Smith, J. A. (2023). Machine learning in healthcare. Journal of AI Research, 45(2), 123-145. https://doi.org/10.1234/jair.2023.001

网络资源：
姓, 名首字母. (年份, 月 日). 标题. 网站名. URL

示例：
Johnson, M. (2023, March 15). The future of AI. Tech Insights. https://example.com/article
```

### 研究报告结构

```
# [研究主题]

## 摘要 (Abstract)
简要概述研究目的、方法和主要发现。

## 1. 研究背景
介绍研究主题的重要性和相关背景。

## 2. 核心发现
### 2.1 [子主题1]
### 2.2 [子主题2]
### 2.3 [子主题3]

## 3. 来源分析
列出主要信息来源及其可靠性评估。

## 4. 结论与展望
总结研究发现，指出未来研究方向。

## 参考文献
按 APA 格式列出所有引用的来源。
```

## 工具使用指南

研究模式只使用运行时已注册的工具，不要调用未提供的 Exa / tavily-extract / Chrome。

```
search_papers
- 查论文（Semantic Scholar → Crossref → arXiv）
- 返回 authors, year, excerpt, url, evidenceId

web_search
- 只用于新闻和普通网页，不要用来查论文

fetch_source
- 抓取某个 http(s) URL 的正文，写入证据

record_claim
- 登记结论，必须带 evidenceIds，否则是 unverified

list_research_board / review_claim / align_claim_evidence / advance_research_phase
- 隔离检索 → 对质 → 引文对齐 → 放行终稿

save_research_note
- 把 markdown 写进本工作区 research-output/

export_report
- 从当前结论和论文生成报告 markdown
```

## 质量检查清单

在完成研究前，检查以下各项：

- [ ] 至少包含 5 个不同的权威来源
- [ ] 所有引用都标注了来源
- [ ] 事实性声明有数据支撑
- [ ] 区分了事实和观点
- [ ] 检查了信息的时效性
- [ ] 识别了可能的偏见来源
- [ ] 报告结构完整（摘要、正文、参考文献）

## 常见研究任务模板

### 模板1: 快速概览
```
目标：5分钟内获取主题基本了解
步骤：
1. Tavily 搜索 "主题 + 最新"
2. 提取前3个高评分结果摘要
3. 生成简短总结
```

### 模板2: 深度研究
```
目标：2-4小时完成全面研究
步骤：
1. 定义研究问题和子主题
2. Exa 搜索学术论文（10+篇）
3. Tavily 搜索补充网络资源
4. 筛选和整理来源
5. 分主题撰写报告
6. 添加引用和参考文献
```

### 模板3: 热点追踪
```
目标：了解某主题最新发展
步骤：
1. Tavily 搜索近3个月相关内容
2. 按时间线组织发现
3. 识别关键趋势
4. 标注信息来源
```

## Related Skills

- [academic](/skills/academic) - 学术写作和论文格式
- [topology](/skills/topology) - 多 Agent 协作框架
