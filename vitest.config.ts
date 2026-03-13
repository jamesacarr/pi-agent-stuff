import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    coverage: {
      include: ['extensions/**', 'skills/**'],
    },
    environment: 'node',
    mockReset: true,
  },
});
