import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, existsSync, rmSync } from 'fs'

const __dirname = import.meta.dirname

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fix-sidepanel-html',
      writeBundle() {
        const distDir = resolve(__dirname, 'dist')
        const srcDir = resolve(distDir, 'src')
        const srcPath = resolve(srcDir, 'sidepanel.html')
        const destPath = resolve(distDir, 'sidepanel.html')

        // Move sidepanel.html from dist/src to dist/
        if (existsSync(srcPath)) {
          copyFileSync(srcPath, destPath)
        }

        // Remove the src directory
        if (existsSync(srcDir)) {
          rmSync(srcDir, { recursive: true })
        }

        // Fix asset paths in sidepanel.html (remove ../ prefix)
        if (existsSync(destPath)) {
          const fs = require('fs')
          let content = fs.readFileSync(destPath, 'utf-8')
          content = content.replace(/\.\.\/assets\//g, 'assets/')
          fs.writeFileSync(destPath, content)
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@tools': resolve(__dirname, 'src/tools'),
      '@background': resolve(__dirname, 'src/background'),
      '@content': resolve(__dirname, 'src/content'),
      '@cdp': resolve(__dirname, 'src/cdp'),
      '@ui': resolve(__dirname, 'src/ui'),
    }
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep background and content at root level
          if (chunkInfo.name === 'background' || chunkInfo.name === 'content') {
            return '[name].js'
          }
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
