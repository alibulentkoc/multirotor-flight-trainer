# Lab 32. Battery warnings and the emergency landing

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

**Goal:** watch the battery pass all three levels, then steer an emergency landing to a clear spot.

**Start**
1. Open the trainer address.
2. Click once on the picture of the field.
3. Press **1** for Position hold.
4. In the side panel, find "Battery and return to home". The levels read 30, 20, and 10. "Automatic RTH on low battery" is ticked.
5. Find the battery bar at the top left of the picture. It reads "100 %", "4.20 V/cell", and "OK".

**Do, part 1: voltage**
1. Press **T**. Look at "Per cell" in the section "Battery and return to home". It is already below 4.20 V, because the motors are drawing current.
2. Hold **W** with **Shift** for three seconds. "Current" jumps and "Per cell" dips. Let go. The voltage comes back. This dip is called sag.
3. Climb to about 10 m. Read "Time left". Hold **W** again and watch it drop, then recover in the hover.

**Do, part 2: the warning and the low level**
1. Waiting ten minutes is dull, so speed up time. Press **P**, set the time selector to **8x time**, and press **P** again. Keep your hands off the keys and let the drone hover.
2. At 30 % the battery bar reads "WARNING" and the task box tells you to plan your return. Nothing else happens.
3. At about 23 %, press **P**, set **1x time**, and press **P** again.
4. At 20 % the bar reads "LOW". The drone starts to return home by itself. The box at the top left reads "Returning home".
5. Take it back: hold the **Right arrow** for a second. RTH is cancelled, and it will not start again on this flight. The decision is now yours.

**Do, part 3: the emergency landing**
1. Fly over the red barn, to the left of the pad, and hover about 10 m above its roof.
2. Speed up time again (**P**, **8x time**, **P**). Around 15 % a message says the battery is getting short for the trip home. At about 12 %, go back to **1x time**.
3. At 10 % the bar reads "CRITICAL". The box at the top left reads "Emergency landing". The drone is coming down, onto the barn.
4. Try to stop it. Press **H**. Press **L**. Hold **W**. Nothing works. This landing cannot be cancelled.
5. The right stick still works. Hold an arrow key and slide the drone clear of the barn, over open grass. Keep clear of the bales and the gate.
6. Let it land. It touches down softly and switches the motors off.

**Do, part 4: your own levels**
1. Press **R**. In "Battery and return to home", set the warning level to 15 and leave the low level at 20. Press **Enter**.
2. A red note refuses the change and says why. The old levels stay in use. Set the warning level back to 30.

**You are done when** you have seen WARNING, LOW, and CRITICAL on the battery bar, cancelled one automatic return, and landed an emergency landing on open grass.

**Think about it:** you may cancel the return at the low level, but not the landing at the critical level. Why is that a sensible rule? And why might a real voltage alarm sound during a hard climb, then go quiet in the hover?

---

[Previous: Lab 31](lab-31-return-to-home-and-why-its-altitude-matters.md) | [All labs](README.md)
