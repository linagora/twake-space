# Joint session history of a page and its cross-origin frames

What Chromium, Firefox and WebKit do with the browser history shared by
TwakeSpace and the frames of the embedded apps (ADR 010). The page stands on
`localhost:8001`, the app on `localhost:8002`: two origins, one site, as in
production.

- `server.mjs`: both origins, with `/redirect?to=` (302), `/slow?ms=&to=`
  (302 after a delay), `/app/<resource>[/...]` (the app page) and the files
  of `public/`.
- `public/host.html`: the TwakeSpace stand-in. Inserts, hides, removes frames,
  changes their `src`, counts its `popstate`, receives the app's messages.
- `public/app.html`: the app stand-in. A `bootId` per document tells a frame
  kept alive from one that reloaded. `goTo(sub, {push})` writes a path with
  `replaceState` or `pushState` and reports it; `load` and `navigate`
  messages are applied with `replaceState`; `nestedLogin()` runs a redirect
  in a nested frame, as a silent renew would.
- `public/callback.html`: an OIDC callback stand-in, replaces itself with the
  app after 2 s.
- `run.mjs`: the scenarios, one fresh context each, a snapshot after every
  step. `node run.mjs` runs everything on the three engines and writes
  `results.md`. `node run.mjs 6 10d --browser=chromium` runs a subset and
  writes `results-6_10d-chromium.md`.
- `results.md`: the measured matrix (Playwright 1.63: chromium 153,
  firefox 155, webkit 26.6).
- `pr10-comment.md`: the comment posted on linagora/twake-space-architecture#10.
- `adr010-amendment.diff`: the matching amendment of `ADR010.md`.

## Running

```sh
node server.mjs &          # keeps running
node run.mjs               # about 25 minutes for the three engines
```

Install first: `npm i && npx playwright install chromium firefox webkit`
(WebKit also needs `npx playwright install-deps webkit`).

## What the matrix says

1. Removing a frame removes its history entries in Firefox only. Chromium and
   WebKit keep them as dead entries: Back lands on them, restores the page URL
   recorded with them, and otherwise does nothing (5, 5b, 7).
2. A frame adds no entry when it is inserted, calls `replaceState`,
   `location.replace`, or follows a 302. It adds one with `pushState`,
   `location.assign`, `location.href =`, or when the page changes its `src`
   (1, 2, 3, 4).
3. One frame per app, switching resource on `load` with `replaceState` only,
   survives space changes, Back and Forward with the same document in the
   three engines (11).
4. Chromium only: when the page traverses between two of its own entries, a
   frame whose recorded document differs from its current one is reloaded.
   A cross-document navigation of the frame after a page `pushState` is the
   trigger, the silent login during a tab change the realistic case, the OIDC
   callback replayed the worst one (6, 6b, 9, 10, 10c, 10d). Entries older
   than the frame, or newer than its last document, are safe (6f, 6g). A
   login in a nested frame never moves the app document and is immune (13).
