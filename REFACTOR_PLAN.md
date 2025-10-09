# 成本追踪系统重构计划

## 📊 当前状态分析

### 存在的组件 (6个)
1. **CostAnalyticsPage.tsx** - 综合成本分析页面（173行）
2. **CostDashboard.tsx** - 实时成本监控仪表板
3. **UsageDashboard.tsx** - 使用情况仪表板
4. **SessionCostTracker.tsx** - 会话成本追踪器（~400行）
5. **CostWidget.tsx** - 成本小部件（~400行）
6. **RealtimeCostWidget.tsx** - 实时成本小部件（~374行）

### 使用情况
- **CostAnalyticsPage**: 导入 CostDashboard, SessionCostTracker, UsageDashboard
- **App.tsx**: 导入 UsageDashboard
- **index.ts**: 导出 UsageDashboard, RealtimeCostWidget

### 冗余问题
- ❌ 重复的 API 调用逻辑
- ❌ 重复的事件监听器
- ❌ 重复的格式化函数
- ❌ 重复的成本计算逻辑
- ❌ 估计 ~1174+ 行冗余代码

---

## 🎯 重构目标

### 保留组件
- ✅ **CostAnalyticsPage** - 作为统一入口

### 删除组件
- ❌ **CostWidget.tsx**
- ❌ **RealtimeCostWidget.tsx**
- ❌ **SessionCostTracker.tsx**

### 合并组件
- 🔄 **CostDashboard + UsageDashboard** → **UnifiedCostDashboard**

---

## 📋 执行步骤

### Phase 1: 备份和准备
- [ ] Git 提交当前状态
- [ ] 创建备份分支

### Phase 2: 创建统一组件
- [ ] 创建 `UnifiedCostDashboard.tsx`
  - 合并 CostDashboard 和 UsageDashboard 的核心功能
  - 提取共享逻辑到 hooks
  - 统一事件监听和数据获取

### Phase 3: 更新 CostAnalyticsPage
- [ ] 使用 UnifiedCostDashboard 替代 CostDashboard + UsageDashboard
- [ ] 移除 SessionCostTracker 引用
- [ ] 简化组件结构

### Phase 4: 清理导出
- [ ] 更新 `index.ts` 导出
- [ ] 移除已删除组件的导出

### Phase 5: 删除冗余文件
- [ ] 删除 CostWidget.tsx
- [ ] 删除 RealtimeCostWidget.tsx
- [ ] 删除 SessionCostTracker.tsx
- [ ] 删除 CostDashboard.tsx（功能已合并）
- [ ] 删除 UsageDashboard.tsx（功能已合并）

### Phase 6: 测试验证
- [ ] TypeScript 编译检查
- [ ] 前端构建测试
- [ ] 功能完整性测试
- [ ] UI 一致性检查

### Phase 7: 提交
- [ ] Git 提交重构结果
- [ ] 更新相关文档

---

## 💾 预期收益

- ✅ 减少 ~1174+ 行冗余代码
- ✅ 统一成本追踪入口
- ✅ 简化维护成本
- ✅ 提升性能（减少重复事件监听）
- ✅ 避免数据不一致

---

## ⚠️ 风险评估

**低风险**
- 这些组件功能高度重叠
- CostAnalyticsPage 已经是统一入口
- 删除的组件只在 CostAnalyticsPage 中使用

**注意事项**
- 确保所有功能在 UnifiedCostDashboard 中保留
- 测试所有成本显示和统计功能
- 验证事件监听器正确清理

---

## 🚀 开始执行

继续执行？
- **A** - 开始执行完整重构
- **B** - 先创建 UnifiedCostDashboard，逐步迁移
- **C** - 提供更多分析信息，暂不执行
