import { defineConfig } from "@playwright/test";
const baseURL = `http://127.0.0.1:${process.env.PORT ?? 4173}/Motion-Input-Grid/`;

export default defineConfig({
    testDir: "./tests/browser",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: "list",
    use: {
        baseURL,
        locale: "fr-FR",
        trace: "retain-on-failure"
    },
    webServer: {
        command: "node scripts/serve.mjs",
        url: baseURL,
        reuseExistingServer: !process.env.CI
    },
    projects: [
        { name: "chromium", use: { browserName: "chromium" } },
        { name: "firefox", use: { browserName: "firefox" } }
    ]
});
