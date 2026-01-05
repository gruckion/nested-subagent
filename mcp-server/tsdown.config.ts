import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'esm',
  target: 'node18',
  clean: true,
  // Bundle all dependencies into a single file
  noExternal: [/.*/]
})
