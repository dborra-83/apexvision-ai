import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './backend',
    include: ['tests/unit/**/*.test.ts', 'tests/property/**/*.property.ts'],
  },
});
