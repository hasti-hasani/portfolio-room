# Portfolio Studio: notes for working on this project

A walk-through 3D portfolio room (three.js r160, Vite, plain JS, no framework). Live at
https://hasti-hasani.github.io/portfolio-room/. Pushing to `main` lints, builds and deploys (`.github/workflows/deploy.yml`),
so a push publishes the live site. README.md has the commands and folder map; this file has what the code doesn't say.

## How the studio runs

- `src/main.js` builds the room in a **fixed order**. Floor, curtains, plants, books and garments draw from one shared
  random sequence (`rnd` in util.js), so reordering or adding `rnd()` calls changes how they look.
- **Render on demand** (`core/frame.js`, `systems/loop.js`): a frame is drawn only when the camera moves, something
  animates, or `invalidate()` was called. Anything that changes the picture outside the loop must call `invalidate()`.
- **`frame.hold`**: nothing is drawn while loading. `ready()` in main.js compiles every shader in one parallel batch
  (`compileAsync`), then releases the hold. Drawing during loading compiled shaders one by one on the main thread
  (about 23 s on Intel HD 520). Don't add rendering before `ready()`.
- **Shadows are baked**: `shadowMap.autoUpdate = false`. Set `shadows.dirty = true` when a shadow caster appears or the sun
  toggles. Anything that moves (in `KEEP_APART` in main.js) must not cast shadows.
- **Merging** (`systems/optimize.js`): after building, sibling meshes with the same material are welded into one.
  A mesh is left alone if it has `userData` (clickable or walkable), is in `KEEP_APART`, or is transparent or emissive.
  To keep a mesh separate, give it `userData`.
- **Picking** (`systems/picking.js`): three-mesh-bvh trees, built in idle time. Set `userData.noPick = true` on meshes
  that must never be clicked (the picking code then skips them entirely).
- **Day/night** (`systems/mood.js`): every light value is blended between a day and a night value in the `MOOD` table.
  `warmMoods()` precompiles the shaders for the other light setups after load. Toggling a light's `visible` changes
  the light count and so needs new shaders; keep the stages in `warmMoods` in sync if lights change.
- **Quality**: `HQ` is false only when opened as a `file://` page (plain colours, no textures).
  `isTouch` (pointer: coarse) picks 512 textures, 1024 canvases, 4× filtering; desktop gets 1k, 2048 and 8×.
  Auto quality (`systems/quality.js`) caps at 30 fps, then steps resolution 1.5 → 1.25 → 1.

## Look: where the knobs are

- Daylight brightness: `DAY_EXPOSURE` in `core/renderer.js` (0.85; 1.05 looked washed out), the hemisphere light in
  `world/lights.js` (0.5), and the ceiling glow in the `MOOD` table (0.15 by day). Night values are pinned separately
  in `mood.js` (`NIGHT_EXPOSURE`, hemi 0.126), so changing the day doesn't change the night.
- Oak and plaster use a fixed roughness (0.73, 0.93) instead of roughness maps; their maps barely varied.

## Assets

- Everything in `public/assets/` is served as-is, and the service worker caches it (see below).
- Music: AAC 96 kbps `.m4a` (re-encoded from the original mp3; credit in `public/assets/CREDITS.txt` must stay).
- FFmpeg is installed on this PC via winget, at
  `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\`
  (not on PATH in older shells).
- Measure a texture before shrinking it: `ffmpeg -i x.webp -vf "format=gray,signalstats,metadata=print:file=-" -f null -`
  gives its value range; a near-flat map can be replaced by a number.

## Service worker (`public/sw.js`)

Production builds only, registered after `ready()`. It serves the page network-first, `static/` cache-first (the file
names are hashed) and `assets/` from the cache while refreshing it in the background. Music isn't cached (range requests).
**If an asset's content changes but its name doesn't, returning visitors see the old file once, then the new one.**
To force a refresh, rename the file or bump `CACHE` in sw.js. Add `?nosw` to a URL to bypass the worker.

## Testing in a browser (headless Chrome, no installs)

```
npm run build && npm run preview            # http://localhost:4173
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir=<temp dir> --window-size=1280,720 --autoplay-policy=no-user-gesture-required about:blank
node tools/shoot.mjs   http://localhost:4173/?stats <out-prefix>   # day + night screenshots, console errors
node tools/smoke.mjs   http://localhost:4173/?stats <outdir>       # hover sweep, click-to-walk, mood, music
node tools/profile.mjs http://localhost:4173/?stats                # CPU self-time + network timeline until ready
node tools/swtest.mjs                                              # first vs repeat visit through the service worker
```

For readable function names in `profile.mjs`, build with `npx vite build --minify false --outDir <temp>` and preview
that on another port. Chrome replays an open page's old console messages, so start a run from `about:blank`.
`?stats` shows fps, slow frames, startup phases (ms), draw calls, triangles and the number of shader programs.

## Measured on this PC (Intel HD 520, Chrome, production build)

- "Step inside" ready ≈ 14–16 s: page 2.9, build 1.8, merge 0.4, textures 2.3, **shaders ≈ 6.7** (GPU-bound, parallel).
  It was ≈ 40 s before `frame.hold`.
- 81 shader programs (about 27 per light setup × day / transition / night). Fewer material variants means a faster start.
- 104 draw calls, 118k triangles.

## Decisions already made

- **three.js stays at r160.** The `three-upgrade` branch (r187) works, but three.js grows from 141 to 160 KB gzipped
  with no gain for this scene.
- **No KTX2 textures:** the transcoder adds ~200 KB per visitor to save GPU memory that isn't tight; the largest
  GPU users are canvas textures painted at runtime, which KTX2 can't compress.
- **Window view stays 2048 on desktop:** standing at the window, it fills ~2000 device pixels.
- Lambert materials and lighting cuts were set aside until a phone profile shows the frame time is spent on pixels.

## Open items

- Profile on a real mid-range phone with `?stats` (startup line, "code per frame", jerks).
- Fewer shader variants: e.g. keep the floor lamp or the sun always in the scene (intensity 0) so day/night share one
  light setup. That's a trade between startup time and per-pixel cost.
- No favicon (a 404 on every visit). Sharing preview (Open Graph image) not set up yet.
