# 移动端 UI 自动化项目通用规范

适用于所有基于 Playwright 的移动端 H5 自动化测试项目（`isMobile: true` + `hasTouch: true`）。

本规范按工作流程顺序组织：**目录结构 → Plan（测试计划）→ Generator（脚本生成）→ Healer（调试修复）→ 执行命令**。

---

## 通用目录结构

```
project/
├── seed.spec.ts             # 测试初始化脚本
├── test_case/               # 测试用例实现目录
│   ├── shared/              # 公共基础类（高频操作）
│   ├── aaaplanning_plan_name/ # 【未实现】测试计划文件夹（带前缀标识，排序靠前）
│   │   └── aaa_plan_name.md  # 测试计划文档（aaa_前缀保证首位显示）
│   ├── plan_name/            # 【已实现】测试计划文件夹（无前缀）
│   │   ├── aaa_plan_name.md  # 测试计划文档（aaa_前缀保证首位显示）
│   │   ├── case_1.spec.ts
│   │   └── case_2.spec.ts
│   └── ...
└── playwright.config.ts
```

---

## 测试计划管理规则

### 计划生命周期标识

- **未实现的计划**：文件夹名前缀 `aaaplanning_`（例：`aaaplanning_user_login/`）
  - 仅包含 `aaa_{plan-name}.md` 测试计划文档
  - 没有脚本文件（.spec.ts）
  - 文件夹前缀 `aaaplanning_` 使其在文件系统排序中位于最前面，便于识别待实现的计划

- **已实现的计划**：文件夹名无前缀（例：`user_login/`）
  - 包含 `aaa_{plan-name}.md` 测试计划文档（固定显示在目录首位）
  - 包含所有实现的脚本文件（.spec.ts）

### 计划文档位置与命名

- 所有测试计划文件直接放在对应目录中（`aaaplanning_{plan-name}/` 或 `{plan-name}/`）
- 计划文档名统一加 `aaa_` 前缀：`aaa_{plan-name}.md`，保证在目录中始终排序最前
- 计划文档始终放在目录的首位，便于快速查看和对照

---

## 测试计划输出格式

Plan 模式生成的计划保存到 `test_case/{plan-name}/` 目录，格式：

```markdown
# {功能名}功能测试计划

## Application Overview
{简要描述}

## Test Scenarios

### 1. {场景组名}
**Seed:** `seed.spec.ts`

#### 1.1. a_{具体场景名}
**File:** `{plan-name}/a_{case-name}.spec.ts`

**Steps:**
  1. {操作描述}
     - expect: {预期结果}
  2. {操作描述}
     - expect: {预期结果}

#### 1.1. a_{具体场景名} [UPDATED]
<!-- 该用例因脚本实现/调试中发现表达或步骤需要调整，已验证通过，待确认合并 -->

**Steps:**
  1. {调整后的操作描述}
     - expect: {预期结果}
  2. {调整后的操作描述}
     - expect: {预期结果}
```

**生成规则：**
1. 每个具体场景前缀遵循规则：`a_` → `b_` → ... → `z_` → `aa_` → `ab_`...（类似 Excel 列标签，全部小写）
2. 前缀用途：便于生成脚本后快速定位对应的测试用例
3. **场景标题前缀与文件名前缀保持一致，均为小写**：场景名 `a_xxx` 对应文件名 `a_xxx.spec.ts`；场景名 `aa_xxx` 对应文件名 `aa_xxx.spec.ts`。例：`a_档案tab切换加载正常` → `a_tab_switch_and_load.spec.ts`
4. 调试更新规则：
   - 若脚本调试发现原用例需要调整，不直接修改原用例
   - 在原用例下新增 `[UPDATED]` 标识的记录（例：`a_具体场景名 [UPDATED]`）
   - 更新用例以 HTML 注释形式展示，被系统识别为"待审批状态"
   - 更新用例中包含经过验证的准确步骤，用户可手动确认后合并到原用例
