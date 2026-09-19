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
  vMax: 4.0, vzMax: 1.5,         // position hold speed limits (m/s)
  batterySeconds: 600
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

function Sim(){ this.mode = 'pos'; this.wind = 0; this.windDir = 270; this.avoid = null; this.avoiding = false; this.landAssist = true; this.assisting = false; this.thrCentered = true; this.onEvent = function(){}; this.reset(); }
Sim.prototype.reset = function(){
  this.pos = [0, 0, 0]; this.v = [0, 0, 0]; this.q = [0, 0, 0, 1]; this.w = [0, 0, 0];
  this.F = [0, 0, 0, 0]; this.armed = false; this.onGround = true; this.crashed = null;
  this.auto = null; this.psiSp = 0; this.posSp = null; this.altSp = null; this.mission = null; this.photos = [];
  this.iv = [0, 0, 0]; this.batt = 100; this.t = 0; this.lastTouchdown = null;
};
Sim.prototype.yaw = function(){ var f = qrot(this.q, [0, 0, -1]); return Math.atan2(-f[0], -f[2]); };
// Command set kept deliberately close to a Tello-style text API.
Sim.prototype.command = function(c){
  if (this.crashed) return;
  if (c === 'arm'){ if (this.onGround){ this.armed = true; } }
  else if (c === 'disarm'){ this.armed = false; this.auto = null; this.mission = null; }
  else if (c === 'takeoff'){ if (this.onGround){ this.armed = true; this.auto = 'takeoff'; this.altSp = 1.2; this.posSp = [this.pos[0], this.pos[2]]; } }
  else if (c === 'land'){ if (!this.onGround){ this.auto = 'land'; this.posSp = [this.pos[0], this.pos[2]]; } }
  else if (c === 'emergency'){ this.armed = false; this.auto = null; }
};
// Wind speed is given at 10 m and follows a log profile down to the canopy.
// windDir is the compass direction the wind comes FROM (0 = north = -Z, 90 = east = +X).
// Mission: wps = [{x, y, z, survey}], y is height above ground. A leg ending at a survey
// waypoint triggers a photo every `trig` meters of travel along the leg.
Sim.prototype.startMission = function(wps, speed, trig){
  if (this.crashed || !wps.length) return;
  this.mission = { wps: wps, idx: 0, speed: speed, trig: trig, from: [this.pos[0], this.pos[2]], shot: null, hdg: null, rth: false };
  this.photos = []; this.armed = true; this.auto = 'mission'; this.iv = [0, 0, 0];
};
Sim.prototype.stopMission = function(){ if (this.auto === 'mission'){ this.auto = null; this.mission = null; this.posSp = null; this.altSp = null; } };
Sim.prototype.missionVel = function(dt){
  var M = this.mission, wp = M.wps[M.idx], p = this.pos, v = [0, 0];
  if (this.batt < 20 && !M.rth && M.idx < M.wps.length - 1){ M.rth = true; M.idx = M.wps.length - 1; M.from = [p[0], p[2]]; M.shot = null; wp = M.wps[M.idx]; this.onEvent('rth'); }
  var lx = wp.x - M.from[0], lz = wp.z - M.from[1], L = Math.hypot(lx, lz), altOk = Math.abs(wp.y - p[1]) < 2.5, rem = 0;
  if (L > 0.01){
    var tx = lx/L, tz = lz/L, rx = p[0] - M.from[0], rz = p[2] - M.from[1];
    var along = rx*tx + rz*tz, cross = -rx*tz + rz*tx; rem = L - along;
    if (L > 3) M.hdg = Math.atan2(-tx, -tz);
    if (altOk){
      var sp = Math.min(M.speed, 0.7*rem + 0.4), cc = clamp(1.0*cross, -2, 2);
      v = [tx*sp + tz*cc, tz*sp - tx*cc];
      if (wp.survey && !M.rth && along >= 0 && (M.shot === null || along - M.shot >= M.trig)){
        M.shot = along; this.photos.push({ x: p[0], z: p[2], y: p[1], psi: this.yaw() });
      }
    }
  }
  if (altOk && rem < 1.0){
    if (wp.photo && !M.snapped && !M.rth){ M.snapped = true; this.photos.push({ x: p[0], z: p[2], y: p[1], psi: this.yaw() }); }
    if (wp.hold > 0 && !M.rth){ M.holdT = (M.holdT || 0) + dt; if (M.holdT < wp.hold) return [clamp(1.2*(wp.x - p[0]), -2, 2), clamp(1.2*(wp.z - p[2]), -2, 2)]; }
    M.holdT = 0; M.snapped = false;
    M.from = [wp.x, wp.z]; M.shot = null; M.idx++;
    if (M.idx >= M.wps.length){ this.mission = null; this.auto = 'land'; this.posSp = [wp.x, wp.z]; this.onEvent('missiondone'); }
  }
  return v;
};
Sim.prototype.windVec = function(h){
  if (h === undefined) h = this.pos[1];
  var prof = clamp(Math.log((Math.max(0, h) + 0.1)/0.03)/Math.log(10/0.03), 0.15, 1.3);
  var s = this.wind*prof*(1 + 0.30*Math.sin(0.7*this.t) + 0.18*Math.sin(1.9*this.t + 1));
  var th = this.windDir*Math.PI/180, dx = -Math.sin(th), dz = Math.cos(th), c = 0.25*s*Math.sin(0.23*this.t);
  return [dx*s - dz*c, 0, dz*s + dx*c];
};
Sim.prototype.step = function(dt, s){
  var P = PARAMS, i; this.t += dt; this.avoiding = false; this.assisting = false;
  if (this.crashed){ this.F = [0, 0, 0, 0]; return; }
  var st = { thr: s.thr, yaw: s.yaw, pitch: s.pitch, roll: s.roll };
  if (this.auto === 'mission' && Math.hypot(s.roll, s.pitch) > 0.3){ this.stopMission(); this.onEvent('takeover'); }
  if (this.auto){ st = { thr: 0, yaw: this.auto === 'land' ? 0 : s.yaw, pitch: 0, roll: 0 }; }
  var mode = this.auto ? 'pos' : this.mode;
  var q = this.q, up = qrot(q, [0, 1, 0]), psi = this.yaw();
  var mg = P.m*P.g, Fmax = mg*P.twr/4, Fcmd = [0, 0, 0, 0];

  if (this.armed){
    var idle = this.onGround && this.auto !== 'takeoff' && this.auto !== 'mission' &&
               (mode === 'angle' && !this.thrCentered ? st.thr <= -0.9 : st.thr <= 0.1);
    var T, tau = [0, 0, 0];
    if (idle){
      T = 0.12*mg; this.iv = [0, 0, 0]; this.psiSp = psi; this.altSp = null; this.posSp = null;
    } else {
      if (this.onGround) this.psiSp = psi;
      var mv = this.auto === 'mission' ? this.missionVel(dt) : null;
      var yawRate = -st.yaw*P.yawRateMax;
      if (this.auto === 'mission' && this.mission.hdg !== null){
        var dpsi = this.mission.hdg - this.psiSp; dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi)); yawRate = clamp(2*dpsi, -1.2, 1.2);
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
        var tl = mv ? 0.5 : P.maxTiltPos;
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
        else if (this.auto === 'land'){ vzSp = this.pos[1] > 0.6 ? -0.6 : -0.3; this.altSp = null; }
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
        T = P.m*(P.g + 4*ey + this.iv[1])/Math.max(0.5, up[1]);
      }
      if (this.landAssist && !this.onGround){ // landing assist: never sink faster than a curve the motors can still brake from
        var vl = -Math.max(0.35, Math.sqrt(12*Math.max(0, this.pos[1] - 0.3)));
        if (this.v[1] < vl){ T = Math.max(T, P.m*(P.g + 8*(vl - this.v[1]))/Math.max(0.5, up[1])); this.assisting = true; }
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
  if (this.armed) this.batt = Math.max(0, this.batt - 100*dt*(0.1 + 0.9*Math.pow(Tact/mg, 1.5))/P.batterySeconds);
  if (this.batt <= 0 && !this.onGround && this.auto !== 'land') this.command('land');

  var wv = this.windVec(), vr = [this.v[0] - wv[0], this.v[1], this.v[2] - wv[2]];
  var sp = Math.hypot(vr[0], vr[1], vr[2]), kd = P.kd1 + P.kd2*sp;
  var a = [up[0]*Tact/P.m - kd*vr[0], up[1]*Tact/P.m - P.g - kd*vr[1], up[2]*Tact/P.m - kd*vr[2]];

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
      if (this.auto === 'land'){ this.armed = false; this.auto = null; }
      this.onEvent('touchdown');
    }
  }
};
Sim.prototype.crash = function(msg){ this.crashed = msg; this.armed = false; this.auto = null; this.v = [0, 0, 0]; this.w = [0, 0, 0]; this.onEvent('crash'); };
// Telemetry schema. A future hardware link must produce the same fields.
Sim.prototype.telemetry = function(){
  var f = qrot(this.q, [0, 0, -1]), r = qrot(this.q, [1, 0, 0]), u = qrot(this.q, [0, 1, 0]);
  var hdg = (Math.atan2(f[0], -f[2])*180/Math.PI + 360) % 360;
  return {
    pitch: Math.asin(clamp(f[1], -1, 1)), roll: Math.atan2(-r[1], u[1]), heading_deg: hdg,
    altitude_m: this.pos[1], vz: this.v[1], ground_speed: Math.hypot(this.v[0], this.v[2]),
    x: this.pos[0], z: this.pos[2], battery: this.batt, armed: this.armed, on_ground: this.onGround,
    motors: this.F.map(function(x){ return x/(PARAMS.m*PARAMS.g*PARAMS.twr/4); })
  };
};
/*SIM-END*/

