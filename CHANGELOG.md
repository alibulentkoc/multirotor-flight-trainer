# Changelog

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
