import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Path resolution
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Build configuration for code splitting and optimization
  build: {
    // Increase chunk size warning limit to 2000 KB
    chunkSizeWarningLimit: 2000,
    
    // Additional optimizations for smaller bundle size and faster loading
    minify: 'esbuild',
    target: 'es2020',
    cssMinify: true,
    sourcemap: false,  // ⚡ 禁用 sourcemap 加快加载
    reportCompressedSize: false,  // ⚡ 跳过压缩大小报告
    
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting and faster loading
        manualChunks: (id) => {
          // ⚡ 优化：更激进的代码分割，减少主 bundle 大小
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Radix UI components
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }
            // Editor (large, lazy load)
            if (id.includes('@uiw/react-md-editor')) {
              return 'editor-vendor';
            }
            // Syntax highlighter (large, lazy load)
            if (id.includes('react-syntax-highlighter')) {
              return 'syntax-vendor';
            }
            // Tauri
            if (id.includes('@tauri-apps')) {
              return 'tauri';
            }
            // Framer Motion (large)
            if (id.includes('framer-motion')) {
              return 'framer';
            }
            // Utils
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'utils';
            }
            // i18n (可能是瓶颈)
            if (id.includes('i18next')) {
              return 'i18n-vendor';
            }
            // 其他 node_modules
            return 'vendor';
          }
        },
      },
    },
  },
}));
