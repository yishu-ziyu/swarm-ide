# 火山引擎 Coding Plan 快速参考

## 核心配置（swarm-ide）

### 环境变量 (.env.local)
```bash
LLM_PROVIDER=ark
ARK_API_KEY=your-api-key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3
ARK_MODEL=kimi-k2.5
```

### 应用配置 (config/app.json)
```json
{
  "llmProvider": "ark",
  "arkApiKey": "your-api-key",
  "arkBaseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
  "arkModel": "kimi-k2.5"
}
```

## 支持的模型
| 模型 | 备注 |
|------|------|
| kimi-k2.5 | ✅ 已验证 |
| doubao-seed-2-0-pro | ✅ 推荐 |
| doubao-seed-2-0-code-preview | ✅ |
| doubao-seed-2-0-lite | ✅ |
| glm-4-7 | ✅ |
| deepseek-v3-2 | ✅ |
| minimax-m2.5 | ✅ |

## API端点
- OpenAI兼容: `https://ark.cn-beijing.volces.com/api/coding/v3`
- Anthropic兼容: `https://ark.cn-beijing.volces.com/api/coding`

## 快速测试
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "kimi-k2.5", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 20}'
```

## 故障排查
1. **API Key无效** → 检查火山引擎控制台
2. **模型不支持** → 使用 kimi-k2.5 或 doubao-seed-2-0-pro
3. **网络错误** → 检查防火墙/代理设置
