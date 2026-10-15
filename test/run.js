// Headless tests. Run with: npm test   (or: node test/run.js)
// They load the source fragments directly, so they need no browser and no dependencies.
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var src = function(f){ return fs.readFileSync(path.join(__dirname, '../src/js', f), 'utf8'); };
var slice = function(text, from, to){ var a = text.indexOf(from), b = text.indexOf(to, a); if (a < 0 || b < 0) throw new Error('marker not found: ' + from + ' .. ' + to); return text.slice(a, b); };
var passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('  ok    ' + name); } catch (e){ failed++; console.log('  FAIL  ' + name + '\n        ' + e.message); } }

// ---- flight model ----
var S = {}; vm.createContext(S); vm.runInContext(src('00-sim.js'), S);
var Sim = S.Sim, Z = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
function run(s, T, fn){ for (var t = 0; t < T; t += 1/250) s.step(1/250, fn ? fn(t) : Z); }
function st(o){ return Object.assign({}, Z, o); }
console.log('flight model');
test('auto takeoff settles at 1.2 m', function(){ var s = new Sim(); s.command('takeoff'); run(s, 6); assert(Math.abs(s.pos[1] - 1.2) < 0.05); assert.strictEqual(s.auto, null); });
test('position hold: forward stick moves north, release stops', function(){ var s = new Sim(); s.command('takeoff'); run(s, 5); run(s, 3, function(){ return st({ pitch: 1 }); }); assert(s.pos[2] < -5); assert(Math.hypot(s.v[0], s.v[2]) < 4.6); run(s, 4); assert(Math.hypot(s.v[0], s.v[2]) < 0.1); });
test('right yaw stick turns the heading east', function(){ var s = new Sim(); s.command('takeoff'); run(s, 5); run(s, 0.5, function(){ return st({ yaw: 1 }); }); var h = s.telemetry().heading_deg; assert(h > 20 && h < 70, 'heading ' + h); });
test('stabilized roll step tracks without overshoot', function(){ var s = new Sim(); s.mode = 'angle'; s.command('arm'); run(s, 1.5, function(){ return st({ thr: 0.4 }); }); var peak = 0; run(s, 1, function(){ peak = Math.max(peak, s.telemetry().roll); return st({ roll: 0.5 }); }); assert(Math.abs(s.telemetry().roll - 0.26) < 0.01); assert(peak < 0.27); });
test('position hold resists 6 m/s wind', function(){ var s = new Sim(); s.command('takeoff'); run(s, 6); var p0 = s.pos.slice(); s.wind = 6; var md = 0; run(s, 15, function(){ md = Math.max(md, Math.hypot(s.pos[0] - p0[0], s.pos[2] - p0[2])); return Z; }); assert(md < 2.5, 'drift ' + md); });
test('wind from the north blows toward the south (+Z)', function(){ var s = new Sim(); s.wind = 8; s.windDir = 0; var w = s.windVec(10); assert(w[2] > 4 && Math.abs(w[0]) < 3); });
test('auto land touches down gently and disarms', function(){ var s = new Sim(); s.command('takeoff'); run(s, 5); s.command('land'); run(s, 8); assert(s.onGround && !s.armed && !s.crashed); assert(s.lastTouchdown.speed < 0.5); });
test('disarming in the air crashes', function(){ var s = new Sim(); s.landAssist = false; s.mode = 'alt'; s.command('arm'); run(s, 2, function(){ return st({ thr: 1 }); }); s.command('disarm'); run(s, 3); assert(s.crashed); });
test('landing assist: throttle chop from height lands softly', function(){ var s = new Sim(); s.mode = 'angle'; s.command('arm'); run(s, 6, function(){ return st({ thr: 1 }); }); assert(s.pos[1] > 30); run(s, 30, function(){ return st({ thr: -1 }); }); assert(!s.crashed && s.onGround); assert(s.lastTouchdown.speed < 0.6); });
test('landing assist off: the same drop crashes', function(){ var s = new Sim(); s.landAssist = false; s.mode = 'angle'; s.command('arm'); run(s, 4, function(){ return st({ thr: 1 }); }); run(s, 30, function(){ return st({ thr: -1 }); }); assert(s.crashed); });
test('horizontal avoidance stops about 1.8 m from a wall', function(){ var s = new Sim(); s.command('takeoff'); run(s, 5); var minr = 99; run(s, 10, function(){ var r = s.pos[2] + 10; s.avoid = { f: r < 6 ? r : Infinity, b: Infinity, l: Infinity, r: Infinity, up: Infinity, down: s.pos[1], downObs: false }; minr = Math.min(minr, r); return st({ pitch: 1 }); }); assert(minr > 1.5 && minr < 2.2, 'closest ' + minr); });
test('vertical avoidance stops 1.5 m below a ceiling', function(){ var s = new Sim(); s.command('takeoff'); run(s, 5); var top = 0; run(s, 10, function(){ s.avoid = { f: Infinity, b: Infinity, l: Infinity, r: Infinity, up: Math.max(0, 4 - s.pos[1] - 0.12), down: s.pos[1], downObs: false }; top = Math.max(top, s.pos[1]); return st({ thr: 1 }); }); assert(top > 2.2 && top < 2.6, 'top ' + top); });
test('survey mission flies, triggers photos, returns, and lands', function(){ S.PARAMS.batterySeconds = 1500; var s = new Sim(); s.wind = 5;
  s.startMission([{ x: 0, y: 40, z: 0 }, { x: -30, y: 40, z: -20 }, { x: -30, y: 40, z: -100, survey: true }, { x: -10, y: 40, z: -100 }, { x: -10, y: 40, z: -20, survey: true }, { x: 0, y: 40, z: 0 }], 6, 8);
  var t = 0; while (t < 600 && !(s.onGround && t > 5 && !s.auto)){ s.step(1/250, Z); t += 1/250; }
  assert(!s.crashed && s.onGround); assert(s.photos.length >= 18 && s.photos.length <= 24, 'photos ' + s.photos.length); assert(Math.hypot(s.pos[0], s.pos[2]) < 1.5); S.PARAMS.batterySeconds = 600; });
test('route mission: photo waypoint records one photo', function(){ S.PARAMS.batterySeconds = 1500; var s = new Sim(); s.startMission([{ x: 0, y: 20, z: 0 }, { x: 10, y: 20, z: -30, photo: true, hold: 1.5 }, { x: -20, y: 35, z: -60, hold: 5 }, { x: 0, y: 35, z: 0 }], 5, 10);
  var t = 0; while (t < 400 && !(s.onGround && t > 5 && !s.auto)){ s.step(1/250, Z); t += 1/250; } assert.strictEqual(s.photos.length, 1); assert(!s.crashed); S.PARAMS.batterySeconds = 600; });
test('right stick takes over from a mission', function(){ var s = new Sim(); s.startMission([{ x: 0, y: 10, z: 0 }, { x: 0, y: 10, z: -50 }], 5, 10); run(s, 8); assert.strictEqual(s.auto, 'mission'); run(s, 0.1, function(){ return st({ roll: 1 }); }); assert.strictEqual(s.auto, null); });

// ---- return to home ----
console.log('return to home');
// Put a flying sim at (x, h, z) without flying it there.
function flyingAt(x, h, z){ var s = new Sim(); s.command('takeoff'); run(s, 5); s.pos = [x, h, z]; s.posSp = null; s.altSp = null; run(s, 2); return s; }
function untilLanded(s, T, fn){ var t = 0; while (t < T && !(s.onGround && !s.armed) && !s.crashed){ s.step(1/250, fn ? fn(t) : Z); t += 1/250; } return t; }
test('RTH from below the RTH altitude: climbs first, then flies home, lands, and disarms', function(){ var s = flyingAt(40, 10, -60); s.command('rth');
  assert.strictEqual(s.auto, 'rth'); assert.strictEqual(s.telemetry().rth_phase, 'climb'); var top = 0, moved = 0;
  untilLanded(s, 120, function(){ top = Math.max(top, s.pos[1]); if (s.rth && s.rth.phase === 'climb') moved = Math.max(moved, Math.hypot(s.pos[0] - 40, s.pos[2] + 60)); return Z; });
  assert(!s.crashed && s.onGround && !s.armed && s.auto === null); assert(top > 29 && top < 32, 'top ' + top); assert(moved < 1.5, 'moved during the climb ' + moved);
  assert(Math.hypot(s.pos[0], s.pos[2]) < 1.5, 'landed ' + Math.hypot(s.pos[0], s.pos[2]) + ' m from home'); assert(s.lastTouchdown.speed < 1, 'touchdown ' + s.lastTouchdown.speed); });
