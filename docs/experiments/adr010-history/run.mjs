// Measures what Chromium, Firefox and WebKit do with the joint session
// history of a page (localhost:8001) and its cross-origin frames
// (localhost:8002). Usage: node run.mjs [scenario...] [--browser=name]
import { chromium, firefox, webkit } from 'playwright'
import { writeFile } from 'node:fs/promises'

const HOST = 'http://localhost:8001'
const SETTLE = 1300
const args = process.argv.slice(2)
const only = args.filter(a => !a.startsWith('--'))
const browserFilter = args.find(a => a.startsWith('--browser='))?.slice(10)

// ---- snapshots -----------------------------------------------------------

async function snapshot(page) {
  const top = await page.evaluate(() => ({
    len: history.length,
    url: location.pathname + location.search,
    pops: window.pops ?? '-',
    state: history.state === null ? '' : JSON.stringify(history.state)
  }))
  const frames = []
  for (const el of await page.$$('iframe')) {
    const id = await el.getAttribute('id')
    const f = await el.contentFrame()
    if (!f) { frames.push(`${id}: no frame`); continue }
    let s
    try {
      s = await f.evaluate(() => ({
        url: location.pathname + location.search,
        boot: window.bootId ?? '?',
        pops: window.pops ?? '-'
      }))
    } catch (e) {
      s = { url: f.url().replace('http://localhost:8002', ''), boot: '?', pops: '?' }
    }
    frames.push(`${id}: ${s.url} boot=${s.boot} pops=${s.pops}`)
  }
  return `len=${top.len} top=${top.url} pops=${top.pops}${top.state ? ' state=' + top.state : ''}` +
    (frames.length ? ' │ ' + frames.join(' │ ') : ' │ (no frame)')
}

// ---- helpers ------------------------------------------------------------

async function open(page) {
  await page.goto(`${HOST}/blank.html`)
  await page.goto(`${HOST}/host.html`)
}

async function frameOf(page, id) {
  const el = await page.$(`#${id}`)
  return el ? el.contentFrame() : null
}

async function addFrame(page, opts) {
  await page.evaluate(o => window.addFrame(o), opts)
  // wait for the app to boot
  for (let i = 0; i < 50; i++) {
    const f = await frameOf(page, opts.name)
    try {
      if (f && (await f.evaluate(() => window.bootId))) return
    } catch {}
    await page.waitForTimeout(100)
  }
  throw new Error('frame never booted')
}

async function inFrame(page, id, fn, arg) {
  const f = await frameOf(page, id)
  // a navigating frame may throw: fire and forget the navigation calls
  return f.evaluate(fn, arg).catch(() => undefined)
}

const back = page => page.evaluate(() => history.back())
const forward = page => page.evaluate(() => history.forward())

// ---- scenarios ----------------------------------------------------------
// Each scenario is a list of steps: [label, async (page) => void]. The runner
// takes a snapshot after each step.

