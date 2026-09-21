# Changelog

## Unreleased

- Return to home (RTH). New "Return to home" button next to Land, the H key, and `sim.command('rth')`. Below the RTH altitude the drone climbs to it first, above it the drone keeps its height. It then flies straight home at 6 m/s, descends, lands, and disarms. The status box reads "Returning home". Moving the right stick past one third, pressing H again, or `sim.command('cancel_rth')` cancels it and returns control in the selected flight mode. New setting "RTH altitude", 5 to 120 m, default 30.
- RTH respects the vertical obstacle limits but does not steer around obstacles. The RTH altitude must clear everything on the path. The manual, the side panel, and the task box say so.
- Battery model: 4S pack voltage from a simple LiPo curve (4.20 V full, about 3.7 V at half, 3.30 V empty per cell) with sag under load from an internal resistance. `telemetry()` gains `voltage`, `cell_voltage`, `current_a`, `minutes_left`, `battery_state`, and `rth_needed_pct`. Percent remains the primary state and drains exactly as before.
- Battery bar on the flight view with percent, volts per cell, and the state in words (OK, WARNING, LOW, CRITICAL), so it does not rely on color. The side panel gains a "Battery and return to home" section with state, voltage, per cell voltage, current, and time left.
- Three battery levels, set in the side panel, defaults 30, 20, and 10 percent. Warning: message only. Low: automatic RTH when "Automatic RTH on low battery" is ticked (default on), and the pilot may cancel it. Critical: emergency landing in place that cannot be cancelled. The sim controls the descent, and the pilot keeps the right stick and yaw to choose the spot. Settings must run warning > low > critical, all between 5 and 60, or they are refused with a note.
- Return estimate: the trainer estimates the battery needed to get home from the present position and height, including the climb to the RTH altitude and the present wind. It warns when the battery falls below that plus 10 percent. If the low level triggers and home is out of reach, the drone lands in place instead, and the task box explains why.
- Changed: planned flights use the same levels. The fixed rule "at 20 percent, fly to the last waypoint" is gone. At the low level a plan hands over to RTH (at the RTH altitude, or the present height if higher), and the pilot may cancel it. With automatic RTH off, the plan carries on and the drone lands in place at the critical level. The plan warning "Needs more than 80 % of the battery" now follows the low level.
- Changed: at 0 percent nothing new happens, because the critical level has already landed the drone.
- Optional beep at each battery level (one, two, three beeps). Off by default, and off again on every page load.
- Controller setup: an "Assign" flow puts switches and buttons on actions: RTH, arm or disarm, land, change camera, a 3-position flight mode switch, and three separate flight mode buttons. Click Assign, then flip the switch or press the button. Each row has a type (Switch or Button), a live lamp, and Clear. A switch starts RTH when it goes on and cancels it when it goes off. A button toggles. Everything fires on changes only, so a switch left on does not restart RTH after a stick cancel. Assignments are saved with the stick mapping.
- The time selector in the flight plan window gives the keyboard back after a change, so P works at once.
- The action buttons are now in two rows: Arm, Take off, Reset, then Land and Return to home.
- Manual: new section 8, "Return to home and battery failsafes". Later sections move up by one. Two new labs in a new group "Extra. Failsafes": Lab 31, "Return to home, and why its altitude matters", and Lab 32, "Battery warnings and the emergency landing".
- Internal: all RTH and battery logic is in `00-sim.js` with constants in `PARAMS.rth` and `PARAMS.batt`. The landing rates and the automatic-flight tilt limit moved from inline numbers into `PARAMS`. The input-to-action decision is a pure function in the new `41-actions.js`. 30 tests added.
- New "Fundamentals" section, `docs/learn/index.html`, is linked from everywhere. The side panel gains a "Learn" link before "Labs" and "Manual", opening in a new tab. The manual page and every lab page have a "Fundamentals" link in the top bar, before the "Open the trainer" button. The README gains a "Fundamentals" line.
- Internal: the top bar link group rule (`.top .nav`) moved from `tools/build-docs.js` into the lab pages' CSS, which the manual page already reuses. A test checks that every lab page and the manual link to the Fundamentals page.
- Side panel: two small links under the title. "Labs" opens `docs/labs/index.html` and "Manual" opens `docs/manual/index.html`, both in a new tab. The README gains a "Labs" line pointing to the Pages site.
- The manual is now a web page, `docs/manual/index.html`, styled like the lab pages (same CSS, fonts loaded from `docs/labs/fonts/`, dark mode, print rules). Every section heading has an id, and the Contents list links to the sections. The top bar has a "Labs" link and the "Open the trainer" button. The README links to the page on the Pages site and keeps a link to the Markdown source.
- Internal: `tools/build-docs.js`, a dependency-free Markdown converter, generates the manual page from `docs/USER_MANUAL.md`. New script `npm run build:docs`, and `npm run build` runs it too. Tests added for the converter, and one that fails when the page is out of date.
- Lab 7 (Flying in wind): step 4 and the closing question reworded. Ground speed reads about zero while Airspeed reads less than the 5 m/s slider value, because wind is weaker near the ground. Changed in `docs/LABS.md`, `docs/labs/all.html`, and both Lab 7 files.
- Movable home point. "Set home" in the flight plan window, followed by a click on the map, moves home. The field image, survey boundary, waypoints, flown track, and georeference shift together, so latitude and longitude do not change. The pilot and the drone move to the new home. Available with a loaded field image or an imported georeferenced plan, with the drone landed and disarmed.
- "Set home" always answers a press: a note under the button (red when refused or failed), a banner on the map, and a changed cursor while it waits for the click.
- On the practice field, where home is fixed, "Set home" is greyed out and a note under it says why. It becomes active as soon as a field image or a plan is loaded.
- "Whole field", "Fit to plan", and the map background follow the field image after a home move.
- Fixed: importing a plan with no image (KML, GeoJSON, or CSV only) left the practice scenery standing around home, with its colliders and range sensor targets still active. It now switches to the user's own field exactly as a field image does: scenery and drills hidden (also on the map), colliders and range targets off, longer view distance, drone reset to the pad.
- "Clear" on an image-less imported plan restores the practice field once no corner or waypoint is left: the georeference is dropped and the scenery, colliders, range targets, and drills come back.
- Returning to the practice field (by "Remove field image" or "Clear") now resets the drone to the home pad, so it cannot reappear inside an obstacle.
- Internal: one pure function, `userFieldActive`, decides whether the user's own field is active. `fieldMode`, the scenery, the fog, and "Set home" are all derived from it through `syncFieldMode`. Tests added, including a guard that `fieldMode` is assigned in one place only.
- Internal: plan computation moved out of DOM code into a pure `planCompute`, with planner constants in named blocks (`PLAN_LIMITS`, `PLAN_TIMES`). Results are unchanged.
- Tests added for plan computation (including the manual's worked example) and for the home shift.

## 0.2.0 (2026-09-18)

Restructure only. No change in behavior.

- Source split into `src/` fragments with a dependency-free build script. The built `index.html` is byte-identical to the v0.1 file.
- Headless test suite added (flight model, avoidance, landing assist, missions, georeference, parsers, build freshness).
- v0.1 frozen at `legacy/v0.1/index.html`.

## 0.1.0 (2026-09-18)

First public version, built as a single hand-edited HTML file.

- 6-DOF quadcopter model at 250 Hz. Position hold, altitude hold, and stabilized modes.
- Keyboard, touch sticks, and game controller input with axis mapping.
- Pilot, chase, and onboard views. Four scored drills with a results log.
- Front and down cameras, ultrasonic rangers in six directions, light sensor, airspeed.
- Obstacle avoidance (horizontal and vertical) in position hold. Landing assist in all modes.
- Wind with height profile, gusts, and direction. Sun height and cloud cover.
- Tall fescue and white clover forage field with a ground truth clover map.
- Flight planner: survey area and waypoint route modes, overlap illustration, warnings, glossary.
- Import: images, KML, KMZ, GeoJSON, CSV, GeoTIFF, world files, two-point scaling. Export: KML and CSV.
