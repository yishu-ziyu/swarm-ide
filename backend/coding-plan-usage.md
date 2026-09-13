# 火山引擎 Coding Plan API 使用指南

## 概述

火山引擎 Coding Plan 提供与 OpenAI API 兼容的接口，可以直接在任何项目中使用 `ark` 作为 provider。

## 环境配置

在项目根目录创建 `.env.local` 文件：

```bash
LLM_PROVIDER=ark
ARK_API_KEY=your-api-key-here
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3
ARK_MODEL=kimi-k2.5
```

## API 调用示例

### 基础 Chat Completions 调用

#### curl

```bash
curl https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kimi-k2.5",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

#### Python

```python
import requests

url = "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}
payload = {
    "model": "kimi-k2.5",
    "messages": [
        {"role": "user", "content": "Hello, how are you?"}
    ]
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

#### JavaScript

```javascript
const response = await fetch('https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'kimi-k2.5',
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ]
  })
});

const data = await response.json();
console.log(data);
```

## Streaming 调用

### curl

```bash
curl https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kimi-k2.5",
    "messages": [
      {"role": "user", "content": "Write a story about a robot"}
    ],
    "stream": true
  }'
```

### JavaScript

```javascript
const response = await fetch('https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'kimi-k2.5',
    messages: [
      { role: 'user', content: 'Write a story about a robot' }
    ],
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.trim() !== '');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        console.log('Stream complete');
      } else {
        const parsed = parseSSEJsonLines(data);
        for (const item of parsed) {
          if (item.choices && item.choices[0].delta.content) {
            process.stdout.write(item.choices[0].delta.content);
          }
        }
      }
    }
  }
}
```

## parseSSEJsonLines 函数

用于解析 SSE 流式响应中的 JSON Lines 数据：

```javascript
/**
 * Parse SSE JSON lines format
 * Each line is: data: {"id":"...","choices":[...]}\n
 * @param {string} data - Raw data string from SSE chunk
 * @returns {Array} Parsed JSON objects
 */
function parseSSEJsonLines(data) {
  const results = [];
  
  // Handle both single line and multiple lines
  const lines = data.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Remove "data: " prefix if present
    let jsonStr = line;
    if (line.startsWith('data: ')) {
      jsonStr = line.slice(6);
    } else if (line.startsWith('data:')) {
      jsonStr = line.slice(5);
    }
    
    // Skip [DONE] sentinel
    if (jsonStr === '[DONE]') {
      continue;
    }
    
    try {
      const parsed = JSON.parse(jsonStr);
      results.push(parsed);
    } catch (e) {
      // Skip malformed JSON
      console.error('Failed to parse JSON:', jsonStr);
    }
  }
  
  return results;
}
```

### Python 版本

```python
import json

def parse_sse_json_lines(data: str) -> list:
    """
    Parse SSE JSON lines format
    Each line is: data: {"id":"...","choices":[...]}\n
    
    Args:
        data: Raw data string from SSE chunk
        
    Returns:
        List of parsed JSON objects
    """
    results = []
    
    # Handle both single line and multiple lines
    lines = data.split('\n')
    
    for line in lines:
        if not line.strip():
            continue
        
        # Remove "data: " prefix if present
        json_str = line
        if line.startswith('data: '):
            json_str = line[6:]
        elif line.startswith('data:'):
            json_str = line[5:]
        
        # Skip [DONE] sentinel
        if json_str == '[DONE]':
            continue
        
        try:
            parsed = json.loads(json_str)
            results.append(parsed)
        except json.JSONDecodeError:
            # Skip malformed JSON
            print(f'Failed to parse JSON: {json_str}')
    
    return results
```

## 完整使用示例

### Next.js API Route

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { messages, stream } = await req.json();
  
  const response = await fetch('https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.ARK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.ARK_MODEL || 'kimi-k2.5',
      messages,
      stream
    })
  });

  if (stream) {
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }

  const data = await response.json();
  return NextResponse.json(data);
}
```