const scenarios = {
  '1-insert-frame': [
    ['open blank then host', open],
    ['append frame A, src set before append', p => addFrame(p, { name: 'A', path: '/app/A' })],
    ['append frame B, src set after append', p => addFrame(p, { name: 'B', path: '/app/B', srcAfter: true })],
    ['append unnamed frame C', p => addFrame(p, { name: 'C', path: '/app/C', unnamed: true })],
    ['append hidden frame D', p => addFrame(p, { name: 'D', path: '/app/D', hidden: true })]
  ],

  '2-frame-same-document': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: replaceState x3', p => inFrame(p, 'A', () => { window.goTo('r1'); window.goTo('r2'); window.goTo('r3') })],
    ['A: pushState x1', p => inFrame(p, 'A', () => window.goTo('p1', { push: true }))],
    ['top: history.back()', back],
    ['top: history.forward()', forward]
  ],

  '3-frame-cross-document': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: location.replace(/app/B)', p => inFrame(p, 'A', () => location.replace('/app/B'))],
    ['A: location.replace(/redirect 302 -> /app/C)', p => inFrame(p, 'A', () => location.replace('/redirect?to=/app/C'))],
    ['A: location.assign(/app/D)', p => inFrame(p, 'A', () => location.assign('/app/D'))],
    ['A: location.href = /redirect 302 -> /app/E', p => inFrame(p, 'A', () => { location.href = '/redirect?to=/app/E' })],
    ['top: history.back()', back],
    ['top: history.back()', back],
    ['top: history.back()', back]
  ],

  '4-host-changes-src': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['host: iframe.src = /app/B', p => p.evaluate(() => window.setFrameSrc('A', '/app/B'))],
    ['top: history.back()', back],
    ['top: history.forward()', forward]
  ],

  '5-remove-frame-with-entries': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: pushState x2', p => inFrame(p, 'A', () => { window.goTo('p1', { push: true }); window.goTo('p2', { push: true }) })],
    ['host: remove A', p => p.evaluate(() => window.removeFrame('A'))],
    ['top: history.back()', back]
  ],

  '5b-remove-hidden-frame-after-host-push': [
    ['open + hidden frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A', hidden: true }) }],
    ['A: pushState x2', p => inFrame(p, 'A', () => { window.goTo('p1', { push: true }); window.goTo('p2', { push: true }) })],
    ['host: pushState(?space=2)', p => p.evaluate(() => history.pushState({ space: 2 }, '', '/host.html?space=2'))],
    ['host: remove A', p => p.evaluate(() => window.removeFrame('A'))],
    ['top: history.back()', back],
    ['top: history.back()', back]
  ],

  '6-top-push-then-frame-cross-doc-then-back': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['host: pushState(?space=2)', p => p.evaluate(() => history.pushState({ space: 2 }, '', '/host.html?space=2'))],
    ['A: location.replace(/app/B)', p => inFrame(p, 'A', () => location.replace('/app/B'))],
    ['top: history.back()', back],
    ['top: history.forward()', forward]
  ],

  '6b-same-with-302': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['host: pushState(?space=2)', p => p.evaluate(() => history.pushState({ space: 2 }, '', '/host.html?space=2'))],
    ['A: location.replace(/redirect 302 -> /app/B)', p => inFrame(p, 'A', () => location.replace('/redirect?to=/app/B'))],
    ['top: history.back()', back],
    ['top: history.forward()', forward]
  ],

  '6c-control-frame-cross-doc-before-top-push': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: location.replace(/app/B)', p => inFrame(p, 'A', () => location.replace('/app/B'))],
    ['host: pushState(?space=2)', p => p.evaluate(() => history.pushState({ space: 2 }, '', '/host.html?space=2'))],
    ['top: history.back()', back],
    ['top: history.forward()', forward]
  ],

  '6d-top-push-then-frame-replaceState-then-back': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['host: pushState(?space=2)', p => p.evaluate(() => history.pushState({ space: 2 }, '', '/host.html?space=2'))],
    ['A: replaceState(/app/A/r1)', p => inFrame(p, 'A', () => window.goTo('r1'))],
    ['top: history.back()', back],
    ['top: history.forward()', forward]
  ],

  '6e-top-push-then-frame-cross-doc-then-back-to-blank': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: location.replace(/app/B)', p => inFrame(p, 'A', () => location.replace('/app/B'))],
    ['top: history.back() (leaves host.html)', back],
    ['top: history.forward() (returns to host.html)', forward],
    ['host: re-add frame A as on a fresh load', p => addFrame(p, { name: 'A', path: '/app/A' })]
  ],

  '6f-top-push-before-insertion-then-frame-cross-doc-then-back': [
    ['open, host pushState(?space=2), then frame A', async p => { await open(p); await p.evaluate(() => history.pushState({ space: 2 }, '', '/host.html?space=2')); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: location.replace(/app/B) (the silent login)', p => inFrame(p, 'A', () => location.replace('/app/B'))],
    ['top: history.back() (to an entry older than the frame)', back],
    ['top: history.forward()', forward]
  ],

  '6g-host-pushes-after-frame-boot-then-back': [
    ['open, frame A, A: location.replace(/app/B) (login done)', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }); await inFrame(p, 'A', () => location.replace('/app/B')); await p.waitForTimeout(500) }],
    ['host: pushState x2 (paths), A: replaceState', async p => { await p.evaluate(() => { history.pushState({ p: 1 }, '', '/host.html?p=1'); history.pushState({ p: 2 }, '', '/host.html?p=2') }); await inFrame(p, 'A', () => window.goTo('r1')) }],
    ['top: back()', back],
    ['top: back()', back],
    ['top: forward() x2', async p => { await forward(p); await p.waitForTimeout(400); await forward(p) }]
  ],

  '10c-host-push-while-frame-login-pending-then-back': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: location.replace(/slow 2500ms -> /app/B); host pushState(?tab=other) at once', async p => {
      await inFrame(p, 'A', () => location.replace('/slow?ms=2500&to=/app/B'))
      await p.waitForTimeout(200)
      await p.evaluate(() => history.pushState({ tab: 'other' }, '', '/host.html?tab=other'))
    }],
    ['wait 3 s', p => p.waitForTimeout(3000)],
    ['top: back()', back],
    ['top: forward()', forward]
  ],

  '7-adr-model-replace-frame-same-name': [
    ['open + frame N (/app/A)', async p => { await open(p); await addFrame(p, { name: 'N', path: '/app/A' }) }],
    ['N: pushState x1', p => inFrame(p, 'N', () => window.goTo('p1', { push: true }))],
    ['host: pushState(?space=2)', p => p.evaluate(() => history.pushState({ space: 2 }, '', '/host.html?space=2'))],
    ['host: remove N, add N again (/app/B)', async p => { await p.evaluate(() => window.removeFrame('N')); await addFrame(p, { name: 'N', path: '/app/B' }) }],
    ['top: history.back()', back],
    ['top: history.back()', back],
    ['top: history.forward()', forward]
  ],

  '7b-adr-model-no-frame-push': [
    ['open + frame N (/app/A)', async p => { await open(p); await addFrame(p, { name: 'N', path: '/app/A' }) }],
    ['N: location.replace(/app/A/logged-in)', p => inFrame(p, 'N', () => location.replace('/app/A/logged-in'))],
    ['host: pushState(?space=2)', p => p.evaluate(() => history.pushState({ space: 2 }, '', '/host.html?space=2'))],
    ['host: remove N, add N again (/app/B)', async p => { await p.evaluate(() => window.removeFrame('N')); await addFrame(p, { name: 'N', path: '/app/B' }) }],
    ['top: history.back()', back],
    ['top: history.forward()', forward]
  ],

  '8-reload-top': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: location.replace(/app/B)', p => inFrame(p, 'A', () => location.replace('/app/B'))],
    ['top: reload', p => p.reload()],
    ['host: add frame A again (src /app/A)', p => addFrame(p, { name: 'A', path: '/app/A' })]
  ],

  '8b-reload-top-after-frame-push': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: pushState(/app/A/p1)', p => inFrame(p, 'A', () => window.goTo('p1', { push: true }))],
    ['top: reload', p => p.reload()],
    ['host: add frame A again (src /app/A)', p => addFrame(p, { name: 'A', path: '/app/A' })]
  ],

  '8c-reload-top-after-frame-replaceState': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: replaceState(/app/A/r1)', p => inFrame(p, 'A', () => window.goTo('r1'))],
    ['top: reload', p => p.reload()],
    ['host: add frame A again (src /app/A)', p => addFrame(p, { name: 'A', path: '/app/A' })]
  ],

  '8d-reload-top-unnamed-frame-after-cross-doc': [
    ['open + unnamed frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A', unnamed: true }) }],
    ['A: location.replace(/app/B)', p => inFrame(p, 'A', () => location.replace('/app/B'))],
    ['top: reload', p => p.reload()],
    ['host: add unnamed frame A again (src /app/A)', p => addFrame(p, { name: 'A', path: '/app/A', unnamed: true })]
  ],

  '9-hidden-frame-top-push-cross-doc-back': [
    ['open + frame A, then hide it', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }); await p.evaluate(() => window.setHidden('A', true)) }],
    ['host: pushState(?tab=other)', p => p.evaluate(() => history.pushState({ tab: 'other' }, '', '/host.html?tab=other'))],
    ['A (hidden): location.replace(/app/A/relogged)', p => inFrame(p, 'A', () => location.replace('/app/A/relogged'))],
    ['top: history.back()', back],
    ['host: show A again', p => p.evaluate(() => window.setHidden('A', false))]
  ],

  '10-back-during-slow-frame-redirect': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['host: pushState(?space=2)', p => p.evaluate(() => history.pushState({ space: 2 }, '', '/host.html?space=2'))],
    ['A: location.replace(/slow 2500ms -> /app/B), then top back() at once', async p => {
      await inFrame(p, 'A', () => location.replace('/slow?ms=2500&to=/app/B'))
      await p.waitForTimeout(200)
      await back(p)
    }],
    ['wait 3 s', p => p.waitForTimeout(3000)],
    ['top: history.forward()', forward]
  ],

  '10b-back-during-slow-frame-redirect-no-top-entry': [
    ['open + frame A, host push', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: location.replace(/slow 2500ms -> /app/B), then top back() to blank at once', async p => {
      await inFrame(p, 'A', () => location.replace('/slow?ms=2500&to=/app/B'))
      await p.waitForTimeout(200)
      await back(p)
    }],
    ['wait 3 s', p => p.waitForTimeout(3000)],
    ['top: history.forward()', forward]
  ],

  '10d-host-push-while-frame-on-callback-then-back': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: location.replace(/slow 1000ms -> /callback.html); host pushState(?tab=other) at 1.4 s, while A is on the callback', async p => {
      await inFrame(p, 'A', () => location.replace('/slow?ms=1000&to=/callback.html'))
      await p.waitForTimeout(1400)
      await p.evaluate(() => history.pushState({ tab: 'other' }, '', '/host.html?tab=other'))
    }],
    ['wait 3 s (callback replaced itself with /app/B)', p => p.waitForTimeout(3000)],
    ['top: back()', back],
    ['wait 3 s', p => p.waitForTimeout(3000)],
    ['top: forward()', forward]
  ],

  '13-silent-login-in-a-nested-frame': [
    ['open + frame A', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['host: pushState(?p=1)', p => p.evaluate(() => history.pushState({ p: 1 }, '', '/host.html?p=1'))],
    ['A: nested frame /redirect 302 -> /blank.html, removed once loaded', p => inFrame(p, 'A', () => window.nestedLogin())],
    ['host: pushState(?p=2)', p => p.evaluate(() => history.pushState({ p: 2 }, '', '/host.html?p=2'))],
    ['A: nested login again', p => inFrame(p, 'A', () => window.nestedLogin())],
    ['top: back()', back],
    ['top: back()', back],
    ['top: forward() x2', async p => { await forward(p); await p.waitForTimeout(400); await forward(p) }]
  ],

  '11-host-owns-history-end-to-end': [
    ['open, host owns history, frame A for resource A', async p => {
      await open(p)
      await p.evaluate(() => {
        window.resource = 'A'
        history.replaceState({ resource: 'A', path: '/app/A' }, '', '/host.html?space=A')
        window.onAppMessage = m => {
          if (m.type !== 'path' || m.resourceId !== window.resource) { window.ignored = (window.ignored ?? 0) + 1; return }
          const sub = m.path.slice(('/app/' + m.resourceId).length)
          history.pushState({ resource: m.resourceId, path: m.path }, '', `/host.html?space=${m.resourceId}&p=${encodeURIComponent(sub)}`)
        }
        addEventListener('popstate', e => {
          const s = e.state
          if (!s) return
          if (s.resource !== window.resource) { window.resource = s.resource; window.send('F', { type: 'load', resourceId: s.resource }) }
          window.send('F', { type: 'navigate', path: s.path })
        })
      })
      await addFrame(p, { name: 'F', path: '/app/A' })
    }],
    ['app: goTo(inbox) then goTo(msg1) (replaceState + path message)', p => inFrame(p, 'F', () => { window.goTo('inbox'); window.goTo('msg1') })],
    ['host: space change to B (pushState + load message)', p => p.evaluate(() => {
      window.resource = 'B'
      history.pushState({ resource: 'B', path: '/app/B' }, '', '/host.html?space=B')
      window.send('F', { type: 'load', resourceId: 'B' })
    })],
    ['app: goTo(inbox) in B', p => inFrame(p, 'F', () => window.goTo('inbox'))],
    ['top: back()', back],
    ['top: back()', back],
    ['top: back()', back],
    ['top: back()', back],
    ['top: forward() x4', async p => { for (let i = 0; i < 4; i++) { await forward(p); await p.waitForTimeout(400) } }],
    ['late message of resource A ignored?', async p => {
      await inFrame(p, 'F', () => parent.postMessage({ type: 'path', path: '/app/A/stale', resourceId: 'A' }, '*'))
      await p.waitForTimeout(300)
      const n = await p.evaluate(() => window.ignored ?? 0)
      await p.evaluate(n => { window.pops = `${window.pops} ignored=${n}` }, n)
    }]
  ],

  '12-adr-today-back-moves-a-hidden-frame': [
    ['open + frame A (tasks)', async p => { await open(p); await addFrame(p, { name: 'A', path: '/app/A' }) }],
    ['A: pushState x1 (user navigates in tasks)', p => inFrame(p, 'A', () => window.goTo('p1', { push: true }))],
    ['host: tab change: hide A, pushState(?tab=mail), add frame B', async p => {
      await p.evaluate(() => { window.setHidden('A', true); history.pushState({ tab: 'mail' }, '', '/host.html?tab=mail') })
      await addFrame(p, { name: 'B', path: '/app/B' })
    }],
    ['top: back()  (user expects the tasks tab)', back],
    ['top: back()', back]
  ]
}

