# Changelog

## Unreleased

- Movable home point. "Set home" in the flight plan window, followed by a click on the map, moves home. The field image, survey boundary, waypoints, flown track, and georeference shift together, so latitude and longitude do not change. The pilot and the drone move to the new home. Available with a loaded field image or an imported georeferenced plan, with the drone landed and disarmed.
- "Set home" always answers a press: a note under the button (red when refused or failed), a banner on the map, and a changed cursor while it waits for the click.
- On the practice field, where home is fixed, "Set home" is greyed out and a note under it says why. It becomes active as soon as a field image or a plan is loaded.
- "Whole field", "Fit to plan", and the map background follow the field image after a home move.
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
