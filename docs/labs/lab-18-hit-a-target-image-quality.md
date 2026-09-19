# Lab 18. Hit a target image quality

Level 2: Less help

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

**Goal:** plan a flight that gives 1.00 cm/pixel or better, with no warnings.

**Start**
1. Open the trainer address.
2. Click once on the picture of the field.
3. Press **P**. The flight plan window opens.
4. Check that **Survey area** is selected. Click **Whole field**.

**Do**
1. Set "Camera" to **Small drone, 12 MP**.
2. Read the GSD in the results table. It is above 1.00 cm/pixel. That is too coarse.
3. Lower "Altitude above ground" a few meters at a time until the GSD reads 1.00 or less.
4. A red warning appears about the photo interval. Read it.
5. Change one setting to clear the warning. The warning tells you which ones can help.
6. Check that the GSD is still 1.00 or less.
7. Set the time selector to **8x time**. Click **Fly this plan**.

**You are done when** the GSD is 1.00 or less, no red warning shows, and the drone has landed.

**If you cannot clear the warning:** try a lower "Speed".

**Think about it:** flying lower gave sharper pictures. What did it cost you?

---

[Previous: Lab 17](lab-17-measure-the-wind-at-height.md) | [All labs](README.md) | [Next: Lab 19](lab-19-with-the-wind-or-across-it.md)
