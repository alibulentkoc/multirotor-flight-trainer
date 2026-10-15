/*SIM-BEGIN*/
// ---------------------------------------------------------------------------
// Flight model. No DOM or rendering dependencies, so it can be tested headless.
// Axes: X east (right), Y up, Z south. Drone nose points along -Z at zero yaw.
// Quaternions are [x, y, z, w].
// ---------------------------------------------------------------------------
var PARAMS = {
  m: 1.2, g: 9.81,
  d: 0.16,                       // motor offset from center along x and z (m)
  I: [0.012, 0.022, 0.012],      // body inertia (kg m^2)
  kq: 0.02,                      // yaw reaction torque per newton of thrust (m)
  twr: 2.6,                      // thrust to weight ratio
  tauM: 0.04,                    // motor time constant (s)
  kd1: 0.30, kd2: 0.04,          // linear and quadratic air drag (per mass)
  kAtt: 8, kAttYaw: 4, kRate: 25, kRateYaw: 10, tauYawMax: 0.15,
  maxTilt: 0.52,                 // stabilized and altitude modes (rad)
  maxTiltPos: 0.40,              // position hold (rad)
  yawRateMax: 2.1,               // rad/s
  maxTiltAuto: 0.50,             // planned flights and return to home (rad)
  vMax: 4.0, vzMax: 1.5,         // position hold speed limits (m/s)
  landRate: 0.6, landRateNear: 0.3, landNearAlt: 0.6, // automatic landing: sink rate, and the slower rate below landNearAlt (m/s, m)
  batterySeconds: 600,           // endurance in a steady hover (s)
  rth: {                         // return to home
    alt: 30, altMin: 5, altMax: 120, // default RTH altitude and its limits (m)
    speed: 6,                    // cruise speed over the ground (m/s)
    climb: 2.5, descend: 2.0,    // climb and descent rates (m/s)
    kAlt: 1.2,                   // height error to climb rate gain (1/s)
    altTol: 1.0,                 // the climb is complete within this of the target height (m)
    kApproach: 0.7,              // distance to speed gain close to home (1/s)
    arrive: 0.8,                 // start the descent within this distance of home (m)
    nearHome: 3,                 // closer than this, skip the climb and just land (m)
    hdgDist: 3,                  // turn the nose toward home beyond this distance (m)
    landAlt: 2.5,                // below this height the descent slows to the landing rate (m)
    minSpeed: 0.5,               // slowest ground speed that still counts as making headway (m/s)
    cancelStick: 1/3             // right stick deflection that cancels RTH
  },
  batt: {                        // battery model and failsafes
    cells: 4,                    // cells in series
    ocv: [[0, 3.30], [10, 3.52], [50, 3.72], [90, 4.03], [100, 4.20]], // open-circuit volts per cell against percent
    rCell: 0.010,                // internal resistance per cell (ohm)
    hoverCurrent: 14,            // current in a steady hover (A). Capacity follows from batterySeconds
    idleFrac: 0.1, loadExp: 1.5, // drain = idleFrac + (1 - idleFrac)*(thrust/weight)^loadExp, as a share of hover drain
    tauDraw: 5,                  // smoothing of the draw behind "minutes remaining" (s)
    warn: 30, low: 20, crit: 10, // default thresholds (percent)
    min: 5, max: 60,             // limits for any threshold (percent)
    returnMargin: 10,            // warn when battery < return estimate + this (percent)
    estimateEvery: 0.5,          // how often the return estimate is refreshed in flight (s)
    landRate: 2.0,               // emergency landing sink rate above landSlowAlt (m/s)
    landSlowAlt: 3               // below this the emergency landing uses the normal landing rates (m)
  },
  // Spray and drift. The factors follow the UAPASTF best-practice guidance (Portillo et al., Drones 2025, 9, 388):
  // droplet size, release height, flight speed, rotor downwash, nozzle position, wind, temperature and humidity,
  // and inversions. Canopy capture is out of scope: a parcel deposits where it reaches the ground.
  spray: {
    rhoAir: 1.2,                 // air density (kg/m^3)
    muAir: 1.81e-5,              // air dynamic viscosity (Pa s)
    rhoLiq: 1000,                // spray liquid density (kg/m^3), water
    tankL: 0,                    // default tank capacity (L). 0 means no tank, so spraying does nothing
    twrMin: 1.5,                 // the largest allowed tank keeps full-tank thrust to weight at or above this, see sprayTankMax()
    flow: 0.5, flowMin: 0.1, flowMax: 2, // total flow rate, its default and limits (L/min)
    nozzles: {                   // nozzle positions in body axes, [x right, z back] (m). 2 nozzles per mount
      rotor: [[-0.16, 0.16], [0.16, 0.16]], // under the two rear rotors (motor offset PARAMS.d)
      boom: [[-0.6, 0], [0.6, 0]]           // on a lateral boom, outside the rotor footprint
    },
    mount: 'rotor',              // default nozzle mount
    nozzleDrop: 0.2,             // nozzles sit this far below the body (m)
    classes: { fine: 150, medium: 250, coarse: 350, 'very coarse': 450 }, // volume median diameter per class (um)
    binMul: [0.5, 0.75, 1.0, 1.3, 1.7],      // size bins as multiples of the VMD
    binFrac: [0.1, 0.2, 0.4, 0.2, 0.1],      // volume fraction in each bin
    cls: 'medium',               // default droplet class
    nonVol: 0.05,                // non-volatile volume fraction of the liquid, tracked as the active ingredient
    // d^2 evaporation law: d^2 = d0^2 - evapK*dTwb*t, dTwb the wet-bulb depression. 80 um^2/(s K) is the
    // constant behind the classic droplet lifetime table (lifetime s = d^2/(80 dTwb), d in um), Amsden (1962),
    // as reproduced in many extension drift guides.
    evapK: 80e-12,               // (m^2/(s K))
    rotorR: 0.12,                // rotor radius for downwash (m). 4 discs make the momentum theory disc area
    dwDecay: 1.0,                // e-folding length of the downwash below the nozzles (m). About 2.3, 0.9, 0.3 m/s at 1, 2, 3 m below in hover
    dwSide: 0.3,                 // e-folding length of the downwash outside the rotor footprint, sideways (m)
    turbH: 0.3, turbV: 0.2,      // turbulent velocity sigma, horizontal and vertical, neutral air (m/s)
    turbT: 1.0,                  // Lagrangian time scale of the turbulent random walk (s)
    invTurbV: 0.15,              // inversion: vertical turbulence is multiplied by this
    invMeander: 40, invPeriod: 60, // inversion: wind direction meander amplitude (deg) and period (s)
    emitRate: 25,                // parcels per second per nozzle, spread across the size bins
    maxParcels: 4000,            // airborne parcel cap. Beyond it new emission merges into fewer, larger parcels
    maxAge: 300,                 // a parcel airborne longer than this has become fine aerosol and counts as lost (s)
    dt: 0.02,                    // parcel update interval (s), 50 Hz, not every physics step
    cell: 0.5,                   // deposit grid cell size (m)
    half: 100,                   // deposit grid half-extent around home (m)
    seed: 12345                  // seed of the parcel random numbers, so runs are reproducible
  }
};
var MOTORS = [ // x, z, spin (+1 = counter clockwise seen from above)
  [-1, -1, -1], [1, -1, 1], [1, 1, -1], [-1, 1, 1]
];
function qmul(a, b){ return [
  a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
  a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
  a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
  a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2] ]; }
