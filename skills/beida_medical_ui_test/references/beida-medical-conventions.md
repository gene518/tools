# 北大医疗业务规范

本文件为北大医疗 AI 医生 IM 聊天业务的专项规范，在通用移动端规范基础上叠加使用。

> **Playwright 版本：v1.58.0** — 所有 API 使用和行为以此版本为准，优先参考该版本文档。

---

## IM 用例复用规范

1. **所有业务测试用例都必须以「访问 IM 并开启新对话」作为统一前置步骤**
2. **以下步骤禁止在各个 spec 中重复手写**：访问登录链接、等待 IM 页面加载、校验顶部导航、校验输入框、点击右上角开启新对话按钮
3. 上述高频前置统一收敛到基础类 `test_case/shared/im-base.ts`
4. 如果「登录方式 / 页面加载校验 / 新对话按钮定位 / 欢迎话术断言」发生变化，只允许修改基础类 `test_case/shared/im-base.ts`
5. `test_case/welcome_message/welcome_message.spec.ts` 是公共前置的专项验证用例，其他业务用例不得复制前置实现

---

## 基础类调用示例

```typescript
import { IMBaseFlow } from '../shared/im-base';

test('业务场景', async ({ page }) => {
  const im = await IMBaseFlow.openNewConversation(page);
  await im.sendMessage('我要买红霉素软膏');
});
```

### IMBaseFlow 可用成员

| 成员 | 说明 |
|---|---|
| `IMBaseFlow.openNewConversation(page)` | 登录 + 页面加载 + 新对话 + 等待就绪 |
| `im.sendMessage(message)` | 输入 + tap 发送 + 确认消息可见 |
| `im.inputBox` | 聊天输入框 locator |
| `im.sendButton` | 发送按钮 locator（`span.chat-send-btn`） |
| `im.newChatButton` | 右上角新对话按钮 locator |
| `im.greeting` | 欢迎话术 locator |
| `im.header` | 顶部导航 locator |
| `im.historyDrawer` | 历史对话抽屉 locator |
| `im.historyManageButton` | 历史管理入口 locator |

---

## 业务目录结构补充

```
test_case/
├── shared/
│   └── im-base.ts                          # IM 高频复用基础类
├── welcome_message/
│   └── welcome_message.spec.ts             # 公共前置专项验证（勿复制）
├── {plan-name}/                            # 各业务功能用例目录
│   └── *.spec.ts
└── ...
```

---

## 测试计划前置步骤约定

Plan 模式生成的步骤中，前置固定为：

```
  1. 访问登录并跳转到IM页面
     - expect: 登录成功并自动跳转到IM页面
     - expect: 页面成功加载并显示AI医生标题
  2. 点击右上角开启新对话图标
     - expect: 显示欢迎话术
```

Generate 模式生成脚本时，以上两步统一替换为 `IMBaseFlow.openNewConversation(page)`，不得手写。
