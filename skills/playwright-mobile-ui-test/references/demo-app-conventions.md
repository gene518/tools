# Demo App 项目专项规范示例

本文件演示如何为具体移动端 H5 项目补充专项约束，在通用移动端规范基础上按需叠加使用。

> 这是可公开发布的 demo 示例。接入真实项目时，请用你自己的应用入口、基础类、固定前置步骤和断言文案替换本文件内容。

---

## Demo 适用场景

假设被测应用是一个移动端购物 demo，核心流程包括：

- 访问首页
- 搜索商品
- 查看商品详情
- 加入购物车
- 查看购物车数量和商品信息

这些约定仅用于展示专项规范写法，不代表技能默认要求所有项目都实现购物车流程。

---

## 高频流程复用规范

1. 如果 5 个以上用例都需要“访问首页并等待基础 UI 就绪”，应收敛到公共基础类。
2. 以下高频步骤不建议在各个 spec 中重复手写：访问首页、等待首页标题、校验搜索框、校验购物车入口。
3. demo 项目可将上述流程收敛到 `test_case/shared/demo-store-base.ts`。
4. 如果首页路由、页面加载校验、搜索框定位或购物车入口发生变化，优先修改基础类，而不是批量修改业务 spec。
5. `test_case/home_ready/home_ready.spec.ts` 可作为公共前置流程的专项验证用例，其他功能用例不要复制它的完整实现。

---

## 基础类调用示例

```typescript
import { DemoStoreBaseFlow } from '../shared/demo-store-base';

test('search product and add to cart', async ({ page }) => {
  const store = await DemoStoreBaseFlow.openHome(page);
  await store.searchProduct('wireless keyboard');
  await store.openProductByName('Wireless Keyboard');
  await store.addCurrentProductToCart();
});
```

### DemoStoreBaseFlow 示例成员

| 成员 | 说明 |
|---|---|
| `DemoStoreBaseFlow.openHome(page)` | 访问首页并等待基础 UI 就绪 |
| `store.searchProduct(keyword)` | 输入搜索词并触发搜索 |
| `store.openProductByName(name)` | 从列表打开指定商品 |
| `store.addCurrentProductToCart()` | 将当前详情页商品加入购物车 |
| `store.searchInput` | 首页搜索框 locator |
| `store.cartButton` | 购物车入口 locator |
| `store.productList` | 商品列表 locator |
| `store.toast` | 全局提示 locator |

---

## Demo 目录结构补充

```text
test_case/
├── shared/
│   └── demo-store-base.ts                  # demo 高频复用基础类
├── home_ready/
│   └── home_ready.spec.ts                  # 公共前置专项验证示例
├── {plan-name}/                            # 各功能用例目录
│   ├── aaa_{plan-name}.md
│   └── *.spec.ts
└── ...
```

---

## 测试计划前置步骤示例

Plan 模式生成 demo 计划时，可将公共前置固定为：

```text
  1. 访问移动端首页
     - expect: 首页加载完成并显示应用标题
     - expect: 搜索框和购物车入口可见
```

Generator 模式生成脚本时，可将以上前置替换为：

```typescript
const store = await DemoStoreBaseFlow.openHome(page);
```

真实项目接入时，请将这里的路径、类名、方法名、页面文案和断言目标替换为项目自己的约定。
