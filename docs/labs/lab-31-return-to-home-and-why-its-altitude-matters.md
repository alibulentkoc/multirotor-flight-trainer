# Lab 31. Return to home, and why its altitude matters

Extra: Failsafes

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
H  return to home, press again to cancel
```

Orange arms mark the front of the drone. Pressing **1** at any time gives you all the help back.

---

**Goal:** see what return to home (RTH) does, watch it fly into the tree when its altitude is too low, then fix it.

**Start**
1. Open the trainer address.
2. Click once on the picture of the field.
3. Press **1** for Position hold.
4. In the side panel, find the section "Battery and return to home". "RTH altitude" reads 30.

**Do, part 1: a normal return**
1. Press **T**. Hold **W** and climb to about 10 m. Watch "Altitude AGL".
2. Hold the **Up arrow** for about five seconds. The drone flies away from you.
3. Press **H**. The box at the top left reads "Returning home".
4. Watch what it does, and read the task box at each step. It stops. It climbs straight up to 30 m. It turns its nose toward home. It flies back, comes down, lands, and switches the motors off.
5. Do it once more, but this time take the drone back. Take off, fly away, and press **H**. While it climbs, hold the **Right arrow** for a second. The task box says RTH is cancelled. You are flying again.

**Do, part 2: set it too low**
1. Press **R**. Click in the "RTH altitude" box, type 5, and press **Enter**. Then click once on the picture of the field.
2. Find the tree. It stands ahead of you and to the left, next to the windsock.
3. Press **T**. Climb to about 3 m. Fly past the tree and stop about 5 m behind it, so the tree stands between the drone and the orange ring.
4. Look at the small "Front camera" picture. Turn with **A** or **D** until the tree is in the middle of it, with the orange ring behind the tree.
5. Check the Sensors section: "Obstacle avoidance" is ticked. Remember that.
6. Press **H**. The drone climbs to 5 m and flies straight for home. The tree is about 10 m tall.
7. It hits the tree, and a notice says why. If it misses, the tree was not between the drone and the ring: press **R**, and line it up again.

**Do, part 3: fix it**
1. Press **R**. Measure the tree: take off, fly next to its top, and read "Altitude AGL".
2. Choose an RTH altitude that clears the tree with room to spare. 15 m is a good choice here. Type it in, press **Enter**, and click once on the picture of the field.
3. Fly behind the tree again, line it up again, and press **H**.
4. The drone climbs to your new altitude, passes over the tree, and lands at home.

**You are done when** one return has ended in the tree, and one has passed over it and landed at home.

**Think about it:** obstacle avoidance was on, and the drone still hit the tree. RTH flies a straight line at one height and does not steer around anything. On a real field, what is the tallest thing between you and the far corner? How much room would you add, and why not simply set 120 m every time?

---

[Previous: Lab 30](lab-30-checkride.md) | [All labs](README.md) | [Next: Lab 32](lab-32-battery-warnings-and-the-emergency-landing.md)
