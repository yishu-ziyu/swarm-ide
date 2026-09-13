# 火山引擎 Coding Plan 配置指南

## 1. 概述

火山引擎 Coding Plan 是字节跳动基于豆包大模型推出的 AI 编程辅助服务，提供代码生成、补全、解释等功能。本文档详细介绍如何在 swarm-ide 项目中配置和使用火山引擎 Coding Plan API。

## 2. 配置文件

项目中有两个配置文件需要修改以启用火山引擎 Coding Plan：

### 2.1 `.env.local` - 环境变量配置

位置：`/Users/mahaoxuan/Desktop/AI产品经理/swarm-ide_副本/backend/.env.local`

关键环境变量说明：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `LLM_PROVIDER` | LLM 提供商 | `ark` |
| `ARK_API_KEY` | 火山引擎 API Key | `your-api-key-here` |
| `ARK_BASE_URL` | API 端点 | `https://ark.cn-beijing.volces.com/api/coding/v3` |
| `ARK_MODEL` | 使用的模型名称 | `kimi-k2.5` |

### 2.2 `config/app.json` - 应用配置

位置：`/Users/mahaoxuan/Desktop/AI产品经理/swarm-ide_副本/backend/config/app.json`

关键配置项说明：

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| `tokenLimit` | 最大 token 限制 | `256000` |
| `llmProvider` | LLM 提供商 | `ark` |
| `arkApiKey` | API Key（需与 .env.local 一致） | `your-api-key-here` |
| `arkBaseUrl` | 完整 API 端点 URL | `https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions` |
| `arkModel` | 模型名称 | `kimi-k2.5` |

## 3. 完整配置示例

### `.env.local` 完整内容

```bash
# Backend
DATABASE_URL=postgres://postgres:postgres@localhost:5433/agent_wechat
REDIS_URL=redis://localhost:6379
LLM_PROVIDER=ark

# Ark / 火山引擎方舟 (OpenAI 兼容)
ARK_API_KEY=your-api-key-here
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3
ARK_MODEL=kimi-k2.5

# 性能优化配置
MCP_LOAD_TIMEOUT_MS=2000
AGENT_POLL_INTERVAL_MS=200

# Lenny PM Skills
AGENT_SKILLS_DIR=/Users/mahaoxuan/Desktop/AI产品经理/lenny-产品经理skills/skills
```

### `config/app.json` 完整内容

```json
{
  "tokenLimit": 256000,
  "llmProvider": "ark",
  "arkApiKey": "your-api-key-here",
  "arkBaseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
  "arkModel": "kimi-k2.5"
}
```

## 4. 支持的模型列表

基于 API 测试结果，以下模型已验证支持 Coding Plan 功能：

| 模型名称 | 状态 | 说明 |
|----------|------|------|
| `kimi-k2.5` | ✅ 已验证 | Kimi 最新编程模型 |
| `doubao-seed-2-0-pro` | ✅ 已验证 | 豆包 Seed 2.0 Pro 版本 |
| `doubao-seed-2-0-code-preview` | ✅ 已验证 | 豆包 Seed 2.0 代码预览版 |
| `doubao-seed-2-0-lite` | ✅ 已验证 | 豆包 Seed 2.0 轻量版 |
| `glm-4-7` | ✅ 已验证 | 智谱 GLM-4 第7代 |
| `deepseek-v3-2` | ✅ 已验证 | DeepSeek V3.2 |
| `minimax-m2.5` | ✅ 已验证 | MiniMax M2.5 |

## 5. API 测试方法

### 5.1 测试 API 连接

```bash
curl -X POST https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "kimi-k2.5",
    "messages": [
      {
        "role": "user",
        "content": "Hello, are you working?"
      }
    ],
    "max_tokens": 100
  }'
```

### 5.2 测试 Streaming 模式

```bash
curl -X POST https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "kimi-k2.5",
    "messages": [
      {
        "role": "user",
        "content": "Write a hello world function in Python"
      }
    ],
    "stream": true,
    "max_tokens": 500
  }'
```

### 5.3 测试特定模型

将上述命令中的 `model` 字段替换为以下任意模型名称：

```bash
# 测试 doubao-seed-2-0-pro
curl -X POST https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "doubao-seed-2-0-pro",
    "messages": [{"role": "user", "content": "Hi"}],
    "max_tokens": 50
  }'
```

## 6. 故障排查

### 6.1 API Key 无效

**错误症状**：返回 `401 Unauthorized` 或 `403 Forbidden`

**解决方案**：
1. 确认 API Key 正确且未过期
2. 检查 `.env.local` 和 `config/app.json` 中的 `ARK_API_KEY` 是否一致
3. 前往 [火山引擎控制台](https://console.volcengine.com/) 重新获取 API Key

### 6.2 模型不支持 Coding Plan

**错误症状**：返回 `400 Bad Request` 或提示模型不支持

**解决方案**：
1. 确认使用的模型在支持列表中
2. 尝试使用 `kimi-k2.5` 作为默认模型
3. 检查模型名称拼写是否正确

### 6.3 网络连接问题

**错误症状**：连接超时、DNS 解析失败

**解决方案**：
1. 确认网络可以访问 `ark.cn-beijing.volces.com`
2. 检查防火墙和代理设置
3. 尝试使用 VPN 或检查企业网络策略

### 6.4 parseSSEJsonLines 函数缺失

**错误症状**：代码中提示 `parseSSEJsonLines is not defined`

**解决方案**：
此问题已在最新版本中修复，确保：
1. 更新到最新版本的 swarm-ide
2. 确认 `src/` 目录下的相关文件包含此函数定义
3. 如仍有问题，尝试重新安装依赖：`npm install`

## 7. 在其他项目中复用

### 7.1 直接调用方式

```javascript
// 使用 fetch 直接调用
const response = await fetch('https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ARK_API_KEY}`
  },
  body: JSON.stringify({
    model: 'kimi-k2.5',
    messages: [
      { role: 'user', content: 'Your prompt here' }
    ],
    stream: false,
    max_tokens: 2000
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### 7.2 环境变量配置模式

在项目中创建 `.env` 文件：

```bash
# 火山引擎 Coding Plan
ARK_API_KEY=your-api-key-here
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3
ARK_MODEL=kimi-k2.5
```

在代码中读取：

```javascript
const apiKey = process.env.ARK_API_KEY;
const baseUrl = process.env.ARK_BASE_URL;
const model = process.env.ARK_MODEL || 'kimi-k2.5';
```

### 7.3 OpenAI 兼容接口使用

火山引擎 API 与 OpenAI API 兼容，可使用 OpenAI SDK：

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.ARK_API_KEY,
  baseURL: 'https://ark.cn-beijing.volces.com/api/coding/v3'
});

const response = await client.chat.completions.create({
  model: 'kimi-k2.5',
  messages: [
    { role: 'user', content: 'Write a React component' }
  ],
  stream: true
});

for await (const chunk of response) {
  console.log(chunk.choices[0].delta.content);
}
```

## 附录：区域端点

| 区域 | 端点 |
|------|------|
| 北京 | `https://ark.cn-beijing.volces.com/api/coding/v3` |
| 上海 | `https://ark.cn-shanghai.volces.com/api/coding/v3` |
| 广州 | `https://ark.cn-guangzhou.volces.com/api/coding/v3` |

---
*本文档最后更新于 2026-03-28*
