import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import {defineConfig} from 'vite';

// Mã build ngắn để hiển thị góc sidebar (theo dõi mỗi lần deploy đang chạy bản nào).
// Ưu tiên biến Vercel (build trên Vercel không có .git đầy đủ để chạy `git`),
// fallback sang lệnh git khi build local.
function getBuildCommit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig(() => {
  return {
    // Bơm qua import.meta.env.VITE_* (cơ chế chính thức của Vite, đáng tin cậy hơn
    // define global identifier — bare global từng không được thay thế đúng trong
    // dev server khi dùng chung với @vitejs/plugin-react (transform bằng Babel)).
    define: {
      'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(getBuildCommit()),
      'import.meta.env.VITE_BUILD_DATE': JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Split large vendor packages to avoid >500kb chunks
            'vendor-react': ['react', 'react-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-xlsx': ['xlsx'],
          },
        },
      },
    },
  };
});
