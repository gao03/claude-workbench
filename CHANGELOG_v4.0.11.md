# 版本 4.0.11 更新日志

**发布日期**: 2025-10-29  
**类型**: ✨ 功能更新

---

## ✨ 新增功能

### 版本更新通知系统

全新的自动更新检查和通知功能，提供现代化的更新体验。

#### 主要特性

1. **自动检查更新** 🔍
   - 应用启动2秒后自动检查新版本
   - 静默后台运行，不影响启动速度
   - 从 GitHub Releases 获取最新版本信息

2. **更新徽章** 🎯
   - Topbar 右侧显示蓝色更新徽章
   - 显示最新版本号
   - 点击查看详情或关闭提醒

3. **更新对话框** 📦
   - 对比当前版本和最新版本
   - 展示详细的更新说明
   - 实时下载进度条
   - 一键下载、安装、重启

4. **智能提醒管理** 🧠
   - 关闭提醒后，同版本不再显示
   - 有新版本时重新提醒
   - 使用 localStorage 持久化状态

#### 技术实现

- **UpdateContext** - React Context 状态管理
- **UpdateBadge** - 简洁的徽章组件
- **UpdateDialog** - 功能完整的对话框
- **updater.ts** - 核心更新逻辑
- **Tauri Plugin** - 使用官方 tauri-plugin-updater

#### 使用方式

无需任何配置，开箱即用：
1. 应用启动后自动检查更新
2. 有新版本时显示蓝色徽章
3. 点击徽章查看详情和下载
4. 一键安装并重启

---

## 🔧 改进

### 依赖更新

- 升级 `tauri-plugin-updater` 到 v2.9 (匹配 npm v2.9.0)
- 升级 `tauri-plugin-process` 到 v2.3 (匹配 npm v2.3.1)
- 修复 Tauri 包版本不匹配警告

### 用户体验

- 更新检查不阻塞应用启动
- 优雅的UI设计，符合应用风格
- 详细的进度反馈
- 智能的提醒策略

---

## 📝 代码变更

### 新增文件 (4个)

1. `src/lib/updater.ts` - 更新核心逻辑 (127行)
2. `src/contexts/UpdateContext.tsx` - 状态管理 (154行)
3. `src/components/UpdateBadge.tsx` - 徽章组件 (62行)
4. `src/components/UpdateDialog.tsx` - 对话框 (188行)

### 修改文件 (6个)

1. `package.json` - 版本号 + 依赖
2. `src-tauri/Cargo.toml` - 版本号 + 依赖版本
3. `src-tauri/src/main.rs` - 注册 updater 插件
4. `src-tauri/tauri.conf.json` - 更新器配置
5. `src/App.tsx` - 集成 UpdateProvider
6. `src/components/Topbar.tsx` - 显示 UpdateBadge

**总计**: +541行新代码

---

## 🔄 向后兼容

✅ **完全兼容** - 所有修改都是新增功能

- API 保持不变
- 用户数据不受影响
- 配置无需迁移
- 界面布局保持一致

---

## ⚠️ 注意事项

### 首次使用需要配置

发布者需要完成以下配置：

1. **生成签名密钥**
   ```bash
   tauri signer generate -w ~/.tauri/claude-workbench.key
   ```

2. **更新公钥到配置**
   - 将生成的公钥更新到 `tauri.conf.json` 的 `updater.pubkey`

3. **创建 GitHub Release**
   - 构建安装包
   - 签名所有产物
   - 创建 `latest.json`
   - 上传到 GitHub Releases

### 用户端

用户无需任何配置，自动启用：
- 应用启动后自动检查
- 有更新时自动显示提醒

---

## 📚 相关文档

- `UPDATE_FEATURE_GUIDE.md` - 详细的功能指南和配置说明
- `SUBAGENT_INDEX_ISSUE_ANALYSIS.md` - 子代理索引问题分析（v4.0.12将修复）

---

## 🐛 已知问题

### 子代理消息索引问题（计划在 v4.0.12 修复）

当使用子代理（subagent）或 task tool 时，内部消息可能被误记录为用户消息，导致撤回功能的索引错位。

**影响范围**: 使用子代理的高级用户  
**临时方案**: 避免在使用子代理后立即使用撤回功能  
**修复计划**: v4.0.12 将实施增强的消息过滤和元数据支持

详见: `SUBAGENT_INDEX_ISSUE_ANALYSIS.md`

---

## 🎯 下个版本预告

### v4.0.12 计划

- 🐛 修复子代理消息索引问题
- ✨ 增强消息过滤机制
- ✨ 添加消息元数据支持
- 🧪 完善测试覆盖

---

## 🎉 总结

v4.0.11 是一个重要的功能更新版本，带来了：

✅ 现代化的版本更新系统  
✅ 自动更新检查  
✅ 一键下载安装  
✅ 智能提醒管理  
✅ 依赖版本修复  

**推荐所有用户升级！**

---

**版本**: v4.0.11  
**发布时间**: 2025-10-29  
**状态**: 准备发布  