5. 如果是新建计划（未有脚本），生成文件夹 `test_case/aaaplanning_{plan-name}/`，保存计划为 `aaa_{plan-name}.md`
6. 如果计划已实现脚本，去掉文件夹的 `aaaplanning_` 前缀，改为 `test_case/{plan-name}/`，并保持 `aaa_{plan-name}.md` 在目录首位

---

## Playwright 移动端交互规范

- 定位器优先使用语义化 API：`page.getByRole()` / `page.getByText()` / `page.locator()`
- 输入使用 `page.fill()` / `page.press()` / `page.keyboard.press()`
- 禁止使用 `locator.click()`，所有点击操作必须统一使用 `locator.tap()` 以模拟真实触摸

---

## 规范文件维护标准

更新或新增规范文件内容时，遵循以下排版原则：

1. **整体介绍在最前** — 文件开头用一句话说明规范的适用范围和内容概览
2. **核心内容在前，非核心在后** — 直接影响 Agent 行为的约束和规则放前面；参考性内容（如命令、示例）放文件末尾
3. **核心内容按工作流程顺序排列** — 以实际使用顺序组织章节，例如：Plan 阶段规范 → Generator 阶段规范 → Healer 阶段规范
4. **新增章节遵循同一原则** — 判断新章节属于哪个阶段或是否为核心约束，插入到对应位置，而非追加到末尾

---

## 代码编写操作要求

1. **发送规则**: 输入框发送文本不要使用 Enter，必须通过发送按钮发送
2. **移动端点击规则**: 禁止一切 `click()` 操作，所有点击均用 `tap()` 触发，模拟真实触摸
3. **操作重试策略**: 同一种方式最多尝试两次；仍失败时必须分析页面并改用新方案
4. **实现原则**: 所有操作必须模拟真实用户行为，禁止使用 `page.evaluate()` 直接触发 DOM 行为
5. **封装规则**: 同一操作在 5 个以上用例中重复时才允许封装进基础类，避免过度封装；低频动作保留在业务用例中

---

## 测试脚本生成规则

- **完成动作约束**：脚本生成完成后，必须按 `generator_write_test` → `browser_run_code`（执行 `async (page) => { const b = page.context().browser(); await b.close(); }`）顺序收尾
- 每文件单测试：一个 .spec.ts 只包含一个 `test()`
- `describe` 名称与计划中的顶层场景组名一致
- `test` 名称包含计划中的前缀和具体场景名（例：`a_具体场景名`）
- 每个步骤前添加步骤文本注释（一步多操作时不重复注释）
- 文件路径: `test_case/{plan-name}/{case-name}.spec.ts`
- **调试更新规则**：若脚本通过调试在步骤或操作上有优化调整，应在 plan 中对应用例下添加 `[UPDATED]` 记录，记录经验证的准确操作，待用户手动审查合并
- **重要**：当生成第一个脚本文件时，需同步将文件夹从 `aaaplanning_{plan-name}/` 重命名为 `{plan-name}/`，并确保 `aaa_{plan-name}.md` 保留在目录首位

---

## 测试执行命令

```bash
# 单个用例
npx playwright test test_case/{plan-name}/{case}.spec.ts

# 查看指定日期的测试报告
npx playwright show-report test-results/{date-folder}/html-report
```

---

- **关闭浏览器**：plan、generator结束后，调用 `browser_run_code` 执行以下代码关闭浏览器：
  ```js
  async (page) => { const b = page.context().browser(); await b.close(); }
  ```
  > `browser_run_code` 需要函数表达式格式，不能用裸代码语句。
  > `browser_close` 只是 `page.close()`，不会关闭浏览器窗口。必须通过 `browser_run_code` 关闭整个浏览器进程。
  > 执行后 MCP 报错 `browserContext.newPage: Target page, context or browser has been closed` 是**预期的成功信号**。

- 禁止在 `planner_save_plan` 失败后用 `create_file` 手动写文件绕过 planner 工作流，失败时必须修正参数后重试
