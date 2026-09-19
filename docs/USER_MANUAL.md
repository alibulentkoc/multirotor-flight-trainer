# Multirotor Flight Trainer: User Manual

This manual covers the browser-based multirotor flight trainer (index.html). It explains how to fly, how to use the sensors, how to plan and fly a survey, and how to bring in your own field.

## Contents

1. What this tool is
2. Requirements and start-up
3. Screen layout
4. Controls
5. Flight modes
6. Your first flight
7. Crashes, battery, and reset
8. Drills and scoring
9. Instruments
10. Sensors and obstacle avoidance
11. Wind, light, and camera views
12. Flight plan window
13. Survey area mode
14. Waypoint route mode
15. Importing your own field
16. Flying a plan
17. Exporting a plan
18. Saved data
19. Troubleshooting
20. Known limits
21. Quick reference card

---

## 1. What this tool is

A flight simulator and mission planner that runs entirely in a web browser. Nothing is installed. No account is needed. No hardware is needed.

It teaches three things:

- Stick skills: hover, orientation, circuits, and landing, from the pilot's line-of-sight view.
- Sensor awareness: range finders, cameras, light, and wind, and what they do to the aircraft.
- Survey planning: altitude, overlap, ground sample distance, flight lines, and waypoints, on a generic field or on your own field image.

The flight physics run inside the page at 250 steps per second. The model is a generic 450 mm class quadcopter of 1.2 kg. It is not tuned to any specific commercial drone.

## 2. Requirements and start-up

- A current desktop browser: Chrome, Edge, Firefox, or Safari. WebGL must be enabled.
- A keyboard is enough. A USB game controller or RC transmitter is better.
- Internet is needed only for three optional things: the display font, KMZ import, and GeoTIFF import. Everything else works offline.

To start, open index.html in the browser, or open the GitHub Pages address. The drone sits on the orange ring (the home pad). You stand 7 m south of it, looking north.

## 3. Screen layout

**3D view (left).** The flying field. Three status boxes sit at the top:

- Arm status: Disarmed, Armed, Taking off, Landing, or Crashed.
- Task box: the current drill, instructions, timers, and warnings.
- View: which camera you are using.

Two on-screen sticks sit at the bottom corners. They show your current stick input from any source. You can also drag them with a mouse or a finger.

Two inset pictures at the top right show the drone's front camera and down camera.

**Side panel (right).** From top to bottom: flight mode, action buttons, drills, instruments, sensors, conditions and view, keyboard help, controller setup, and results.

## 4. Controls

All control layouts follow Mode 2, the most common RC layout. The left stick is throttle and yaw. The right stick is pitch and roll.

### Keyboard

| Key | Action |
|---|---|
| W / S | Throttle up / down (left stick) |
| A / D | Yaw left / right (left stick) |
| Up / Down arrow | Pitch forward / back (right stick) |
| Left / Right arrow | Roll left / right (right stick) |
| Shift (hold) | Full stick deflection. Without Shift, keys give 70 percent |
| Space | Arm or disarm |
| T | Automatic take off |
| L | Automatic land |
| 1, 2, 3 | Position hold, altitude hold, stabilized |
| C | Change camera view |
| P | Open or close the flight plan window |
| R | Reset to the home pad and restart the current drill |

Keyboard input ramps up and down smoothly, so a short tap gives a small input.

### On-screen sticks

Drag the knob inside either circle. Both sticks spring back to center when released.

### Game controller or RC transmitter

1. Plug the controller into USB. Move any stick so the browser detects it.
2. Open "Controller setup" in the side panel.
3. For each channel (throttle, yaw, pitch, roll), pick the axis number that moves the live bar.
4. Stick up and stick right must fill the bar. If a bar moves the wrong way, tick Invert.
5. If your throttle stick does not spring back to center (a real RC transmitter), clear the box "Throttle stick springs back to center".

The mapping is remembered in the browser. Controller input has a small dead zone and an exponential curve for fine control near center.

## 5. Flight modes

| Mode | What the sticks do | What the drone does for you | Use it for |
|---|---|---|---|
| Position hold | Command speed: up to 4 m/s sideways, 1.5 m/s up or down | Stops and holds position and height when you let go. Fights wind | First flights, camera-drone feel, flying plans |
| Altitude hold | Right stick commands tilt (up to 30 deg). Left stick commands climb rate | Holds height only. It drifts until you level it and brake | Learning momentum and braking |
| Stabilized | Right stick commands tilt. Left stick is raw throttle | Self-levels only. Nothing holds height or position | The core manual skill that transfers to any multirotor |

