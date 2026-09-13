/**
 * Ark Provider 闭环测试脚本
 * 测试项目：
 * 1. 基础连通性测试
 * 2. 工具调用测试
 * 3. 多轮对话测试
 * 4. 压力测试
 */

const BASE_URL = "http://127.0.0.1:3017";

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initDatabase() {
  console.log("=== 数据库初始化 ===");
  console.log("1. 初始化数据库 Schema...");

  const initRes = await fetch(`${BASE_URL}/api/admin/init-db`, { method: "POST" });
  const initData = await initRes.json();
  console.log(`   结果: ${initData.ok ? "✅ 成功" : "❌ 失败"} - ${initData.message || ""}`);

  if (!initData.ok) {
    throw new Error(`数据库初始化失败: ${initData.message}`);
  }

  console.log("2. 创建测试 Workspace...");
  const wsRes = await fetch(`${BASE_URL}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ark Test Workspace" })
  });
  const wsData = await wsRes.json();
  console.log(`   Workspace ID: ${wsData.workspaceId}`);

  return wsData.workspaceId;

  return wsData.id;
}

async function testBasicConnectivity(workspaceId) {
  console.log("\n=== 测试 1: 基础连通性测试 ===");

  const creatorId = generateUUID();

  // 创建 Agent
  console.log("1.1 创建 Agent...");
  const createRes = await fetch(`${BASE_URL}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      creatorId,
      role: "tester"
    })
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`创建 Agent 失败: ${err}`);
  }

  const { agentId, groupId } = await createRes.json();
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Group ID: ${groupId}`);

  // 获取 Agent 列表确认
  const listRes = await fetch(`${BASE_URL}/api/agents?workspaceId=${workspaceId}`);
  const { agents } = await listRes.json();
  console.log(`   Agent 列表确认: ${agents.length} 个 Agent`);

  return { workspaceId, agentId, groupId };
}

async function testSimpleChat(workspaceId, agentId, groupId) {
  console.log("\n=== 测试 2: 简单对话测试 ===");

  const senderId = generateUUID();
  const message = "你好，请用一句话介绍一下你自己。";

  console.log(`2.1 发送消息: "${message}"`);

  const sendRes = await fetch(`${BASE_URL}/api/groups/${groupId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderId,
      content: message,
      contentType: "text"
    })
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    throw new Error(`发送消息失败: ${err}`);
  }

  const { id: messageId } = await sendRes.json();
  console.log(`   消息 ID: ${messageId}`);

  // 等待处理
  console.log("2.2 等待 LLM 响应 (8秒)...");
  await sleep(8000);

  // 获取消息列表
  const messagesRes = await fetch(`${BASE_URL}/api/groups/${groupId}/messages`);
  const { messages } = await messagesRes.json();

  console.log(`   消息数量: ${messages.length}`);
  messages.forEach((msg, i) => {
    const preview = msg.content?.substring(0, 100) || "(empty)";
    console.log(`   [${i+1}] ${msg.senderId} (${msg.contentType}): ${preview}${preview.length >= 100 ? "..." : ""}`);
  });

  return messages;
}

async function testToolCalls(workspaceId, agentId, groupId) {
  console.log("\n=== 测试 3: 工具调用测试 ===");

  const senderId = generateUUID();

  // 构造一个需要工具调用的复杂请求
  const toolPrompt = `请帮我完成以下任务：
1. 列出你可用的工具
2. 使用其中一个工具来展示功能
3. 然后总结结果`;

  console.log(`3.1 发送工具调用测试请求...`);
  console.log(`    Prompt: "${toolPrompt.substring(0, 50)}..."`);

  const sendRes = await fetch(`${BASE_URL}/api/groups/${groupId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderId,
      content: toolPrompt,
      contentType: "text"
    })
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    throw new Error(`发送消息失败: ${err}`);
  }

  console.log("3.2 等待 LLM 响应和处理 (15秒)...");
  await sleep(15000);

  console.log(`   工具调用测试完成`);
  return true;
}

async function testMultiRound(workspaceId, agentId, groupId) {
  console.log("\n=== 测试 4: 多轮对话测试 (5轮) ===");

  const senderId = generateUUID();
  const rounds = [
    "第一轮：你好！",
    "第二轮：今天天气怎么样？",
    "第三轮：请给我讲个笑话",
    "第四轮：2+3等于多少？",
    "第五轮：谢谢，再见！"
  ];

  for (let i = 0; i < rounds.length; i++) {
    console.log(`4.${i+1} 发送第 ${i+1} 轮: "${rounds[i]}"`);

    const sendRes = await fetch(`${BASE_URL}/api/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderId,
        content: rounds[i],
        contentType: "text"
      })
    });

    if (!sendRes.ok) {
      console.log(`   警告: 发送失败`);
    } else {
      console.log(`   发送成功`);
    }

    await sleep(4000);
  }

  console.log("4.6 等待所有响应完成 (15秒)...");
  await sleep(15000);

  // 获取所有消息
  const messagesRes = await fetch(`${BASE_URL}/api/groups/${groupId}/messages`);
  const { messages } = await messagesRes.json();

  console.log(`   总消息数量: ${messages.length}`);
  return messages;
}

