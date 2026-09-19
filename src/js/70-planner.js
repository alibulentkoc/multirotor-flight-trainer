// ---------- flight planner ----------
// fieldRect = { w, h, cx, cz }: size and center of the field image in local meters
var timeScale = 1, planMode = 'area', poly = [], route = [], plan = null, fieldCanvas = null, fieldPlane = null, fieldRect = null, mapT = 0;
var geo = null, view2d = { cx: 0, cz: -32, span: 150 }, track = [], calib = null, homePick = false;
var map = $('map'), mx = map.getContext('2d');

// Everything from mkGeo down to geoNote is pure (no DOM, no three.js). test/run.js loads that range headless.
// --- georeference: flat local tangent plane around the home point (sim origin) ---
function mkGeo(lat, lon){ var p = lat*Math.PI/180; return { lat0: lat, lon0: lon,
  mLat: 111132.92 - 559.82*Math.cos(2*p) + 1.175*Math.cos(4*p), mLon: 111412.84*Math.cos(p) - 93.5*Math.cos(3*p) }; }
// g is optional and defaults to the current georeference
function ll2xz(lat, lon, g){ g = g || geo; return [(lon - g.lon0)*g.mLon, -(lat - g.lat0)*g.mLat]; }
function xz2ll(x, z, g){ g = g || geo; return [g.lat0 - z/g.mLat, g.lon0 + x/g.mLon]; }
function utm2ll(E, N, zone, south){
  var a = 6378137, f = 1/298.257223563, k0 = 0.9996, e2 = f*(2 - f), ep2 = e2/(1 - e2), x = E - 500000, y = south ? N - 10000000 : N;
  var mu = y/k0/(a*(1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256)), e1 = (1 - Math.sqrt(1 - e2))/(1 + Math.sqrt(1 - e2));
  var p1 = mu + (3*e1/2 - 27*Math.pow(e1, 3)/32)*Math.sin(2*mu) + (21*e1*e1/16 - 55*Math.pow(e1, 4)/32)*Math.sin(4*mu) + 151*Math.pow(e1, 3)/96*Math.sin(6*mu) + 1097*Math.pow(e1, 4)/512*Math.sin(8*mu);
  var s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1), C1 = ep2*c*c, T1 = t*t, N1 = a/Math.sqrt(1 - e2*s*s), R1 = a*(1 - e2)/Math.pow(1 - e2*s*s, 1.5), D = x/(N1*k0);
  var lat = p1 - (N1*t/R1)*(D*D/2 - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*ep2)*Math.pow(D, 4)/24 + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*ep2 - 3*C1*C1)*Math.pow(D, 6)/720);
  var lon = (D - (1 + 2*T1 + C1)*Math.pow(D, 3)/6 + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*ep2 + 24*T1*T1)*Math.pow(D, 5)/120)/c;
  return [lat*180/Math.PI, (zone*6 - 183) + lon*180/Math.PI];
}
// --- plan computation: pure, so it can be tested headless ---
var CAMERAS = [
  { n: 'Small drone, 12 MP (1/2.3 in)', sw: 6.17, sh: 4.55, f: 4.5, iw: 4000, ih: 3000 },
  { n: 'Mapping drone, 20 MP (1 in)', sw: 13.2, sh: 8.8, f: 8.8, iw: 5472, ih: 3648 },
  { n: 'Multispectral, 1.2 MP per band', sw: 4.8, sh: 3.6, f: 5.4, iw: 1280, ih: 960 }
];
// input limits as [min, max, default]
var PLAN_LIMITS = { alt: [5, 120, 40], front: [10, 95, 75], side: [10, 95, 70], speed: [1, 8, 5], dir: [0, 179, 0], endurance: [5, 45, 20] };
// time allowances for the estimate, and pattern limits
var PLAN_TIMES = { turn: 4, photoHold: 1.5, hoverHold: 5, climbRate: 2.5, descentRate: 0.6, legClimbRate: 2, overhead: 10, minLine: 1, maxLines: 400 };
// inp = { cam, alt (m), front (%), side (%), speed (m/s), dirDeg, endurance (min), mode: 'area' | 'route', poly: [[x, z]], route: [{ x, z, alt, act }] }
function planCompute(inp){
  var cam = inp.cam, alt = inp.alt, fo = inp.front/100, so = inp.side/100, speed = inp.speed, dir = inp.dirDeg*Math.PI/180, poly = inp.poly || [], route = inp.route || [], T = PLAN_TIMES;
  var W = cam.sw*alt/cam.f, L = cam.sh*alt/cam.f, P = { cam: cam, alt: alt, speed: speed, W: W, L: L, dir: dir, mode: inp.mode };
  P.gsd = cam.sw*alt*100/(cam.f*cam.iw); P.spacing = W*(1 - so); P.trig = L*(1 - fo); P.interval = P.trig/speed;
  P.lines = []; P.shots = []; P.wps = []; P.area = 0; P.dist = 0; P.time = 0; P.endurance = inp.endurance; P.ok = false;
  var i, prev = [0, 0], holdOf = function(r){ return r.act === 'hover' ? T.hoverHold : (r.act === 'photo' ? T.photoHold : 0); };
  if (inp.mode === 'route'){
    if (route.length >= 1){
      var climb = 0, hold = 0, lastAlt = route[0].alt;
      P.wps.push({ x: 0, y: route[0].alt, z: 0 });
      route.forEach(function(r){
        P.wps.push({ x: r.x, y: r.alt, z: r.z, photo: r.act === 'photo', hold: holdOf(r) });
        P.dist += Math.hypot(r.x - prev[0], r.z - prev[1]); prev = [r.x, r.z]; climb += Math.abs(r.alt - lastAlt); lastAlt = r.alt; hold += holdOf(r);
        if (r.act === 'photo') P.shots.push([r.x, r.z, 0]);
      });
      P.dist += Math.hypot(prev[0], prev[1]); P.wps.push({ x: 0, y: lastAlt, z: 0 });
      P.time = P.dist/speed + route.length*T.turn + hold + climb/T.legClimbRate + route[0].alt/T.climbRate + lastAlt/T.descentRate + T.overhead; P.ok = true;
    }
  } else if (poly.length >= 3){
    // rotate so flight lines run along the local v axis; dir 0 = north-south lines
    var ca = Math.cos(dir), sa = Math.sin(dir), loc = poly.map(function(p){ return [p[0]*ca + p[1]*sa, -p[0]*sa + p[1]*ca]; });
    var minU = Infinity, maxU = -Infinity; loc.forEach(function(p){ minU = Math.min(minU, p[0]); maxU = Math.max(maxU, p[0]); });
    for (i = 0; i < poly.length; i++){ var a = poly[i], b = poly[(i + 1) % poly.length]; P.area += a[0]*b[1] - b[0]*a[1]; } P.area = Math.abs(P.area)/2;
    var nL = Math.max(1, Math.ceil((maxU - minU)/P.spacing)), u0 = (minU + maxU)/2 - (nL - 1)*P.spacing/2, flip = false;
    for (var k = 0; k < nL && k < T.maxLines; k++){
      var u = u0 + k*P.spacing, hits = [];
      for (i = 0; i < loc.length; i++){ var p1 = loc[i], p2 = loc[(i + 1) % loc.length];
        if ((p1[0] - u)*(p2[0] - u) <= 0 && p1[0] !== p2[0]) hits.push(p1[1] + (u - p1[0])/(p2[0] - p1[0])*(p2[1] - p1[1])); }
      if (hits.length < 2) continue;
      var v1 = Math.min.apply(null, hits), v2 = Math.max.apply(null, hits); if (v2 - v1 < T.minLine) continue;
      var A = [u*ca - v1*sa, u*sa + v1*ca], B = [u*ca - v2*sa, u*sa + v2*ca];
      P.lines.push(flip ? [A, B] : [B, A]); flip = !flip;
    }
    if (P.lines.length){ // start from the end of the pattern nearest home
      var first = P.lines[0][0], lastEnd = P.lines[P.lines.length - 1][1];
      if (Math.hypot(lastEnd[0], lastEnd[1]) < Math.hypot(first[0], first[1])) P.lines = P.lines.reverse().map(function(l){ return [l[1], l[0]]; });
    }
    P.wps.push({ x: 0, y: alt, z: 0 });
    P.lines.forEach(function(l){
      P.wps.push({ x: l[0][0], y: alt, z: l[0][1] }); P.wps.push({ x: l[1][0], y: alt, z: l[1][1], survey: true });
      P.dist += Math.hypot(l[0][0] - prev[0], l[0][1] - prev[1]); var len = Math.hypot(l[1][0] - l[0][0], l[1][1] - l[0][1]); P.dist += len; prev = l[1];
      for (var d = 0; d <= len; d += P.trig) P.shots.push([l[0][0] + (l[1][0] - l[0][0])*d/len, l[0][1] + (l[1][1] - l[0][1])*d/len, Math.atan2(-(l[1][0] - l[0][0]), -(l[1][1] - l[0][1]))]);
    });
    P.dist += Math.hypot(prev[0], prev[1]); P.wps.push({ x: 0, y: alt, z: 0 });
    P.time = P.dist/speed + P.lines.length*2*T.turn + alt/T.climbRate + alt/T.descentRate + T.overhead; P.ok = P.lines.length > 0;
  }
  return P;
}
// --- movable home: home stays the sim origin, so moving home shifts everything else the other way ---
// s = { geo, poly, route, track, field: { w, h, cx, cz } | null } in local meters. (hx, hz) is the new home in the old frame.
// With a georeference, points go through latitude and longitude, so their geographic coordinates do not change.
// Local meters then rescale very slightly, because the tangent plane is re-anchored: about 11 parts per million per 100 m of
// north-south move at 35 deg latitude (about 1 mm across a 100 m field). The field image keeps its size, which is well below one pixel.
function shiftHome(s, hx, hz){
  var g0 = s.geo, h = g0 ? xz2ll(hx, hz, g0) : null, g1 = g0 ? mkGeo(h[0], h[1]) : null;
  var mv = function(x, z){ if (!g0) return [x - hx, z - hz]; var l = xz2ll(x, z, g0); return ll2xz(l[0], l[1], g1); };
  var c = s.field ? mv(s.field.cx, s.field.cz) : null;
  return { geo: g1,
    poly: (s.poly || []).map(function(p){ return mv(p[0], p[1]); }),
    route: (s.route || []).map(function(r){ var q = mv(r.x, r.z); return { x: q[0], z: q[1], alt: r.alt, act: r.act }; }),
    track: (s.track || []).map(function(p){ return mv(p[0], p[1]); }),
    field: s.field ? { w: s.field.w, h: s.field.h, cx: c[0], cz: c[1] } : null };
}
// What a press of "Set home", or the map click that follows it, should do. Every outcome carries a message, so a press is never silent.
// st = { picking, hasField, hasGeo, armed, onGround }. Returns { action: 'arm' | 'cancel' | 'refuse', msg }.
var HOME_MSG = {
  arm: 'Click the map where you will stand and take off. Press Esc or the button again to cancel.',
  cancel: 'Set home cancelled. Home has not moved.',
  practice: 'Home is fixed on the practice field. Load a field image or import a plan first.',
  flying: 'Land and disarm before moving home.',
  moved: 'Home moved. The drone now sits at the new home.'
};
function homeDecision(st){
  if (st.picking) return { action: 'cancel', msg: HOME_MSG.cancel };
  if (!st.hasField && !st.hasGeo) return { action: 'refuse', msg: HOME_MSG.practice };
  if (st.armed || !st.onGround) return { action: 'refuse', msg: HOME_MSG.flying };
  return { action: 'arm', msg: HOME_MSG.arm };
}
function geoNote(msg){ $('geoStatus').textContent = msg || (geo ? 'Georeferenced. Home point: ' + geo.lat0.toFixed(6) + ', ' + geo.lon0.toFixed(6) + '.' : 'Not georeferenced. Exports use local meters east and north of home.'); }
CAMERAS.forEach(function(c, i){ var o = document.createElement('option'); o.value = i; o.textContent = c.n; $('pCam').appendChild(o); });
$('pCam').value = 1;

