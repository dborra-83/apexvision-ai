import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './backend',
    include: ['tests/integration/**/*.integration.ts'],
    testTimeout: 30000,
  },
});
