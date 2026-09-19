// --- scale from two points (for screenshots with no georeference) ---
$('calibStart').addEventListener('click', function(){ if (!fieldRect){ geoNote('Load a field image first, then set its scale.'); return; } setHomePick(false); calib = { pts: [] }; $('calibBox').hidden = true; $('calibMsg').textContent = 'Click the first of two points whose true distance you know.'; });
$('calibApply').addEventListener('click', function(){
  var d = parseFloat($('calibDist').value), m = Math.hypot(calib.pts[1][0] - calib.pts[0][0], calib.pts[1][1] - calib.pts[0][1]);
  if (!(d > 0) || !(m > 0)) return; $('fieldW').value = Math.round(fieldRect.w*d/m*10)/10; calib = null; $('calibBox').hidden = true; $('calibMsg').textContent = ''; geo = null; placeField(); geoNote();
});

// --- field image: becomes the ground north of the home point and the map background ---
function imgToCanvas(img){ var k = Math.min(1, 4096/Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width*k); c.height = Math.round(img.height*k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; }
function placeField(hMeters, keepPlan){
  if (!fieldCanvas) return;
  var w = num('fieldW', 5, 5000, 200), h = hMeters || w*fieldCanvas.height/fieldCanvas.width;
  if (fieldPlane){ scene.remove(fieldPlane); fieldPlane.geometry.dispose(); fieldPlane.material.map.dispose(); }
  var tex = new THREE.CanvasTexture(fieldCanvas); tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  fieldPlane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
  fieldPlane.rotation.x = -Math.PI/2; fieldPlane.position.set(0, 0.03, -(h/2 + 6)); scene.add(fieldPlane);
  fieldRect = { w: w, h: h, cx: 0, cz: -(h/2 + 6) }; setHomePick(false); fieldMode = true; scenery.visible = false; drillObjs.visible = false;
  scene.fog.near = 400; scene.fog.far = 2200; $('fieldRemove').hidden = false; if (!keepPlan){ poly = []; route = []; } track = []; startDrill('free'); fitView(); computePlan();
}
// bounds = {n, s, e, w} in degrees places the image at true scale and sets the home point 6 m south of its south edge
function useImage(canvas, bounds){
  fieldCanvas = canvas;
  if (bounds){ var g0 = mkGeo((bounds.n + bounds.s)/2, (bounds.e + bounds.w)/2); geo = mkGeo(bounds.s - 6/g0.mLat, (bounds.e + bounds.w)/2);
    $('fieldW').value = Math.round((bounds.e - bounds.w)*g0.mLon*10)/10; placeField((bounds.n - bounds.s)*g0.mLat); }
  else { geo = null; placeField(); }
  geoNote();
}
function removeField(){
  if (fieldPlane){ scene.remove(fieldPlane); fieldPlane = null; } fieldCanvas = null; fieldRect = null; fieldMode = false; scenery.visible = true; drillObjs.visible = true;
  scene.fog.near = 60; scene.fog.far = 160; $('fieldRemove').hidden = true; $('fieldFile').value = ''; poly = []; route = []; track = []; geo = null; calib = null; setHomePick(false); fitView(); computePlan(); geoNote();
}
$('fieldW').addEventListener('change', function(){ if (fieldCanvas){ geo = null; placeField(); geoNote(); } });
$('fieldRemove').addEventListener('click', removeField);