Notes on stabilized mode:

- With a spring-centered throttle (keyboard or game controller), center stick equals hover thrust. Push up to climb, pull down to descend.
- With an RC transmitter throttle, the stick position sets thrust directly. Hover is near mid-stick.
- Thrust is not corrected for tilt. When you lean the drone, it sinks unless you add throttle. This is realistic.

Yaw rate is up to 120 deg/s in all modes.

## 6. Your first flight

1. Leave the mode on Position hold.
2. Press T. The drone arms, climbs to 1.2 m, and hovers.
3. Tap the Up arrow. It moves away from you. Let go. It stops.
4. Try Left and Right arrows, then W and S for height.
5. Press A or D to yaw. Turn the nose toward you and notice that roll and pitch now feel reversed. This is the main orientation problem in line-of-sight flying.
6. Fly back over the pad. Press L to land. The drone descends, touches down, and disarms.

Manual take off: press Space to arm, then raise the throttle. Manual landing: descend slowly to the ground, hold throttle down, then press Space to disarm.

Front of the drone: orange arms, orange nose block, orange propellers. Rear: dark arms and a white tail mark.

The dark spot on the ground is the drone's shadow. It falls along the sun direction, not straight below, and it fades under cloud.

## 7. Crashes, battery, and reset

A touchdown counts as a crash when any of these is true:

- Vertical speed above 2.2 m/s. Aim for under 1 m/s.
- Tilt above about 34 deg.
- Sideways speed above 2.5 m/s.

Hitting the barn, the bales, the gate, or the tree is also a crash. Disarming in the air cuts the motors, and the drone falls.

**Landing assist.** On by default (Sensors section). It works in every flight mode, including stabilized:

- It caps the sink rate along a braking curve the motors can always hold. High up you can still descend fast. Near the ground the cap falls to about 0.35 m/s, so touchdown is soft even with the throttle fully down.
- Below 0.8 m it limits tilt to about 12 deg, so the drone lands nearly level.
- A touchdown while sliding sideways counts as a landing, not a crash.
- The task box says when the assist is slowing your descent.

Many consumer drones have a similar landing protection feature. Turn it off to practise real landings. It cannot help if you disarm in the air or fly into an obstacle.

After a crash, a notice gives the reason. Press R to reset.

Battery: the default endurance is about 10 minutes of hover. Hard flying drains it faster. The reading turns red below 20 percent. At 0 percent the drone lands by itself. The flight plan window lets you set a different endurance.

R (or the Reset button) puts the drone back on the pad with a full battery and restarts the selected drill.

## 8. Drills and scoring

Pick a drill in the side panel. The timer starts when the drone rises above 0.3 m. Scores run from 0 to 100. A crash fails the attempt.

| Drill | Task | How it is scored |
|---|---|---|
| Free flight | No task | Not scored |
| Hover box | Stay inside the 1.2 m box, centered 1.5 m above the pad, for a total of 15 s. Keep the tail toward you (heading within 25 deg of north). The box turns green while you are inside | 100, minus 110 per meter of mean distance from the box center, minus 1.5 per second taken beyond 15 s |
| Nose-in hover | Same box, but the nose must point at you (heading within 25 deg of south) | Same as hover box |
| Square circuit | Fly through four markers in order at 1.5 m height. The active marker is orange, passed markers turn green. Keep the tail toward you | 100, minus 1 per second over 25 s, minus 60 per meter of mean altitude error, minus 0.6 per degree of mean heading error |
| Precision landing | Fly to the target 4 m east and 7 m north of the pad and land on it | 100, minus 70 per meter from the center, minus 20 per m/s of touchdown speed above 0.5 m/s. More than 1.5 m away scores 0 |

Each result is logged with the flight mode and the wind setting. A high score in stabilized mode with wind means far more than the same score in position hold with calm air. The drill buttons show your best score.

Suggested progression:

1. All drills in position hold, no wind.
2. Hover box and precision landing in altitude hold.
3. All drills in stabilized mode.
4. Repeat with 3 to 5 m/s wind.
5. Nose-in hover in stabilized mode with wind. This is the hardest combination.

## 9. Instruments

