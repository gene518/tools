---
name: beida_medical_ui_test
description: "北大医疗 UI 自动化测试技能。包含三种模式：plan（生成测试计划）、generator（生成测试脚本）、heal（调试修复测试）。Use when: 生成测试计划、生成测试用例、生成脚本、调试测试、修复失败测试、运行测试、Playwright UI 测试、test plan、write test、generate test、debug test、fix failing test、run test。"
argument-hint: "plan / generator / heal + 目标描述"
---

# 北大医疗 UI 自动化测试

路由技能：识别用户意图 → 检查环境 → 加载 Agent 指令 + 规范 → 执行。
三种模式：**plan**（生成测试计划）、**generator**（生成测试脚本）、**heal**（调试修复测试）。

## 前置检查（必需）

本技能依赖 `playwright-test` MCP 服务提供的工具（如 `playwright_run_test`）。执行任务前：

**第一步：直接尝试调用 playwright MCP 工具**

不做任何命令行检查，直接调用一个 playwright MCP 工具（如列出测试文件）。

- ✅ **调用成功** → MCP 已连接，继续执行任务
- ❌ **工具不存在 / 调用失败** → 进入第二步

**第二步：MCP 未连接时，自动识别平台并配置**

分析当前运行环境，判断所在平台，然后在对应的**项目级** MCP 配置文件中注册以下服务：

```json
{
  "playwright-test": {
    "type": "stdio",
    "command": "npx",
    "args": ["playwright", "run-test-mcp-server"],
    "env": {
      "PWTEST_HEADED": "1"
    }
  }
}
```

配置写入后，再次检查MCP时否可用，如果还不可用则检查**playwright-test MCP配置**（重新加载窗口或重启客户端），然后重新执行本技能。

## 意图识别

| 用户关键词 | 模式 | Agent 指令 |
|---|---|---|
| 生成计划、测试计划、生成用例、plan | **plan** | [playwright-test-planner-agent.md](./references/playwright-test-planner-agent.md) |
| 生成脚本、generator | **generator** | [playwright-test-generator-agent.md](./references/playwright-test-generator-agent.md) |
| 调试、修复、heal、fix、失败 | **heal** | [playwright-test-healer-agent.md](./references/playwright-test-healer-agent.md) |

如果用户意图不明确，询问确认后再执行。

## Core Procedure

1. 读取用户输入，根据「意图识别」表判断模式
2. 意图不明确时，询问用户确认
3. 执行「前置检查」，MCP 不可用则先安装和配置
4. 读取对应的 Agent 指令文件，按其工作流程执行
5. 同时读取并遵守以下两份规范（全部叠加生效）：
   - [通用] [mobile-ui-conventions.md](./references/mobile-ui-conventions.md) — 移动端 UI 自动化通用约束
   - [定制] [beida-medical-conventions.md](./references/beida-medical-conventions.md) — 北大医疗 IM 业务专项约束
6. 工具使用范围限定在 Agent 指令文件中声明的「允许工具」列表内

## References

按需加载，不要一次性全部读取：

- Agent 指令（三选一）：见「意图识别」表
- 移动端通用规范：[mobile-ui-conventions.md](./references/mobile-ui-conventions.md)
- 北大医疗业务规范：[beida-medical-conventions.md](./references/beida-medical-conventions.md)
