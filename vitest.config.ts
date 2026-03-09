import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      thresholds: {
        statements: 43,
        branches: 37,
        functions: 43,
        lines: 44,
      },
      include: ['src/**/*.{ts,tsx}', 'control-plane-api/src/**/*.mjs'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx,mjs}',
        'src/test/**',
        'src/types/**',
        'src/mocks/**',
        'src/app/**/loading.tsx',
        'src/app/**/not-found.tsx',
        'src/app/global-error.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