function qconj(q){ return [-q[0], -q[1], -q[2], q[3]]; }
function qrot(q, v){ var p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qconj(q)); return [p[0], p[1], p[2]]; }
function qaxis(ax, ang){ var s = Math.sin(ang/2); return [ax[0]*s, ax[1]*s, ax[2]*s, Math.cos(ang/2)]; }
function clamp(x, a, b){ return x < a ? a : (x > b ? b : x); }
// Mean wind speed at height h as a share of the 10 m value (log profile down to the canopy).
function windProfile(h){ return clamp(Math.log((Math.max(0, h) + 0.1)/0.03)/Math.log(10/0.03), 0.15, 1.3); }
function dragAcc(va){ return (PARAMS.kd1 + PARAMS.kd2*va)*va; }

// ---- battery: pure functions ----
// Drain as a share of the hover drain, from total thrust over weight.
function battLoad(thrustRatio){ var B = PARAMS.batt; return B.idleFrac + (1 - B.idleFrac)*Math.pow(Math.max(0, thrustRatio), B.loadExp); }
// Open-circuit volts per cell at a given percent, by linear interpolation in PARAMS.batt.ocv.
function battOcv(pct){
  var c = PARAMS.batt.ocv, p = clamp(pct, 0, 100);
  for (var i = 1; i < c.length; i++) if (p <= c[i][0]) return c[i - 1][1] + (c[i][1] - c[i - 1][1])*(p - c[i - 1][0])/(c[i][0] - c[i - 1][0]);
  return c[c.length - 1][1];
}
// Pack voltage under load: open-circuit voltage minus the drop across the internal resistance.
function battVolts(pct, amps){ var B = PARAMS.batt; return Math.max(0, B.cells*(battOcv(pct) - amps*B.rCell)); }
// Threshold settings are valid when warning > low > critical and all lie within the limits. Returns '' or the reason.
function battCfgError(warn, low, crit){
  var B = PARAMS.batt, v = [warn, low, crit];
  for (var i = 0; i < 3; i++) if (typeof v[i] !== 'number' || !isFinite(v[i]) || v[i] < B.min || v[i] > B.max) return 'Each battery level must be between ' + B.min + ' and ' + B.max + ' percent.';
  if (!(warn > low && low > crit)) return 'Battery levels must run warning > low > critical.';
  return '';
}
// Battery percent needed to return home from (x, z) at height h: the climb to the RTH altitude, the cruise
// home against the mean wind at that height, and the descent. Gusts are left out, which is what the margin is for.
// pct is Infinity when the drone cannot make headway against the wind.
// mr is the total mass over the empty airframe mass (default 1). Drag is a force, so a heavier drone needs more
// thrust to hover but the same drag force, and its tilt for that drag is smaller. The tank is assumed to stay as it is.
function rthEstimate(x, z, h, rthAlt, wind, windDir, mr){
  var P = PARAMS, R = P.rth, d = Math.hypot(x, z), top = d < R.nearHome ? h : Math.max(h, clamp(rthAlt, R.altMin, R.altMax));
  if (!(mr > 0)) mr = 1;
  var tClimb = (top - h)/R.climb, eClimb = tClimb*battLoad(mr + dragAcc(R.climb)/P.g);
  var tDown = Math.max(0, top - R.landAlt)/R.descend, eDown = tDown*battLoad(mr - dragAcc(R.descend)/P.g);
  var hl = Math.min(top, R.landAlt), tLand = Math.max(0, hl - P.landNearAlt)/P.landRate + Math.min(hl, P.landNearAlt)/P.landRateNear, eLand = tLand*battLoad(mr);
  var tCruise = 0, eCruise = 0;
  if (d > R.arrive){
    var th = windDir*Math.PI/180, w = wind*windProfile(top), wx = -Math.sin(th)*w, wz = Math.cos(th)*w, ux = -x/d, uz = -z/d;
    var aMax = P.g*Math.tan(P.maxTiltAuto), sp = R.speed, a = 0, n = 0;
    for (; n <= 40; n++){ a = dragAcc(Math.hypot(ux*sp - wx, uz*sp - wz)); if (a/mr <= aMax) break; sp -= R.speed/40; }
    if (n > 40 || sp < R.minSpeed) return { pct: Infinity, time: Infinity, dist: d, top: top, speed: 0 };
    tCruise = d/sp; eCruise = tCruise*battLoad(Math.sqrt(mr*mr + a*a/(P.g*P.g)));
  }
  return { pct: 100*(eClimb + eCruise + eDown + eLand)/P.batterySeconds, time: tClimb + tCruise + tDown + tLand, dist: d, top: top, speed: tCruise ? d/tCruise : 0 };
}

