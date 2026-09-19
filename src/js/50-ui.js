// ---------- UI ----------
var HINTS = {
  pos: 'Sticks command speed. Let go and the drone stops and holds its place. This is how a Tello or a GPS camera drone feels.',
  alt: 'The drone holds height for you. You control tilt, so it drifts until you level it and brake.',
  angle: 'You control tilt and raw throttle. Nothing holds height or position. This is the skill that transfers to any multirotor.'
};
function setMode(m){
  sim.mode = m; sim.posSp = null; sim.altSp = null; sim.iv = [0, 0, 0];
  [].forEach.call($('modes').children, function(b){ b.setAttribute('aria-pressed', b.dataset.mode === m ? 'true' : 'false'); });
  $('modeHint').textContent = HINTS[m];
}
[].forEach.call($('modes').children, function(b){ b.addEventListener('click', function(){ setMode(b.dataset.mode); }); });
var cam = 'los';
function setCam(c){ cam = c; $('cam').value = c; $('camPill').textContent = 'View: ' + CAMNAMES[c]; pilot.visible = c !== 'los'; drone.visible = c !== 'fpv'; }
$('cam').addEventListener('change', function(e){ setCam(e.target.value); e.target.blur(); });
$('bArm').addEventListener('click', function(){ sim.command(sim.armed ? 'disarm' : 'arm'); });
$('bTakeoff').addEventListener('click', function(){ sim.command('takeoff'); });
$('bLand').addEventListener('click', function(){ sim.command('land'); });
$('bReset').addEventListener('click', function(){ startDrill(drill.id); });
$('wind').addEventListener('input', function(e){ sim.wind = +e.target.value; $('windOut').textContent = e.target.value + ' m/s'; });
$('bClear').addEventListener('click', function(){ sessionLog = []; store.set('uavtrainer.log.v1', []); renderLog(); renderDrillButtons(); });
var sessionLog = store.get('uavtrainer.log.v1', []);
var MODENAMES = { pos: 'Position', alt: 'Altitude', angle: 'Stabilized' };
function renderLog(){
  var t = $('log'); $('logEmpty').style.display = sessionLog.length ? 'none' : 'block'; $('bClear').style.display = sessionLog.length ? '' : 'none';
  if (!sessionLog.length){ t.innerHTML = ''; return; }
  t.innerHTML = '<tr><th>Drill</th><th>Mode</th><th>Wind</th><th>Time</th><th>Score</th></tr>' + sessionLog.slice(0, 10).map(function(r){
    return '<tr><td>' + DRILLS[r.d].name + '</td><td>' + MODENAMES[r.m] + '</td><td>' + r.w + '</td><td>' + r.t + ' s</td><td>' + r.s + '</td></tr>'; }).join('');
}
function renderDrillButtons(){
  var el = $('drills'); el.innerHTML = '';
  Object.keys(DRILLS).forEach(function(id){
    var b = document.createElement('button'), best = sessionLog.filter(function(r){ return r.d === id; }).reduce(function(m, r){ return Math.max(m, r.s); }, -1);
    b.setAttribute('aria-pressed', id === drill.id ? 'true' : 'false');
    b.innerHTML = '<span>' + DRILLS[id].name + '</span><small>' + (id === 'free' ? '' : (best >= 0 ? 'best ' + best : 'not flown')) + '</small>';
    b.addEventListener('click', function(){ startDrill(id); b.blur(); }); el.appendChild(b);
  });
}
function showNotice(kind, title, text){ var n = $('notice'); n.className = kind; n.querySelector('h2').textContent = title; n.querySelector('p').textContent = text; n.style.display = 'block'; }
function hideNotice(){ $('notice').style.display = 'none'; }

