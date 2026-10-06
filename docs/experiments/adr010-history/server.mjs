// Two origins, as TwakeSpace (8001) and an embedded app (8002) would be.
// Routes shared by both ports:
//   /redirect?to=<path>            302 to <path>
//   /slow?ms=<n>&to=<path>         302 to <path> after n ms
//   /app/<resource>[/...]          the app page (any depth)
//   anything else                  a file in public/
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), 'public')

async function handle(req, res) {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/redirect') {
    res.writeHead(302, { Location: url.searchParams.get('to') })
    return res.end()
  }
  if (url.pathname === '/slow') {
    const ms = Number(url.searchParams.get('ms') ?? 2000)
    await new Promise(r => setTimeout(r, ms))
    res.writeHead(302, { Location: url.searchParams.get('to') })
    return res.end()
  }
  let file = url.pathname
  if (file.startsWith('/app')) file = '/app.html'
  try {
    const body = await readFile(join(root, file))
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
}

for (const port of [8001, 8002]) {
  createServer((req, res) => void handle(req, res)).listen(port, '127.0.0.1')
}
console.log('listening on 8001 (host) and 8002 (app)')
