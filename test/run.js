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

// ---- build ----
console.log('build');
test('index.html is up to date with src/ (run "npm run build" if this fails)', function(){
  var before = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'); require('child_process').execSync('node build.js', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'), before); });

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