- **Artificial horizon.** Blue is sky, brown is ground. The horizon line tilts opposite to your roll and drops when the nose rises. The pitch ladder is marked every 10 deg.
- **Altitude AGL.** Height above the ground below the drone.
- **Altitude MSL.** Field elevation plus AGL. Set the field elevation in the flight plan window.
- **Climb.** Vertical speed. Positive is up.
- **Ground speed.** Horizontal speed over the ground.
- **Heading.** Compass direction of the nose. 000 is north, away from you at start.
- **Distance.** Straight-line distance from your eyes to the drone.
- **Battery.** Percent remaining.
- **Motor bars.** Output of each motor. Watch them to learn how a quadcopter moves: the rear pair speeds up to pitch forward, one side speeds up to roll, and one diagonal pair speeds up to yaw.

## 10. Sensors and obstacle avoidance

**Range display.** The triangle is the drone, nose up. Four arcs show the distance to the nearest surface in front, behind, left, and right. Each direction uses a fan of five ultrasonic beams with 6 m reach, wide enough to cover the diagonals. Green is beyond 3 m. Amber is 1.5 to 3 m. Red is under 1.5 m. No arc means nothing within range.

**Range up.** An upward ranger with 6 m reach. It sees the tree canopy, roof edges, and anything else above the drone.

**Range down.** A downward ranger with 8 m reach. It points along the body axis, so it reads long when the drone is tilted, as a real one does. It also sees the tops of obstacles.

**Light.** An upward-facing light sensor, in kilolux. It reads lower when the drone tilts away from the sun, when the sun is low, and under cloud. Full sun gives roughly 70 to 100 klx, depending on sun height.

**Airspeed.** Speed relative to the air. In a hover in wind, airspeed equals the wind speed while ground speed is zero.

**Wind here.** Wind speed at the drone's current height.

**Clover below.** Share of clover in the ground patch under the down camera. It is read from the simulator's own ground truth map. It is not image analysis. Use it as a reference value when students estimate pasture composition from the down camera picture. It shows "n/a" when your own field image is loaded.

**Front and down cameras.** Live inset views. The down camera has a crosshair, which helps on the precision landing drill. Untick "Show front and down cameras" to hide them and gain frame rate.

**Obstacle avoidance.** On by default. It acts only in position hold:

- The allowed speed toward a surface shrinks as you approach and reaches zero at 2 m.
- Closer than 2 m, the drone backs away gently.
- Between two surfaces, such as the 3.2 m gate, it centers itself.
- Climbing stops 1.5 m below anything overhead, such as the tree canopy.
- Descending stops 1.2 m above an obstacle. Move clear of it before you land. Descent to open ground is never blocked.
- The task box says when avoidance is limiting you.

In altitude hold and stabilized modes you get a warning only. Those modes are for learning without assistance.

The practice field has a barn, stacked round bales, a tree, and a gate with a 3.2 m opening.

## 11. Wind, light, and camera views

**Wind at 10 m.** 0 to 12 m/s. This is the speed at the standard 10 m reference height. Wind is slower near the ground and follows a logarithmic profile. At 1.2 m you feel about 65 percent of the set value. At 40 m you feel about 120 percent. Gusts vary the speed by up to nearly 50 percent.

**Wind from.** The compass direction the wind blows from. 270 deg means wind from the west, pushing the drone east. The windsock on the field shows direction and strength.

**Sun height.** Sun elevation above the horizon, 8 to 80 deg. It changes scene brightness, shadow length, and the light sensor reading.

**Cloud cover.** 0 to 100 percent. It dims direct sun, greys the sky, and fades the shadow. The shadow is an important depth cue, so heavy cloud makes height judgment harder.

**Camera views.**

- Pilot (line of sight): you stand still and watch the drone. This is how real visual-line-of-sight flying works, and it is the view to train in. The view zooms gently as the drone gets farther away.
- Chase: the camera follows behind the drone. Good for demonstrations and videos.
- Onboard (FPV): the view from the drone.

## 12. Flight plan window

Open it with the "Open flight plan" button or the P key. It floats over the 3D view. You can leave it open while the drone flies.

**The map.** North is up. The orange H is the home point, where you stand. The yellow triangle is the drone. A scale bar sits at the bottom left.

| Button | Action |
|---|---|
| Survey area / Waypoint route | Choose the planning mode |
| Undo point | Remove the last corner or waypoint |
| Clear | Remove all corners or waypoints in the current mode, and the flown track |
| Whole field | Make the survey area cover the whole loaded image |
| Zoom in / Zoom out | Change the map scale |
| Fit to plan | Frame the home point, image, and plan |
| Set home | Move the home point on your own field. Press it, then click the map where you will stand and take off. Greyed out on the practice field, where home is fixed. See section 15 |

Click the map to add a point. Drag an existing point to move it.

