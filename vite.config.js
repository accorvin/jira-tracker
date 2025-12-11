import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { jiraRefreshPlugin } from './server/vitePluginJiraRefresh.js'

export default defineConfig({
  plugins: [
    vue(),
    jiraRefreshPlugin()
  ],
})