test('RTH from above the RTH altitude keeps the current height', function(){ var s = flyingAt(-50, 45, 30); s.rthAlt = 20; s.command('rth'); assert.strictEqual(s.telemetry().rth_phase, 'cruise'); var lo = 99, hi = 0;
  untilLanded(s, 120, function(){ if (s.rth && s.rth.phase === 'cruise'){ lo = Math.min(lo, s.pos[1]); hi = Math.max(hi, s.pos[1]); } return Z; });
  assert(lo > 43.5 && hi < 46.5, 'cruise height ' + lo + ' .. ' + hi); assert(!s.crashed && s.onGround && !s.armed); assert(Math.hypot(s.pos[0], s.pos[2]) < 1.5); assert(s.lastTouchdown.speed < 1); });
test('RTH arrives within 1.5 m of home in a 6 m/s crosswind', function(){ var s = flyingAt(0, 12, -80); s.wind = 6; s.windDir = 270; s.command('rth'); untilLanded(s, 150);
  assert(!s.crashed && s.onGround && !s.armed); assert(Math.hypot(s.pos[0], s.pos[2]) < 1.5, 'landed ' + Math.hypot(s.pos[0], s.pos[2])); assert(s.lastTouchdown.speed < 1); });
test('RTH: the right stick past one third cancels and returns control in the selected mode', function(){ var s = flyingAt(30, 10, -30), ev = []; s.onEvent = function(e){ ev.push(e); }; s.mode = 'alt'; s.command('rth'); run(s, 3);
  run(s, 0.1, function(){ return st({ roll: 0.3 }); }); assert.strictEqual(s.auto, 'rth', 'a small stick movement must not cancel');
  run(s, 0.1, function(){ return st({ pitch: 0.4 }); }); assert.strictEqual(s.auto, null); assert.strictEqual(s.mode, 'alt'); assert.deepStrictEqual(ev.filter(function(e){ return e === 'rth_cancel'; }), ['rth_cancel']);
  s.command('rth'); run(s, 1); s.command('cancel_rth'); assert.strictEqual(s.auto, null); run(s, 5); assert(!s.crashed && !s.onGround && s.armed); });
test('RTH is ignored on the ground and close to home it skips the climb', function(){ var s = new Sim(); s.command('rth'); assert.strictEqual(s.auto, null);
  s = flyingAt(1, 2, -1); s.command('rth'); var top = 0; untilLanded(s, 40, function(){ top = Math.max(top, s.pos[1]); return Z; }); assert(top < 3, 'top ' + top); assert(s.onGround && !s.armed && !s.crashed); });
test('RTH respects the vertical obstacle limit: it does not climb through a ceiling', function(){ var s = flyingAt(20, 3, -20); s.command('rth'); var top = 0;
  run(s, 10, function(){ s.avoid = { f: Infinity, b: Infinity, l: Infinity, r: Infinity, up: Math.max(0, 8 - s.pos[1] - 0.12), down: s.pos[1], downObs: false }; top = Math.max(top, s.pos[1]); return Z; });
  assert(top > 5.5 && top < 6.8, 'top ' + top); assert.strictEqual(s.auto, 'rth'); });

// ---- battery ----
console.log('battery');
test('battery thresholds fire once each, in order', function(){ S.PARAMS.batterySeconds = 60; var s = new Sim(), ev = []; s.battCfg.autoRth = false; s.onEvent = function(e){ if (/^batt_(warn|low|crit)$/.test(e)) ev.push(e); };
  s.command('takeoff'); var seen = []; untilLanded(s, 120, function(){ var b = s.telemetry().battery_state; if (seen[seen.length - 1] !== b) seen.push(b); return Z; }); S.PARAMS.batterySeconds = 600;
  assert.deepStrictEqual(ev, ['batt_warn', 'batt_low', 'batt_crit']); assert.deepStrictEqual(seen, ['ok', 'warning', 'low', 'critical']); assert(s.onGround && !s.armed && !s.crashed, 'the critical level lands the drone'); });
test('low battery starts RTH once, and the pilot may cancel it', function(){ var s = flyingAt(30, 10, -40), n = 0; s.onEvent = function(e){ if (e === 'rth') n++; }; s.batt = 20.05; run(s, 3);
  assert.strictEqual(s.auto, 'rth'); assert.strictEqual(s.telemetry().auto_reason, 'battery'); s.command('cancel_rth'); run(s, 5); assert.strictEqual(s.auto, null); assert.strictEqual(n, 1); });
test('low battery with automatic RTH off only warns', function(){ var s = flyingAt(30, 10, -40), ev = []; s.battCfg.autoRth = false; s.onEvent = function(e){ ev.push(e); }; s.batt = 20.05; run(s, 3); assert.strictEqual(s.auto, null); assert(ev.indexOf('batt_low') >= 0); });
test('critical battery: emergency landing cannot be cancelled, horizontal stick and yaw still work', function(){ var s = flyingAt(20, 15, -20); s.batt = 9.9; run(s, 0.1); assert.strictEqual(s.auto, 'critland');
  ['cancel_rth', 'rth', 'land', 'takeoff'].forEach(function(c){ s.command(c); assert.strictEqual(s.auto, 'critland', c + ' must not cancel'); }); s.startMission([{ x: 0, y: 10, z: 0 }], 5, 10); assert.strictEqual(s.auto, 'critland');
  var x0 = s.pos[0]; run(s, 3, function(){ return st({ roll: 1, thr: 1 }); }); assert.strictEqual(s.auto, 'critland', 'sticks must not cancel'); var h0 = s.telemetry().heading_deg; run(s, 0.5, function(){ return st({ yaw: 1 }); });
  assert(s.pos[0] - x0 > 4, 'moved east ' + (s.pos[0] - x0)); assert(Math.abs(s.telemetry().heading_deg - h0) > 20, 'yaw'); assert(s.v[1] < -1, 'still descending with full up throttle: ' + s.v[1]);
  untilLanded(s, 60); assert(s.onGround && !s.armed && !s.crashed); assert(s.lastTouchdown.speed < 1); assert(Math.hypot(s.pos[0], s.pos[2]) > 20, 'landed in place, not at home'); });
test('critical battery: taking off again below the critical level lands again', function(){ var s = new Sim(), was = false, top = 0; s.batt = 8; s.command('takeoff'); untilLanded(s, 20, function(){ was = was || s.auto === 'critland'; top = Math.max(top, s.pos[1]); return Z; }); assert(was, 'emergency landing engaged'); assert(top < 1, 'top ' + top); assert(s.onGround && !s.armed && !s.crashed); });
test('an empty battery lands the drone even when the critical level is set below its limits', function(){ var s = flyingAt(10, 8, -10); s.battCfg = { warn: 0, low: 0, crit: 0, autoRth: false }; s.batt = 0.01; run(s, 1); assert.strictEqual(s.batt, 0); assert.strictEqual(s.auto, 'critland'); s.command('land'); assert.strictEqual(s.auto, 'critland'); untilLanded(s, 40); assert(s.onGround && !s.armed && !s.crashed); });
test('voltage falls with percent and sags with thrust', function(){
  assert(Math.abs(S.battOcv(100) - 4.2) < 1e-9 && Math.abs(S.battOcv(0) - 3.3) < 1e-9 && Math.abs(S.battOcv(50) - 3.7) < 0.05); for (var p = 1; p <= 100; p++) assert(S.battOcv(p) > S.battOcv(p - 1), 'curve not rising at ' + p);
  var s = new Sim(), rest = s.telemetry(); assert(Math.abs(rest.voltage - 16.8) < 1e-9 && Math.abs(rest.cell_voltage - 4.2) < 1e-9 && rest.current_a === 0 && rest.minutes_left === null);
  s.command('takeoff'); run(s, 6); var hov = s.telemetry(); assert(hov.current_a > 12 && hov.current_a < 16, 'hover amps ' + hov.current_a); assert(hov.voltage < rest.voltage - 0.3);
  assert(Math.abs(hov.cell_voltage*S.PARAMS.batt.cells - hov.voltage) < 1e-9); run(s, 1, function(){ return st({ thr: 1 }); }); var climb = s.telemetry(); assert(climb.current_a > hov.current_a + 1 && climb.voltage < hov.voltage - 0.04, 'sag ' + hov.voltage + ' -> ' + climb.voltage);
  s.batt = 40; run(s, 3); assert(s.telemetry().voltage < hov.voltage - 0.5); });