// ---- runner -------------------------------------------------------------

const browsers = { chromium, firefox, webkit }
const selected = Object.entries(scenarios).filter(([k]) => only.length === 0 || only.some(o => k.startsWith(o)))
const out = {}
for (const [bname, type] of Object.entries(browsers)) {
  if (browserFilter && bname !== browserFilter) continue
  const browser = await type.launch()
  const version = browser.version()
  console.log(`\n==== ${bname} ${version}`)
  for (const [name, steps] of selected) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const lines = []
    console.log(`\n--- ${name}`)
    for (const [label, fn] of steps) {
      let result
      try {
        await fn(page)
        await page.waitForTimeout(SETTLE)
        result = await snapshot(page)
      } catch (e) {
        result = 'ERROR ' + e.message.split('\n')[0]
      }
      console.log(`  ${label}\n      ${result}`)
      lines.push([label, result])
    }
    out[name] ??= {}
    out[name][`${bname} ${version}`] = lines
    await context.close()
  }
  await browser.close()
}

// ---- markdown -----------------------------------------------------------

let md = '# Joint session history: measured behaviour\n\nGenerated by `run.mjs`. Snapshot after each step: `len` is `history.length` at the top, `top` its URL, `pops` its popstate count, then each frame with its URL, its `bootId` (a new document gets a new one) and its popstate count.\n'
for (const [name, byBrowser] of Object.entries(out)) {
  md += `\n## ${name}\n\n`
  const engines = Object.keys(byBrowser)
  md += `| step | ${engines.join(' | ')} |\n|---|${engines.map(() => '---').join('|')}|\n`
  const n = Math.max(...engines.map(e => byBrowser[e].length))
  for (let i = 0; i < n; i++) {
    const label = byBrowser[engines[0]][i]?.[0] ?? ''
    md += `| ${label} | ${engines.map(e => '`' + (byBrowser[e][i]?.[1] ?? '') + '`').join(' | ')} |\n`
  }
}
if (only.length === 0 && !browserFilter) await writeFile(new URL('./results.md', import.meta.url), md)
else await writeFile(new URL(`./results-${only.join('_') || 'all'}${browserFilter ? '-' + browserFilter : ''}.md`, import.meta.url), md)
