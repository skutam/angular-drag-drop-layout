import {defineConfig} from '@playwright/test';

const base = process.env.DEMO_BASE ?? '/';
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: '../../dist/demo-results',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:4180${base}`,
    viewport: {width: 1280, height: 900},
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROME_BIN ? {executablePath: process.env.CHROME_BIN} : {},
  },
  webServer: {
    command: 'node scripts/serve-demo.mjs',
    cwd: '../..',
    url: `http://127.0.0.1:4180${base}`,
    reuseExistingServer: false,
  },
});