test('minutes remaining is sensible in hover', function(){ var s = new Sim(); s.command('takeoff'); run(s, 30); var m = s.telemetry().minutes_left; assert(m > 8.5 && m < 10.5, 'minutes ' + m); s.batt = 50; run(s, 1); m = s.telemetry().minutes_left; assert(m > 4.5 && m < 5.5, 'minutes at 50 % ' + m); });
test('return estimate grows with distance, headwind, and RTH altitude', function(){ var E = function(x, z, h, alt, w, dir){ return S.rthEstimate(x, z, h, alt, w, dir).pct; };
  var base = E(0, -100, 10, 30, 0, 0); assert(base > 3 && base < 15, 'base ' + base); assert(E(0, -300, 10, 30, 0, 0) > base + 3); assert(E(0, -100, 10, 80, 0, 0) > base + 3);
  var head = E(0, -100, 10, 30, 4, 180), tail = E(0, -100, 10, 30, 4, 0); assert(head > base && tail < head, 'head ' + head + ' tail ' + tail + ' base ' + base); // home is south, so wind from 180 is a headwind
  assert.strictEqual(E(0, -100, 10, 30, 12, 180), Infinity, 'no headway against 12 m/s'); assert(E(0, -100, 40, 30, 0, 0) < base, 'already above the RTH altitude: no climb'); });
test('return estimate is close to a flown return', function(){ var s = flyingAt(60, 10, -120); s.wind = 3; s.windDir = 180; var est = S.rthEstimate(s.pos[0], s.pos[2], s.pos[1], s.rthAlt, s.wind, s.windDir), b0 = s.batt; s.command('rth'); var t = untilLanded(s, 200);
  assert(s.onGround && !s.crashed); var used = b0 - s.batt; assert(Math.abs(used - est.pct) < 0.25*used + 0.5, 'used ' + used + ' estimated ' + est.pct); assert(Math.abs(t - est.time) < 0.25*t, 'time ' + t + ' estimated ' + est.time); });
test('unreachable home at the low threshold: lands in place and says why', function(){ var s = flyingAt(0, 30, -2500), ev = []; s.onEvent = function(e){ ev.push(e); }; s.batt = 20.05; run(s, 3);
  assert.strictEqual(s.auto, 'critland'); assert.strictEqual(s.telemetry().auto_reason, 'unreachable'); assert(ev.indexOf('batt_unreachable') > ev.indexOf('batt_low') && ev.indexOf('batt_low') >= 0); assert(ev.indexOf('rth') < 0);
  untilLanded(s, 60); assert(s.onGround && !s.armed && !s.crashed); assert(Math.hypot(s.pos[0], s.pos[2]) > 2400); });
test('return margin warning fires once, before the low threshold when far from home', function(){ var s = flyingAt(0, 30, -1200), ev = []; s.onEvent = function(e){ ev.push(e); }; var need = S.rthEstimate(0, -1200, 30, 30, 0, 270).pct; assert(need > 25, 'need ' + need);
  s.batt = need + 10.05; run(s, 3); assert.deepStrictEqual(ev.filter(function(e){ return e === 'batt_margin'; }), ['batt_margin']); assert(ev.indexOf('batt_low') < 0); assert(Math.abs(s.telemetry().rth_needed_pct - need) < 1); });
test('battery settings: warning > low > critical, all between 5 and 60', function(){
  assert.strictEqual(S.battCfgError(30, 20, 10), ''); assert.strictEqual(S.battCfgError(60, 6, 5), ''); assert(S.battCfgError(20, 20, 10)); assert(S.battCfgError(30, 10, 20)); assert(S.battCfgError(61, 20, 10)); assert(S.battCfgError(30, 20, 4)); assert(S.battCfgError(30, NaN, 10)); assert(S.battCfgError('30', 20, 10)); });
test('a planned flight returns and lands under the battery thresholds', function(){ S.PARAMS.batterySeconds = 300; var s = new Sim(), ev = [], wps = [{ x: 0, y: 40, z: 0 }]; s.onEvent = function(e){ ev.push(e); };
  for (var k = 0; k < 20; k++){ var x = -40 + 4*k, far = k % 2 === 0; wps.push({ x: x, y: 40, z: far ? -20 : -100 }); wps.push({ x: x, y: 40, z: far ? -100 : -20, survey: true }); } wps.push({ x: 0, y: 40, z: 0 }); s.startMission(wps, 6, 8);
  var t = 0, hi = 0; while (t < 500 && !(s.onGround && t > 5 && !s.auto)){ s.step(1/250, Z); if (s.auto === 'rth') hi = Math.max(hi, s.pos[1]); t += 1/250; } S.PARAMS.batterySeconds = 600;
  assert(ev.indexOf('batt_low') >= 0 && ev.indexOf('rth') > ev.indexOf('batt_low'), 'events ' + ev.join(',')); assert(ev.indexOf('missiondone') < 0, 'the plan was abandoned'); assert(hi < 42, 'above the RTH altitude it keeps its height: ' + hi);
  assert(!s.crashed && s.onGround && !s.armed); assert(Math.hypot(s.pos[0], s.pos[2]) < 1.5); assert(s.lastTouchdown.speed < 1); });
test('a planned flight with automatic RTH off flies on and lands in place at the critical level', function(){ S.PARAMS.batterySeconds = 100; var s = new Sim(); s.battCfg.autoRth = false;
  s.startMission([{ x: 0, y: 20, z: 0 }, { x: 0, y: 20, z: -600 }, { x: 0, y: 20, z: 0 }], 6, 8); var was = null; untilLanded(s, 300, function(){ if (s.auto) was = s.auto; return Z; }); S.PARAMS.batterySeconds = 600;
  assert.strictEqual(was, 'critland'); assert(s.onGround && !s.crashed); assert(Math.hypot(s.pos[0], s.pos[2]) > 50); });

// ---- spray ----
console.log('spray');
var SPR = S.PARAMS.spray, TMAX = S.sprayTankMax();
// A sim with a full tank (unless o.fill says otherwise) hovering at height o.h (default 3 m) over home.
function sprayer(o){ o = o || {}; var s = new Sim();
  s.sprayCfg = { tankL: TMAX, fillL: o.fill === undefined ? TMAX : o.fill, flowLmin: o.flow || 0.5, cls: o.cls || 'medium', mount: o.mount || 'rotor' };
  s.wind = o.wind || 0; s.windDir = o.dir === undefined ? 270 : o.dir; if (o.temp !== undefined) s.airTempC = o.temp; if (o.rh !== undefined) s.rhPct = o.rh; if (o.stab) s.stability = o.stab;
  s.reset(); s.command('takeoff'); run(s, 5); s.pos = [0, o.h || 3, 0]; s.posSp = null; s.altSp = null; run(s, 3); return s; }
// Run until every parcel has landed or been lost.
function settle(s, T){ var t = 0; while (t < (T || 400) && (s.parcels.length || s.sprayAcc > 0)){ s.step(1/250, Z); t += 1/250; } return t; }
// Spray in a hover for T seconds, land, and wait for the parcels.
function hoverSpray(o, T){ var s = sprayer(o); s.command('sprayOn'); run(s, T || 6); s.command('sprayOff'); s.command('land'); settle(s); return s; }
// Deposit-weighted centroid, and mean distance from the point (0, 0) under the drone.
function depStats(s){ var d = s.sprayDeposit(), n = Math.round(2*d.half/d.cell), sx = 0, sz = 0, sa = 0, sr = 0;
  for (var iz = 0; iz < n; iz++) for (var ix = 0; ix < n; ix++){ var a = d.data[iz*n + ix]; if (!a) continue; var x = -d.half + (ix + 0.5)*d.cell, z = -d.half + (iz + 0.5)*d.cell; sx += a*x; sz += a*z; sa += a; sr += a*Math.hypot(x, z); }
  return { x: sx/sa, z: sz/sa, r: sr/sa, a: sa, lost: d.lost }; }
var sprayLog = []; // measured values, printed at the end of the section
test('dropTerminal: 100 um 0.22 to 0.32 m/s, 400 um 1.4 to 1.8 m/s, rising with diameter', function(){
  var v100 = S.dropTerminal(100e-6), v400 = S.dropTerminal(400e-6); sprayLog.push('terminal speed: 100 um ' + v100.toFixed(3) + ' m/s, 400 um ' + v400.toFixed(3) + ' m/s');
  assert(v100 > 0.22 && v100 < 0.32, '100 um ' + v100); assert(v400 > 1.4 && v400 < 1.8, '400 um ' + v400);
  for (var d = 10, prev = 0; d <= 1000; d += 10){ var v = S.dropTerminal(d*1e-6); assert(v > prev, 'not rising at ' + d + ' um'); prev = v; }
  assert(S.dropTerminal(400e-6) < (1000 - 1.2)*9.81*16e-8/(18*1.81e-5)/2, 'well below Stokes at 400 um'); });