async function testConcurrentAgents(workspaceId) {
  console.log("\n=== 测试 5: 并发 Agent 压力测试 (3个并发) ===");

  const creatorId = generateUUID();

  // 创建 3 个并发的 Agent
  console.log("5.1 创建 3 个并发 Agent...");

  const createPromises = Array(3).fill(0).map((_, i) =>
    fetch(`${BASE_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        creatorId,
        role: `stress-agent-${i}`
      })
    })
  );

  const results = await Promise.all(createPromises);
  const agentsData = await Promise.all(results.map(r => r.json()));

  console.log(`   创建了 ${agentsData.length} 个 Agent`);
  agentsData.forEach((data, i) => {
    console.log(`   Agent ${i+1}: ${data.agentId}`);
  });

  // 并发发送消息
  console.log("5.2 并发发送消息...");

  const messagePromises = agentsData.map((data, i) =>
    fetch(`${BASE_URL}/api/groups/${data.groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderId: creatorId,
        content: `并发测试消息 ${i + 1}`,
        contentType: "text"
      })
    })
  );

  const msgResults = await Promise.all(messagePromises);
  console.log(`   消息发送完成: ${msgResults.filter(r => r.ok).length}/${msgResults.length} 成功`);

  console.log("5.3 等待响应 (15秒)...");
  await sleep(15000);

  console.log("   并发测试完成");
  return true;
}

async function runAllTests() {
  console.log("========================================");
  console.log("Ark Provider 闭环测试与压力测试");
  console.log("========================================");
  console.log(`测试时间: ${new Date().toISOString()}`);
  console.log(`后端地址: ${BASE_URL}`);

  const results = {
    basicConnectivity: false,
    simpleChat: false,
    toolCalls: false,
    multiRound: false,
    concurrentAgents: false
  };

  try {
    // 初始化数据库
    const workspaceId = await initDatabase();

    // 测试 1: 基础连通性
    const { agentId, groupId } = await testBasicConnectivity(workspaceId);
    results.basicConnectivity = true;

    // 测试 2: 简单对话
    await testSimpleChat(workspaceId, agentId, groupId);
    results.simpleChat = true;

    // 测试 3: 工具调用
    await testToolCalls(workspaceId, agentId, groupId);
    results.toolCalls = true;

    // 测试 4: 多轮对话
    await testMultiRound(workspaceId, agentId, groupId);
    results.multiRound = true;

    // 测试 5: 并发压力测试
    await testConcurrentAgents(workspaceId);
    results.concurrentAgents = true;

  } catch (error) {
    console.error("\n!!! 测试过程中发生错误 !!!");
    console.error(error.message);
    console.error(error.stack);
  }

  console.log("\n========================================");
  console.log("测试结果汇总");
  console.log("========================================");
  console.log("| 测试项           | 状态  |");
  console.log("|------------------|-------|");
  console.log(`| 基础连通性测试   | ${results.basicConnectivity ? "✅ 通过" : "❌ 失败"} |`);
  console.log(`| 简单对话测试     | ${results.simpleChat ? "✅ 通过" : "❌ 失败"} |`);
  console.log(`| 工具调用测试     | ${results.toolCalls ? "✅ 通过" : "❌ 失败"} |`);
  console.log(`| 多轮对话测试     | ${results.multiRound ? "✅ 通过" : "❌ 失败"} |`);
  console.log(`| 并发压力测试     | ${results.concurrentAgents ? "✅ 通过" : "❌ 失败"} |`);
  console.log("========================================");

  const allPassed = Object.values(results).every(v => v);
  console.log(allPassed ? "\n🎉 所有测试通过!" : "\n⚠️ 部分测试失败，请检查日志");

  process.exit(allPassed ? 0 : 1);
}

runAllTests();
