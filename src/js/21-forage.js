// ---------- forage sward: tall fescue bunches with white clover patches ----------
var TILE_M = 4, MASK_N = 128, cloverMask = null;
function forageTexture(){
  var S = 1024, c = document.createElement('canvas'); c.width = c.height = S; var g = c.getContext('2d');
  var mc = document.createElement('canvas'); mc.width = mc.height = MASK_N; var mg = mc.getContext('2d');
  mg.fillStyle = '#000'; mg.fillRect(0, 0, MASK_N, MASK_N);
  var seed = 11; function rnd(){ seed = (seed*16807) % 2147483647; return seed/2147483647; }
  function wrap(x, y, m, fn){ for (var ox = -S; ox <= S; ox += S) for (var oy = -S; oy <= S; oy += S){
    var X = x + ox, Y = y + oy; if (X > -m && X < S + m && Y > -m && Y < S + m) fn(X, Y); } }
  g.fillStyle = '#56733a'; g.fillRect(0, 0, S, S);
  var i, j;
  for (i = 0; i < 260; i++){ // thatch and soil mottling
    (function(x, y, r, dark){ wrap(x, y, r, function(X, Y){ g.fillStyle = dark ? 'rgba(60,52,30,0.10)' : 'rgba(150,170,90,0.08)'; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill(); }); })(rnd()*S, rnd()*S, 15 + rnd()*45, rnd() < 0.5);
  }
  var patches = []; for (i = 0; i < 9; i++) patches.push([rnd()*S, rnd()*S, 90 + rnd()*115]);
  function inClover(x, y){ for (var k = 0; k < patches.length; k++){ var dx = Math.abs(x - patches[k][0]), dy = Math.abs(y - patches[k][1]);
    dx = Math.min(dx, S - dx); dy = Math.min(dy, S - dy); if (Math.hypot(dx, dy) < patches[k][2]*0.9) return true; } return false; }
  function bunch(x, y, n, len){
    for (var b = 0; b < n; b++){
      var a = rnd()*6.283, L = len*(0.5 + rnd()*0.6), hue = 92 + rnd()*30, lt = 20 + rnd()*14;
      var ex = Math.cos(a)*L, ey = Math.sin(a)*L, bx = -ey*0.25*(rnd() - 0.5), by = ex*0.25*(rnd() - 0.5), w = 1.4 + rnd()*1.4;
      (function(ex, ey, bx, by, w, col){ wrap(x, y, 60, function(X, Y){ g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(X, Y);
        g.quadraticCurveTo(X + ex*0.5 + bx*4, Y + ey*0.5 + by*4, X + ex, Y + ey); g.stroke(); }); })(ex, ey, bx, by, w, 'hsl(' + hue + ',38%,' + lt + '%)');
    }
  }
  g.lineCap = 'round';
  for (i = 0; i < 1500; i++){ var fx = rnd()*S, fy = rnd()*S; if (inClover(fx, fy) && rnd() < 0.75) continue; bunch(fx, fy, 9 + (rnd()*8 | 0), 44); }
  patches.forEach(function(pt){
    for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++){
      var mx = pt[0]*MASK_N/S + ox*MASK_N, my = pt[1]*MASK_N/S + oy*MASK_N, mr = pt[2]*MASK_N/S;
      var gr = mg.createRadialGradient(mx, my, mr*0.55, mx, my, mr); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      mg.fillStyle = gr; mg.beginPath(); mg.arc(mx, my, mr, 0, 7); mg.fill();
    }
    var n = pt[2]*pt[2]*0.020;
    for (j = 0; j < n; j++){
      var rr = pt[2]*Math.pow(rnd(), 0.6), aa = rnd()*6.283, lx = pt[0] + Math.cos(aa)*rr, ly = pt[1] + Math.sin(aa)*rr;
      var rot = rnd()*6.283, sz = 4 + rnd()*2.5, col = 'hsl(' + (104 + rnd()*14) + ',48%,' + (30 + rnd()*12) + '%)', flower = rnd() < 0.07;
      (function(rot, sz, col, flower){ wrap(lx, ly, 20, function(X, Y){
        g.fillStyle = col;
        for (var l = 0; l < 3; l++){ var la = rot + l*2.094; g.beginPath(); g.ellipse(X + Math.cos(la)*sz, Y + Math.sin(la)*sz, sz, sz*0.8, la, 0, 6.3); g.fill(); }
        g.strokeStyle = 'rgba(215,235,190,0.55)'; g.lineWidth = 1;
        for (l = 0; l < 3; l++){ la = rot + l*2.094; g.beginPath(); g.arc(X + Math.cos(la)*sz*0.6, Y + Math.sin(la)*sz*0.6, sz*0.55, la - 0.9, la + 0.9); g.stroke(); }
        if (flower){ g.fillStyle = '#f4f1e6'; g.beginPath(); g.arc(X, Y, sz*1.05, 0, 7); g.fill(); g.fillStyle = 'rgba(214,170,170,0.7)'; g.beginPath(); g.arc(X, Y + sz*0.3, sz*0.45, 0, 7); g.fill(); }
      }); })(rot, sz, col, flower);
    }
  });
  for (i = 0; i < 180; i++) bunch(rnd()*S, rnd()*S, 5, 36); // a few fescue tillers growing through the clover
  cloverMask = mg.getImageData(0, 0, MASK_N, MASK_N).data;
  var tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(400/TILE_M, 400/TILE_M);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); return tex;
}
function cloverAt(x, z){ // 0..1 from the truth mask, using the same mapping as the ground texture
  var u = x/TILE_M, v = -z/TILE_M; u -= Math.floor(u); v -= Math.floor(v);
  var px = Math.min(MASK_N - 1, u*MASK_N | 0), py = Math.min(MASK_N - 1, (1 - v)*MASK_N | 0);
  return cloverMask[(py*MASK_N + px)*4]/255;
}
var ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ map: forageTexture() }));
ground.rotation.x = -Math.PI/2; scene.add(ground);
var g5 = new THREE.GridHelper(60, 12, 0xe9edf0, 0xe9edf0); g5.position.y = 0.01; g5.material.transparent = true; g5.material.opacity = 0.22; scenery.add(g5);
// standing fescue tufts give the canopy some height near the flying area
(function(){
  var N = 5000, tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 1, 5), new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
  var d = new THREE.Object3D(), col = new THREE.Color(), seed = 5, n = 0, tries = 0;
  function rnd(){ seed = (seed*16807) % 2147483647; return seed/2147483647; }
  while (n < N && tries++ < N*6){
    var x = -28 + rnd()*56, z = -34 + rnd()*46;
    if (Math.hypot(x, z) < 1.1 || Math.hypot(x - 4, z + 7) < 1.3 || Math.hypot(x, z - 7) < 0.8 || cloverAt(x, z) > 0.3) continue;
    var h = 0.16 + rnd()*0.3; d.position.set(x, h/2, z); d.scale.set(0.8 + rnd()*0.8, h, 0.8 + rnd()*0.8); d.rotation.y = rnd()*3; d.updateMatrix();
    tuft.setMatrixAt(n, d.matrix); tuft.setColorAt(n, col.setHSL(0.26 + rnd()*0.06, 0.4, 0.2 + rnd()*0.1)); n++;
  }
  tuft.count = n; scenery.add(tuft);
})();
