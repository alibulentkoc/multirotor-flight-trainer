# Multirotor Flight Trainer

A browser-based multirotor flight simulator and survey mission planner for teaching. It is one HTML file. Nothing is installed, and no hardware is needed.

**Run it:** open `index.html`, or visit the GitHub Pages site for this repository:
`https://alibulentkoc.github.io/multirotor-flight-trainer/`

**Read the manual:** [docs/USER_MANUAL.md](docs/USER_MANUAL.md)

## What it does

- 6-DOF quadcopter physics at 250 Hz, running in the page.
- Three flight modes: position hold, altitude hold, and stabilized.
- Mode 2 control by keyboard, on-screen touch sticks, USB or Bluetooth game controller, or an RC transmitter in USB joystick mode.
- Pilot line-of-sight, chase, and onboard camera views.
- Four scored drills: hover box, nose-in hover, square circuit, precision landing.
- Onboard sensors: front and down cameras, ultrasonic range finders, obstacle avoidance, light sensor, airspeed.
- Wind with a height profile and gusts, plus sun height and cloud cover.
- A mixed tall fescue and white clover forage field with a ground truth clover map.
- Flight planning: draw a survey boundary or a waypoint route, set camera, altitude, overlap, and speed, then let the drone fly it.
- Import: images, KML, KMZ, GeoJSON, CSV waypoints, GeoTIFF, and images with world files.
- Export: KML and CSV.

## Requirements

A current desktop browser with WebGL (Chrome, Edge, Firefox, or Safari). Internet is needed only for the display font, KMZ import, and GeoTIFF import.

## Status and limits

This is a teaching tool, not a certified training device.

- The ground is flat. Terrain following is explained but not simulated.
- The airframe is generic (450 mm class, 1.2 kg). It is not matched to a specific drone.
- Georeferencing uses a flat local plane around the home point.
- Rotated KMZ overlays are placed north-up.
- The 400 ft and line-of-sight checks follow US Part 107 conventions. They are teaching prompts, not legal advice.
- There is no link to a physical drone in this version.

## Repository layout

```
index.html                 the application (Three.js r128 inlined)
docs/USER_MANUAL.md        user manual
THIRD_PARTY_NOTICES.md     licenses of bundled and on-demand libraries
LICENSE                    license for this project
CITATION.cff               how to cite
.nojekyll                  tells GitHub Pages to serve files as-is
```

## How to cite

See `CITATION.cff`. GitHub shows a "Cite this repository" button once the file is filled in.

## License

See `LICENSE`. Third-party components keep their own licenses, listed in `THIRD_PARTY_NOTICES.md`.

## Acknowledgment

Developed with assistance from Claude (Anthropic).