test('sprayRate: 0.5 L/min at 3 m/s over a 2 m swath is about 13.9 L/ha', function(){ assert(Math.abs(S.sprayRate(0.5, 3, 2) - 13.89) < 0.01); });
test('wet-bulb depression, downwash, and droplet bins', function(){
  var a = S.wetBulbDepression(20, 50), b = S.wetBulbDepression(30, 30), c = S.wetBulbDepression(15, 80); assert(a > 5.5 && a < 7.5, '20 C 50 % ' + a); assert(b > c + 8, 'hot dry ' + b + ' cool humid ' + c); assert(S.wetBulbDepression(20, 100) < 0.3);
  var vh = S.downwashSpeed(S.PARAMS.m*S.PARAMS.g); assert(vh > 3 && vh < 8, 'hover downwash ' + vh); assert(Math.abs(S.downwashSpeed(4*S.PARAMS.m*S.PARAMS.g) - 2*vh) < 1e-9);
  var bins = S.sprayClassBins('medium'); assert.strictEqual(bins.length, 5); assert(Math.abs(bins[2].d - 250e-6) < 1e-12); assert(Math.abs(bins.reduce(function(t, x){ return t + x.frac; }, 0) - 1) < 1e-12); assert.strictEqual(S.sprayClassBins('mist').length, 0); });
test('effectiveSwath: a flat 4 m profile gives 4.3 m at CV 30 %, a triangle gives at least half its base', function(){
  var flat = []; for (var i = 0; i < 40; i++) flat.push(1); // gaps of g bins in 40 give CV = sqrt(g/40): 3 bins pass, 4 fail
  assert(Math.abs(S.effectiveSwath({ dx: 0.1, v: flat }) - 4.3) < 1e-9, 'flat ' + S.effectiveSwath({ dx: 0.1, v: flat }));
  assert(Math.abs(S.effectiveSwath({ dx: 0.1, v: flat }, 10) - 4.0) < 1e-9, 'flat at 10 %');
  var tri = []; for (i = 0; i < 40; i++) tri.push(20 - Math.abs(i - 19.5)); var w = S.effectiveSwath({ dx: 0.1, v: tri }); assert(w >= 2.0 && w < 4, 'triangle ' + w); });
test('default config: empty tank, spraying does nothing, mass is the airframe', function(){ var s = new Sim(), ev = []; s.onEvent = function(e){ ev.push(e); };
  assert.strictEqual(s.tank, 0); assert.strictEqual(s.mass(), S.PARAMS.m); s.command('takeoff'); run(s, 5); s.command('sprayOn'); run(s, 3); var t = s.telemetry();
  assert.strictEqual(t.spraying, false); assert.strictEqual(t.tank_l, 0); assert.strictEqual(t.mass_kg, S.PARAMS.m); assert.strictEqual(t.sprayed_l, 0); assert.strictEqual(t.parcels, 0); assert.strictEqual(t.deposited_l + t.airborne_l + t.lost_l, 0);
  assert.strictEqual(s.sprayParcels().length, 0); assert.strictEqual(ev.indexOf('spray_empty'), -1); });
test('conservation: active ingredient sprayed = deposited + airborne + lost', function(){ var s = sprayer({ cls: 'fine', wind: 3, h: 4 }); s.command('sprayOn'); run(s, 8);
  var t = s.telemetry(); assert(t.airborne_l > 0 && t.parcels > 0); assert(Math.abs(t.sprayed_ai_l - (t.deposited_l + t.airborne_l + t.lost_l)) < 1e-9, 'in flight');
  s.command('sprayOff'); s.command('land'); settle(s); t = s.telemetry(); assert.strictEqual(t.parcels, 0); assert(t.deposited_l > 0);
  assert(Math.abs(t.sprayed_ai_l - (t.deposited_l + t.airborne_l + t.lost_l)) < 1e-9, 'after landing: ' + t.sprayed_ai_l + ' vs ' + (t.deposited_l + t.airborne_l + t.lost_l));
  assert(Math.abs(t.sprayed_ai_l - t.sprayed_l*SPR.nonVol) < 1e-9, 'ai is the non-volatile share of the liquid'); });
test('the tank empties at the flow rate and spraying stops at empty', function(){ var s = sprayer({ fill: 0.1, flow: 2 }), ev = []; s.onEvent = function(e){ ev.push(e); }; s.command('sprayOn'); run(s, 1.5);
  assert(Math.abs(s.tank - (0.1 - 2/60*1.5)) < 0.002, 'tank ' + s.tank); assert(s.mass() < S.PARAMS.m + 0.1 && s.mass() > S.PARAMS.m); run(s, 2.5);
  assert.strictEqual(s.tank, 0); assert.strictEqual(s.spraying, false); assert(Math.abs(s.sprayed - 0.1) < 1e-9); assert.strictEqual(s.mass(), S.PARAMS.m); assert.deepStrictEqual(ev.filter(function(e){ return e === 'spray_empty'; }), ['spray_empty']);
  s.command('sprayOn'); assert.strictEqual(s.spraying, false, 'cannot start with an empty tank'); });
test('refill works only landed and disarmed; reset refills to the fill level', function(){ var s = sprayer({ fill: 0.3 }); s.command('sprayOn'); run(s, 3); var left = s.tank; assert(left < 0.3);
  s.command('refill'); assert.strictEqual(s.tank, left, 'no refill in the air'); s.command('sprayOff'); s.command('land'); untilLanded(s, 20); assert(s.onGround && !s.armed); s.command('refill'); assert.strictEqual(s.tank, 0.3);
  settle(s); s.reset(); assert.strictEqual(s.tank, 0.3); assert.strictEqual(s.parcels.length, 0); assert.strictEqual(s.telemetry().deposited_l, 0); assert.strictEqual(s.sprayed, 0); });
test('no wind, hover at 3 m: the deposit centroid is under the drone', function(){ var d = depStats(hoverSpray({})); sprayLog.push('no wind, 3 m hover: centroid (' + d.x.toFixed(2) + ', ' + d.z.toFixed(2) + ') m');
  assert(Math.hypot(d.x, d.z) < 0.5, 'centroid ' + d.x + ', ' + d.z); });
var drift = {}; // centroid x in a 3 m/s west wind, by case
function drifted(key, o){ if (!drift[key]) drift[key] = depStats(hoverSpray(Object.assign({ wind: 3, dir: 270 }, o))); return drift[key]; }
test('wind 3 m/s from the west moves the deposit east (+X)', function(){ var d = drifted('medium3', {}); assert(d.x > 0.3, 'centroid x ' + d.x); assert(Math.abs(d.z) < d.x, 'mostly east'); });
test('3 m/s wind: fine drifts farther than very coarse, a 5 m release farther than a 2 m release', function(){
  var f = drifted('fine3', { cls: 'fine' }), vc = drifted('vc3', { cls: 'very coarse' }), h5 = drifted('h5', { h: 5 }), h2 = drifted('h2', { h: 2 });
  sprayLog.push('3 m/s wind, 3 m: centroid x fine ' + f.x.toFixed(2) + ' m (lost ' + (100*f.lost/(f.a + f.lost)).toFixed(1) + ' %), medium ' + drifted('medium3', {}).x.toFixed(2) + ' m, very coarse ' + vc.x.toFixed(2) + ' m');
  sprayLog.push('3 m/s wind, medium: centroid x from 2 m ' + h2.x.toFixed(2) + ' m, from 5 m ' + h5.x.toFixed(2) + ' m');
  assert(f.x > vc.x + 0.2, 'fine ' + f.x + ' very coarse ' + vc.x); assert(h5.x > h2.x + 0.2, '5 m ' + h5.x + ' 2 m ' + h2.x); });
test('hot and dry (30 C, 30 %) drifts farther downwind than cool and humid (15 C, 80 %), fine spray', function(){
  var hot = drifted('hot', { cls: 'fine', temp: 30, rh: 30 }), cool = drifted('cool', { cls: 'fine', temp: 15, rh: 80 });
  sprayLog.push('fine, 3 m/s wind: centroid x hot and dry ' + hot.x.toFixed(2) + ' m (lost ' + (100*hot.lost/(hot.a + hot.lost)).toFixed(1) + ' %), cool and humid ' + cool.x.toFixed(2) + ' m (lost ' + (100*cool.lost/(cool.a + cool.lost)).toFixed(1) + ' %)');
  assert(hot.x > cool.x + 0.1, 'hot ' + hot.x + ' cool ' + cool.x); });
