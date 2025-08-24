import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

export default defineConfig([
  // Main Parallel entry point
  {
    input: 'src/Parallel.ts',
    output: {
      dir: 'dist/esm',
      format: 'es',
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
      sourcemap: true
    },
    external: [
      /^node:/,
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {})
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.esm.json',
        declaration: false,
        declarationMap: false,
        sourceMap: true,
        removeComments: true
      })
    ]
  },
  // eval.js worker script - standalone
  {
    input: 'src/eval.ts',
    output: {
      file: 'dist/esm/eval.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.esm.json',
        declaration: false,
        declarationMap: false,
        sourceMap: true,
        removeComments: true
      })
    ]
  }
]);




