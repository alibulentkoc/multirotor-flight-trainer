# Lab 27. Light, sun, and cloud

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

**Goal:** measure how the sun and the clouds change the light that a camera gets.

**Start**
1. Open the trainer address.
2. Click once on the picture of the field.
3. Check that "Position hold" is selected at the top right.
4. Press **T** to take off. Let the drone hover.

**Do**
1. In "Conditions and view", set **Cloud cover** to 0. Set **Sun height** to 10. Write down "Light" from the Sensors section.
2. Repeat with Sun height at 30, 50, and 80.
3. Set Sun height back to 50. Now set Cloud cover to 50, then 100. Write down "Light" each time.
4. Look at the shadow of the drone each time. Note when it is long, short, sharp, or faint.
5. Set Cloud cover to 0. Hold **Arrow Up** and watch "Light" while the drone leans forward. Then hold **Arrow Down**.
6. Press **L** to land.

| Sun height (deg) | 10 | 30 | 50 | 80 |
|---|---|---|---|---|
| Light, no cloud (klx) | | | | |

| Cloud cover (%) | 0 | 50 | 100 |
|---|---|---|---|
| Light, sun at 50 deg (klx) | | | |

**You are done when** both tables are full.

**Think about it:** the light changed when the drone leaned. Why would that matter for a camera that measures crop reflectance?

---

[Previous: Lab 26](lab-26-running-out-of-battery.md) | [All labs](README.md) | [Next: Lab 28](lab-28-a-field-from-a-screenshot.md)