// The model does not reproduce "fine droplets stay aloft" under an inversion (see DESIGN_NOTES, Spray and drift).
// This test checks what it does model: the slow wind meander, and the sideways turn of the fine-spray plume.
test('inversion: the wind direction meanders and turns the fine-spray plume sideways (0.8 m/s, 3 m)', function(){
  var a = new Sim(), b = new Sim(); a.wind = b.wind = 4; a.windDir = b.windDir = 270; b.stability = 'inversion'; a.t = b.t = 15; // a quarter period: full amplitude
  var wa = a.windVec(10), wb = b.windVec(10), turn = (Math.atan2(wb[2], wb[0]) - Math.atan2(wa[2], wa[0]))*180/Math.PI;
  assert(Math.abs(turn - SPR.invMeander) < 0.5, 'turn ' + turn); assert(Math.abs(Math.hypot(wa[0], wa[2]) - Math.hypot(wb[0], wb[2])) < 1e-9, 'same speed');
  var inv = depStats(hoverSpray({ cls: 'fine', wind: 0.8, stab: 'inversion' }, 10)), neu = depStats(hoverSpray({ cls: 'fine', wind: 0.8 }, 10));
  sprayLog.push('fine, 0.8 m/s wind: mean distance from the target, inversion ' + inv.r.toFixed(2) + ' m, neutral ' + neu.r.toFixed(2) + ' m; centroid inversion (' + inv.x.toFixed(2) + ', ' + inv.z.toFixed(2) + '), neutral (' + neu.x.toFixed(2) + ', ' + neu.z.toFixed(2) + ')');
  assert(inv.z - neu.z > 0.1, 'the meandered wind (from about 300 deg) moves the plume south: z ' + inv.z + ' vs ' + neu.z); assert(inv.x > 0 && neu.x > 0, 'both downwind'); });
// Fly a 3 m pass north along x = 0 at the given speed, spraying from z = -20 to z = -60. Share of the deposit within 1 m of the line.
function passShare(speed, wind){ var s = new Sim(); s.sprayCfg = { tankL: TMAX, fillL: TMAX, flowLmin: 0.5, cls: 'medium', mount: 'rotor' }; s.wind = wind; s.windDir = 270; s.reset();
  s.startMission([{ x: 0, y: 3, z: 0 }, { x: 0, y: 3, z: -80 }], speed, 10);
  untilLanded(s, 120, function(){ if (s.pos[2] < -20 && s.pos[2] > -60) s.command('sprayOn'); else s.command('sprayOff'); return Z; }); settle(s);
  var d = s.sprayDeposit(), n = Math.round(2*d.half/d.cell), near = 0, all = 0;
  for (var iz = 0; iz < n; iz++) for (var ix = 0; ix < n; ix++){ var a = d.data[iz*n + ix], x = -d.half + (ix + 0.5)*d.cell; all += a; if (Math.abs(x) < 1) near += a; }
  return { share: near/(all + d.lost), s: s }; }
test('7 m/s puts less of the deposit under the path than 2 m/s', function(){ var fast = passShare(7, 1).share, slow = passShare(2, 1).share;
  sprayLog.push('3 m pass, 1 m/s crosswind: share within 1 m of the line at 2 m/s ' + (100*slow).toFixed(1) + ' %, at 7 m/s ' + (100*fast).toFixed(1) + ' %');
  assert(fast < slow - 0.03, 'fast ' + fast + ' slow ' + slow); });
test('effective swath of a 3 m pass at 3 m/s, no wind (printed)', function(){ var s = passShare(3, 0).s, d = s.sprayDeposit(), n = Math.round(2*d.half/d.cell), v = [];
  var i0 = Math.floor((-55 + d.half)/d.cell), i1 = Math.floor((-25 + d.half)/d.cell), jc = n/2, jw = 16; // rows across the middle of the sprayed segment, columns |x| < 8 m
  for (var j = jc - jw; j < jc + jw; j++){ var sum = 0; for (var iz = i0; iz < i1; iz++) sum += d.data[iz*n + j]; v.push(sum); }
  var w = S.effectiveSwath({ dx: d.cell, v: v }); sprayLog.push('effective swath, 3 m pass at 3 m/s, medium, no wind: ' + w.toFixed(1) + ' m (CV <= 30 %)'); assert(w > 0.5 && w < 16, 'swath ' + w); });
test('a full tank needs more hover thrust and drains the battery faster', function(){ var e = sprayer({ fill: 0 }), f = sprayer({}); var b0e = e.batt, b0f = f.batt; run(e, 20); run(f, 20);
  var te = e.F.reduce(function(a, x){ return a + x; }, 0), tf = f.F.reduce(function(a, x){ return a + x; }, 0);
  assert(Math.abs(te - S.PARAMS.m*S.PARAMS.g) < 0.3, 'empty hover thrust ' + te); assert(Math.abs(tf - f.mass()*S.PARAMS.g) < 0.3, 'full hover thrust ' + tf + ' for ' + f.mass() + ' kg');
  assert(b0f - f.batt > 1.5*(b0e - e.batt), 'drain full ' + (b0f - f.batt) + ' empty ' + (b0e - e.batt)); assert(Math.abs(f.pos[1] - 3) < 0.2 && !f.crashed);
  assert(S.rthEstimate(0, -100, 10, 30, 0, 0, f.mass()/S.PARAMS.m).pct > 1.5*S.rthEstimate(0, -100, 10, 30, 0, 0).pct, 'return estimate grows with mass'); });
test('maximum motor thrust is the same with a full and an empty tank', function(){ var Fmax = S.PARAMS.m*S.PARAMS.g*S.PARAMS.twr/4;
  var peak = function(fill){ var s = sprayer({ fill: fill }), hi = 0; s.mode = 'alt'; run(s, 0.6, function(){ s.v[1] = -3; hi = Math.max(hi, Math.max.apply(null, s.F)); return st({ thr: 1 }); }); return { hi: hi, mot: Math.max.apply(null, s.telemetry().motors) }; };
  var e = peak(0), f = peak(TMAX); assert(Math.abs(e.hi - Fmax) < 1e-3*Fmax && Math.abs(f.hi - Fmax) < 1e-3*Fmax, 'peaks ' + e.hi + ' ' + f.hi + ' of ' + Fmax);
  assert(f.mot <= 1 + 1e-9 && Math.abs(e.mot - f.mot) < 1e-3, 'normalized motors ' + e.mot + ' ' + f.mot); });
test('the same seed gives identical deposits', function(){ var a = hoverSpray({ cls: 'fine', wind: 2, h: 4 }, 4), b = hoverSpray({ cls: 'fine', wind: 2, h: 4 }, 4), da = a.sprayDeposit().data, db = b.sprayDeposit().data;
  assert.strictEqual(da.length, db.length); for (var i = 0; i < da.length; i++) if (da[i] !== db[i]) assert.fail('cell ' + i + ' differs'); assert.strictEqual(a.lost, b.lost); assert(a.deposited > 0); });
test('sprayCfgError: capacity, fill, flow, class, and mount', function(){ var ok = { tankL: 0.5, fillL: 0.5, flowLmin: 0.5, cls: 'medium', mount: 'boom' }, w = function(o){ return S.sprayCfgError(Object.assign({}, ok, o)); };
  assert.strictEqual(S.sprayCfgError(ok), ''); assert.strictEqual(w({ tankL: 0, fillL: 0 }), ''); assert.strictEqual(w({ tankL: TMAX, fillL: TMAX }), '');
  assert(Math.abs((S.PARAMS.m + TMAX*SPR.rhoLiq/1000)*SPR.twrMin - S.PARAMS.m*S.PARAMS.twr) < 1e-9, 'the full tank leaves thrust to weight at the limit');
  assert(w({ tankL: TMAX + 0.01 })); assert(w({ fillL: 0.6 })); assert(w({ fillL: -0.1 })); assert(w({ flowLmin: 0.05 })); assert(w({ flowLmin: 2.5 })); assert(w({ flowLmin: '1' })); assert(w({ mount: 'wing' })); assert(w({ cls: 'mist' })); assert(S.sprayCfgError(null));
  var s = new Sim(); s.sprayCfg = Object.assign({}, ok, { mount: 'wing' }); s.reset(); assert.strictEqual(s.tank, 0, 'an invalid config fills nothing'); });
test('boom nozzles release outside the rotor footprint and sprayStats splits the deposit', function(){ var s = sprayer({ mount: 'boom' }); s.command('sprayOn'); run(s, 0.3); var xs = s.sprayParcels().map(function(p){ return Math.abs(p[0]); });
  assert(xs.length && Math.min.apply(null, xs) > 0.4, 'boom parcels start out at the boom ends'); s.command('sprayOff'); s.command('land'); settle(s);
  var r = hoverSpray({}), box = function(c, h){ return [[c[0] - h, c[1] - h], [c[0] + h, c[1] - h], [c[0] + h, c[1] + h], [c[0] - h, c[1] + h]]; }, st0 = r.sprayStats(box([0, 0], 3), box([20, 0], 3)), t = r.telemetry();
  assert(Math.abs(st0.inside_l + st0.outside_l + st0.lost_l - t.deposited_l - t.lost_l) < 1e-12); assert(st0.inside_l > 0.9*t.deposited_l && st0.offtarget_pct < 10, 'off target ' + st0.offtarget_pct);
  assert.strictEqual(st0.sensitive_l, 0); assert(st0.peak_lha > st0.mean_lha && st0.cv_pct > 0); });