// ---- spray: pure functions ----
// Settling speed (m/s) of a water droplet of diameter d (m) in still air. Drag from the Schiller-Naumann
// correlation, Cd = 24/Re*(1 + 0.15*Re^0.687), which turns the force balance into v = vStokes/(1 + 0.15*Re(v)^0.687).
// v*(1 + 0.15*Re(v)^0.687) rises with v, so bisection between 0 and the Stokes speed always converges.
function dropTerminal(d){
  var S = PARAMS.spray, pow = Math.pow; if (!(d > 0)) return 0;
  var vs = (S.rhoLiq - S.rhoAir)*PARAMS.g*d*d/(18*S.muAir), k = S.rhoAir*d/S.muAir, lo = 0, hi = vs;
  for (var i = 0; i < 32; i++){ var v = (lo + hi)/2; if (v*(1 + 0.15*pow(k*v, 0.687)) > vs) hi = v; else lo = v; }
  return (lo + hi)/2;
}
// Induced (downwash) speed under the rotors from momentum theory in hover, v_i = sqrt(T/(2*rho*A)), A = 4 rotor discs.
function downwashSpeed(thrustN){ var S = PARAMS.spray; return Math.sqrt(Math.max(0, thrustN)/(2*S.rhoAir*4*Math.PI*S.rotorR*S.rotorR)); }
// Wet-bulb depression (K): air temperature minus the wet-bulb temperature from the empirical formula of
// Stull (2011, J. Appl. Meteor. Climatol. 50, 2267), valid near sea level for 5 to 99 % RH and -20 to 50 C.
function wetBulbDepression(tempC, rhPct){
  var T = tempC, RH = clamp(rhPct, 5, 99), at = Math.atan;
  var tw = T*at(0.151977*Math.sqrt(RH + 8.313659)) + at(T + RH) - at(RH - 1.676331) + 0.00391838*Math.pow(RH, 1.5)*at(0.023101*RH) - 4.686035;
  return Math.max(0, T - tw);
}
// Application rate (L/ha) from the flow (L/min), the ground speed (m/s), and the swath or line spacing (m).
function sprayRate(flowLmin, speed_ms, swath_m){ return 166.67*flowLmin/(speed_ms*swath_m); }
// Droplet size bins of a class: [{ d (m), frac (volume fraction) }]. Unknown names return [].
function sprayClassBins(name){
  var S = PARAMS.spray, vmd = S.classes[name]; if (!vmd) return [];
  return S.binMul.map(function(m, i){ return { d: m*vmd*1e-6, frac: S.binFrac[i] }; });
}
// Effective swath (m) from a cross-track deposit profile { dx (m), v: [dose per bin] }: the widest line spacing,
// in whole bins, whose overlapped deposit has a coefficient of variation <= cvMax (percent, default 30). Passes
// alternate direction (back and forth), so every second pass is mirrored and the pattern repeats every 2 spacings.
function effectiveSwath(profile, cvMax){
  if (cvMax === undefined) cvMax = 30;
  var v = profile.v, L = v.length, best = 0;
  for (var k = 1; k <= 2*L; k++){
    var n = 2*k, sum = 0, sum2 = 0;
    for (var j = 0; j < n; j++){
      var tot = 0;
      for (var p = Math.floor((j - L + 1)/k); p <= Math.floor(j/k); p++){ var i = j - p*k; if (i >= 0 && i < L) tot += (p & 1) ? v[L - 1 - i] : v[i]; }
      sum += tot; sum2 += tot*tot;
    }
    var mean = sum/n, sd = Math.sqrt(Math.max(0, sum2/n - mean*mean));
    if (mean > 0 && 100*sd/mean <= cvMax) best = k;
  }
  return best*profile.dx;
}
// Spray settings are valid when the tank fits the airframe, the fill fits the tank, and the flow, class, and
// mount are known. Returns '' or the reason.
function sprayTankMax(){ var P = PARAMS; return P.m*(P.twr/P.spray.twrMin - 1)/P.spray.rhoLiq*1000; } // largest tank (L)
function sprayCfgError(c){
  var S = PARAMS.spray, num = function(x){ return typeof x === 'number' && isFinite(x); }, max = sprayTankMax();
  if (!c || typeof c !== 'object') return 'Spray settings are missing.';
  if (!num(c.tankL) || c.tankL < 0 || c.tankL > max) return 'Tank capacity must be between 0 and ' + max.toFixed(2) + ' L for this airframe.';
  if (!num(c.fillL) || c.fillL < 0 || c.fillL > c.tankL) return 'The fill must be between 0 and the tank capacity.';
  if (!num(c.flowLmin) || c.flowLmin < S.flowMin || c.flowLmin > S.flowMax) return 'Flow rate must be between ' + S.flowMin + ' and ' + S.flowMax + ' L/min.';
  if (!S.classes.hasOwnProperty(c.cls)) return 'Unknown droplet class: ' + c.cls + '.';
  if (!S.nozzles.hasOwnProperty(c.mount)) return 'Unknown nozzle mount: ' + c.mount + '.';
  return '';
}
function inPoly(x, z, poly){ // even-odd rule, poly = [[x, z], ...]
  var c = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++){
    var a = poly[i], b = poly[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0])*(z - a[1])/(b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// Deposit statistics, a pure function of a deposit { cell, half, data, lost } (see Sim.sprayDeposit). Amounts
// are active ingredient (L), doses are L/ha of active ingredient. A cell belongs to a polygon when its center does.
// Lost material counts as off target. cv_pct is over the target cells, null without target cells or deposit.
function sprayStats(dep, poly, sensitivePoly){
  var c = dep.cell, n = Math.round(2*dep.half/c), perHa = 1e4/(c*c), d = dep.data;
  var inside = 0, outside = 0, peak = 0, sens = 0, nIn = 0, nSens = 0, s1 = 0, s2 = 0;
  for (var iz = 0; iz < n; iz++) for (var ix = 0; ix < n; ix++){
    var a = d[iz*n + ix], x = -dep.half + (ix + 0.5)*c, z = -dep.half + (iz + 0.5)*c;
    if (a > peak) peak = a;
    if (poly && poly.length >= 3 && inPoly(x, z, poly)){ inside += a; nIn++; s1 += a; s2 += a*a; } else outside += a;
    if (sensitivePoly && sensitivePoly.length >= 3 && inPoly(x, z, sensitivePoly)){ sens += a; nSens++; }
  }
  var lost = dep.lost || 0, total = inside + outside + lost, mean = nIn ? s1/nIn : 0;
  return {
    inside_l: inside, outside_l: outside, lost_l: lost,
    offtarget_pct: total > 0 ? 100*(outside + lost)/total : 0,
    cv_pct: mean > 0 ? 100*Math.sqrt(Math.max(0, s2/nIn - mean*mean))/mean : null,
    mean_lha: mean*perHa, peak_lha: peak*perHa,
    sensitive_l: sens, sensitive_lha: nSens ? sens/nSens*perHa : 0
  };
}
// Small seeded random number generator (mulberry32), so spray runs are reproducible.
function mkRng(seed){
  var a = seed >>> 0, imul = Math.imul;
  return function(){ a = (a + 0x6D2B79F5) >>> 0; var t = a; t = imul(t ^ (t >>> 15), t | 1); t ^= t + imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0)/4294967296; };
}

