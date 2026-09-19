# Lab 8. Sensors and obstacles

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

**Goal:** watch the distance sensors work, and let the drone protect itself.

**Start**
1. Open the trainer address.
2. Click once on the picture of the field.
3. Check that "Position hold" is selected at the top right.
4. In the Sensors section, check that "Obstacle avoidance" is ticked. It is ticked by default.

**Do**
1. Press **T** to take off.
2. Hold **A** until the nose points at the red barn on your left.
3. Hold **Arrow Up** and fly toward the barn. Do not let go.
4. Watch the range display in the Sensors section. An arc appears. It goes green, then amber.
5. The drone slows down and stops about 2 m from the barn, by itself.
6. Fly under the tree and hold **W**. The drone stops below the branches. Read "Range up".
7. Press **L** to land.

**You are done when** you have seen the drone stop by itself in front of the barn.

**Good to know:** avoidance only works in Position hold. In the other modes the drone warns you, but you must stop it yourself.

**Think about it:** why might a pilot switch avoidance off on purpose?

---

[Previous: Lab 7](lab-07-flying-in-wind.md) | [All labs](README.md) | [Next: Lab 9](lab-09-plan-a-survey-flight.md)
