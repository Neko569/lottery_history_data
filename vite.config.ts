import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
// base 使用相对路径，便于部署到任意 GitHub Pages 子路径
export default defineConfig({
  base: './',
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
    {
      name: 'exclude-ort-wasm-assets',
      // ONNX Runtime Web 的 .wasm 文件会被作为静态资源打包进 dist，
      // 但运行时已通过 wasmPaths 指向 jsDelivr CDN，本地副本无需部署。
      // Cloudflare Pages 单文件限制 25 MiB，需移除这些大体积 wasm 产物。
      generateBundle(_, bundle) {
        for (const fileName of Object.keys(bundle)) {
          if (/^assets\/ort-.*\.wasm(\.map)?$/.test(fileName)) {
            delete bundle[fileName];
          }
        }
      },
    },
  ],
})