function Sim(){
  this.mode = 'pos'; this.wind = 0; this.windDir = 270; this.avoid = null; this.avoiding = false; this.landAssist = true; this.assisting = false; this.thrCentered = true;
  this.rthAlt = PARAMS.rth.alt; this.battCfg = { warn: PARAMS.batt.warn, low: PARAMS.batt.low, crit: PARAMS.batt.crit, autoRth: true };
  var SP = PARAMS.spray; // spray inputs. Validate sprayCfg with sprayCfgError(), then reset() to fill the tank
  this.sprayCfg = { tankL: SP.tankL, fillL: SP.tankL, flowLmin: SP.flow, cls: SP.cls, mount: SP.mount };
  this.airTempC = 20; this.rhPct = 60; this.stability = 'neutral'; // air temperature (C), relative humidity (%), 'neutral' or 'inversion'
  this.onEvent = function(){}; this.reset();
}
Sim.prototype.reset = function(){
  this.pos = [0, 0, 0]; this.v = [0, 0, 0]; this.q = [0, 0, 0, 1]; this.w = [0, 0, 0];
  this.F = [0, 0, 0, 0]; this.armed = false; this.onGround = true; this.crashed = null;
  this.auto = null; this.autoReason = null; this.rth = null; this.psiSp = 0; this.posSp = null; this.altSp = null; this.mission = null; this.photos = [];
  this.iv = [0, 0, 0]; this.batt = 100; this.t = 0; this.lastTouchdown = null;
  this.amps = 0; this.drainAvg = 0; this.needPct = 0; this.needT = 0; this.battLatch = { warn: false, low: false, crit: false, margin: false };
  // spray state: tank (L of liquid), airborne parcels, deposit grid (allocated on first use), and running totals.
  // sprayed is liquid (L). sprayedAi, deposited, and lost are active ingredient (L).
  this.tank = sprayCfgError(this.sprayCfg) ? 0 : this.sprayCfg.fillL; this.spraying = false;
  this.parcels = []; this.dep = null; this.sprayAcc = 0; this.sprayClock = 0; this.emitClock = 0;
  this.sprayed = 0; this.sprayedAi = 0; this.deposited = 0; this.lost = 0;
  this.rng = mkRng(PARAMS.spray.seed);
};
Sim.prototype.yaw = function(){ var f = qrot(this.q, [0, 0, -1]); return Math.atan2(-f[0], -f[2]); };
// Total mass (kg): the airframe plus the liquid in the tank.
Sim.prototype.mass = function(){ return PARAMS.m + this.tank*PARAMS.spray.rhoLiq/1000; };
// Command set kept deliberately close to a Tello-style text API.
// During an emergency landing (auto === 'critland') only a disarm, a motor kill, or a spray command gets through.
// Spray commands do not touch the flight. sprayOn needs a valid sprayCfg and liquid in the tank. refill fills the
// tank to sprayCfg.fillL and only works landed and disarmed.
Sim.prototype.command = function(c){
  if (this.crashed) return;
  if (c === 'sprayOn' || (c === 'sprayToggle' && !this.spraying)){ if (this.tank > 0 && !sprayCfgError(this.sprayCfg)) this.spraying = true; }
  else if (c === 'sprayOff' || c === 'sprayToggle') this.spraying = false;
  else if (c === 'refill'){ if (this.onGround && !this.armed && !sprayCfgError(this.sprayCfg)) this.tank = this.sprayCfg.fillL; }
  else if (c === 'disarm'){ this.armed = false; this.auto = null; this.mission = null; this.rth = null; }
  else if (c === 'emergency'){ this.armed = false; this.auto = null; this.rth = null; }
  else if (this.auto === 'critland') return;
  else if (c === 'arm'){ if (this.onGround){ this.armed = true; } }
  else if (c === 'takeoff'){ if (this.onGround){ this.armed = true; this.auto = 'takeoff'; this.altSp = 1.2; this.posSp = [this.pos[0], this.pos[2]]; } }
  else if (c === 'land'){ if (!this.onGround){ this.auto = 'land'; this.autoReason = 'pilot'; this.mission = null; this.rth = null; this.posSp = [this.pos[0], this.pos[2]]; } }
  else if (c === 'rth') this.startRth('pilot');
  else if (c === 'cancel_rth') this.cancelRth();
};
// Return to home. Home is the sim origin. Below the RTH altitude the drone climbs to it first, above it the
// drone keeps its height. It then flies straight home, descends, lands, and disarms. The vertical avoidance
// limits still apply, but nothing routes around an obstacle on the way.
Sim.prototype.startRth = function(reason){
  if (this.crashed || this.onGround || !this.armed || this.auto === 'critland') return;
  var R = PARAMS.rth, h = this.pos[1], top = Math.hypot(this.pos[0], this.pos[2]) < R.nearHome ? h : Math.max(h, clamp(this.rthAlt, R.altMin, R.altMax));
  this.mission = null; this.auto = 'rth'; this.autoReason = reason; this.posSp = null; this.altSp = null;
  this.rth = { phase: h < top - R.altTol ? 'climb' : 'cruise', alt: top, hold: [this.pos[0], this.pos[2]], hdg: null };
  this.onEvent('rth');
};
Sim.prototype.cancelRth = function(){
  if (this.auto !== 'rth') return;
  this.auto = null; this.autoReason = null; this.rth = null; this.posSp = null; this.altSp = null; this.onEvent('rth_cancel');
};
Sim.prototype.rthVel = function(){
  var R = PARAMS.rth, r = this.rth, p = this.pos, d = Math.hypot(p[0], p[2]);
  var hold = function(t){ return [clamp(1.2*(t[0] - p[0]), -2, 2), clamp(1.2*(t[1] - p[2]), -2, 2)]; };
  if (r.phase === 'climb'){ if (p[1] < r.alt - R.altTol) return hold(r.hold); r.phase = 'cruise'; }
  if (r.phase === 'cruise'){
    if (d < R.arrive) r.phase = 'descend';
    else { if (d > R.hdgDist) r.hdg = Math.atan2(p[0], p[2]); var sp = Math.min(R.speed, R.kApproach*d + 0.2); return [-p[0]/d*sp, -p[2]/d*sp]; }
  }
  if (r.phase === 'descend' && p[1] < R.landAlt) r.phase = 'land';
  return hold([0, 0]);
};
// Emergency landing in place. The sim controls the descent, the pilot keeps horizontal stick and yaw.
Sim.prototype.startCritLand = function(reason){
  this.mission = null; this.rth = null; this.auto = 'critland'; this.autoReason = reason; this.posSp = null; this.altSp = null;
};
// Battery failsafes. Each level announces itself once. The low level acts once, so a pilot who cancels the
// automatic RTH is not overruled again. The critical level acts whenever the drone is in the air.
Sim.prototype.battCheck = function(){
  if (!this.armed) return;
  var c = this.battCfg, L = this.battLatch, air = !this.onGround, busy = this.auto === 'critland';
  if (!L.warn && this.batt < c.warn){ L.warn = true; this.onEvent('batt_warn'); }
  if (air && !busy){
    var lowNow = !L.low && this.batt < c.low;
    if (lowNow || this.t >= this.needT){ this.needT = this.t + PARAMS.batt.estimateEvery; this.needPct = rthEstimate(this.pos[0], this.pos[2], this.pos[1], this.rthAlt, this.wind, this.windDir, this.mass()/PARAMS.m).pct; }
    var need = this.needPct;
    if (!L.margin && this.auto !== 'rth' && this.batt < need + PARAMS.batt.returnMargin){ L.margin = true; this.onEvent('batt_margin'); }
    if (lowNow){
      L.low = true; this.onEvent('batt_low');
      if (c.autoRth){
        if (need > this.batt){ this.startCritLand('unreachable'); this.onEvent('batt_unreachable'); }
        else this.startRth('battery');
      }
    }
  }
  if (this.batt < c.crit){
    if (!L.crit){ L.crit = true; this.onEvent('batt_crit'); }
    if (air && this.auto !== 'critland') this.startCritLand('critical');
  }
};
// Wind speed is given at 10 m and follows a log profile down to the canopy.
// windDir is the compass direction the wind comes FROM (0 = north = -Z, 90 = east = +X).
// Mission: wps = [{x, y, z, survey}], y is height above ground. A leg ending at a survey
// waypoint triggers a photo every `trig` meters of travel along the leg.
Sim.prototype.startMission = function(wps, speed, trig){
  if (this.crashed || !wps.length || this.auto === 'critland') return;
  this.mission = { wps: wps, idx: 0, speed: speed, trig: trig, from: [this.pos[0], this.pos[2]], shot: null, hdg: null };
  this.photos = []; this.armed = true; this.auto = 'mission'; this.autoReason = null; this.rth = null; this.iv = [0, 0, 0];
};
Sim.prototype.stopMission = function(){ if (this.auto === 'mission'){ this.auto = null; this.mission = null; this.posSp = null; this.altSp = null; } };
Sim.prototype.missionVel = function(dt){
  var M = this.mission, wp = M.wps[M.idx], p = this.pos, v = [0, 0]; // low battery is handled by battCheck, as in manual flight
  var lx = wp.x - M.from[0], lz = wp.z - M.from[1], L = Math.hypot(lx, lz), altOk = Math.abs(wp.y - p[1]) < 2.5, rem = 0;
  if (L > 0.01){
    var tx = lx/L, tz = lz/L, rx = p[0] - M.from[0], rz = p[2] - M.from[1];
    var along = rx*tx + rz*tz, cross = -rx*tz + rz*tx; rem = L - along;
    if (L > 3) M.hdg = Math.atan2(-tx, -tz);
    if (altOk){
      var sp = Math.min(M.speed, 0.7*rem + 0.4), cc = clamp(1.0*cross, -2, 2);
      v = [tx*sp + tz*cc, tz*sp - tx*cc];
      if (wp.survey && along >= 0 && (M.shot === null || along - M.shot >= M.trig)){
        M.shot = along; this.photos.push({ x: p[0], z: p[2], y: p[1], psi: this.yaw() });
      }
    }
  }
  if (altOk && rem < 1.0){
    if (wp.photo && !M.snapped){ M.snapped = true; this.photos.push({ x: p[0], z: p[2], y: p[1], psi: this.yaw() }); }
    if (wp.hold > 0){ M.holdT = (M.holdT || 0) + dt; if (M.holdT < wp.hold) return [clamp(1.2*(wp.x - p[0]), -2, 2), clamp(1.2*(wp.z - p[2]), -2, 2)]; }
    M.holdT = 0; M.snapped = false;
    M.from = [wp.x, wp.z]; M.shot = null; M.idx++;
    if (M.idx >= M.wps.length){ this.mission = null; this.auto = 'land'; this.autoReason = 'mission'; this.posSp = [wp.x, wp.z]; this.onEvent('missiondone'); }
  }
  return v;
};
Sim.prototype.windVec = function(h){
  if (h === undefined) h = this.pos[1];
  var s = this.wind*windProfile(h)*(1 + 0.30*Math.sin(0.7*this.t) + 0.18*Math.sin(1.9*this.t + 1));
  var th = this.windDir*Math.PI/180, dx = -Math.sin(th), dz = Math.cos(th), c = 0.25*s*Math.sin(0.23*this.t);
  if (this.stability === 'inversion'){ // stable air: the wind direction meanders slowly
    var SP = PARAMS.spray; th += SP.invMeander*Math.PI/180*Math.sin(2*Math.PI*this.t/SP.invPeriod); dx = -Math.sin(th); dz = Math.cos(th);
  }
  return [dx*s - dz*c, 0, dz*s + dx*c];
};
// ---- spray parcels ----
// Each parcel is a packet of droplets of one size: position (m), diameter d (m), liquid volume liq (L), and active
// ingredient ai (L, the non-volatile part). Parcels have no inertia. Their velocity is the wind at their height,
// plus the rotor downwash, plus the settling speed, plus a seeded turbulent random walk (u, v, w). Canopy capture is
// out of scope: a parcel deposits on the grid cell where it reaches y = 0.
Sim.prototype.sprayGrid = function(){ var S = PARAMS.spray, n = Math.round(2*S.half/S.cell); if (!this.dep) this.dep = new Float64Array(n*n); return this.dep; };
Sim.prototype.sprayLand = function(x, z, ai){
  var S = PARAMS.spray, n = Math.round(2*S.half/S.cell), ix = Math.floor((x + S.half)/S.cell), iz = Math.floor((z + S.half)/S.cell);
  if (ix < 0 || iz < 0 || ix >= n || iz >= n){ this.lost += ai; return; }
  this.sprayGrid()[iz*n + ix] += ai; this.deposited += ai;
};
// Release vol liters of liquid: one parcel per nozzle and size bin, starting at the nozzle in world coordinates.
// Near the parcel cap the same volume goes into fewer parcels (one per bin at the mean nozzle position), and at
// the cap it merges into the youngest airborne parcel of each bin. No volume is ever dropped.
Sim.prototype.sprayEmit = function(vol){
  var S = PARAMS.spray, bins = sprayClassBins(this.sprayCfg.cls), noz = S.nozzles[this.sprayCfg.mount], nb = bins.length, room = S.maxParcels - this.parcels.length;
  if (!(vol > 0) || !nb || !noz) return;
  var at = noz.map(function(n){ return n; }), self = this;
  if (room < noz.length*nb) at = [[noz.reduce(function(a, n){ return a + n[0]; }, 0)/noz.length, noz.reduce(function(a, n){ return a + n[1]; }, 0)/noz.length]];
  var merge = room < nb;
  at.forEach(function(n){
    var o = qrot(self.q, [n[0], -S.nozzleDrop, n[1]]), x = self.pos[0] + o[0], y = self.pos[1] + o[1], z = self.pos[2] + o[2];
    bins.forEach(function(b, k){
      var liq = vol*b.frac/at.length, ai = liq*S.nonVol;
      self.sprayedAi += ai;
      if (merge){ for (var i = self.parcels.length - 1; i >= 0; i--) if (self.parcels[i].bin === k){ self.parcels[i].liq0 += liq; self.parcels[i].liq += liq; self.parcels[i].ai += ai; return; } }
      self.parcels.push({ x: x, y: y, z: z, d: b.d, d0: b.d, dmin: b.d*Math.cbrt(S.nonVol), liq0: liq, liq: liq, ai: ai, bin: k, u: 0, v: 0, w: 0, vt: dropTerminal(b.d), dvt: b.d, kw: 0, ky: -1, age: 0 });
    });
  });
};
// One parcel update of h seconds: drain the tank and emit, then move, evaporate, and deposit the parcels.
Sim.prototype.sprayUpdate = function(h){
  var S = PARAMS.spray, P = PARAMS, i, cfgOk = !sprayCfgError(this.sprayCfg);
  var emitting = this.spraying && cfgOk && this.tank > 0 && this.armed && !this.onGround && !this.crashed;
  if (emitting){
    var dV = Math.min(this.tank, this.sprayCfg.flowLmin/60*h); this.tank -= dV; if (this.tank < 1e-12){ dV += this.tank; this.tank = 0; }
    this.sprayed += dV; this.sprayAcc += dV; this.emitClock += h;
    if (this.emitClock >= S.binMul.length/S.emitRate - 1e-9){ this.sprayEmit(this.sprayAcc); this.sprayAcc = 0; this.emitClock = 0; }
  }
  if (this.spraying && (this.tank <= 0 || !cfgOk)){ this.spraying = false; if (this.tank <= 0) this.onEvent('spray_empty'); }
  if (this.sprayAcc > 0 && (!emitting || !this.spraying)){ this.sprayEmit(this.sprayAcc); this.sprayAcc = 0; this.emitClock = 0; }
  var ps = this.parcels; if (!ps.length) return;
  // The loop below runs for every parcel, so it uses local aliases instead of global lookups.
  var mexp = Math.exp, msqrt = Math.sqrt, mlog = Math.log, msin = Math.sin, mcos = Math.cos, prof = windProfile, drop = dropTerminal, rng = this.rng, spare = null;
  var gauss = function(){ // standard normal from the seeded generator (Box-Muller)
    if (spare !== null){ var g = spare; spare = null; return g; }
    var r = msqrt(-2*mlog(1 - rng())), a = 6.283185307179586*rng(); spare = r*msin(a); return r*mcos(a);
  };
  // windVec(h) scales with windProfile(h) at a given time, so one call per update gives the wind at every height
  var w10 = this.windVec(10), p10 = prof(10);
  // downwash column: induced speed from the actual thrust, tilted back along the airspeed (wake skew angle)
  var Tact = this.F[0] + this.F[1] + this.F[2] + this.F[3], vi = downwashSpeed(Tact), dp = this.pos, k0 = prof(dp[1])/p10;
  var ax = this.v[0] - w10[0]*k0, az = this.v[2] - w10[2]*k0, va = msqrt(ax*ax + az*az);
  var skew = vi > 1e-6 ? va/vi : 0, bx = va > 1e-6 ? -ax/va : 0, bz = va > 1e-6 ? -az/va : 0;
  var rFoot = P.d*Math.SQRT2 + S.rotorR, nzd = S.nozzleDrop, dwDecay = S.dwDecay, dwSide = S.dwSide, maxAge = S.maxAge; // rFoot: rotor footprint radius around the drone center (m)
  var lam = S.evapK*wetBulbDepression(this.airTempC, this.rhPct)*h; // d^2 loss per update (m^2)
  var sh = S.turbH, sv = S.turbV*(this.stability === 'inversion' ? S.invTurbV : 1);
  var ka = mexp(-h/S.turbT), kb = msqrt(1 - ka*ka), out = 0;
  for (i = 0; i < ps.length; i++){
    var p = ps[i], dw = 0;
    if (vi > 0){
      var dy = dp[1] - p.y;
      if (dy > 0){
        var rx = p.x - dp[0] - bx*dy*skew, rz = p.z - dp[2] - bz*dy*skew, r = msqrt(rx*rx + rz*rz);
        dw = vi*mexp(-(dy > nzd ? dy - nzd : 0)/dwDecay)*(r <= rFoot ? 1 : mexp(-(r - rFoot)/dwSide));
      }
    }
    if (lam > 0 && p.d > p.dmin){ // d^2 law down to the non-volatile residue
      var d2 = p.d*p.d - lam; p.d = d2 > p.dmin*p.dmin ? msqrt(d2) : p.dmin; var f = p.d/p.d0, lq = p.liq0*f*f*f; p.liq = lq > p.ai ? lq : p.ai;
      if (p.dvt - p.d > 0.01*p.dvt){ p.vt = drop(p.d); p.dvt = p.d; }
    }
    p.u = ka*p.u + kb*sh*gauss(); p.v = ka*p.v + kb*sv*gauss(); p.w = ka*p.w + kb*sh*gauss();
    if (p.ky - p.y > 0.01 || p.y - p.ky > 0.01){ p.kw = prof(p.y)/p10; p.ky = p.y; } // wind profile factor, refreshed every 1 cm of height
    var kw = p.kw, vx = w10[0]*kw + p.u, vy = p.v - dw - p.vt, vz = w10[2]*kw + p.w, ny = p.y + vy*h;
    if (ny <= 0){ var fr = p.y > 0 ? p.y/(p.y - ny) : 0; this.sprayLand(p.x + vx*h*fr, p.z + vz*h*fr, p.ai); continue; }
    p.x += vx*h; p.y = ny; p.z += vz*h; p.age += h;
    if (p.age > maxAge){ this.lost += p.ai; continue; }
    ps[out++] = p;
  }
  ps.length = out;
};
// Read-only views for the renderer, the deposit map, and scoring.
Sim.prototype.sprayParcels = function(){ return this.parcels.map(function(p){ return [p.x, p.y, p.z, p.d]; }); };
Sim.prototype.sprayDeposit = function(){ var S = PARAMS.spray; return { cell: S.cell, half: S.half, data: this.sprayGrid(), lost: this.lost }; };
Sim.prototype.sprayStats = function(poly, sensitivePoly){ return sprayStats(this.sprayDeposit(), poly, sensitivePoly); };
Sim.prototype.sprayAirborne = function(){ var a = this.sprayAcc*PARAMS.spray.nonVol; for (var i = 0; i < this.parcels.length; i++) a += this.parcels[i].ai; return a; };
Sim.prototype.step = function(dt, s){
  var P = PARAMS, i; this.t += dt; this.avoiding = false; this.assisting = false;
  // spray parcels run at their own rate (PARAMS.spray.dt), and keep falling after a landing or a crash
  this.sprayClock += dt;
  while (this.sprayClock >= P.spray.dt - 1e-9){ this.sprayClock -= P.spray.dt; if (this.spraying || this.parcels.length || this.sprayAcc > 0) this.sprayUpdate(P.spray.dt); }
  if (this.crashed){ this.F = [0, 0, 0, 0]; return; }
  this.battCheck();
  var st = { thr: s.thr, yaw: s.yaw, pitch: s.pitch, roll: s.roll };
  if (this.auto === 'mission' && Math.hypot(s.roll, s.pitch) > 0.3){ this.stopMission(); this.onEvent('takeover'); }
  if (this.auto === 'rth' && Math.hypot(s.roll, s.pitch) > P.rth.cancelStick) this.cancelRth();
  if (this.auto === 'critland'){ st = { thr: 0, yaw: s.yaw, pitch: s.pitch, roll: s.roll }; }
  else if (this.auto){ st = { thr: 0, yaw: this.auto === 'land' ? 0 : s.yaw, pitch: 0, roll: 0 }; }
  var mode = this.auto ? 'pos' : this.mode;
  var q = this.q, up = qrot(q, [0, 1, 0]), psi = this.yaw();
  // M is the total mass with the tank. The controllers and the force equation use it. The motor limit Fmax and the
  // battery load stay referred to the empty airframe, so a full tank costs thrust margin and drains the battery faster.
  var M = this.mass(), mg = M*P.g, mg0 = P.m*P.g, Fmax = mg0*P.twr/4, Fcmd = [0, 0, 0, 0];

  if (this.armed){
    var idle = this.onGround && this.auto !== 'takeoff' && this.auto !== 'mission' &&
               (mode === 'angle' && !this.thrCentered ? st.thr <= -0.9 : st.thr <= 0.1);
    var T, tau = [0, 0, 0];
    if (idle){
      T = 0.12*mg0; this.iv = [0, 0, 0]; this.psiSp = psi; this.altSp = null; this.posSp = null;
    } else {
      if (this.onGround) this.psiSp = psi;
      var mv = this.auto === 'mission' ? this.missionVel(dt) : (this.auto === 'rth' ? this.rthVel() : null);
      var yawRate = -st.yaw*P.yawRateMax;
      var hdgSp = this.auto === 'mission' && this.mission ? this.mission.hdg : (this.auto === 'rth' ? this.rth.hdg : null);
      if (hdgSp !== null){
        var dpsi = hdgSp - this.psiSp; dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi)); yawRate = clamp(2*dpsi, -1.2, 1.2);
      }
      this.psiSp += yawRate*dt;
      var rollCmd, pitchCmd;
      if (mode === 'pos'){
        var fw = [-Math.sin(psi), -Math.cos(psi)], rt = [Math.cos(psi), -Math.sin(psi)];
        var vsx = 0, vsz = 0;
        if (mv){ this.posSp = null; vsx = mv[0]; vsz = mv[1]; }
        else if (Math.hypot(st.roll, st.pitch) > 0.02){
          this.posSp = null;
          var vf = st.pitch*P.vMax, vs = st.roll*P.vMax;
          if (this.avoid){ // speed limit reaches zero 2 m out, then pushes back gently
            var A = this.avoid, lim = function(r){ return Math.max(-1, (r - 2.0)*0.9); }, f0 = vf, s0 = vs;
            var box = function(v, lo, hi){ if (lo > hi) lo = hi = (lo + hi)/2; return clamp(v, lo, hi); };
            vf = box(vf, -lim(A.b), lim(A.f)); vs = box(vs, -lim(A.l), lim(A.r));
            this.avoiding = vf !== f0 || vs !== s0;
          }
          vsx = fw[0]*vf + rt[0]*vs; vsz = fw[1]*vf + rt[1]*vs;
        } else {
          if (!this.posSp && Math.hypot(this.v[0], this.v[2]) < 0.4) this.posSp = [this.pos[0], this.pos[2]];
          if (this.posSp){
            vsx = clamp(1.6*(this.posSp[0] - this.pos[0]), -2, 2); vsz = clamp(1.6*(this.posSp[1] - this.pos[2]), -2, 2);
          }
        }
        var ex = vsx - this.v[0], ez = vsz - this.v[2];
        this.iv[0] = clamp(this.iv[0] + 1.2*ex*dt, -3, 3); this.iv[2] = clamp(this.iv[2] + 1.2*ez*dt, -3, 3);
        var ax = 2.5*ex + this.iv[0], az = 2.5*ez + this.iv[2];
        var tl = mv ? P.maxTiltAuto : P.maxTiltPos;
        pitchCmd = clamp(Math.atan2(ax*fw[0] + az*fw[1], P.g), -tl, tl);
        rollCmd  = clamp(Math.atan2(ax*rt[0] + az*rt[1], P.g), -tl, tl);
      } else {
        rollCmd = st.roll*P.maxTilt; pitchCmd = st.pitch*P.maxTilt;
      }
      if (this.landAssist && this.pos[1] < 0.8){ // keep it nearly level close to the ground
        rollCmd = clamp(rollCmd, -0.21, 0.21); pitchCmd = clamp(pitchCmd, -0.21, 0.21);
      }
      if (mode === 'angle'){
        if (this.thrCentered) T = mg*(st.thr >= 0 ? 1 + 0.6*st.thr : 1 + st.thr);
        else T = (st.thr + 1)/2*0.8*4*Fmax;
      } else {
        var vzSp;
        if (this.auto === 'mission' && this.mission){ vzSp = clamp(1.2*(this.mission.wps[this.mission.idx].y - this.pos[1]), -2, 3); this.altSp = null; }
        else if (this.auto === 'land' || (this.auto === 'rth' && this.rth.phase === 'land')){ vzSp = this.pos[1] > P.landNearAlt ? -P.landRate : -P.landRateNear; this.altSp = null; }
        else if (this.auto === 'rth'){ vzSp = clamp(P.rth.kAlt*((this.rth.phase === 'descend' ? 0 : this.rth.alt) - this.pos[1]), -P.rth.descend, P.rth.climb); this.altSp = null; }
        else if (this.auto === 'critland'){ vzSp = this.pos[1] > P.batt.landSlowAlt ? -P.batt.landRate : (this.pos[1] > P.landNearAlt ? -P.landRate : -P.landRateNear); this.altSp = null; }
        else if (this.auto === 'takeoff'){ vzSp = clamp(1.5*(this.altSp - this.pos[1]), -1, 1); if (this.pos[1] > this.altSp - 0.1) this.auto = null; }
        else if (Math.abs(st.thr) > 0.05){ vzSp = st.thr*P.vzMax; this.altSp = null; }
        else {
          if (this.altSp === null && Math.abs(this.v[1]) < 0.3) this.altSp = this.pos[1];
          vzSp = this.altSp === null ? 0 : clamp(1.5*(this.altSp - this.pos[1]), -P.vzMax, P.vzMax);
        }
        if (this.avoid && mode === 'pos'){ // vertical avoidance: stop 1.5 m under a surface and 1.2 m over an obstacle
          var AV = this.avoid, capUp = Math.max(-0.5, (AV.up - 1.5)*0.9), capDn = AV.downObs ? -Math.max(-0.5, (AV.down - 1.2)*0.9) : -Infinity;
          if (vzSp > capUp){ vzSp = capUp; this.avoiding = true; this.altSp = null; }
          if (vzSp < capDn){ vzSp = capDn; this.avoiding = true; this.altSp = null; }
        }
        var ey = vzSp - this.v[1];
        this.iv[1] = clamp(this.iv[1] + 1.5*ey*dt, -4, 4);
        T = M*(P.g + 4*ey + this.iv[1])/Math.max(0.5, up[1]);
      }
      if (this.landAssist && !this.onGround){ // landing assist: never sink faster than a curve the motors can still brake from
        var vl = -Math.max(0.35, Math.sqrt(12*Math.max(0, this.pos[1] - 0.3)));
        if (this.v[1] < vl){ T = Math.max(T, M*(P.g + 8*(vl - this.v[1]))/Math.max(0.5, up[1])); this.assisting = true; }
      }
      T = clamp(T, 0, 4*Fmax);
      // attitude loop (quaternion error) then body rate loop
      var qd = qmul(qaxis([0, 1, 0], this.psiSp), qmul(qaxis([1, 0, 0], -pitchCmd), qaxis([0, 0, 1], -rollCmd)));
      var qe = qmul(qconj(q), qd); if (qe[3] < 0) qe = [-qe[0], -qe[1], -qe[2], -qe[3]];
      var wsp = [2*P.kAtt*qe[0], 2*P.kAttYaw*qe[1] + yawRate, 2*P.kAtt*qe[2]];
      if (!this.onGround){
        tau[0] = P.I[0]*P.kRate*(wsp[0] - this.w[0]);
        tau[1] = clamp(P.I[1]*P.kRateYaw*(wsp[1] - this.w[1]), -P.tauYawMax, P.tauYawMax);
        tau[2] = P.I[2]*P.kRate*(wsp[2] - this.w[2]);
      }
    }
    for (i = 0; i < 4; i++){
      var mt = MOTORS[i];
      Fcmd[i] = clamp(T/4 - mt[1]*tau[0]/(4*P.d) + mt[0]*tau[2]/(4*P.d) - mt[2]*tau[1]/(4*P.kq), 0.02*Fmax, Fmax);
    }
  }
  // motors, forces and torques actually produced
  var Tact = 0, ta = [0, 0, 0], k = Math.min(1, dt/P.tauM);
  for (i = 0; i < 4; i++){
    this.F[i] += (Fcmd[i] - this.F[i])*k; var Fi = this.F[i], m2 = MOTORS[i];
    Tact += Fi; ta[0] -= m2[1]*P.d*Fi; ta[2] += m2[0]*P.d*Fi; ta[1] -= m2[2]*P.kq*Fi;
  }
  var load = this.armed ? battLoad(Tact/mg0) : 0, drain = 100*load/P.batterySeconds; // percent per second, load from thrust over EMPTY weight
  this.batt = Math.max(0, this.batt - drain*dt); this.amps = P.batt.hoverCurrent*load;
  this.drainAvg += (drain - this.drainAvg)*Math.min(1, dt/P.batt.tauDraw);
  // Last resort. battCheck has normally started the emergency landing long before 0 percent. This only acts when
  // battCfg.crit was set below the limits that battCfgError enforces, so an empty battery always lands the drone.
  if (this.batt <= 0 && this.armed && !this.onGround && this.auto !== 'critland') this.startCritLand('critical');

  var wv = this.windVec(), vr = [this.v[0] - wv[0], this.v[1], this.v[2] - wv[2]];
  var sp = Math.hypot(vr[0], vr[1], vr[2]), kd = (P.kd1 + P.kd2*sp)*(P.m/M); // drag is a force: kd is per empty mass
  var a = [up[0]*Tact/M - kd*vr[0], up[1]*Tact/M - P.g - kd*vr[1], up[2]*Tact/M - kd*vr[2]];

  if (this.onGround){
    if (a[1] <= 0 || !this.armed){
      this.v = [0, 0, 0]; this.w = [0, 0, 0]; this.q = qaxis([0, 1, 0], psi); this.pos[1] = 0; return;
    }
    this.onGround = false; this.onEvent('liftoff');
  }
  var w = this.w, I = P.I;
  var gx = w[1]*I[2]*w[2] - w[2]*I[1]*w[1], gy = w[2]*I[0]*w[0] - w[0]*I[2]*w[2], gz = w[0]*I[1]*w[1] - w[1]*I[0]*w[0];
  w[0] += ((ta[0] - gx)/I[0] - 0.5*w[0])*dt; w[1] += ((ta[1] - gy)/I[1] - 0.5*w[1])*dt; w[2] += ((ta[2] - gz)/I[2] - 0.5*w[2])*dt;
  var nq = qmul(q, [w[0]*dt/2, w[1]*dt/2, w[2]*dt/2, 1]), n = Math.hypot(nq[0], nq[1], nq[2], nq[3]);
  this.q = [nq[0]/n, nq[1]/n, nq[2]/n, nq[3]/n];
  for (i = 0; i < 3; i++){ this.v[i] += a[i]*dt; this.pos[i] += this.v[i]*dt; }

  if (this.pos[1] <= 0){
    var vi = -this.v[1], hs = Math.hypot(this.v[0], this.v[2]), tilt = Math.acos(clamp(up[1], -1, 1));
    this.pos[1] = 0;
    if (vi > 2.2) this.crash('Hard impact at ' + vi.toFixed(1) + ' m/s. Aim for under 1 m/s at touchdown.');
    else if (tilt > 0.6) this.crash('Touched down tilted ' + Math.round(tilt*57.3) + ' deg. Level out before landing.');
    else if (hs > 2.5 && !this.landAssist) this.crash('Touched down while moving sideways at ' + hs.toFixed(1) + ' m/s.');
    else {
      this.onGround = true; this.lastTouchdown = { speed: vi, x: this.pos[0], z: this.pos[2] };
      if (this.auto === 'land' || this.auto === 'rth' || this.auto === 'critland'){ this.armed = false; this.auto = null; this.rth = null; }
      this.onEvent('touchdown');
    }
  }
};
Sim.prototype.crash = function(msg){ this.crashed = msg; this.armed = false; this.auto = null; this.v = [0, 0, 0]; this.w = [0, 0, 0]; this.onEvent('crash'); };
// Telemetry schema. A future hardware link must produce the same fields.
Sim.prototype.telemetry = function(){
  var f = qrot(this.q, [0, 0, -1]), r = qrot(this.q, [1, 0, 0]), u = qrot(this.q, [0, 1, 0]);
  var hdg = (Math.atan2(f[0], -f[2])*180/Math.PI + 360) % 360;
  var B = PARAMS.batt, c = this.battCfg, volts = battVolts(this.batt, this.amps);
  return {
    pitch: Math.asin(clamp(f[1], -1, 1)), roll: Math.atan2(-r[1], u[1]), heading_deg: hdg,
    altitude_m: this.pos[1], vz: this.v[1], ground_speed: Math.hypot(this.v[0], this.v[2]),
    x: this.pos[0], z: this.pos[2], battery: this.batt, armed: this.armed, on_ground: this.onGround,
    voltage: volts, cell_voltage: volts/B.cells, current_a: this.amps,
    minutes_left: this.armed && this.drainAvg > 1e-6 ? this.batt/this.drainAvg/60 : null, // at the present draw
    battery_state: this.batt < c.crit ? 'critical' : (this.batt < c.low ? 'low' : (this.batt < c.warn ? 'warning' : 'ok')),
    rth_needed_pct: this.onGround ? 0 : this.needPct, // battery needed to get home, refreshed in flight
    auto: this.auto, auto_reason: this.auto ? this.autoReason : null, rth_phase: this.rth ? this.rth.phase : null,
    motors: this.F.map(function(x){ return x/(PARAMS.m*PARAMS.g*PARAMS.twr/4); }), // share of the fixed empty-airframe maximum
    // spray: liquid volumes in L, active ingredient (ai) in L. sprayed_ai_l = deposited_l + airborne_l + lost_l
    spraying: this.spraying, tank_l: this.tank, mass_kg: this.mass(), sprayed_l: this.sprayed,
    sprayed_ai_l: this.sprayedAi + this.sprayAcc*PARAMS.spray.nonVol, deposited_l: this.deposited, airborne_l: this.sprayAirborne(),
    lost_l: this.lost, parcels: this.parcels.length
  };
};
/*SIM-END*/

