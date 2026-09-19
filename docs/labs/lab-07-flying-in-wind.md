# Lab 7. Flying in wind

Level 1: Getting started

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

**Goal:** see what wind does, and hold position against it.

**Start**
1. Open the trainer address.
2. Click once on the picture of the field.
3. Check that "Position hold" is selected at the top right.

**Do**
1. Press **T** to take off.
2. In "Conditions and view", move the **Wind at 10 m** slider to 5 m/s.
3. Watch the round instrument. The drone leans into the wind to stay in place.
4. Look at "Ground speed" and "Airspeed". Ground speed reads about zero. Airspeed does not. It reads less than 5, because wind is weaker near the ground.
5. Press **2** for Altitude hold. The wind now pushes the drone away.
6. Use the arrow keys to fly back to the ring and hold there.
7. Press **1**, then **L** to land. Set the wind back to 0.

**You are done when** you have held near the ring for 20 seconds in Altitude hold with wind.

**If the drone blows far away:** press **1**, then fly back. Or press **R**.

**Think about it:** the drone was not moving over the ground. Why did Airspeed still show a value?

---

[Previous: Lab 6](lab-06-flying-with-less-help.md) | [All labs](README.md) | [Next: Lab 8](lab-08-sensors-and-obstacles.md)