**Parameters.**

| Parameter | Range | Meaning |
|---|---|---|
| Camera | 3 presets | Sets sensor size, focal length, and image size |
| Altitude above ground | 5 to 120 m | Survey height AGL. Also the default height for new waypoints |
| Front overlap | 10 to 95 percent | Overlap between consecutive photos on one line |
| Side overlap | 10 to 95 percent | Overlap between neighbouring lines |
| Speed | 1 to 8 m/s | Cruise speed for the plan |
| Flight line direction | 0 to 179 deg | 0 gives north-south lines. 90 gives east-west lines |
| Field elevation | m MSL | Ground height above sea level. Used for the MSL readouts |
| Battery endurance | 5 to 45 min | Sets the battery for the next flight and the battery warning |

**Camera presets.**

| Preset | Sensor (mm) | Focal length (mm) | Image (pixels) |
|---|---|---|---|
| Small drone, 12 MP (1/2.3 in) | 6.17 x 4.55 | 4.5 | 4000 x 3000 |
| Mapping drone, 20 MP (1 in) | 13.2 x 8.8 | 8.8 | 5472 x 3648 |
| Multispectral, 1.2 MP per band | 4.8 x 3.6 | 5.4 | 1280 x 960 |

**The formulas behind the results.**

- GSD (cm/pixel) = sensor width (mm) x altitude (m) x 100 / (focal length (mm) x image width (pixels))
- Footprint width (m) = sensor width x altitude / focal length
- Footprint length (m) = sensor height x altitude / focal length
- Line spacing (m) = footprint width x (1 - side overlap)
- Trigger distance (m) = footprint length x (1 - front overlap)
- Trigger interval (s) = trigger distance / speed

Worked example: the 20 MP camera at 40 m with 75 percent front and 70 percent side overlap gives a GSD of 1.10 cm/pixel, a 60 x 40 m footprint, 18 m line spacing, and a 10 m trigger distance. A 1 ha square then needs 6 lines and 66 photos.

**Warnings.** The window warns when:

- The photo interval is under 2 s. Many cameras cannot write images that fast. Slow down or fly higher.
- The plan needs more than 80 percent of the battery endurance. Split the job or raise the altitude.
- Any altitude is above 400 ft (122 m) AGL.
- The farthest point is more than 450 m from you. Holding visual line of sight is doubtful.

The time estimate includes rough allowances for turns, climb, and descent.

A glossary, "Terms you need to know", sits at the bottom of the window.

## 13. Survey area mode

Use this to map a field with a back-and-forth (lawnmower) pattern.

1. Select "Survey area".
2. Click the corners of the area, in order around the boundary. Three corners is the minimum.
3. Set the camera, altitude, overlaps, speed, and line direction.
4. Read the results table and clear any warnings.

On the map:

- White dashed outline: your boundary.
- Orange lines: the flight path, from home and back.
- Small dark squares: planned photo positions.
- Two white shaded boxes: the first two photo footprints on the first line. Their shared area is the front overlap.
- One blue shaded box: the neighbouring photo on the second line. Its shared area with the white boxes is the side overlap.

Change the overlap values and watch the boxes move. This is the fastest way to understand the two overlaps.

The pattern starts from whichever end is nearer to home. For concave boundaries, each line runs between its outermost crossings of the boundary.

Teaching points to try:

- Halve the altitude. GSD halves, and the photo count roughly quadruples.
- Turn the flight lines to run along the long side of the field. There are fewer turns and the time drops.
- Align the lines with the wind. Crosswind makes the drone crab and skews the footprints.

## 14. Waypoint route mode

Use this for inspection paths, scouting points, or any free route.

1. Select "Waypoint route".
2. Click the map to drop waypoints in flying order. Drag to adjust.
3. In the table under the map, set each waypoint's altitude (2 to 120 m AGL) and its action.

| Action | Marker color | What happens at the waypoint |
|---|---|---|
| Fly through | Dark | The drone passes and continues |
| Take a photo | Blue | It pauses about 1.5 s and records one photo |
| Hover 5 s | Purple | It holds position for 5 s |

The drone climbs at home to the first waypoint's altitude, flies the route, returns home, and lands. When two waypoints differ in altitude, it climbs or descends at the start of that leg before moving on.

Up to 200 waypoints are kept from an imported file.

## 15. Importing your own field

Use the file picker at the top right of the flight plan window. You can also drop files onto the 3D view. An image copied to the clipboard can be pasted with Ctrl+V.

