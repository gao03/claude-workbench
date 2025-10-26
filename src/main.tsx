import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./assets/shimmer.css";
import "./styles.css";
import { getCurrentWindow } from '@tauri-apps/api/window';

// ⚡ 优化：移除同步初始化，改为异步延迟加载
// 旧版本在这里同步初始化 i18n 和 toolRegistry，会阻塞应用启动
// import "./i18n"; // ❌ 同步阻塞
// initializeToolRegistry(); // ❌ 同步阻塞

// 防止窗口闪烁的React包装组件
const AppWrapper: React.FC = () => {
  React.useEffect(() => {
    // ⚡ 性能优化：异步初始化不阻塞主渲染
    const initializeAsync = async () => {
      try {
        // 异步加载 i18n 和 toolRegistry（不阻塞 UI）
        await Promise.all([
          import('./i18n'),
          import('./lib/toolRegistryInit').then(m => m.initializeToolRegistry())
        ]);
        console.log('[AppWrapper] ✅ Async initialization complete');
      } catch (error) {
        console.error('[AppWrapper] Async initialization failed:', error);
      }
    };
    
    // 在React应用完全挂载后显示窗口
    const showWindow = async () => {
      try {
        const window = getCurrentWindow();
        await window.show();
        await window.setFocus();
      } catch (error) {
        console.error('Failed to show window:', error);
      }
    };
    
    // 立即开始异步初始化（不阻塞）
    initializeAsync();
    
    // 延迟显示窗口（生产模式需要更长时间）
    const timer = setTimeout(showWindow, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
