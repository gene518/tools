# Playwright Mobile UI Test Skill

一个面向移动端 H5 应用的 Playwright UI 自动化测试技能（Copilot Custom Skill）。

用自然语言驱动测试的全生命周期：**制定计划 → 生成脚本 → 调试修复**，无需手动切换 Agent。

---

## 解决什么问题

### 1. 告别 Agent 频繁切换

Playwright MCP 原生提供了三个独立 Agent：`planner`（计划）、`generator`（生成）、`healer`（修复）。实际工作中你需要：

1. 切到 planner 写计划
2. 切到 generator 生成脚本
3. 脚本失败，切到 healer 调试
4. 调试发现计划有误，再切回 planner 修改
5. 反复循环...

**使用本 Skill 后**，只需用自然语言描述意图，Skill 自动识别并路由到对应模式，全程无需手动切换：

```
用户：帮我生成侧边栏功能的测试计划     → 自动进入 Plan 模式
用户：按照计划生成脚本                → 自动进入 Generator 模式
用户：这个用例执行失败了，帮我修复     → 自动进入 Heal 模式
```

### 2. 内置移动端 UI 自动化规范

移动端 H5 自动化与桌面 Web 有诸多差异（触摸操作、视口、交互模式等）。没有规范约束时，AI 生成的脚本往往：

- 使用 `click()` 而非 `tap()`，导致移动端事件不触发
- 缺乏统一的目录结构和命名规则，用例难以维护
- 前置步骤在每个文件中重复编写，改一处要改几十个文件

本 Skill 内置了两层规范，AI 在生成代码时自动遵循：

| 规范 | 作用 |
|---|---|
| `mobile-ui-conventions.md` | 通用移动端约束：目录结构、tap 替代 click、计划格式、脚本生成规则 |
| `beida-medical-conventions.md` | 业务定制约束：高频操作收敛到基础类、前置步骤复用、业务目录结构 |

---

## 三种模式

| 模式 | 触发关键词 | 说明 |
|---|---|---|
| **Plan** | 生成计划、测试计划、plan | 浏览器实时探索页面 → 生成结构化测试计划（Markdown） |
| **Generator** | 生成脚本、generator | 按计划逐步操作浏览器 → 录制并生成 `.spec.ts` 脚本 |
| **Heal** | 调试、修复、heal、fix | 运行失败用例 → 断点调试 → 自动修复代码 → 验证通过 |

---

## 快速开始

### 前置条件

- 项目已安装 `@playwright/test`（v1.49+，内置 MCP server）
- AI 客户端已连接 `playwright-test` MCP 服务

> Skill 执行时会自动检测 MCP 连接状态。如未连接，会根据当前平台（VS Code / Claude Code / Cursor 等）自动写入 MCP 配置并提示重启。

### 安装 Skill

将 `.github/skills/beida_medical_ui_test/` 目录复制到你的项目中：

```
your-project/
└── .github/
    └── skills/
        └── beida_medical_ui_test/
            ├── SKILL.md                  # 技能入口（意图路由 + 前置检查）
            └── references/
                ├── playwright-test-planner-agent.md    # Plan 模式指令
                ├── playwright-test-generator-agent.md  # Generator 模式指令
                ├── playwright-test-healer-agent.md     # Heal 模式指令
                ├── mobile-ui-conventions.md            # 移动端通用规范
                └── beida-medical-conventions.md        # 业务定制规范（需替换）
```

### 使用方式

在 Copilot Chat 中直接用自然语言描述需求即可：

```
# 生成计划
帮我为登录功能生成测试计划

# 生成脚本
按照计划生成第 1 个用例的脚本

# 调试修复
运行 test_case/im_sidebar/ 下的用例，修复失败的测试
```

---

## 定制适配

本 Skill 分为**通用层**和**业务层**，适配自己的项目只需替换业务层。

### 可直接复用（通用层）

| 文件 | 说明 |
|---|---|
| `SKILL.md` | 技能入口，意图路由与 MCP 检测逻辑 |
| `playwright-test-planner-agent.md` | Plan 模式工作流 |
| `playwright-test-generator-agent.md` | Generator 模式工作流 |
| `playwright-test-healer-agent.md` | Heal 模式工作流 |
| `mobile-ui-conventions.md` | 移动端通用规范（目录结构、命名、tap 规则等） |

### 需要替换（业务层）

| 文件 | 说明 |
|---|---|
| `beida-medical-conventions.md` | 当前为北大医疗 IM 业务规范，包含特定的基础类、前置步骤和目录约定。替换为你自己项目的业务约定即可 |

**替换要点**：

1. 定义你项目的**高频前置操作**，收敛到基础类中
2. 列出基础类的**可用成员**（方法和 locator），供 AI 生成脚本时引用
3. 约定 Plan 模式中**前置步骤**的固定写法，以及 Generator 模式如何替换为基础类调用

---

## 许可

MIT
