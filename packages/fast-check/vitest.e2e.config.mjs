import { defineConfig } from 'vitest/config';

import rootConfig from './vitest.config.mjs';

export default defineConfig({
  ...rootConfig,
  test: {
    ...rootConfig.test,
    include: ['test/e2e/**/*.spec.?(c|m)[jt]s?(x)'],
  },
});
