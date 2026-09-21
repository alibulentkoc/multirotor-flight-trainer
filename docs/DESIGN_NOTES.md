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
| 00-sim.js | Flight model, controllers, missions, return to home, battery model and failsafes, telemetry. Global scope, headless-testable |
| 10-app-start.js | Opens the app scope, storage helper |
| 20-scene.js | Renderer, camera, lights |
| 21-forage.js | Forage texture, clover truth mask, fescue tufts |
| 22-field-objects.js | Obstacles, colliders, pilot, trees, windsock, drone model |
| 30-drills.js | Drill definitions, scoring, results log |
| 40-input.js | Keyboard, touch sticks, gamepad mapping, the Assign table for controller actions |
| 41-actions.js | Pure logic for switches and buttons assigned to actions (`actionStep`, `detectSource`). Headless-testable |
| 50-ui.js | Side panel, instruments, task messages |
| 51-failsafe.js | RTH and battery settings, battery bar, failsafe messages, beep |
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

- `command(name)`: arm, disarm, takeoff, land, emergency, rth, cancel_rth
- `step(dt, sticks)`: sticks are thr, yaw, pitch, roll in -1 to 1
- `startMission(wps, speed, trig)`, `stopMission()`
- `telemetry()`: pitch, roll, heading_deg, altitude_m, vz, ground_speed, x, z, battery, armed, on_ground, motors, voltage, cell_voltage, current_a, minutes_left, battery_state, rth_needed_pct, auto, auto_reason, rth_phase
- Inputs set by the app: `mode`, `wind`, `windDir`, `avoid` (range readings), `landAssist`, `thrCentered`, `rthAlt`, `battCfg` (`warn`, `low`, `crit`, `autoRth`)

## Return to home and battery failsafes

All of this is in `00-sim.js`, with no DOM code. Constants are in `PARAMS.rth` and `PARAMS.batt`.

- `auto` has two new states. `'rth'` runs the phases `climb`, `cruise`, `descend`, `land` (in `sim.rth.phase`). `'critland'` is the emergency landing. `autoReason` says why: `pilot`, `battery`, `mission`, `unreachable`, or `critical`.
- RTH target height is `max(current height, rthAlt)`, fixed when RTH starts. Closer than `rth.nearHome` it skips the climb. RTH reuses the mission velocity path (`mv`), so the vertical avoidance caps apply and nothing else does. It does not route around obstacles, by decision: the lesson is that the RTH altitude must clear the path. A drone blocked under a surface waits there until the pilot cancels.
- Cancel: right stick past `rth.cancelStick` (one third), or `command('cancel_rth')`. Control returns in `sim.mode`. RTH stays cancellable through its own landing phase.
- `'critland'` locks `command()`: only `disarm` and `emergency` get through, and `startMission` is refused. The sim sets the sink rate. The pilot's roll, pitch, and yaw pass through the position hold path, whatever mode is selected, so horizontal avoidance still acts.
- Battery: percent is the state. `battLoad`, `battOcv`, `battVolts`, `battCfgError`, and `rthEstimate` are pure functions. Hover current is a parameter, so pack capacity follows from `batterySeconds` (a longer endurance means a bigger pack, not a smaller draw). Voltage is the open-circuit curve minus current times internal resistance.
- `battCheck()` runs at the top of every step. Warning and low latch once per flight (`battLatch`, cleared by `reset()`), so a pilot who cancels the automatic RTH is not overruled. Critical is a condition, not a latch: whenever the drone is airborne below it, it lands.
- At the low level `rthEstimate` decides between RTH and landing in place. The estimate covers climb, cruise against the mean wind at the cruise height (with the ground speed reduced when the tilt limit cannot hold `rth.speed`, and `Infinity` when there is no headway), descent, and landing. It is refreshed every `batt.estimateEvery` seconds for the margin warning and telemetry. A test compares it with a flown return.
- Planned flights have no battery rule of their own any more. `battCheck` hands a mission over to `'rth'` or `'critland'` exactly as in manual flight. With automatic RTH off, a plan flies on to the critical level. The planner's battery warning uses `100 - battCfg.low` percent.
- At 0 percent, `step()` starts the emergency landing itself if it is not already running. That only matters when `battCfg.crit` was set outside the limits of `battCfgError`. It replaces the old `command('land')` at 0 percent, which the `critland` command lock had turned into dead code.
- Drills: `drillAbort` in `30-drills.js` (pure, tested through a marker slice) ends a drill that is ready or running when an emergency landing starts, because that landing cannot be cancelled and the drill could otherwise never finish. A battery RTH does not end a drill, since the pilot may cancel it.
- Events added to `onEvent`: `rth`, `rth_cancel`, `batt_warn`, `batt_low`, `batt_crit`, `batt_margin`, `batt_unreachable`.
- UI side: `51-failsafe.js` holds the settings (validated with `battCfgError`, stored under `uavtrainer.failsafe.v1`), the battery bar, the task box messages, and the optional beep. The bar always carries the state as a word. The beep starts off on every load, because a browser only allows sound after a click.

