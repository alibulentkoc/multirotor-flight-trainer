// ---------- obstacles ----------
var obstacles = [];
function obst(geo, color, x, y, z){ var o = mesh(geo, color); o.position.set(x, y, z); scenery.add(o); obstacles.push(o); return o; }
obst(new THREE.BoxGeometry(5, 3.2, 4), 0x8c3b2e, -11, 1.6, -6);
var roof = obst(new THREE.ConeGeometry(3.9, 1.6, 4), 0x59636a, -11, 4.0, -6); roof.rotation.y = Math.PI/4; roof.scale.set(1, 1, 0.82);
[[9, 0.6, -2.5], [9, 0.6, -3.9], [9, 1.65, -3.2]].forEach(function(b){ var o = obst(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 18), 0xc9b26b, b[0], b[1], b[2]); o.rotation.z = Math.PI/2; });
obst(new THREE.BoxGeometry(4, 3, 0.3), 0xdfe4e6, -3.6, 1.5, -13);
obst(new THREE.BoxGeometry(4, 3, 0.3), 0xdfe4e6, 3.6, 1.5, -13);
obst(new THREE.BoxGeometry(0.35, 0.5, 0.32), 0xd9500a, -1.75, 2.6, -13); obst(new THREE.BoxGeometry(0.35, 0.5, 0.32), 0xd9500a, 1.75, 2.6, -13);
obst(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 8), 0x5b4632, -6, 1.2, -11);
obst(new THREE.ConeGeometry(1.7, 3.6, 9), 0x3f6a3a, -6, 4.0, -11);
scene.updateMatrixWorld(true);
var colliders = obstacles.map(function(o){
  var b = new THREE.Box3().setFromObject(o).expandByScalar(0.28);
  if (o.geometry.type === 'ConeGeometry'){ var gp = o.geometry.parameters; b.cone = { x: o.position.x, z: o.position.z, y0: o.position.y - gp.height/2, y1: o.position.y + gp.height/2, r: gp.radius*Math.min(o.scale.x, o.scale.z)*(gp.radialSegments <= 4 ? 0.85 : 1) }; }
  return b;
});
function hitsCollider(c, p){
  if (!c.containsPoint(p)) return false; if (!c.cone) return true;
  var k = c.cone, t = clamp((p.y - k.y0)/(k.y1 - k.y0), 0, 1); return Math.hypot(p.x - k.x, p.z - k.z) < k.r*(1 - t) + 0.28;
}
var pad = mesh(new THREE.CircleGeometry(0.7, 40), 0xe9edf0); pad.rotation.x = -Math.PI/2; pad.position.y = 0.012; scene.add(pad);
var padRing = mesh(new THREE.RingGeometry(0.45, 0.55, 40), 0xd9500a); padRing.rotation.x = -Math.PI/2; padRing.position.y = 0.014; scene.add(padRing);
// pilot figure, visible from the chase camera
var pilot = new THREE.Group();
var pb = mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.4, 12), 0x2b3a42); pb.position.y = 0.7; pilot.add(pb);
var ph = mesh(new THREE.SphereGeometry(0.16, 12, 10), 0xd8b89a); ph.position.y = 1.58; pilot.add(ph);
pilot.position.set(0, 0, 7); scene.add(pilot);
// tree line and corner poles give depth cues
for (var ti = 0; ti < 26; ti++){
  var tx = -60 + ti*4.8 + (ti*37 % 5) - 2, th = 5 + (ti*53 % 4);
  var trunk = mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 6), 0x5b4632); trunk.position.set(tx, 1, -42 - (ti % 3)*3); scenery.add(trunk);
  var crown = mesh(new THREE.ConeGeometry(2.2, th, 8), 0x3f6a3a); crown.position.set(tx, 2 + th/2, trunk.position.z); scenery.add(crown);
}
[[-15, -20], [15, -20], [-15, 5], [15, 5]].forEach(function(p){
  var pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), 0xf3f6f7); pole.position.set(p[0], 1.5, p[1]); scenery.add(pole);
  var flag = mesh(new THREE.BoxGeometry(0.6, 0.35, 0.02), 0xd9500a); flag.position.set(p[0] + 0.32, 2.8, p[1]); scenery.add(flag);
});
// windsock
var sockPole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 4, 8), 0xf3f6f7); sockPole.position.set(-9, 2, -12); scene.add(sockPole);
var sock = new THREE.Group(); sock.position.set(-9, 4, -12); scene.add(sock);
var sockCone = mesh(new THREE.CylinderGeometry(0.12, 0.3, 1.6, 12, 1, true), 0xff7a1a, { side: THREE.DoubleSide });
sockCone.rotation.z = -Math.PI/2; sockCone.position.x = 0.8; sock.add(sockCone);

// drone model, built from primitives. Orange = front, dark = rear.
var drone = new THREE.Group(), props = [];
var body = mesh(new THREE.BoxGeometry(0.16, 0.07, 0.30), 0x2b3a42); drone.add(body);
var nose = mesh(new THREE.BoxGeometry(0.10, 0.05, 0.06), 0xd9500a); nose.position.set(0, 0, -0.17); drone.add(nose);
var tail = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), 0xf3f6f7); tail.position.set(0, 0.01, 0.155); drone.add(tail);
MOTORS.forEach(function(mt, i){
  var x = mt[0]*PARAMS.d, z = mt[1]*PARAMS.d, len = Math.hypot(x, z);
  var arm = mesh(new THREE.BoxGeometry(0.03, 0.02, len), mt[1] < 0 ? 0xd9500a : 0x2b3a42);
  arm.position.set(x/2, 0, z/2); arm.rotation.y = Math.atan2(x, z); drone.add(arm);
  var mot = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 12), 0x8a979d); mot.position.set(x, 0.03, z); drone.add(mot);
  var leg = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), 0x2b3a42); leg.position.set(x*0.8, -0.055, z*0.8); drone.add(leg);
  var prop = new THREE.Group(); prop.position.set(x, 0.062, z);
  var blade = mesh(new THREE.BoxGeometry(0.24, 0.004, 0.022), mt[1] < 0 ? 0xff7a1a : 0x13242d); prop.add(blade);
  var disc = mesh(new THREE.CircleGeometry(0.12, 24), 0x13242d, { transparent: true, opacity: 0.12, side: THREE.DoubleSide });
  disc.rotation.x = -Math.PI/2; prop.add(disc); drone.add(prop); props.push(prop);
});
var droneHolder = new THREE.Group(); drone.position.y = 0.1; drone.scale.setScalar(1.6); droneHolder.add(drone); scene.add(droneHolder);
var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
shadow.rotation.x = -Math.PI/2; scene.add(shadow);

