# Changelog

## Unreleased

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