test('performance: 60 s of spraying at the parcel cap (printed, never fails)', function(){ var rate = SPR.emitRate; SPR.emitRate = 400; var s = sprayer({ cls: 'fine', wind: 3, h: 5 }), hi = 0, t0 = Date.now();
  try { s.command('sprayOn'); run(s, 60, function(){ hi = Math.max(hi, s.parcels.length); return Z; }); } finally { SPR.emitRate = rate; }
  sprayLog.push('performance: 60 s at up to ' + hi + ' parcels (cap ' + SPR.maxParcels + ') took ' + (Date.now() - t0) + ' ms'); assert(hi <= SPR.maxParcels); });
sprayLog.push('largest tank for this airframe: ' + TMAX.toFixed(3) + ' L');
sprayLog.forEach(function(l){ console.log('        ' + l); });

// ---- drills (pure function sliced from 30-drills.js) ----
console.log('drills');
var D = {}; vm.createContext(D); vm.runInContext(slice(src('30-drills.js'), 'function drillAbort', 'function drillStep'), D);
test('an emergency landing ends a drill that is ready or running, so it cannot hang', function(){
  ['hover', 'nosein', 'square', 'land'].forEach(function(id){ ['ready', 'run'].forEach(function(ph){ assert(D.drillAbort('batt_crit', id, ph).length > 20, id + ' ' + ph); assert(D.drillAbort('batt_unreachable', id, ph).length > 20); }); });
  assert.strictEqual(D.drillAbort('batt_crit', 'free', 'run'), ''); assert.strictEqual(D.drillAbort('batt_crit', 'hover', 'done'), ''); assert.strictEqual(D.drillAbort('batt_crit', 'hover', 'failed'), '');
  ['batt_warn', 'batt_low', 'batt_margin', 'rth', 'rth_cancel', 'touchdown', 'liftoff'].forEach(function(ev){ assert.strictEqual(D.drillAbort(ev, 'hover', 'run'), '', ev + ' must not end a drill'); }); });

// ---- controller actions (pure functions, the whole of 41-actions.js) ----
console.log('controller actions');
var A = {}; vm.createContext(A); vm.runInContext(src('41-actions.js'), A);
function pad(buttons, axes){ return { buttons: buttons || [], axes: axes || [] }; }
function feed(assign, frames, ctx){ var state = null, out = []; frames.forEach(function(f){ var r = A.actionStep(assign, state, f, typeof ctx === 'function' ? ctx(out) : (ctx || { armed: false, rthActive: false })); state = r.state; out.push(r.cmds.join('+')); }); return out; }
var BTN = { kind: 'button', index: 2, dir: 1, latch: false }, SW = { kind: 'axis', index: 5, dir: 1, latch: true };
test('momentary button: fires on the press edge only, and toggles RTH', function(){ var active = false, ctx = function(){ return { armed: true, rthActive: active }; }, state = null, log = [];
  [[false], [false, false, true], [false, false, true], [false, false, false], [false, false, true], [false, false, true], [false, false, false]].forEach(function(b){ var r = A.actionStep({ rth: BTN }, state, pad(b), ctx()); state = r.state; r.cmds.forEach(function(c){ active = c === 'rth'; }); log.push(r.cmds.join('+')); });
  assert.deepStrictEqual(log, ['', 'rth', '', '', 'cancel_rth', '', '']); });
test('a button held down at the first frame does not fire', function(){ assert.deepStrictEqual(feed({ land: BTN }, [pad([0, 0, true]), pad([0, 0, true]), pad([0, 0, false]), pad([0, 0, true])]), ['', '', '', 'land']); });
test('latching switch: on starts RTH, off cancels it', function(){ var ax = function(v){ return pad([], [0, 0, 0, 0, 0, v]); };
  assert.deepStrictEqual(feed({ rth: SW }, [ax(-1), ax(-1), ax(1), ax(1), ax(-1), ax(-1), ax(1)]), ['', '', 'rth', '', 'cancel_rth', '', 'rth']); });
test('latching switch: no retrigger after a stick cancel while the switch stays on', function(){ var ax = function(v){ return pad([], [0, 0, 0, 0, 0, v]); }, frames = [ax(-1), ax(1)]; for (var i = 0; i < 50; i++) frames.push(ax(1)); frames.push(ax(-1)); frames.push(ax(1));
  var out = feed({ rth: SW }, frames, function(o){ return { armed: true, rthActive: o.length < 10 }; }); // RTH is cancelled with the stick around frame 10
  assert.strictEqual(out.filter(function(c){ return c === 'rth'; }).length, 2); assert.strictEqual(out[1], 'rth'); assert.strictEqual(out[out.length - 1], 'rth'); assert.strictEqual(out.slice(2, 52).join(''), ''); });
test('a switch left on at the start does not act until it is cycled', function(){ var ax = function(v){ return pad([], [0, 0, 0, 0, 0, v]); }; assert.deepStrictEqual(feed({ rth: SW, arm: { kind: 'axis', index: 4, dir: -1, latch: true } }, [ax(1), ax(1), ax(-1), ax(1)]), ['', '', 'cancel_rth', 'rth']); });
test('axis switch has hysteresis and respects its direction', function(){ var ax = function(v){ return pad([], [0, 0, 0, 0, 0, v]); }, inv = { kind: 'axis', index: 5, dir: -1, latch: true };
  assert.deepStrictEqual(feed({ land: SW }, [ax(0), ax(0.45), ax(0.55), ax(0.4), ax(0.25), ax(0.45), ax(0.6)]), ['', '', 'land', '', '', '', 'land']); assert.deepStrictEqual(feed({ land: inv }, [ax(0), ax(1), ax(-1)]), ['', '', 'land']); });
test('arm or disarm: a switch follows its position, a button toggles', function(){ var ax = function(v){ return pad([], [0, 0, 0, 0, 0, v]); };
  assert.deepStrictEqual(feed({ arm: SW }, [ax(-1), ax(1), ax(-1)]), ['', 'arm', 'disarm']);
  assert.deepStrictEqual(feed({ arm: BTN }, [pad([]), pad([0, 0, true]), pad([])], { armed: false, rthActive: false }), ['', 'arm', '']); assert.deepStrictEqual(feed({ arm: BTN }, [pad([]), pad([0, 0, true])], { armed: true, rthActive: false }), ['', 'disarm']); });
test('three-position axis selects Position hold, Altitude hold, Stabilized', function(){ var ax = function(v){ return pad([], [0, 0, 0, 0, v]); }, M3 = { kind: 'axis', index: 4, dir: 1, latch: true };
  assert.deepStrictEqual(feed({ mode3: M3 }, [ax(-1), ax(-1), ax(0), ax(0.02), ax(1), ax(1), ax(0), ax(-1)]), ['', '', 'mode:alt', '', 'mode:angle', '', 'mode:alt', 'mode:pos']);
  assert.deepStrictEqual(feed({ mode3: M3 }, [ax(0), ax(0.35), ax(0.30), ax(0.36), ax(0.45)]), ['', '', '', '', 'mode:angle'], 'hysteresis around the band edge'); });
test('three separate buttons select the flight modes, camera changes on each press', function(){ var asg = { modePos: { kind: 'button', index: 0, dir: 1, latch: false }, modeAlt: { kind: 'button', index: 1, dir: 1, latch: false }, modeAngle: { kind: 'button', index: 2, dir: 1, latch: false }, cam: { kind: 'button', index: 3, dir: 1, latch: false } };
  assert.deepStrictEqual(feed(asg, [pad([]), pad([0, 0, 1]), pad([]), pad([0, 1]), pad([1, 0, 0, 1]), pad([]), pad([0, 0, 0, 1])]), ['', 'mode:angle', '', 'mode:alt', 'mode:pos+cam', '', 'cam']); });
