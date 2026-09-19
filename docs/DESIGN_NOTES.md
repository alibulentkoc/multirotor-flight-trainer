# Design notes

These notes keep continuity between development sessions. Update them when a decision changes.

## Principles

- The product is one self-contained `index.html`. It must run from a file, from GitHub Pages, and offline.
- No frameworks and no runtime dependencies other than three.js r128 (vendored). JSZip and geotiff.js load on demand from a CDN for KMZ and GeoTIFF import only.
- All authored text is ASCII. The build fails on any non-ASCII character.
- Every modeling choice is a named parameter, not buried logic. Flight parameters live in `PARAMS` in `00-sim.js`.
- The flight model has no DOM or three.js dependency, so it can be tested headless.

## Axes and conventions

- X east, Y up, Z south. The drone nose points along -Z at zero yaw. North is -Z.
- Quaternions are `[x, y, z, w]`. Yaw is positive counter clockwise seen from above.
- Compass heading: 0 is north, 90 is east. Wind direction is where the wind comes FROM.
- The home point is the sim origin. The pilot stands at (0, 1.6, 7).
- Georeferencing is a flat local tangent plane around home (`mkGeo`, `ll2xz`, `xz2ll`). `ll2xz` and `xz2ll` take an optional georeference argument and default to the current one.
- Home never leaves the origin. "Moving home" shifts everything else instead (see Movable home below).

## Current structure (v0.2)

The split is mechanical. Fragments in `src/js` are concatenated in file-name order into one script, and everything after `10-app-start.js` runs inside one shared function scope. Order matters, and fragments share variables.

| Fragment | Contents |
|---|---|
| 00-sim.js | Flight model, controllers, missions, telemetry. Global scope, headless-testable |
| 10-app-start.js | Opens the app scope, storage helper |
| 20-scene.js | Renderer, camera, lights |
| 21-forage.js | Forage texture, clover truth mask, fescue tufts |
| 22-field-objects.js | Obstacles, colliders, pilot, trees, windsock, drone model |
| 30-drills.js | Drill definitions, scoring, results log |
| 40-input.js | Keyboard, touch sticks, gamepad mapping |
| 50-ui.js | Side panel, instruments, task messages |
| 60-environment.js | Sun, cloud, wind controls |
| 61-sensors.js | Rangers, light, airspeed, inset cameras, collision check |
| 70-planner.js | Georeference math, pure plan computation (`planCompute`), home shift (`shiftHome`), map drawing, map interaction |
| 71-field-image.js | Two-point scaling, field image placement |
| 72-import.js | KML, KMZ, GeoJSON, CSV, world file, GeoTIFF import |
| 73-export.js | KML and CSV export |
| 80-render.js | Camera views and rendering |
| 90-main.js | Fixed-step main loop, closes the app scope |

## The sim interface

The UI talks to the aircraft only through this surface. A future hardware link must implement the same one.

- `command(name)`: arm, disarm, takeoff, land, emergency
- `step(dt, sticks)`: sticks are thr, yaw, pitch, roll in -1 to 1
- `startMission(wps, speed, trig)`, `stopMission()`
- `telemetry()`: pitch, roll, heading_deg, altitude_m, vz, ground_speed, x, z, battery, armed, on_ground, motors
- Inputs set by the app: `mode`, `wind`, `windDir`, `avoid` (range readings), `landAssist`, `thrCentered`

## Pure planner logic

Everything in `70-planner.js` from `function mkGeo` down to `function geoNote` is pure: no DOM, no three.js, no reads of planner state other than the default `geo`. `test/run.js` loads that range headless, so do not put DOM code inside it.

- `planCompute(inp)` takes the camera, altitude, overlaps in percent, speed, line direction, endurance, mode, `poly`, and `route`, and returns the plan object (`gsd`, `W`, `L`, `spacing`, `trig`, `interval`, `lines`, `shots`, `wps`, `area`, `dist`, `time`, `ok`). `computePlan()` is a thin wrapper: it reads and clamps the inputs, calls `planCompute`, and renders.
- Planner constants live in named blocks next to it: `CAMERAS`, `PLAN_LIMITS` (input ranges and defaults), and `PLAN_TIMES` (time allowances and pattern limits). The warning thresholds in `renderPlanOut` are still inline and should move to a block when that function is next touched.

## Movable home

Home is the sim origin, the pilot stands at (0, 1.6, 7), and return-to-home, the distance readout, and the plan's home legs all assume that. So the home point is never stored. "Set home" at map point (hx, hz) calls `shiftHome(state, hx, hz)`, which returns a shifted `poly`, `route`, `track`, field image center, and `geo`. The sim, the pilot, and the Sim interface do not change.

- With a georeference, each point goes local to latitude and longitude with the old `geo`, then back to local with the new `geo` anchored at the clicked point. Geographic coordinates therefore stay exact. Local meters rescale by a few parts per million, because the tangent plane is re-anchored. The field image keeps its size, which is an error far below one pixel.
- Without a georeference it is a plain subtraction.
- `fieldRect` is `{ w, h, cx, cz }`. `cx` is 0 until home moves. `placeField` always places the image north of home again, which matches its existing behavior of clearing the plan on a rescale.
- The map view center shifts by the same offset, so the map does not jump under the cursor.
- The aircraft is reset through `startDrill`, the same path the R key uses. That also clears `sim.photos`, so photo marks do not survive a home move. The flown track does, because the app owns it.
- The arm, cancel, or refuse decision is the pure `homeDecision(st)` in the tested range, with its texts in `HOME_MSG`. Every outcome carries a message, and the button and map-click handlers catch exceptions and show them in the note, so a press can never do nothing silently.
- Moving home is refused while armed or airborne (read from `telemetry()`), and on the built-in practice field, where the scenery, colliders, drills, and forage truth layer are fixed around the origin. It is allowed when a field image is loaded or a georeference exists.

## Next structural step

Turn the shared-scope fragments into real modules with explicit imports, so features can be added without order coupling. Do this one fragment at a time, with the tests green at each step. Pure logic (plan computation, parsers, scoring) should move out of DOM code first so it can be tested directly.

## Roadmap

1. Movable home point (done, see Movable home). Still open: scenario files and results export (instructor control).
2. Emergency procedures and additional drills.
3. Image capture and quick mosaic. Simulated red and NIR camera with NDVI. Biomass and clover truth layers.
4. Spray drone mode: tank, swath, rate, boundary shutoff, drift, coverage map.
5. Built-in lessons, preflight checklist, quiz bank.
6. Terrain, airframe presets, replay. Optional: phone controller, hardware link.

## Known limits

Flat terrain. Generic airframe. North-up overlays only. Home point placed automatically at import and movable afterwards, but fixed on the built-in practice field. An imported plan with no image leaves the practice scenery visible around home. First polygon and first path only on import. Rendering and input are not covered by automated tests, so every release needs a manual browser check.
