/**
 * Vite plugin to add API endpoints for Jira refresh and release management
 */
import { fetchAndWriteIssues } from './jiraFetcher.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RELEASES_PATH = path.join(__dirname, '..', 'public', 'releases.json')

/**
 * Parse JSON body from request
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<object>}
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Read releases from file, return empty array if not exists
 * @returns {Promise<{releases: Array}>}
 */
async function readReleases() {
  try {
    const content = await fs.readFile(RELEASES_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { releases: [] }
    }
    throw error
  }
}

/**
 * Write releases to file
 * @param {object} data
 * @returns {Promise<void>}
 */
async function writeReleases(data) {
  await fs.writeFile(RELEASES_PATH, JSON.stringify(data, null, 2))
}

/**
 * Creates a Vite plugin that handles API requests
 * @returns {import('vite').Plugin}
 */
export function jiraRefreshPlugin() {
  return {
    name: 'jira-refresh',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // GET /api/releases - Read releases
        if (req.method === 'GET' && req.url === '/api/releases') {
          try {
            const data = await readReleases()
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end(JSON.stringify(data))
          } catch (error) {
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          }
          return
        }

        // POST /api/releases - Save releases
        if (req.method === 'POST' && req.url === '/api/releases') {
          try {
            const body = await parseJsonBody(req)
            await writeReleases(body)
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end(JSON.stringify({ success: true }))
          } catch (error) {
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: error.message }))
          }
          return
        }

        // POST /api/refresh - Fetch issues from Jira
        if (req.method === 'POST' && req.url === '/api/refresh') {
          console.log('Received refresh request...')

          try {
            const body = await parseJsonBody(req)
            const { targetRelease } = body

            if (!targetRelease) {
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 400
              res.end(JSON.stringify({
                success: false,
                count: 0,
                error: 'targetRelease is required'
              }))
              return
            }

            const result = await fetchAndWriteIssues(targetRelease)

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
