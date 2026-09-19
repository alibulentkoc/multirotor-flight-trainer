// ---------- drills ----------
var H_ALT = 1.5;
var DRILLS = {
  free:   { name: 'Free flight', brief: 'No task. Practice anything you like.' },
  hover:  { name: 'Hover box', brief: 'Take off and hold inside the box for 15 s, tail toward you.' },
  nosein: { name: 'Nose-in hover', brief: 'Hold inside the box for 15 s with the nose pointing at you. Roll and pitch feel reversed.' },
  square: { name: 'Square circuit', brief: 'Fly through the four markers in order. Keep the tail toward you and hold 1.5 m.' },
  land:   { name: 'Precision landing', brief: 'Fly to the far target and land as close to its center as you can.' }
};
var WPS = [[-3, H_ALT, -2], [-3, H_ALT, -8], [3, H_ALT, -8], [3, H_ALT, -2]];
var LAND_T = [4, -7];
var drill = { id: 'free', phase: 'ready', t: 0, hold: 0, errSum: 0, errT: 0, idx: 0, altErr: 0, hdgErr: 0, maxAlt: 0 };
var drillObjs = new THREE.Group(); scene.add(drillObjs);
var boxMat, wpMeshes = [];
function buildDrill(){
  while (drillObjs.children.length) drillObjs.remove(drillObjs.children[0]);
  wpMeshes = [];
  if (drill.id === 'hover' || drill.id === 'nosein'){
    boxMat = new THREE.LineBasicMaterial({ color: 0xd9500a });
    var box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.2, 1.2, 1.2)), boxMat);
    box.position.set(0, H_ALT, 0); drillObjs.add(box);
  }
  if (drill.id === 'square'){
    WPS.forEach(function(p){
      var s = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshBasicMaterial({ color: 0x8a979d, transparent: true, opacity: 0.3 }));
      s.position.set(p[0], p[1], p[2]); drillObjs.add(s); wpMeshes.push(s);
      var post = mesh(new THREE.CylinderGeometry(0.03, 0.03, p[1], 6), 0xf3f6f7); post.position.set(p[0], p[1]/2, p[2]); drillObjs.add(post);
    });
  }
  if (drill.id === 'land'){
    [[1.0, 0xf3f6f7], [0.5, 0xd9500a], [0.25, 0xf3f6f7]].forEach(function(r, i){
      var c = mesh(new THREE.CircleGeometry(r[0], 40), r[1]); c.rotation.x = -Math.PI/2; c.position.set(LAND_T[0], 0.012 + i*0.002, LAND_T[1]); drillObjs.add(c);
    });
  }
}
function startDrill(id){
  if (fieldMode) id = 'free';
  drill = { id: id, phase: 'ready', t: 0, hold: 0, errSum: 0, errT: 0, idx: 0, altErr: 0, hdgErr: 0, maxAlt: 0 };
  sim.reset(); buildDrill(); hideNotice(); renderDrillButtons();
}
function angDiff(a, b){ var d = (a - b + 540) % 360 - 180; return Math.abs(d); }
function finish(score, detail){
  drill.phase = 'done'; score = Math.round(clamp(score, 0, 100));
  var log = store.get('uavtrainer.log.v1', []);
  log.unshift({ d: drill.id, m: sim.mode, s: score, t: +drill.t.toFixed(1), w: sim.wind, at: new Date().toISOString().slice(0, 16).replace('T', ' ') });
  store.set('uavtrainer.log.v1', log.slice(0, 40)); sessionLog = log.slice(0, 40);
  showNotice('pass', DRILLS[drill.id].name + ': ' + score + ' / 100', detail + ' Press R to fly it again.');
  renderLog(); renderDrillButtons();
}
function drillStep(dt){
  if (drill.id === 'free' || drill.phase === 'done' || drill.phase === 'failed') return;
  var p = sim.pos; if (drill.phase === 'ready'){ if (p[1] > 0.3){ drill.phase = 'run'; } else return; }
  drill.t += dt; drill.maxAlt = Math.max(drill.maxAlt, p[1]);
  var tel = sim.telemetry();
  if (drill.id === 'hover' || drill.id === 'nosein'){
    var dx = p[0], dy = p[1] - H_ALT, dz = p[2];
    var hdgOk = angDiff(tel.heading_deg, drill.id === 'nosein' ? 180 : 0) < 25;
    var inside = Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6 && Math.abs(dz) < 0.6 && hdgOk;
    if (inside) drill.hold += dt;
    if (drill.hold > 0){ drill.errSum += Math.hypot(dx, dy, dz)*dt; drill.errT += dt; }
    boxMat.color.setHex(inside ? 0x1d7a4c : 0xd9500a);
    if (drill.hold >= 15){
      var me = drill.errSum/drill.errT;
      finish(100 - 110*me - 1.5*(drill.errT - 15), 'Mean error ' + me.toFixed(2) + ' m. Took ' + drill.errT.toFixed(1) + ' s to bank 15 s inside.');
    }
  } else if (drill.id === 'square'){
    drill.altErr += Math.abs(p[1] - H_ALT)*dt; drill.hdgErr += angDiff(tel.heading_deg, 0)*dt;
    var wp = WPS[drill.idx];
    if (Math.hypot(p[0] - wp[0], p[1] - wp[1], p[2] - wp[2]) < 0.8) drill.idx++;
    wpMeshes.forEach(function(m, i){ m.material.color.setHex(i < drill.idx ? 0x1d7a4c : (i === drill.idx ? 0xd9500a : 0x8a979d)); m.material.opacity = i === drill.idx ? 0.5 : 0.25; });
    if (drill.idx >= 4){
      var ma = drill.altErr/drill.t, mh = drill.hdgErr/drill.t;
      finish(100 - Math.max(0, drill.t - 25) - 60*ma - 0.6*mh, 'Time ' + drill.t.toFixed(1) + ' s. Mean altitude error ' + ma.toFixed(2) + ' m, mean heading error ' + mh.toFixed(0) + ' deg.');
    }
  }
}
sim.onEvent = function(ev){
  if (ev === 'crash'){
    if (drill.id !== 'free' && drill.phase !== 'done') drill.phase = 'failed';
    showNotice('fail', 'Crashed', sim.crashed + ' Press R to reset.');
  }
  if (ev === 'touchdown' && drill.id === 'land' && drill.phase === 'run' && drill.maxAlt > 0.8){
    var td = sim.lastTouchdown, dist = Math.hypot(td.x - LAND_T[0], td.z - LAND_T[1]);
    finish(dist > 1.5 ? 0 : 100 - 70*dist - 20*Math.max(0, td.speed - 0.5), 'Landed ' + dist.toFixed(2) + ' m from center at ' + td.speed.toFixed(1) + ' m/s.');
  }
};

