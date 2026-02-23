import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs';
import swc from 'unplugin-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { resolve } from 'path'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'

const configPath = path.resolve(__dirname, 'extension_configuration.json');
const configuration = JSON.parse(readFileSync(configPath, 'utf8'));
const fileName = configuration.file.split('/').pop()?.replace('.js', '');

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
        ]
      }
    }),
    tailwindcss(),
    cssInjectedByJs(),
    swc.vite({
      jsc: {
        target: 'es2020',
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic'
          }
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.tsx'),
      name: 'variant-converter',
      fileName: fileName,
      formats: ['es'],
    },
    minify: mode === 'development' ? false : 'terser',
    ...(mode === 'development' && {
      sourcemap: false,
      cssCodeSplit: false,
      emptyOutDir: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: Infinity,
    })
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    global: {},
    process: {
      env: {},
    },
  },
  ...(mode === 'development' && {
    optimizeDeps: {
      include: ['react', 'react-dom'],
      force: false,
      esbuildOptions: {
        target: 'es2020',
        treeShaking: false
      }
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
      target: 'es2020',
      treeShaking: false,
      legalComments: 'none',
    }
  })
}))