When an image is loaded, it becomes the ground north of the home point and the map background. The practice obstacles and drills are hidden. "Remove field image" restores the practice field.

| What you have | What to select | Result |
|---|---|---|
| A screenshot or photo (JPG, PNG, WebP) | The image | Placed using the width you type. Not georeferenced |
| Google Earth boundary or path | The .kml file | Polygon becomes the survey boundary. Path or placemarks become a waypoint route, with altitudes if the file has them |
| Google Earth image overlay saved as KMZ | The .kmz file | Image placed at true scale from its north, south, east, and west bounds. Boundary and path are read too. Needs internet |
| KML that refers to a separate overlay image | The .kml and the image together | Same as KMZ |
| Image with a world file | The image and its .jgw, .pgw, .tfw, or .wld together | Degrees: true scale plus latitude and longitude. Projected meters: true scale only |
| Orthomosaic GeoTIFF | The .tif file | WGS84 or UTM (WGS84 and NAD83 zones) gives true scale plus latitude and longitude. Read at reduced resolution. Needs internet |
| GeoJSON | The .geojson or .json file | Polygon, line, or points, handled as for KML |
| CSV waypoint list | The .csv file | Needs latitude and longitude columns. An altitude column is optional |

You can select several files at once, for example an image, its world file, and a KML boundary.

**Setting the scale of a plain screenshot.** Two ways:

- Type the true ground width of the image in "Image width on the ground".
- Or use "Set image scale from two points": click two points you can identify, then enter the true distance between them. Measure that distance with the Google Earth ruler before you take the screenshot.

**Georeference status.** A line under the file picker shows whether the plan is georeferenced and gives the home point latitude and longitude. Typing a new width or using two-point scaling makes the image a plain, non-georeferenced image again.

**The home point: fixed on the practice field, movable on your own field.**

- On the built-in practice field, home is fixed at the orange pad. The barn, bales, tree, gate, and drills are all laid out around it. The "Set home" button is greyed out, and the note under it says why.
- On your own field, home is movable. As soon as you load a field image or import a plan (KML, KMZ, GeoJSON, CSV, or GeoTIFF), the "Set home" button becomes active. "Remove field image" returns to the practice field, and the button greys out again.

**Where home goes.** On your own field, home is first set automatically:

- With an image: 6 m south of the middle of the image's south edge.
- With only a boundary: 6 m south of its southernmost point.
- With only a route: 5 m south of the first waypoint.

**Moving home.** Pick the spot where you would really stand, such as a field gate or a farm track:

1. Land and disarm. Home cannot be moved while the drone is armed or in the air.
2. Press "Set home" under the map. The button stays highlighted, an orange "SET HOME" banner appears on the map, and the cursor changes while it waits for your click. Every press shows a note under the button: what to do next, that it was cancelled, or why it was refused (in red).
3. Click the new home point on the map. Press Esc, or the button again, to cancel.

What happens:

- The H marker, the drone, and you (the pilot) move to the clicked point. You still stand 7 m south of home, looking north.
- The field image, the survey boundary, the waypoints, and the yellow flown track stay where they are on the ground. The map does not jump.
- In a georeferenced plan, every latitude and longitude stays the same. Only the home point latitude and longitude change, and the status line shows the new values.
- The plan is recomputed. The flight lines stay the same, but the pattern may now start from the other end, because it starts from the end nearer to home. Path length, time, and the line-of-sight warning are updated.
- The drone is reset with a full battery. Green photo dots from an earlier flight are cleared.

If you press the greyed-out button on the practice field, the note turns red and repeats the reason. Nothing else happens. Typing a new image width or using two-point scaling places the image north of home again and clears the plan.

**Import limits.**

- Only the first polygon and the first path in a file are used.
- Rotated Google Earth overlays are placed north-up, with a warning. Re-export them north-up for an exact fit.
- GeoTIFFs with more than three bands or 16-bit data may not decode. Export an 8-bit RGB copy.
- Very large images are reduced to 4096 pixels on the long side (2048 for GeoTIFF).

## 16. Flying a plan

1. Make a valid plan. The "Fly this plan" button becomes active.
2. Press "Fly this plan". The drone arms, climbs over home to the plan altitude, flies the path, returns home, and lands.
3. Use the time selector (1x to 8x) to speed up long surveys.
4. Close the window or leave it open. The map shows live progress.

During the flight:

- The nose turns along each leg.
- On survey lines, photos trigger by distance travelled. Each one appears as a green dot.
- The yellow line is the track actually flown. Compare it with the orange plan, especially in crosswind.
- The task box shows the current waypoint and the photo count.