function w2m(x, z){ var v = view2d; return [(x - v.cx)/v.span*840 + 420, (z - v.cz)/v.span*840 + 420]; }
function m2w(e){ var r = map.getBoundingClientRect(), v = view2d; return [((e.clientX - r.left)/r.width - 0.5)*v.span + v.cx, ((e.clientY - r.top)/r.height - 0.5)*v.span + v.cz]; }
function fitView(){
  var pts = [[0, 0]]; poly.forEach(function(p){ pts.push(p); }); route.forEach(function(p){ pts.push([p.x, p.z]); });
  if (fieldRect){ pts.push([fieldRect.cx - fieldRect.w/2, fieldRect.cz - fieldRect.h/2]); pts.push([fieldRect.cx + fieldRect.w/2, fieldRect.cz + fieldRect.h/2]); }
  if (pts.length === 1){ view2d = { cx: 0, cz: -32, span: 150 }; return; }
  var x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity;
  pts.forEach(function(p){ x1 = Math.min(x1, p[0]); x2 = Math.max(x2, p[0]); z1 = Math.min(z1, p[1]); z2 = Math.max(z2, p[1]); });
  view2d = { cx: (x1 + x2)/2, cz: (z1 + z2)/2, span: Math.max(60, Math.max(x2 - x1, z2 - z1)*1.15 + 20) };
}
function num(id, lo, hi, d){ var v = parseFloat($(id).value); if (isNaN(v)) v = d; return clamp(v, lo, hi); }
function planNum(id, k){ var l = PLAN_LIMITS[k]; return num(id, l[0], l[1], l[2]); }

