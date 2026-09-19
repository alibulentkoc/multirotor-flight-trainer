// ---------- main loop: fixed 250 Hz physics, free-running render ----------
var H = 1/250, acc = 0, last = performance.now();
function frame(now){
  var dt = Math.min(0.05, (now - last)/1000); last = now; acc += dt*timeScale;
  readInputs(dt);
  sensT += dt; if (sensT >= 0.05){ sensT = 0; updateSensors(); }
  while (acc >= H){ sim.step(H, sticks); drillStep(H); acc -= H; }
  render(dt); updateUI(dt); planTick(dt); requestAnimationFrame(frame);
}
setMode('pos'); setCam('los'); applyEnv(); buildDrill(); renderDrillButtons(); renderLog(); resize();
requestAnimationFrame(frame);
})();