test('Assign detects a new button press or an axis that moved, and skips the stick axes', function(){ var base = pad([false, true], [0, 0, 0, 0, -1, 0.1]);
  assert.strictEqual(A.detectSource(base, pad([false, true], [0.9, 0, 0, 0, -1, 0.3]), [0, 1, 2, 3]), null, 'a held button, a stick, and a small move are ignored');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(A.detectSource(base, pad([true, true], [0, 0, 0, 0, -1, 0]), [0, 1, 2, 3]))), { kind: 'button', index: 0, dir: 1, latch: false });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(A.detectSource(base, pad([false, true], [0, 0, 0, 0, 1, 0]), [0, 1, 2, 3]))), { kind: 'axis', index: 4, dir: 1, latch: true });
  assert.strictEqual(A.detectSource(pad([], [0, 0, 0, 0, 1]), pad([], [0, 0, 0, 0, -1]), [0, 1, 2, 3]).dir, -1);
  assert.strictEqual(A.detectSource(base, pad([true, true], [0, 0, 0, 0, -1, 0]), [0, 1, 2, 3], { button: false }), null, 'the 3-position action takes an axis only'); });

// ---- georeference and parsers (pure functions sliced from the planner fragments) ----
console.log('georeference and import');
var G = { geo: null, clamp: S.clamp }; vm.createContext(G);
vm.runInContext('var geo = null;\n' + slice(src('70-planner.js'), 'function mkGeo', 'function geoNote'), G);
var imp = src('72-import.js');
vm.runInContext(slice(imp, 'function parseGeoJSON', 'function readGeoTIFF'), G);
test('UTM 17N 500000 E, 3800000 N -> 34.3413, -81.0000', function(){ var r = G.utm2ll(500000, 3800000, 17, false); assert(Math.abs(r[0] - 34.3413) < 0.0002 && Math.abs(r[1] + 81) < 1e-6); });
test('local conversion round trip', function(){ vm.runInContext('geo = mkGeo(34.68, -82.84);', G); var q = G.ll2xz(34.681, -82.839); assert(Math.abs(q[1] + 110.9) < 0.3 && Math.abs(q[0] - 91.6) < 0.3); var b = G.xz2ll(q[0], q[1]); assert(Math.abs(b[0] - 34.681) < 1e-9 && Math.abs(b[1] + 82.839) < 1e-9); });
test('CSV waypoints with a header row', function(){ var r = G.parseCSV('Latitude,Longitude,Altitude(m)\n34.68,-82.84,30\n34.681,-82.839,40').route; assert.strictEqual(r.length, 2); assert.strictEqual(r[1].alt, 40); });
test('GeoJSON polygon', function(){ var o = G.parseGeoJSON(JSON.stringify({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-82.84, 34.68], [-82.839, 34.68], [-82.839, 34.681], [-82.84, 34.68]]] } })); assert.strictEqual(o.poly.length, 4); });

// ---- plan computation and movable home (pure functions from the same slice of 70-planner.js) ----
console.log('plan computation and home shift');
var HA = [[-50, -106], [50, -106], [50, -6], [-50, -6]]; // 1 ha square, 6 m north of home
function areaPlan(poly, o){ return G.planCompute(Object.assign({ cam: G.CAMERAS[1], alt: 40, front: 75, side: 70, speed: 5, dirDeg: 0, endurance: 20, mode: 'area', poly: poly, route: [] }, o || {})); }
test('verified case: 1 ha, 40 m, 20 MP, 75/70 -> 1.10 cm/px, 18 m, 10 m, 6 lines, 66 photos', function(){ var P = areaPlan(HA);
  assert.strictEqual(P.gsd.toFixed(2), '1.10'); assert(Math.abs(P.W - 60) < 1e-9 && Math.abs(P.L - 40) < 1e-9); assert(Math.abs(P.spacing - 18) < 1e-9); assert(Math.abs(P.trig - 10) < 1e-9); assert(Math.abs(P.interval - 2) < 1e-9);
  assert(Math.abs(P.area - 10000) < 1e-6); assert.strictEqual(P.lines.length, 6); assert.strictEqual(P.shots.length, 66); assert(P.ok); });
test('area plan starts and ends at home and marks survey legs', function(){ var P = areaPlan(HA), w = P.wps; assert.strictEqual(w.length, 14);
  assert(w[0].x === 0 && w[0].z === 0 && w[13].x === 0 && w[13].z === 0 && w[0].y === 40); assert.strictEqual(w.filter(function(q){ return q.survey; }).length, 6);
  assert(Math.hypot(w[1].x, w[1].z) <= Math.hypot(w[12].x, w[12].z), 'pattern should start at the end nearest home'); });
test('line direction 90 gives east-west lines', function(){ var P = areaPlan(HA, { dirDeg: 90 }); assert.strictEqual(P.lines.length, 6); P.lines.forEach(function(l){ assert(Math.abs(l[0][1] - l[1][1]) < 1e-6); }); });
test('fewer than three corners gives no plan', function(){ var P = areaPlan(HA.slice(0, 2)); assert(!P.ok); assert.strictEqual(P.wps.length, 0); });
test('route plan: holds, photos, length, and home legs', function(){
  var P = G.planCompute({ cam: G.CAMERAS[1], alt: 40, front: 75, side: 70, speed: 5, dirDeg: 0, endurance: 20, mode: 'route', poly: [], route: [{ x: 0, z: -30, alt: 20, act: 'photo' }, { x: 40, z: -30, alt: 30, act: 'hover' }] });
  assert(P.ok); assert.strictEqual(P.wps.length, 4); assert.strictEqual(P.shots.length, 1); assert.strictEqual(P.wps[1].hold, 1.5); assert.strictEqual(P.wps[2].hold, 5); assert(Math.abs(P.dist - 120) < 1e-9); assert.strictEqual(P.wps[3].y, 30); });
function llOf(pts, g){ return pts.map(function(p){ return G.xz2ll(p[0], p[1], g); }); }
test('home shift keeps the polygon latitude and longitude', function(){ var g0 = G.mkGeo(34.68, -82.84), before = llOf(HA, g0);
  var s = G.shiftHome({ geo: g0, poly: HA, route: [{ x: 10, z: -20, alt: 30, act: 'photo' }], track: [[1, -2]], field: { w: 200, h: 120, cx: 0, cz: -66 } }, 35, -140), after = llOf(s.poly, s.geo);
  before.forEach(function(b, i){ assert(Math.abs(b[0] - after[i][0]) < 1e-10 && Math.abs(b[1] - after[i][1]) < 1e-10, 'corner ' + i + ' moved'); });
  var r0 = G.xz2ll(10, -20, g0), r1 = G.xz2ll(s.route[0].x, s.route[0].z, s.geo); assert(Math.abs(r0[0] - r1[0]) < 1e-10 && Math.abs(r0[1] - r1[1]) < 1e-10);
  assert.strictEqual(s.route[0].alt, 30); assert.strictEqual(s.route[0].act, 'photo'); });
test('home shift puts the new home at the clicked point', function(){ var g0 = G.mkGeo(34.68, -82.84), h = G.xz2ll(35, -140, g0), s = G.shiftHome({ geo: g0, poly: HA }, 35, -140);
  assert(Math.abs(s.geo.lat0 - h[0]) < 1e-12 && Math.abs(s.geo.lon0 - h[1]) < 1e-12); assert(Math.abs(s.poly[0][0] - (-85)) < 0.01 && Math.abs(s.poly[0][1] - 34) < 0.01); });
test('home shift without a georeference is a plain offset', function(){ var s = G.shiftHome({ geo: null, poly: HA, route: [{ x: 10, z: -20, alt: 30, act: 'none' }], track: [[1, -2]], field: { w: 200, h: 120, cx: 0, cz: -66 } }, 35, -140);
  assert.strictEqual(s.geo, null); assert.deepStrictEqual(JSON.parse(JSON.stringify(s.poly[2])), [15, 134]); assert.deepStrictEqual(JSON.parse(JSON.stringify(s.track[0])), [-34, 138]);
  assert(s.route[0].x === -25 && s.route[0].z === 120); assert(s.field.cx === -35 && s.field.cz === 74 && s.field.w === 200 && s.field.h === 120); });
test('home shift does not modify its input and keeps the survey the same', function(){ var g0 = G.mkGeo(34.68, -82.84), copy = JSON.stringify(HA), s = G.shiftHome({ geo: g0, poly: HA }, -20, -60);
  assert.strictEqual(JSON.stringify(HA), copy); var A = areaPlan(HA), B = areaPlan(s.poly); assert.strictEqual(B.lines.length, A.lines.length); assert.strictEqual(B.shots.length, A.shots.length); assert(Math.abs(B.area/A.area - 1) < 1e-4, 'area ratio ' + B.area/A.area); }); // re-anchoring the tangent plane rescales local meters by a few ppm
