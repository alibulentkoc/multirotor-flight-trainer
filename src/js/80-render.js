// ---------- camera and render ----------
var look = new THREE.Vector3(0, 0.5, 0), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
function resize(){ var w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize);
function render(dt){
  var p = sim.pos, q = sim.q;
  droneHolder.position.set(p[0], p[1], p[2]); droneHolder.quaternion.set(q[0], q[1], q[2], q[3]);
  for (var i = 0; i < 4; i++) props[i].rotation.y += MOTORS[i][2]*Math.sqrt(Math.max(0, sim.F[i]))*38*dt;
  var sk = p[1]/sunDir.y; shadow.position.set(p[0] - sunDir.x*sk, 0.02, p[2] - sunDir.z*sk); var sc = 1 + p[1]*0.12; shadow.scale.set(sc, sc, sc);
  shadow.material.opacity = clamp(0.4 - p[1]*0.03, 0.08, 0.4)*(1 - 0.8*env.cloud);
  var wv = sim.windVec(4), ws = Math.hypot(wv[0], wv[2]);
  sock.rotation.y = -Math.atan2(wv[2], wv[0] || 1e-6); sockCone.parent.rotation.z = -clamp(1.2 - ws*0.2, 0, 1.2);
  var tgt = tmpV.set(p[0], p[1] + 0.15, p[2]), kk = 1 - Math.exp(-dt*8);
  if (cam === 'los'){
    camera.position.set(0, 1.6, 7); look.lerp(tgt, kk); camera.up.set(0, 1, 0); camera.lookAt(look);
    var dist = camera.position.distanceTo(tgt); camera.fov = clamp(2*Math.atan(3.2/dist)*57.3, 14, 52);
  } else if (cam === 'chase'){
    var psi = sim.yaw(); var want = new THREE.Vector3(p[0] + Math.sin(psi)*3.2, p[1] + 1.3, p[2] + Math.cos(psi)*3.2);
    camera.position.lerp(want, 1 - Math.exp(-dt*4)); look.lerp(tgt, kk); camera.up.set(0, 1, 0); camera.lookAt(look); camera.fov = 55;
  } else {
    camera.position.set(p[0], p[1] + 0.2, p[2]); tmpQ.set(q[0], q[1], q[2], q[3]); camera.quaternion.copy(tmpQ); camera.rotateX(0.12); camera.fov = 80; look.copy(tgt);
  }
  camera.updateProjectionMatrix();
  renderer.setScissorTest(false); renderer.setViewport(0, 0, view.clientWidth, view.clientHeight); renderer.render(scene, camera);
  if (!document.body.classList.contains('nopip')){
    var vis = drone.visible; drone.visible = false; renderPip($('pipF'), false); renderPip($('pipD'), true); drone.visible = vis;
  }
}

