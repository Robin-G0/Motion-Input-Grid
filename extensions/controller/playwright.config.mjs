import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"tests/browser",workers:1,timeout:45000,reporter:"list",use:{trace:"retain-on-failure"}});
