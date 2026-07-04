import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Resolve the proxy target from VITE_API_BASE_URL so dev follows whichever
  // env is active (local / staging / prod) instead of hardcoding production.
  const env = loadEnv(mode, process.cwd(), "");
  let proxyOrigin = "https://assessment.zecdata.com";
  try {
    if (env.VITE_API_BASE_URL) {
      proxyOrigin = new URL(env.VITE_API_BASE_URL).origin;
    }
  } catch {
    // fall through to default
  }

  return {
    base: "/",

    server: {
      host: "::",
      port: 3000,
      proxy: {
        "/v1": {
          target: proxyOrigin,
          changeOrigin: true,
          secure: true,
        },
        "/api": {
          target: proxyOrigin,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    build: {
      outDir: "dist",
      chunkSizeWarningLimit: 1000,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core framework — loaded on every page
            "vendor-react": ["react", "react-dom"],
            "vendor-router": ["react-router-dom"],
            "vendor-redux": ["@reduxjs/toolkit", "react-redux"],
            // UI primitives — loaded on most pages
            "vendor-radix": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-select",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
              "@radix-ui/react-label",
              "@radix-ui/react-slot",
              "@radix-ui/react-tabs",
            ],
            // Animation lib used across many pages — one shared chunk.
            "vendor-motion": ["framer-motion"],
            // Monaco is large; keep it in a single shared async chunk so it's
            // deduped across the code-editor screens.
            "vendor-monaco": ["@monaco-editor/react", "monaco-editor"],
            // Everything else (jspdf, html2canvas, sweetalert2, etc.)
            // stays with the lazy chunks that import them — NOT eagerly loaded
          },
        },
      },
    },
  };
});
