# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Browser-based multirotor flight simulator and survey mission planner for teaching. The shipped product is one self-contained `index.html` (three.js r128 inlined) that must run from a file, from GitHub Pages, and offline. `docs/DESIGN_NOTES.md` holds the architecture, conventions, and roadmap. Update it when a design decision changes.

## Commands

Node 18+. There are no dependencies, so there is nothing to install.

```
npm test            # headless tests (node test/run.js)
npm run build       # rebuild index.html from src/, then run build:docs
npm run build:docs  # rebuild docs/manual/index.html from docs/USER_MANUAL.md (node tools/build-docs.js)
npm run build:cdn   # dist/index.cdn.html, which loads three.js from cdnjs (dist/ is gitignored)
```

There is no test filter. To run a single test, temporarily comment out other `test(...)` calls in `test/run.js`, or run a quick `node -e` script that loads `src/js/00-sim.js` into a `vm` context the same way `test/run.js` does.

## Workflow rules

- Edit `src/`, never `index.html`. Then run the tests, rebuild, and commit both `src/` and the rebuilt `index.html`. The last test rebuilds `index.html` and fails if it changed, so a stale build fails the tests. Running `npm test` also rewrites `index.html` as a side effect.
- All authored text must be ASCII. `build.js` throws on any non-ASCII character in the output (CSS, template, and JS alike). Watch out for smart quotes, degree signs, em dashes, and similar characters.
- Don't add frameworks or runtime dependencies. three.js r128 in `vendor/` is the only one. JSZip and geotiff.js load on demand from a CDN, only for KMZ and GeoTIFF import.
- `docs/USER_MANUAL.md` is the source of the manual. `docs/manual/index.html` is generated from it by `tools/build-docs.js`. Never edit it by hand. After any change to the manual, run `npm run build:docs` (or `npm run build`) and commit both files. A test fails if the page is out of date. Unlike the `index.html` test, it does not rewrite the file.
- `legacy/v0.1/index.html` is a frozen copy. Don't edit it.
- Rendering and input have no automated tests, so changes there need a manual check in a browser.

## Project rules

- All authored text is ASCII only. No em dashes, en dashes, curly quotes, or Unicode arrows. The build fails on non-ASCII.
- Never edit `index.html` by hand. Edit files in `src/`, run `npm test`, run `npm run build`, and commit `src/` and `index.html` together.
- Every new behavior in the sim, planner math, or parsers needs a test in `test/run.js`.
- Work on a feature branch. Never push. The maintainer reviews and pushes.
- Update `CHANGELOG.md` and `docs/USER_MANUAL.md` when user-visible behavior changes. Never edit `docs/manual/index.html` by hand. It is generated from `docs/USER_MANUAL.md`, so rebuild it with `npm run build:docs` and commit it with the manual.
- Keep scientific and modeling constants in named parameter blocks (such as `PARAMS` in `00-sim.js`), never buried in logic.

## Architecture

**Build.** `build.js` concatenates every `src/js/*.js` file in file-name order into one script. It fills the `{{CSS}}`, `{{THREE}}`, and `{{APP}}` placeholders in `src/index.template.html`, and each placeholder must appear exactly once, on its own line.

**Docs build.** `tools/build-docs.js` converts `docs/USER_MANUAL.md` into `docs/manual/index.html` with its own small Markdown converter (headings, paragraphs, bold, inline code, links, flat lists, tables, code fences, rules). Unsupported Markdown throws. The page takes its CSS from the `<style>` block of `docs/labs/index.html` at build time and loads the fonts from `../labs/fonts/`, so a style change on the labs index also changes the manual and needs a docs rebuild. Every heading gets an id, and the list under "Contents" is linked to the matching `##` headings. A Contents entry with no matching heading throws.

**Shared scope, order-coupled fragments.** The v0.2 split into fragments was mechanical, not a real module system:
- `00-sim.js` runs at global scope. It holds the flight model (`Sim`, `PARAMS`, quaternion helpers, controllers, missions, and telemetry) and has no DOM or three.js dependency, so it can be tested headless. Keep it that way.
- `10-app-start.js` opens an IIFE (`(function(){`) and `90-main.js` closes it. All fragments in between share one function scope and use each other's variables directly (for example `sim`, `sticks`, `$`, and `store`). Because they are concatenated in file-name order, a fragment can't rely on top-level statements from a later fragment having run yet. Function declarations are hoisted.
- The numeric prefixes group the code by area: 20s for the scene, 30 for drills, 40 for input, 50s and 60s for the UI, environment, and sensors, 70s for the planner and import/export, 80 for rendering, and 90 for the main loop. Pick the prefix for a new fragment by where it has to run in the order.
- `90-main.js` runs a fixed 250 Hz physics step (`sim.step(H, sticks)` plus `drillStep`) inside a free-running `requestAnimationFrame` render loop.

**Sim interface.** The UI talks to the aircraft only through `command(name)`, `step(dt, sticks)`, `startMission(wps, speed, trig)`, `stopMission()`, and `telemetry()`, plus the input fields `mode`, `wind`, `windDir`, `avoid`, `landAssist`, and `thrCentered`. A future hardware link has to implement the same surface, so don't let UI code reach into other sim internals. Every modeling choice should be a named parameter in `PARAMS`.

**Conventions.** X is east, Y is up, and Z is south, so north is -Z. The nose points along -Z at zero yaw. Quaternions are `[x, y, z, w]`, and yaw is positive counterclockwise seen from above. Compass heading 0 is north and 90 is east. Wind direction is where the wind comes FROM. The home point is the sim origin, and the pilot stands at (0, 1.6, 7). Georeferencing uses a flat local tangent plane around home (`mkGeo`, `ll2xz`, and `xz2ll` in `70-planner.js`).

**How the tests load code.** `test/run.js` runs `00-sim.js` in a `vm` context. For the planner and parsers, it slices source text between marker strings: from `function mkGeo` to `function geoNote` in `70-planner.js`, and from `function parseGeoJSON` to `function readGeoTIFF` in `72-import.js`. If you rename or reorder those functions, or insert DOM-dependent code between the markers, the tests break. Update the markers in `test/run.js` when you do.

**Planned direction.** The next structural step is to convert the fragments into real modules one at a time, keeping the tests green at each step. Pure logic (plan computation, parsers, scoring) moves out of DOM code first.