var hud = $('hud'), hc = hud.getContext('2d');
function drawHud(tel){
  var c = 150; hc.save(); hc.clearRect(0, 0, 300, 300);
  hc.beginPath(); hc.arc(c, c, 148, 0, 7); hc.clip();
  hc.translate(c, c); hc.rotate(-tel.roll); hc.translate(0, tel.pitch*57.3*3.2);
  hc.fillStyle = '#6fb1d6'; hc.fillRect(-400, -800, 800, 800); hc.fillStyle = '#7a5a3a'; hc.fillRect(-400, 0, 800, 800);
  hc.strokeStyle = '#fff'; hc.lineWidth = 3; hc.beginPath(); hc.moveTo(-400, 0); hc.lineTo(400, 0); hc.stroke();
  hc.lineWidth = 2; hc.fillStyle = '#fff'; hc.font = '600 18px Arial'; hc.textAlign = 'center';
  [-30, -20, -10, 10, 20, 30].forEach(function(d){ var y = -d*3.2, w = d % 20 === 0 ? 44 : 26; hc.beginPath(); hc.moveTo(-w, y); hc.lineTo(w, y); hc.stroke(); });
  hc.restore();
  hc.strokeStyle = '#ffb000'; hc.lineWidth = 6; hc.beginPath();
  hc.moveTo(60, c); hc.lineTo(120, c); hc.lineTo(135, c + 16); hc.moveTo(240, c); hc.lineTo(180, c); hc.lineTo(165, c + 16); hc.stroke();
  hc.fillStyle = '#ffb000'; hc.beginPath(); hc.arc(c, c, 5, 0, 7); hc.fill();
}
var uiT = 0;
function updateUI(dt){
  drawL(); drawR();
  uiT += dt; if (uiT < 0.08) return; uiT = 0;
  var tel = sim.telemetry(); drawHud(tel);
  $('tAlt').textContent = tel.altitude_m.toFixed(1) + ' m';
  $('tMsl').textContent = ((+$('pElev').value || 0) + tel.altitude_m).toFixed(0) + ' m';
  $('tVz').textContent = (tel.vz >= 0 ? '+' : '') + tel.vz.toFixed(1) + ' m/s';
  $('tSpd').textContent = tel.ground_speed.toFixed(1) + ' m/s';
  $('tHdg').textContent = ('00' + Math.round(tel.heading_deg) % 360).slice(-3) + ' deg';
  $('tDist').textContent = Math.hypot(tel.x, tel.altitude_m - 1.6, tel.z - 7).toFixed(1) + ' m';
  updateSensorUI();
  $('tBat').textContent = Math.round(tel.battery) + ' %'; $('tBat').style.color = tel.battery < 20 ? 'var(--warn)' : '';
  for (var i = 0; i < 4; i++) $('m' + i).style.width = (tel.motors[i]*100).toFixed(0) + '%';
  var ap = $('armPill');
  ap.textContent = sim.crashed ? 'Crashed' : (sim.auto === 'takeoff' ? 'Taking off' : sim.auto === 'land' ? 'Landing' : sim.armed ? 'Armed' : 'Disarmed');
  ap.className = 'pill' + (sim.armed ? ' armed' : '');
  $('bArm').textContent = sim.armed ? 'Disarm' : 'Arm';
  $('bTakeoff').disabled = !sim.onGround || !!sim.crashed; $('bLand').disabled = sim.onGround;
  var msg = '<b>' + DRILLS[drill.id].name + '.</b> ' + DRILLS[drill.id].brief;
  if (drill.phase === 'run'){
    if (drill.id === 'hover' || drill.id === 'nosein') msg += ' <b>' + drill.hold.toFixed(1) + ' / 15 s</b>';
    if (drill.id === 'square') msg += ' <b>Marker ' + Math.min(4, drill.idx + 1) + ' of 4, ' + drill.t.toFixed(1) + ' s</b>';
    if (drill.id === 'land') msg += ' <b>' + Math.hypot(tel.x - LAND_T[0], tel.z - LAND_T[1]).toFixed(1) + ' m to target</b>';
  } else if (drill.phase === 'ready' && !sim.armed){ msg += ' Press Space to arm, or T to take off automatically.'; }
  var near = Math.min(sens.f, sens.b, sens.l, sens.r, sens.up, sens.downObs ? sens.down : Infinity);
  if (sim.avoiding) msg = '<b>Obstacle avoidance is holding you back.</b> ' + near.toFixed(1) + ' m to the nearest surface.' + (sens.downObs && sens.down < 2 ? ' There is an obstacle below: move clear before descending.' : '');
  else if (sim.assisting) msg = '<b>Landing assist is slowing your descent.</b>';
  else if (near < 2 && !sim.onGround) msg = '<b>Obstacle ' + near.toFixed(1) + ' m away.</b> ' + (sim.mode === 'pos' ? '' : 'Avoidance only acts in position hold. ') + 'Ease off.';
  if (sim.auto === 'mission' && sim.mission) msg = '<b>Flying the plan.</b> Waypoint ' + (sim.mission.idx + 1) + ' of ' + sim.mission.wps.length + ', ' + sim.photos.length + ' photos taken.' + (sim.mission.rth ? ' <b>Low battery: returning home.</b>' : '');
  else if (sim.auto === 'land' && sim.photos.length) msg = '<b>Plan complete.</b> ' + sim.photos.length + ' photos taken. Landing at home.';
  if (Math.hypot(tel.x, tel.z) > (fieldMode || sim.auto ? 500 : 45)) msg = '<b>Too far away.</b> You would lose sight of it. Bring it back or press R.';
  $('task').innerHTML = msg;
}

