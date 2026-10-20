import {defineConfig} from '@playwright/test';

const versions = process.env.COMPAT_ANGULAR ? [process.env.COMPAT_ANGULAR] : ['20', '21', '22'];
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: '../../dist/compatibility/results',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    viewport: {width: 1000, height: 900},
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROME_BIN ? {executablePath: process.env.CHROME_BIN} : {},
  },
  projects: versions.flatMap(version => ['zone', 'zoneless'].map(mode => ({
    name: `angular-${version}-${mode}`,
    metadata: {version, mode},
  }))),
  webServer: {
    command: 'node scripts/serve-compatibility.mjs',
    cwd: '../..',
    url: `http://127.0.0.1:4179/${versions[0]}/`,
    reuseExistingServer: false,
  },
});
