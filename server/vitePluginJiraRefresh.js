/**
 * Vite plugin to add /api/refresh endpoint for fetching Jira issues
 */
import { fetchAndWriteIssues } from './jiraFetcher.js'

/**
 * Creates a Vite plugin that handles POST /api/refresh requests
 * @returns {import('vite').Plugin}
 */
export function jiraRefreshPlugin() {
  return {
    name: 'jira-refresh',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only handle POST /api/refresh
        if (req.method === 'POST' && req.url === '/api/refresh') {
          console.log('Received refresh request...')

          try {
            const result = await fetchAndWriteIssues()

            res.setHeader('Content-Type', 'application/json')
            res.statusCode = result.success ? 200 : 500
            res.end(JSON.stringify(result))
          } catch (error) {
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 500
            res.end(JSON.stringify({
              success: false,
              count: 0,
              error: error.message
            }))
          }
          return
        }

        next()
      })
    }
  }
}
