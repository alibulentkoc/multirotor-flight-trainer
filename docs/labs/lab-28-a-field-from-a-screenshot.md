# Lab 28. A field from a screenshot

Level 3: On your own

Trainer address: https://alibulentkoc.github.io/multirotor-flight-trainer/

- You cannot break anything. This is a simulator. Crashing costs nothing.
- If anything goes wrong, press **R**. The drone returns to the start, good as new.
- There is no time limit. Only your best try counts.

**The keys**

```
W / S   up / down            Arrow Up / Down     forward / back
A / D   turn left / right    Arrow Left / Right  slide left / right
T  take off    L  land    R  start over    C  change view    P  flight plan
1  Position hold    2  Altitude hold    3  Stabilized
Space  motors on / off       Shift  full stick
```

Orange arms mark the front of the drone. Pressing **1** at any time gives you all the help back.

---

**Goal:** plan a flight over a field when all you have is a picture with no coordinates.

**You need:** a screenshot of a field from Google Earth or any map, saved as JPG or PNG. Before you take it, measure one distance on the map with the ruler tool, for example the length of one field edge. Write that distance down.

**Start**
1. Open the trainer address.
2. Click once on the picture of the field.
3. Press **P**. The flight plan window opens.

**Do**
1. Under "Import your field", click **Choose Files** and pick your screenshot.
2. Click **Set image scale from two points**. Click the two ends of the edge you measured.
3. Type the true distance in meters and click **Apply**. The picture is now at the right size.
4. Check that **Survey area** is selected. Click the corners of the field to mark the boundary.
5. Click **Set home**, then click where you would stand.
6. Choose a camera and an altitude that give a GSD of 2.0 cm/pixel or better.
7. Clear any red warnings. Then set **8x time** and click **Fly this plan**.
8. Click **Export CSV** and save the text.

**You are done when** the drone has landed and you have the CSV text.

**If the scale looks wrong:** check the scale bar at the bottom left of the map against a distance you know.

**Think about it:** the status line says "Not georeferenced". What can you not do with this plan that you could do with a KML?

---

[Previous: Lab 27](lab-27-light-sun-and-cloud.md) | [All labs](README.md) | [Next: Lab 29](lab-29-design-a-mission-to-a-brief.md)