function computePlan(){
  plan = planCompute({ cam: CAMERAS[+$('pCam').value], alt: planNum('pAlt', 'alt'), front: planNum('pFront', 'front'), side: planNum('pSide', 'side'), speed: planNum('pSpeed', 'speed'),
    dirDeg: planNum('pDir', 'dir'), endurance: planNum('pBatt', 'endurance'), mode: planMode, poly: poly, route: route });
  renderPlanOut(); renderWpTable(); drawMap();
}
function renderPlanOut(){
  var P = plan, rows = [
    ['GSD at ' + P.alt + ' m', P.gsd.toFixed(2) + ' cm/pixel'], ['Photo footprint', P.W.toFixed(1) + ' x ' + P.L.toFixed(1) + ' m']];
  if (P.mode === 'area') rows.push(['Line spacing (from side overlap)', P.spacing.toFixed(1) + ' m'], ['Trigger distance (from front overlap)', P.trig.toFixed(1) + ' m, every ' + P.interval.toFixed(1) + ' s'],
    ['Survey area', (P.area/10000).toFixed(2) + ' ha (' + (P.area/4046.86).toFixed(2) + ' acres)'], ['Flight lines and photos', P.lines.length + ' lines, ' + P.shots.length + ' photos']);
  else rows.push(['Waypoints and photos', route.length + ' waypoints, ' + P.shots.length + ' photos']);
  rows.push(['Altitude', P.alt + ' m AGL = ' + Math.round(P.alt*3.281) + ' ft, ' + Math.round(num('pElev', -100, 4000, 0) + P.alt) + ' m MSL'],
    ['Path length and time', Math.round(P.dist) + ' m, about ' + (P.time/60).toFixed(1) + ' min']);
  $('planOut').innerHTML = rows.map(function(r){ return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('');
  var w = [];
  if (P.mode === 'area' && poly.length < 3) w.push('Mark at least three corners on the map.');
  if (P.mode === 'route' && !route.length) w.push('Click the map to drop waypoints in the order to fly them.');
  if (P.mode === 'area' && P.interval < 2) w.push('Photo interval under 2 s. Many cameras cannot keep up: slow down or fly higher.');
  if (P.time/60 > P.endurance*0.8) w.push('Needs more than 80 % of the battery. Split the job or change altitude.');
  var top = P.alt; route.forEach(function(r){ if (P.mode === 'route') top = Math.max(top, r.alt); }); if (top*3.281 > 400) w.push('Above the 400 ft AGL ceiling.');
  var far = 0; P.wps.forEach(function(q){ far = Math.max(far, Math.hypot(q.x, q.z)); }); if (far > 450) w.push('Farthest point is ' + Math.round(far) + ' m from you. Holding visual line of sight is doubtful.');
  $('planWarn').textContent = w.join(' '); $('planFly').disabled = !P.ok;
}
function renderWpTable(){
  var t = $('wpTable'); $('wpBox').hidden = planMode !== 'route';
  if (planMode !== 'route') return;
  if (document.activeElement && t.contains(document.activeElement)) return; // do not rebuild while the user is typing in it
  t.innerHTML = '<tr><th>#</th><th>Altitude AGL (m)</th><th>At the waypoint</th><th></th></tr>';
  route.forEach(function(r, i){
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + (i + 1) + '</td><td><input type="number" min="2" max="120" value="' + r.alt + '" aria-label="Altitude of waypoint ' + (i + 1) + '"></td>' +
      '<td><select aria-label="Action at waypoint ' + (i + 1) + '"><option value="none">Fly through</option><option value="photo">Take a photo</option><option value="hover">Hover 5 s</option></select></td><td><button aria-label="Delete waypoint ' + (i + 1) + '">Delete</button></td>';
    tr.querySelector('select').value = r.act;
    tr.querySelector('input').addEventListener('change', function(e){ r.alt = clamp(parseFloat(e.target.value) || 30, 2, 120); e.target.blur(); computePlan(); });
    tr.querySelector('select').addEventListener('change', function(e){ r.act = e.target.value; e.target.blur(); computePlan(); });
    tr.querySelector('button').addEventListener('click', function(e){ e.target.blur(); route.splice(i, 1); computePlan(); });
    t.appendChild(tr);
  });
}
function drawMap(){
  if ($('plan').hidden || !plan) return;
  var v = view2d, sc = 840/v.span, a;
  mx.fillStyle = '#56733a'; mx.fillRect(0, 0, 840, 840);
  if (fieldRect){ a = w2m(fieldRect.cx - fieldRect.w/2, fieldRect.cz - fieldRect.h/2); mx.drawImage(fieldCanvas, a[0], a[1], fieldRect.w*sc, fieldRect.h*sc); }
  else { mx.fillStyle = '#8a8f8c'; colliders.forEach(function(c){ a = w2m(c.min.x, c.min.z); mx.fillRect(a[0], a[1], (c.max.x - c.min.x)*sc, (c.max.z - c.min.z)*sc); }); }
  if (plan.mode === 'area' && plan.shots.length >= 2 && plan.lines.length){ // overlap illustration
    var ll = function(l){ return Math.hypot(l[1][0] - l[0][0], l[1][1] - l[0][1]); }, n1 = Math.floor(ll(plan.lines[0])/plan.trig) + 1, show = [plan.shots[0], plan.shots[1]];
    if (plan.lines.length > 1) show.push(plan.shots[n1 + Math.floor(ll(plan.lines[1])/plan.trig)]);
    show.forEach(function(sh, k){ if (!sh) return; a = w2m(sh[0], sh[1]); mx.save(); mx.translate(a[0], a[1]); mx.rotate(-sh[2]);
      mx.fillStyle = k === 2 ? 'rgba(80,170,255,0.30)' : 'rgba(255,255,255,0.28)'; mx.strokeStyle = '#fff'; mx.lineWidth = 1.5;
      mx.fillRect(-plan.W*sc/2, -plan.L*sc/2, plan.W*sc, plan.L*sc); mx.strokeRect(-plan.W*sc/2, -plan.L*sc/2, plan.W*sc, plan.L*sc); mx.restore(); });
  }
  if (poly.length){ mx.beginPath(); poly.forEach(function(p, k){ a = w2m(p[0], p[1]); if (k) mx.lineTo(a[0], a[1]); else mx.moveTo(a[0], a[1]); }); mx.closePath();
    mx.fillStyle = 'rgba(255,255,255,0.10)'; mx.fill(); mx.strokeStyle = '#ffffff'; mx.lineWidth = 3; mx.setLineDash([10, 6]); mx.stroke(); mx.setLineDash([]);
    poly.forEach(function(p){ a = w2m(p[0], p[1]); mx.fillStyle = '#fff'; mx.strokeStyle = '#13242d'; mx.lineWidth = 2; mx.beginPath(); mx.arc(a[0], a[1], 7, 0, 7); mx.fill(); mx.stroke(); }); }
  if (plan.wps.length){ mx.strokeStyle = '#ff7a1a'; mx.lineWidth = 3; mx.beginPath(); plan.wps.forEach(function(q, k){ a = w2m(q.x, q.z); if (k) mx.lineTo(a[0], a[1]); else mx.moveTo(a[0], a[1]); }); mx.stroke(); }
  if (plan.mode === 'area' && plan.shots.length < 3000){ mx.fillStyle = '#13242d'; plan.shots.forEach(function(sh){ a = w2m(sh[0], sh[1]); mx.fillRect(a[0] - 2, a[1] - 2, 4, 4); }); }
  if (planMode === 'route') route.forEach(function(r, k){ a = w2m(r.x, r.z); mx.fillStyle = r.act === 'photo' ? '#2a7de1' : (r.act === 'hover' ? '#7a4fd0' : '#13242d'); mx.strokeStyle = '#fff'; mx.lineWidth = 2;
    mx.beginPath(); mx.arc(a[0], a[1], 13, 0, 7); mx.fill(); mx.stroke(); mx.fillStyle = '#fff'; mx.font = '700 15px Arial'; mx.textAlign = 'center'; mx.textBaseline = 'middle'; mx.fillText(k + 1, a[0], a[1] + 1); });
  if (track.length > 1){ mx.strokeStyle = '#ffe14d'; mx.lineWidth = 2; mx.beginPath(); track.forEach(function(q, k){ a = w2m(q[0], q[1]); if (k) mx.lineTo(a[0], a[1]); else mx.moveTo(a[0], a[1]); }); mx.stroke(); }
  mx.fillStyle = '#7CFFB2'; sim.photos.forEach(function(ph){ a = w2m(ph.x, ph.z); mx.beginPath(); mx.arc(a[0], a[1], 4, 0, 7); mx.fill(); });
  if (calib){ mx.strokeStyle = '#ff2d95'; mx.fillStyle = '#ff2d95'; mx.lineWidth = 3; mx.beginPath(); calib.pts.forEach(function(q, k){ a = w2m(q[0], q[1]); if (k) mx.lineTo(a[0], a[1]); else mx.moveTo(a[0], a[1]); }); mx.stroke();
    calib.pts.forEach(function(q){ a = w2m(q[0], q[1]); mx.beginPath(); mx.arc(a[0], a[1], 6, 0, 7); mx.fill(); }); }
  a = w2m(0, 0); mx.fillStyle = '#d9500a'; mx.beginPath(); mx.arc(a[0], a[1], 13, 0, 7); mx.fill(); mx.fillStyle = '#fff'; mx.font = '700 18px Arial'; mx.textAlign = 'center'; mx.textBaseline = 'middle'; mx.fillText('H', a[0], a[1] + 1);
  a = w2m(sim.pos[0], sim.pos[2]); mx.save(); mx.translate(a[0], a[1]); mx.rotate(-sim.yaw()); mx.fillStyle = '#ffe14d'; mx.strokeStyle = '#13242d'; mx.lineWidth = 2;
  mx.beginPath(); mx.moveTo(0, -14); mx.lineTo(10, 11); mx.lineTo(0, 5); mx.lineTo(-10, 11); mx.closePath(); mx.fill(); mx.stroke(); mx.restore();
  var bar = [5, 10, 20, 50, 100, 200, 500, 1000].filter(function(m){ return m*sc > 70; })[0] || 1000;
  mx.fillStyle = 'rgba(19,36,45,0.75)'; mx.fillRect(16, 796, bar*sc + 16, 30); mx.fillStyle = '#fff'; mx.fillRect(24, 818, bar*sc, 3);
  mx.font = '600 16px Arial'; mx.textAlign = 'left'; mx.fillText(bar + ' m', 24, 807);
  mx.fillStyle = 'rgba(19,36,45,0.75)'; mx.fillRect(786, 14, 40, 46); mx.fillStyle = '#fff'; mx.textAlign = 'center'; mx.fillText('N', 806, 46);
  mx.beginPath(); mx.moveTo(806, 18); mx.lineTo(813, 32); mx.lineTo(799, 32); mx.closePath(); mx.fill();
  if (homePick){ mx.fillStyle = 'rgba(217,80,10,0.92)'; mx.fillRect(140, 12, 560, 40); mx.fillStyle = '#fff'; mx.font = '700 20px Arial'; mx.textAlign = 'center'; mx.fillText('SET HOME: click the new home point', 420, 33); }
}
// map pointer: click adds a point, dragging an existing point moves it
var drag = null;
function ptsList(){ return planMode === 'route' ? route.map(function(r){ return [r.x, r.z]; }) : poly; }
map.addEventListener('pointerdown', function(e){
  var w = m2w(e), r = map.getBoundingClientRect(), tol = 16*view2d.span/r.width, best = -1, bd = tol;
  if (!calib && !homePick) ptsList().forEach(function(p, i){ var d = Math.hypot(p[0] - w[0], p[1] - w[1]); if (d < bd){ bd = d; best = i; } });
  drag = { idx: best, x: e.clientX, y: e.clientY, moved: false }; map.setPointerCapture(e.pointerId);
});
map.addEventListener('pointermove', function(e){
  if (!drag) return; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true;
  if (drag.idx >= 0 && drag.moved){ var w = m2w(e); if (planMode === 'route'){ route[drag.idx].x = w[0]; route[drag.idx].z = w[1]; } else poly[drag.idx] = w; computePlan(); }
});
map.addEventListener('pointerup', function(e){
  if (!drag) return; var d = drag; drag = null; if (d.moved || d.idx >= 0) return;
  var w = m2w(e);
  if (homePick){ moveHome(w[0], w[1]); return; }
  if (calib){ if (calib.pts.length < 2) calib.pts.push(w); if (calib.pts.length === 2){ var m = Math.hypot(calib.pts[1][0] - calib.pts[0][0], calib.pts[1][1] - calib.pts[0][1]);
      $('calibBox').hidden = false; $('calibMsg').textContent = 'These points are ' + m.toFixed(1) + ' m apart at the current scale. Enter the true distance:'; } else $('calibMsg').textContent = 'Now click the second point.'; drawMap(); return; }
  if (planMode === 'route') route.push({ x: w[0], z: w[1], alt: planNum('pAlt', 'alt'), act: 'none' }); else poly.push(w);
  computePlan();
});
// --- set home: a one-shot map click. Home stays the sim origin, so the field, plan, track, and georeference shift instead (see shiftHome) ---
// The decision itself is the pure homeDecision above. A press or click always ends in a visible message, even if something throws.
function homeState(picking){ var tel = sim.telemetry(); return { picking: picking, hasField: fieldMode, hasGeo: !!geo, armed: tel.armed, onGround: tel.on_ground }; }
function setHomePick(on, msg, warn){
  homePick = on; $('pgHome').setAttribute('aria-pressed', on ? 'true' : 'false'); map.style.cursor = on ? 'cell' : '';
  $('homeMsg').textContent = msg || ''; $('homeMsg').className = warn ? 'note warn' : 'note';
}
function homeFail(err){ setHomePick(false, 'Set home failed: ' + (err && err.message ? err.message : err) + '. Please report this message.', true); }
function moveHome(hx, hz){
  try {
    var d = homeDecision(homeState(false)); if (d.action !== 'arm'){ setHomePick(false, d.msg, true); return; }
    var s = shiftHome({ geo: geo, poly: poly, route: route, track: track, field: fieldRect }, hx, hz);
    geo = s.geo; poly = s.poly; route = s.route; track = s.track; fieldRect = s.field;
    if (fieldPlane) fieldPlane.position.set(fieldRect.cx, 0.03, fieldRect.cz);
    view2d.cx -= hx; view2d.cz -= hz; // keep the map steady under the cursor
    startDrill(drill.id); setHomePick(false, HOME_MSG.moved); computePlan(); geoNote();
  } catch (err){ homeFail(err); }
}
$('pgHome').addEventListener('click', function(){
  try {
    $('pgHome').blur(); var d = homeDecision(homeState(homePick));
    if (d.action === 'arm'){ calib = null; $('calibBox').hidden = true; $('calibMsg').textContent = ''; }
    setHomePick(d.action === 'arm', d.msg, d.action === 'refuse'); drawMap();
  } catch (err){ homeFail(err); }
});
window.addEventListener('keydown', function(e){ if (e.code === 'Escape' && homePick){ setHomePick(false, HOME_MSG.cancel); drawMap(); } });
$('pgUndo').addEventListener('click', function(){ if (planMode === 'route') route.pop(); else poly.pop(); computePlan(); });
$('pgClear').addEventListener('click', function(){ if (planMode === 'route') route = []; else poly = []; track = []; computePlan(); });
$('pgWhole').addEventListener('click', function(){
  var R = fieldRect || { w: 60, h: 44, cx: 0, cz: -32 }, x1 = R.cx - R.w/2, x2 = R.cx + R.w/2, z1 = R.cz - R.h/2, z2 = R.cz + R.h/2;
  setPlanMode('area'); poly = [[x1, z1], [x2, z1], [x2, z2], [x1, z2]]; computePlan();
});
$('pgIn').addEventListener('click', function(){ view2d.span = Math.max(30, view2d.span/1.4); drawMap(); });
$('pgOut').addEventListener('click', function(){ view2d.span = Math.min(4000, view2d.span*1.4); drawMap(); });
$('pgFit').addEventListener('click', function(){ fitView(); drawMap(); });
function setPlanMode(m){ planMode = m; [].forEach.call($('planModes').children, function(b){ b.setAttribute('aria-pressed', b.dataset.pm === m ? 'true' : 'false'); });
  $('planHelp').textContent = m === 'area' ? 'Click the map to mark the corners of the survey area. Drag a corner to move it. Orange lines are flight lines, dots are photo positions, and the shaded boxes show how neighbouring photos overlap.'
    : 'Click the map to drop waypoints in flying order. Drag a waypoint to move it. Set the altitude and action of each one in the table. The drone flies home after the last waypoint.'; }
[].forEach.call($('planModes').children, function(b){ b.addEventListener('click', function(){ setPlanMode(b.dataset.pm); b.blur(); computePlan(); }); });
['pCam', 'pAlt', 'pFront', 'pSide', 'pSpeed', 'pDir', 'pElev', 'pBatt'].forEach(function(id){ $(id).addEventListener('input', computePlan); });
function togglePlan(){ var el = $('plan'); el.hidden = !el.hidden; if (!el.hidden) computePlan(); }
$('bPlan').addEventListener('click', function(e){ togglePlan(); e.target.blur(); });
$('planClose').addEventListener('click', togglePlan);
$('simSpeed').addEventListener('change', function(e){ timeScale = +e.target.value; });
$('planFly').addEventListener('click', function(){
  if (!plan || !plan.ok) return;
  if (sim.crashed) startDrill('free');
  PARAMS.batterySeconds = plan.endurance*60; hideNotice(); track = [];
  sim.startMission(plan.wps.map(function(q){ return { x: q.x, y: q.y, z: q.z, survey: q.survey, photo: q.photo, hold: q.hold }; }), plan.speed, plan.trig);
});
$('planStop').addEventListener('click', function(){ sim.stopMission(); });
function planTick(dt){ mapT += dt; if (mapT > 0.2){ mapT = 0;
  if (sim.auto === 'mission'){ var l = track[track.length - 1]; if (!l || Math.hypot(l[0] - sim.pos[0], l[1] - sim.pos[2]) > 1) track.push([sim.pos[0], sim.pos[2]]); }
  drawMap(); } }

