// ---------- sensors ----------
var ray = new THREE.Raycaster(), rO = new THREE.Vector3(), rD = new THREE.Vector3(), downTargets = obstacles.concat([ground]), fieldMode = false, noObst = [];
var sens = { f: Infinity, b: Infinity, l: Infinity, r: Infinity, up: Infinity, downObs: false, down: 0, lux: 0, air: 0, wind: 0, clover: 0 }, sensT = 0;
function cast(dx, dy, dz, targets, far){ ray.far = far; rD.set(dx, dy, dz).normalize(); ray.set(rO, rD); var h = ray.intersectObjects(targets, false); cast.obj = h.length ? h[0].object : null; return h.length ? h[0].distance + (Math.random() - 0.5)*0.02 : Infinity; }
function fan(a, far){ var m = Infinity; for (var k = -2; k <= 2; k++){ var t = a + k*0.35; m = Math.min(m, cast(-Math.sin(t), 0, -Math.cos(t), fieldMode ? noObst : obstacles, far)); } return m; }
function updateSensors(){
  var p = sim.pos, psi = sim.yaw(), up = qrot(sim.q, [0, 1, 0]);
  rO.set(p[0], p[1] + 0.12, p[2]);
  sens.f = fan(psi, 6); sens.l = fan(psi + Math.PI/2, 6); sens.b = fan(psi + Math.PI, 6); sens.r = fan(psi - Math.PI/2, 6);
  sens.down = Math.max(0, cast(-up[0], -up[1], -up[2], fieldMode ? [ground] : downTargets, 8) - 0.12); sens.downObs = !!cast.obj && cast.obj !== ground;
  sens.up = cast(up[0], up[1], up[2], fieldMode ? noObst : obstacles, 6);
  var se = Math.sin(env.el*Math.PI/180), dot = Math.max(0, up[0]*sunDir.x + up[1]*sunDir.y + up[2]*sunDir.z);
  sens.lux = 95000*Math.pow(1 - env.cloud, 1.5)*Math.pow(se, 0.3)*dot + (6000 + 14000*se)*(1 - 0.55*env.cloud)*(0.5 + 0.5*up[1]);
  sens.lux *= 1 + (Math.random() - 0.5)*0.01;
  var wv = sim.windVec(); sens.wind = Math.hypot(wv[0], wv[2]); sens.air = Math.hypot(sim.v[0] - wv[0], sim.v[1], sim.v[2] - wv[2]);
  var half = Math.max(0.05, p[1]*0.577), sum = 0, cnt = 0;
  for (var ix = -3; ix <= 3; ix++) for (var iz = -3; iz <= 3; iz++){ sum += cloverAt(p[0] + ix/3*half*1.5, p[2] + iz/3*half); cnt++; }
  sens.clover = sum/cnt;
  sim.avoid = $('avoid').checked ? sens : null;
  if (!sim.crashed && !sim.onGround && !fieldMode){
    rO.set(p[0], p[1] + 0.1, p[2]);
    for (var c = 0; c < colliders.length; c++) if (hitsCollider(colliders[c], rO)){ sim.crash('Hit an obstacle. Watch the range display and slow down near structures.'); break; }
  }
}
var radar = $('radar'), rc = radar.getContext('2d');
function fmtR(r){ return r === Infinity ? 'clear' : r.toFixed(2) + ' m'; }
function drawRadar(){
  var ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#13242d', c = 150;
  rc.clearRect(0, 0, 300, 300); rc.lineCap = 'butt';
  rc.strokeStyle = ink; rc.globalAlpha = 0.18; rc.lineWidth = 2;
  [40, 80, 120].forEach(function(r){ rc.beginPath(); rc.arc(c, c, r, 0, 7); rc.stroke(); }); rc.globalAlpha = 1;
  [['f', -Math.PI/2], ['r', 0], ['b', Math.PI/2], ['l', Math.PI]].forEach(function(d){
    var r = sens[d[0]]; if (r === Infinity) return;
    rc.strokeStyle = r < 1.5 ? '#c62828' : (r < 3 ? '#e09400' : '#1d7a4c'); rc.lineWidth = 12;
    rc.beginPath(); rc.arc(c, c, 20 + r/6*110, d[1] - 0.55, d[1] + 0.55); rc.stroke();
    rc.fillStyle = ink; rc.font = '600 22px Arial'; rc.textAlign = 'center'; rc.textBaseline = 'middle';
    var tr = Math.min(128, 20 + r/6*110 + 22); rc.fillText(r.toFixed(1), c + Math.cos(d[1])*tr, c + Math.sin(d[1])*tr);
  });
  rc.fillStyle = ink; rc.beginPath(); rc.moveTo(c, c - 16); rc.lineTo(c + 10, c + 10); rc.lineTo(c - 10, c + 10); rc.closePath(); rc.fill();
}
function updateSensorUI(){
  drawRadar();
  $('sDown').textContent = sens.down === Infinity ? 'over 8 m' : sens.down.toFixed(2) + ' m';
  $('sFront').textContent = fmtR(sens.f); $('sUp').textContent = fmtR(sens.up);
  $('sLux').textContent = (sens.lux/1000).toFixed(1) + ' klx';
  $('sAir').textContent = sens.air.toFixed(1) + ' m/s'; $('sWind').textContent = sens.wind.toFixed(1) + ' m/s';
  $('sClover').textContent = fieldMode ? 'n/a' : Math.round(sens.clover*100) + ' %';
}
var pipCam = new THREE.PerspectiveCamera(70, 1.5, 0.05, 2500);
function renderPip(el, down){
  var r = el.getBoundingClientRect(), v = view.getBoundingClientRect(); if (!r.width) return;
  var p = sim.pos, q = sim.q, x = r.left - v.left + 2, y = v.bottom - r.bottom + 2, w = r.width - 4, h = r.height - 4;
  pipCam.quaternion.set(q[0], q[1], q[2], q[3]); pipCam.position.set(p[0], p[1] + 0.12, p[2]);
  if (down){ pipCam.rotateX(-Math.PI/2); pipCam.fov = 60; } else { pipCam.translateZ(-0.3); pipCam.fov = 70; }
  pipCam.aspect = w/h; pipCam.updateProjectionMatrix();
  renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.setScissorTest(true); renderer.render(scene, pipCam);
}

