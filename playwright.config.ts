import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 120000, workers: 1, retries: 0,
  expect: { timeout: 20000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Small functional viewport is explicit; it is NOT a 1080p/60-FPS benchmark.
    viewport: { width: 640, height: 400 },
    screenshot: 'only-on-failure',
    // Constant screencast readbacks stall CPU WebGL; retain DOM/source traces.
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
    channel: 'chromium',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: process.env.GPU_MODE === 'hardware' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] },
  },
  webServer: [
    { command: 'npm run dev -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
    { command: 'npm run preview -- --port 4174 --strictPort', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI },
  ],
});
