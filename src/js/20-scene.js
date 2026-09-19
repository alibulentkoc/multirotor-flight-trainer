// ---------- scene ----------
var view = $('view');
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.domElement.className = 'gl';
view.insertBefore(renderer.domElement, view.firstChild);
var scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd9e6);
scene.fog = new THREE.Fog(0xbfd9e6, 60, 160);
var camera = new THREE.PerspectiveCamera(50, 1, 0.05, 2500);
var scenery = new THREE.Group(); scene.add(scenery);
var hemi = new THREE.HemisphereLight(0xffffff, 0x6b7f55, 0.9); scene.add(hemi);
var sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(-20, 40, 15); scene.add(sun);

function mesh(geo, color, opts){
  var m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial(Object.assign({ color: color }, opts || {}))); return m;
}