Taking control:

- Move the right stick (or arrow keys) past about one third. The plan stops at once and you are in your selected flight mode.
- "Stop and hold" stops the plan and hovers.
- At 20 percent battery the drone abandons the plan, returns home, and lands.

After loading your own field, switch to the pilot view during a plan. It shows how small the drone looks at survey distance and height. That is a direct lesson in visual line of sight.

## 17. Exporting a plan

**Export KML.** Writes the home point, the survey boundary, the flight path with heights above ground, and every waypoint. It opens in Google Earth. KML export needs a georeferenced plan, so import a KML, KMZ, GeoTIFF, GeoJSON, CSV, or an image with a degree-based world file first.

**Export CSV.** One row per waypoint: number, latitude, longitude, altitude AGL, speed, and action. Without a georeference, the position columns are meters east and meters north of home.

The exported text always appears in a box for copying. On GitHub Pages or from a local file, the browser also saves the file directly.

The CSV is a general waypoint list. It is not in the exact column layout of any one flight app. Rearrange the columns to suit the app you use.

## 18. Saved data

The browser stores two things for this page, on this computer only:

- Drill results: the latest 40 attempts. The Results list shows the latest 10. "Clear results" deletes them.
- Controller mapping.

Nothing is sent anywhere. Plans and imported images are not saved. Export your plan before closing the page.

## 19. Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| The 3D view is blank | WebGL is disabled or blocked. Try another browser, update the graphics driver, or enable hardware acceleration |
| Low frame rate | Untick "Show front and down cameras". Make the browser window smaller. Close other tabs |
| Keys do nothing | Click once on the 3D view. Keys are ignored while the cursor is in a text or number box |
| The drone will not arm | It arms only on the ground and not after a crash. Press R first |
| The controller is not detected | Move a stick or press a button after plugging in. Browsers hide controllers until they see input |
| A stick moves the wrong way | Tick Invert for that channel in Controller setup |
| Throttle behaves oddly with an RC transmitter | Clear "Throttle stick springs back to center" |
| The drone climbs or sinks in stabilized mode | That is expected. Nothing holds height in this mode. Hold hover throttle and correct by eye |
| The drone refuses to sink fast near the ground | Landing assist is limiting the descent. Untick it in the Sensors section to practise unassisted landings |
| The drone slows by itself near objects | Obstacle avoidance is limiting speed. Untick it in the Sensors section |
| KMZ or GeoTIFF import fails | These need internet to fetch a helper library. Check the connection or a script blocker |
| The imported image is the wrong size | It is not georeferenced. Type its width or use two-point scaling |
| The KML boundary does not line up with the image | The image is a plain screenshot. Import the overlay as KMZ or GeoTIFF |
| Export KML is refused | The plan has no latitude and longitude. Import georeferenced data, or use CSV |
| "Set home" is greyed out | You are on the built-in practice field, where home is fixed. Load a field image or import a plan |
| "Set home" is refused with a red note | Land and disarm first |
| Text looks wider than expected | The display font could not load. The tool still works |

## 20. Known limits

- The ground is flat. Elevation is a constant offset, so terrain following is explained in the glossary but not simulated.
- The airframe is generic. Stick feel is plausible but not matched to a specific drone.
- Simulator practice transfers well for orientation and coordination. It transfers less well for depth perception, real wind, and nerves.
- Georeferencing uses a flat local plane around home. This is accurate to centimeters over a farm field and degrades over several kilometers.
- The 400 ft ceiling and line-of-sight checks follow US Part 107 conventions. They are teaching prompts, not legal advice. Check the rules that apply where you fly.
- No link to a physical drone is included in this version.

## 21. Quick reference card

```
LEFT STICK                     RIGHT STICK
  W  throttle up                 Up     pitch forward
  S  throttle down               Down   pitch back
  A  yaw left                    Left   roll left
  D  yaw right                   Right  roll right

Shift  full deflection          Space  arm / disarm
T      auto take off            L      auto land
1      position hold            2      altitude hold
3      stabilized               C      change camera
P      flight plan window       R      reset

Front of drone = ORANGE.   Home pad = orange ring.   You stand 7 m south of it.

Safe touchdown: under 1 m/s down, level, not sliding.

GSD (cm/px)      = sensor width x altitude x 100 / (focal length x image width)
Line spacing     = footprint width  x (1 - side overlap)
Trigger distance = footprint length x (1 - front overlap)
MSL altitude     = field elevation + AGL altitude
```
