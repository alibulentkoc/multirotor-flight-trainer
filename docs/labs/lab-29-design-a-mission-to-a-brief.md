# Lab 29. Design a mission to a brief

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

**Goal:** meet a full set of requirements, as you would for a client.

**You need:** a field boundary saved from Google Earth as KML. To make one: draw a polygon around a field, right-click it, choose "Save Place As", and save it as KML.

**The brief**
- Image quality: 1.5 cm/pixel or better.
- Overlap: at least 75 percent front and 70 percent side.
- Battery: 15 minutes of endurance. Use no more than 80 percent.
- Wind on the day: 5 m/s from the west.
- The pilot must keep the drone in sight.

**Start**
1. Open the trainer address.
2. Click once on the picture of the field.
3. In "Conditions and view", set **Wind at 10 m** to 5 m/s and "Wind from" to 270 deg.
4. Press **P**. Under "Import your field", click **Choose Files** and pick your KML.

**Do**
1. Set "Battery endurance" to 15. Choose a camera.
2. Find an altitude that meets the image quality.
3. Choose a "Flight line direction" that suits the wind.
4. Click **Set home** and place the **H** where you can see the whole field.
5. Clear every red warning. If the field is too big for one battery, shrink the area and plan two flights.
6. Set **8x time** and click **Fly this plan**. Check that it finishes before the battery reaches 20 percent.
7. Click **Export KML** and save it.

**You are done when** the plan meets every line of the brief and the drone has flown it.

**Hand in:** your KML, and five sentences that explain your altitude, line direction, home position, and battery margin.

**Think about it:** which requirement was the hardest to meet, and what did you give up to meet it?

---

[Previous: Lab 28](lab-28-a-field-from-a-screenshot.md) | [All labs](README.md) | [Next: Lab 30](lab-30-checkride.md)