## Controller actions

- `41-actions.js` is pure (no DOM, no gamepad API) and the tests load the whole file. `actionStep(assign, prev, inputs, ctx)` returns the commands to run and the next state. `detectSource` implements the Assign flow. Constants are in `ACTION_PARAMS`.
- Everything is edge-triggered. The first sight of a source records its state without firing, so a switch left on at load, or left on after a stick cancel of RTH, does nothing until it is cycled.
- A source is latching (switch) or momentary (button). Detection guesses axis = switch and button = button, and the table lets the user override it, because many transmitters report switches as buttons.
- Assignments are stored as `padMap.actions` under the existing `uavtrainer.pad.v1` key, so older saved mappings still load.

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
- `homeAvailable(st)` (a thin wrapper around `userFieldActive`, see Practice field or user field) drives the button's look. When it is false the button carries `aria-disabled="true"` (greyed out by CSS) and the reason stays in the note. It is not a real `disabled` attribute, so a press still answers with the red refusal. `geoNote()` calls `refreshHome()`, because every change of field image or georeference already ends in `geoNote()`.
- Moving home is refused while armed or airborne (read from `telemetry()`), and on the built-in practice field, where the scenery, colliders, drills, and forage truth layer are fixed around the origin. It is allowed when a field image is loaded or a georeference exists.

## Practice field or user field

One pure function in the tested range of `70-planner.js` decides which field is active: `userFieldActive({ hasField, hasGeo })`, true with a loaded field image or with a georeference (an imported plan, with or without an image). Nothing else may repeat that rule.

- `fieldState()` reads the two inputs (`!!fieldCanvas`, `!!geo`). `syncFieldMode()` in `71-field-image.js` is the only place that assigns `fieldMode`. It also sets `scenery.visible`, `drillObjs.visible`, and the fog range (named block `FOG`), and returns true when the mode changed.
- `fieldMode` is the cached result that the per-frame code reads: colliders and range sensor targets (`61-sensors.js`), the drill lock (`30-drills.js`), the "Too far away" radius (`50-ui.js`), and the collider boxes on the map (`drawMap`).
- `geoNote()` calls `syncFieldMode()` and resets the drone through `startDrill('free')` on a change, because every change of field image or georeference already ends in `geoNote()`. `placeField` also calls it directly, before its own reset.
- "Clear" restores the practice field for an image-less plan: the pure `clearDropsGeo({ hasField, points })` says when the georeference goes (no image, and no corner or waypoint left in either mode). "Undo point" never drops it.
- A test scans `src/js` and fails if `fieldMode` is assigned anywhere else, or if the image-or-georeference rule appears outside `userFieldActive`.

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

Flat terrain. Generic airframe. North-up overlays only. Home point placed automatically at import and movable afterwards, but fixed on the built-in practice field. An imported plan with no image flies over the plain forage ground, which is 400 m square, and "Whole field" still draws the practice field rectangle there. First polygon and first path only on import. Rendering and input are not covered by automated tests, so every release needs a manual browser check.