var HS = function(o){ return Object.assign({ picking: false, hasField: true, hasGeo: false, armed: false, onGround: true }, o || {}); };
test('set home: arms with a field image or a georeference, landed and disarmed', function(){ assert.strictEqual(G.homeDecision(HS()).action, 'arm'); assert.strictEqual(G.homeDecision(HS({ hasField: false, hasGeo: true })).action, 'arm'); });
test('set home: available only with a field image or an imported plan (the button looks disabled otherwise)', function(){
  assert.strictEqual(G.homeAvailable({ hasField: false, hasGeo: false }), false); assert.strictEqual(G.homeAvailable({ hasField: true, hasGeo: false }), true); assert.strictEqual(G.homeAvailable({ hasField: false, hasGeo: true }), true);
  [true, false].forEach(function(f){ [true, false].forEach(function(g){ var st = HS({ hasField: f, hasGeo: g }); assert.strictEqual(G.homeDecision(st).action === 'arm', G.homeAvailable(st)); }); }); });
test('set home: refused on the practice field, while armed, and in the air', function(){
  var a = G.homeDecision(HS({ hasField: false })), b = G.homeDecision(HS({ armed: true })), c = G.homeDecision(HS({ onGround: false }));
  assert.strictEqual(a.action, 'refuse'); assert.strictEqual(a.msg, G.HOME_MSG.practice); assert.strictEqual(b.action, 'refuse'); assert.strictEqual(b.msg, G.HOME_MSG.flying); assert.strictEqual(c.action, 'refuse'); assert.strictEqual(c.msg, G.HOME_MSG.flying); });
test('set home: a second press cancels, whatever the aircraft state', function(){ assert.strictEqual(G.homeDecision(HS({ picking: true })).action, 'cancel'); assert.strictEqual(G.homeDecision(HS({ picking: true, armed: true, onGround: false, hasField: false })).action, 'cancel'); });
test('set home: every outcome has a message, so a press is never silent', function(){
  [true, false].forEach(function(p){ [true, false].forEach(function(f){ [true, false].forEach(function(g){ [true, false].forEach(function(a){ [true, false].forEach(function(og){
    var d = G.homeDecision({ picking: p, hasField: f, hasGeo: g, armed: a, onGround: og }); assert(['arm', 'cancel', 'refuse'].indexOf(d.action) >= 0); assert(typeof d.msg === 'string' && d.msg.length > 10, JSON.stringify(d)); }); }); }); }); }); });
test('user field: active with a field image, or with an imported plan and no image', function(){
  assert.strictEqual(G.userFieldActive({ hasField: false, hasGeo: false }), false); assert.strictEqual(G.userFieldActive({ hasField: true, hasGeo: false }), true);
  assert.strictEqual(G.userFieldActive({ hasField: false, hasGeo: true }), true); assert.strictEqual(G.userFieldActive({ hasField: true, hasGeo: true }), true); });
test('user field: "Set home" is available exactly when the practice scenery is off', function(){
  [true, false].forEach(function(f){ [true, false].forEach(function(g){ var st = { hasField: f, hasGeo: g }; assert.strictEqual(G.homeAvailable(st), G.userFieldActive(st)); }); }); });
test('user field: clearing the last point of an image-less plan drops the georeference (back to the practice field)', function(){
  assert.strictEqual(G.clearDropsGeo({ hasField: false, points: 0 }), true); assert.strictEqual(G.clearDropsGeo({ hasField: false, points: 4 }), false);
  assert.strictEqual(G.clearDropsGeo({ hasField: true, points: 0 }), false); assert.strictEqual(G.clearDropsGeo({ hasField: true, points: 4 }), false);
  assert.strictEqual(G.userFieldActive({ hasField: false, hasGeo: !G.clearDropsGeo({ hasField: false, points: 0 }) }), false); });
test('user field: fieldMode is assigned in one place only, from userFieldActive', function(){
  var all = fs.readdirSync(path.join(__dirname, '../src/js')).map(function(f){ return src(f); }).join('\n'), sets = all.match(/fieldMode\s*=(?!=)\s*[^;,]+/g) || [];
  assert.deepStrictEqual(sets.filter(function(s){ return !/^fieldMode\s*=\s*false$/.test(s); }), ['fieldMode = on'], JSON.stringify(sets));
  assert(/var on = userFieldActive\(fieldState\(\)\)/.test(all)); assert.strictEqual((all.match(/\.hasField \|\| /g) || []).length, 1, 'the image-or-georeference rule must live only in userFieldActive'); });

// ---- docs ----
console.log('docs');
var docs = require('../tools/build-docs.js');
test('manual converter: blocks and inline marks', function(){
  var h = docs.render(docs.parse('# T\n\nA **b** `c<d` [e](f.html)\nsame para\n\n- u1\n- u2\n\n3. o1\n4. o2\n\n| H1 | H2 |\n|---|---|\n| a | **b** |\n\n```\nx < **y**\n```\n\n---\n')).html;
  assert(h.indexOf('<p>A <strong>b</strong> <code>c&lt;d</code> <a href="f.html">e</a> same para</p>') >= 0, 'paragraph and inline marks');
  assert(h.indexOf('<ul>\n<li>u1</li>\n<li>u2</li>\n</ul>') >= 0 && h.indexOf('<ol start="3">\n<li>o1</li>\n<li>o2</li>\n</ol>') >= 0, 'lists');
  assert(h.indexOf('<tr><th>H1</th><th>H2</th></tr>') >= 0 && h.indexOf('<tr><td>a</td><td><strong>b</strong></td></tr>') >= 0, 'table');
  assert(h.indexOf('<pre><code>x &lt; **y**\n</code></pre>') >= 0 && h.indexOf('<hr>') >= 0, 'code fence is literal, rule'); });
test('manual converter: heading ids and Contents links', function(){
  var d = docs.render(docs.parse('# My Doc\n\n## Contents\n\n1. First part\n2. Second\n\n## 1. First part\n\n### Keys\n\n## 2. Second\n\n### Keys\n'));
  assert.strictEqual(d.title, 'My Doc');
  assert(d.html.indexOf('<ol class="toc">\n<li><a href="#1-first-part">First part</a></li>\n<li><a href="#2-second">Second</a></li>\n</ol>') >= 0, 'contents links');
  assert(d.html.indexOf('<h2 id="1-first-part">') >= 0 && d.html.indexOf('<h3 id="keys">') >= 0 && d.html.indexOf('<h3 id="keys-2">') >= 0, 'unique ids');
  assert.throws(function(){ docs.render(docs.parse('## Contents\n\n1. Missing\n')); }, /no matching section/);
  assert.throws(function(){ docs.parse('> quote\n'); }, /not supported/); });
test('manual page: every Contents link has a target, fonts come from ../labs/fonts/', function(){
  var html = docs.buildManual(), links = html.match(/href="#[^"]+"/g) || [];
  assert(links.length >= 21, 'contents links: ' + links.length);
  links.forEach(function(l){ assert(html.indexOf(' id="' + l.slice(7, -1) + '"') >= 0, 'no target for ' + l); });
  assert(html.indexOf('url("../labs/fonts/LM-regular.woff2")') >= 0 && html.indexOf('url("fonts/') < 0);
  assert(html.indexOf('href="../../index.html"') >= 0 && html.indexOf('href="../labs/index.html"') >= 0, 'top bar links'); });
test('Fundamentals is linked: side panel, manual top bar, and every lab page, before "Open the trainer"', function(){
  var rootDir = path.join(__dirname, '..'), labsDir = path.join(rootDir, 'docs/labs');
  assert(fs.existsSync(path.join(rootDir, 'docs/learn/index.html')), 'docs/learn/index.html is missing');
  assert(fs.readFileSync(path.join(rootDir, 'src/index.template.html'), 'utf8').indexOf('<a href="docs/learn/index.html" target="_blank" rel="noopener">Learn</a>') >= 0, 'side panel link');
  var bar = /<span class="nav">(?:<a [^>]*>[^<]*<\/a>)*<a class="btn" /, link = '<a href="../learn/index.html">Fundamentals</a>';
  var pages = fs.readdirSync(labsDir).filter(function(f){ return /.html$/.test(f); }).map(function(f){ return { name: f, html: fs.readFileSync(path.join(labsDir, f), 'utf8') }; });
  assert(pages.length >= 32, 'lab pages: ' + pages.length);
  pages.concat([{ name: 'manual', html: docs.buildManual() }]).forEach(function(p){
    var m = bar.exec(p.html); assert(m && m[0].indexOf(link) >= 0, 'no Fundamentals link in the top bar of ' + p.name);
    assert(p.html.indexOf('.top .nav{') >= 0, 'no .top .nav rule in ' + p.name); }); });
test('docs/manual/index.html is up to date with docs/USER_MANUAL.md (run "npm run build:docs" if this fails)', function(){
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', docs.OUT), 'utf8'), docs.buildManual()); });

// ---- build ----
console.log('build');
test('index.html is up to date with src/ (run "npm run build" if this fails)', function(){
  var before = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'); require('child_process').execSync('node build.js', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'), before); });

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
