// ---------- environment: sun, cloud, wind ----------
var env = { el: 50, cloud: 0.1 }, sunDir = new THREE.Vector3();
function applyEnv(){
  var e = env.el*Math.PI/180, se = Math.sin(e), ce = Math.cos(e);
  sunDir.set(-0.64*ce, se, 0.77*ce); sun.position.copy(sunDir).multiplyScalar(60);
  sun.intensity = 0.95*Math.pow(1 - env.cloud, 1.3)*Math.pow(se, 0.4);
  hemi.intensity = (0.45 + 0.5*Math.sqrt(se))*(1 - 0.3*env.cloud);
  var sky = new THREE.Color(0x9fcbe6).lerp(new THREE.Color(0xb4bcc0), env.cloud).multiplyScalar(0.55 + 0.45*Math.sqrt(se));
  scene.background = sky; scene.fog.color.copy(sky);
}
$('windDir').addEventListener('input', function(e){ sim.windDir = +e.target.value; $('windDirOut').textContent = e.target.value + ' deg'; });
$('sunEl').addEventListener('input', function(e){ env.el = +e.target.value; $('sunElOut').textContent = e.target.value + ' deg'; applyEnv(); });
$('cloud').addEventListener('input', function(e){ env.cloud = e.target.value/100; $('cloudOut').textContent = e.target.value + ' %'; applyEnv(); });
$('landAssist').addEventListener('change', function(e){ sim.landAssist = e.target.checked; });
$('pips').addEventListener('change', function(e){ document.body.classList.toggle('nopip', !e.target.checked); });

