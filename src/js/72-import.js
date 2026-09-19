// --- import: images, KML, KMZ, GeoJSON, CSV waypoints, world files, GeoTIFF ---
function readAs(file, how){ return new Promise(function(res, rej){ var fr = new FileReader(); fr.onload = function(){ res(fr.result); }; fr.onerror = rej; fr[how](file); }); }
function loadImg(src){ return new Promise(function(res, rej){ var im = new Image(); im.onload = function(){ res(im); }; im.onerror = function(){ rej(new Error('That image could not be read.')); }; im.src = src; }); }
var scriptP = {};
function loadScript(url){ return scriptP[url] || (scriptP[url] = new Promise(function(res, rej){ var s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = function(){ rej(new Error('Could not load a helper library. This file type needs an internet connection.')); }; document.head.appendChild(s); })); }
function coordList(txt){ return txt.trim().split(/\s+/).map(function(t){ var c = t.split(',').map(Number); return { lon: c[0], lat: c[1], alt: c[2] || 0 }; }).filter(function(c){ return isFinite(c.lat) && isFinite(c.lon); }); }
function parseKML(text){
  var doc = new DOMParser().parseFromString(text, 'text/xml'), out = { poly: null, route: null, overlay: null };
  var tag = function(el, n){ var r = el.getElementsByTagName(n); return r.length ? r[0] : null; }, tx = function(el, n){ var t = tag(el, n); return t ? t.textContent.trim() : ''; };
  var pg = tag(doc, 'Polygon'); if (pg){ var ob = tag(pg, 'outerBoundaryIs') || pg; out.poly = coordList(tx(ob, 'coordinates')); }
  var ls = tag(doc, 'LineString'); if (ls) out.route = coordList(tx(ls, 'coordinates'));
  if (!out.route){ var pts = []; [].forEach.call(doc.getElementsByTagName('Point'), function(p){ var c = coordList(tx(p, 'coordinates')); if (c.length) pts.push(c[0]); }); if (pts.length >= 2) out.route = pts; }
  var go = tag(doc, 'GroundOverlay'); if (go){ var bx = tag(go, 'LatLonBox'); if (bx) out.overlay = { href: tx(go, 'href'), n: +tx(bx, 'north'), s: +tx(bx, 'south'), e: +tx(bx, 'east'), w: +tx(bx, 'west'), rot: +tx(bx, 'rotation') || 0 }; }
  return out;
}
function parseGeoJSON(text){
  var j = JSON.parse(text), out = { poly: null, route: null, overlay: null }, pts = [];
  var feats = j.type === 'FeatureCollection' ? j.features : (j.type === 'Feature' ? [j] : [{ geometry: j }]);
  var conv = function(a){ return a.map(function(c){ return { lon: c[0], lat: c[1], alt: c[2] || 0 }; }); };
  feats.forEach(function(f){ var g = f.geometry; if (!g) return;
    if (g.type === 'Polygon' && !out.poly) out.poly = conv(g.coordinates[0]);
    if (g.type === 'MultiPolygon' && !out.poly) out.poly = conv(g.coordinates[0][0]);
    if (g.type === 'LineString' && !out.route) out.route = conv(g.coordinates);
    if (g.type === 'Point') pts.push(conv([g.coordinates])[0]); });
  if (!out.route && pts.length >= 2) out.route = pts; return out;
}
function parseCSV(text){
  var rows = text.trim().split(/\r?\n/).map(function(l){ return l.split(/[,;\t]/).map(function(c){ return c.trim().replace(/^"|"$/g, ''); }); }), iLat = 0, iLon = 1, iAlt = 2, start = 0;
  if (isNaN(parseFloat(rows[0][0])) || isNaN(parseFloat(rows[0][1]))){ start = 1; iLat = iLon = iAlt = -1;
    rows[0].forEach(function(h, i){ h = h.toLowerCase(); if (iLat < 0 && /^lat/.test(h)) iLat = i; else if (iLon < 0 && /^(lon|lng)/.test(h)) iLon = i; else if (iAlt < 0 && /^(alt|height)/.test(h)) iAlt = i; }); }
  if (iLat < 0 || iLon < 0) throw new Error('The CSV needs latitude and longitude columns.');
  var r = []; for (var i = start; i < rows.length; i++){ var la = parseFloat(rows[i][iLat]), lo = parseFloat(rows[i][iLon]); if (isFinite(la) && isFinite(lo)) r.push({ lat: la, lon: lo, alt: iAlt >= 0 ? parseFloat(rows[i][iAlt]) || 0 : 0 }); }
  return { poly: null, route: r.length ? r : null, overlay: null };
}
function readGeoTIFF(buf){
  return loadScript('https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js').then(function(){ return GeoTIFF.fromArrayBuffer(buf); }).then(function(t){ return t.getImage(); }).then(function(im){
    var W = im.getWidth(), H = im.getHeight(), k = Math.min(1, 2048/Math.max(W, H)), w = Math.max(1, Math.round(W*k)), h = Math.max(1, Math.round(H*k));
    return im.readRGB({ width: w, height: h, interleave: true }).then(function(rgb){
      var c = document.createElement('canvas'); c.width = w; c.height = h; var ctx = c.getContext('2d'), id = ctx.createImageData(w, h), n = w*h, step = rgb.length/n;
      for (var i = 0; i < n; i++){ id.data[i*4] = rgb[i*step]; id.data[i*4 + 1] = rgb[i*step + 1]; id.data[i*4 + 2] = rgb[i*step + 2]; id.data[i*4 + 3] = 255; }
      ctx.putImageData(id, 0, 0);
      var bb = im.getBoundingBox(), keys = im.getGeoKeys() || {}, pcs = keys.ProjectedCSTypeGeoKey, bounds = null, widthM = null, zone = 0, south = false;
      if (pcs >= 32601 && pcs <= 32660) zone = pcs - 32600; else if (pcs >= 32701 && pcs <= 32760){ zone = pcs - 32700; south = true; } else if (pcs >= 26901 && pcs <= 26923) zone = pcs - 26900;
      if (zone){ var sw = utm2ll(bb[0], bb[1], zone, south), ne = utm2ll(bb[2], bb[3], zone, south); bounds = { s: sw[0], w: sw[1], n: ne[0], e: ne[1] }; }
      else if (Math.abs(bb[0]) <= 180 && Math.abs(bb[2]) <= 180 && Math.abs(bb[1]) <= 90 && Math.abs(bb[3]) <= 90) bounds = { w: bb[0], s: bb[1], e: bb[2], n: bb[3] };
      else widthM = Math.abs(bb[2] - bb[0]);
      return { canvas: c, bounds: bounds, widthM: widthM };
    });
  });
}
function applyVectors(vec){ // vec coordinates are lat/lon; make sure a home point exists, then convert to local meters
  if (!vec.poly && !vec.route) return;
  if (!geo){ var src = vec.route && vec.route.length ? vec.route : vec.poly;
    if (vec.route && vec.route.length){ var g0 = mkGeo(src[0].lat, src[0].lon); geo = mkGeo(src[0].lat - 5/g0.mLat, src[0].lon); }
    else { var s = Infinity, lo = 0; src.forEach(function(c){ s = Math.min(s, c.lat); lo += c.lon/src.length; }); var g1 = mkGeo(s, lo); geo = mkGeo(s - 6/g1.mLat, lo); } }
  var defAlt = planNum('pAlt', 'alt');
  if (vec.poly && vec.poly.length >= 3){ var pp = vec.poly.map(function(c){ return ll2xz(c.lat, c.lon); }); var a = pp[0], b = pp[pp.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01) pp.pop(); poly = pp; setPlanMode('area'); }
  if (vec.route && vec.route.length){ route = vec.route.slice(0, 200).map(function(c){ var q = ll2xz(c.lat, c.lon); return { x: q[0], z: q[1], alt: c.alt > 1 ? clamp(Math.round(c.alt), 2, 120) : defAlt, act: 'none' }; }); if (!vec.poly) setPlanMode('route'); }
}
function handleFiles(files){
  var imgFile = null, world = null, vec = { poly: null, route: null, overlay: null }, jobs = [], tiff = null, zipImg = null;
  var merge = function(o){ vec.poly = vec.poly || o.poly; vec.route = vec.route || o.route; vec.overlay = vec.overlay || o.overlay; };
  [].forEach.call(files, function(f){
    var ext = (f.name.split('.').pop() || '').toLowerCase();
    if (ext === 'kml') jobs.push(readAs(f, 'readAsText').then(function(t){ merge(parseKML(t)); }));
    else if (ext === 'kmz') jobs.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js').then(function(){ return readAs(f, 'readAsArrayBuffer'); }).then(function(b){ return JSZip.loadAsync(b); }).then(function(zip){
      var k = zip.file(/\.kml$/i)[0]; if (!k) throw new Error('No KML found inside the KMZ.');
      return k.async('text').then(function(t){ var o = parseKML(t); merge(o);
        if (o.overlay && o.overlay.href){ var zf = zip.file(o.overlay.href) || zip.file(o.overlay.href.replace(/^\.?\//, '')); if (zf) return zf.async('base64').then(function(b64){ var e2 = o.overlay.href.split('.').pop().toLowerCase(); zipImg = 'data:image/' + (e2 === 'jpg' ? 'jpeg' : e2) + ';base64,' + b64; }); } }); }));
    else if (ext === 'geojson' || ext === 'json') jobs.push(readAs(f, 'readAsText').then(function(t){ merge(parseGeoJSON(t)); }));
    else if (ext === 'csv' || ext === 'txt') jobs.push(readAs(f, 'readAsText').then(function(t){ merge(parseCSV(t)); }));
    else if (/^(jgw|pgw|tfw|wld|jpgw|pngw)$/.test(ext)) jobs.push(readAs(f, 'readAsText').then(function(t){ world = t.trim().split(/\s+/).map(Number); }));
    else if (ext === 'tif' || ext === 'tiff') jobs.push(readAs(f, 'readAsArrayBuffer').then(readGeoTIFF).then(function(r){ tiff = r; }));
    else if (/^image\//.test(f.type)) imgFile = f;
  });
  geoNote('Reading...');
  return Promise.all(jobs).then(function(){ return zipImg ? loadImg(zipImg) : (imgFile ? readAs(imgFile, 'readAsDataURL').then(loadImg) : null); }).then(function(img){
    var note = '';
    if (tiff){ if (tiff.bounds) useImage(tiff.canvas, tiff.bounds); else { if (tiff.widthM) $('fieldW').value = Math.round(tiff.widthM); useImage(tiff.canvas, null); note = ' The GeoTIFF coordinate system was not recognised, so only its size was used.'; } }
    else if (img){
      var b = null;
      if (vec.overlay){ b = vec.overlay; if (Math.abs(b.rot) > 0.5) note = ' The overlay is rotated ' + b.rot.toFixed(1) + ' deg in the KML. Rotation is ignored here, so re-export it north-up for an exact fit.'; }
      else if (world && world.length >= 6){
        if (Math.abs(world[0]) < 0.01){ var wx = world[4] - world[0]/2, ny = world[5] - world[3]/2; b = { w: wx, n: ny, e: wx + world[0]*img.width, s: ny + world[3]*img.height }; }
        else { $('fieldW').value = Math.round(Math.abs(world[0])*img.width*10)/10; note = ' World file is in projected meters: true scale applied, but no latitude and longitude.'; }
      }
      useImage(imgToCanvas(img), b);
    }
    else if (vec.overlay && !zipImg) note = ' The KML points to an image overlay (' + vec.overlay.href + '). Select that image together with the KML to load it.';
    applyVectors(vec); if (!$('plan').hidden || vec.poly || vec.route) { if ($('plan').hidden) togglePlan(); }
    fitView(); computePlan(); geoNote(); if (note) $('geoStatus').textContent += note;
    if (!img && !tiff && !vec.poly && !vec.route && !note) geoNote('Nothing usable was found in that file.');
  }).catch(function(err){ geoNote('Import failed: ' + (err && err.message ? err.message : 'unreadable file') + ''); });
}
$('fieldFile').addEventListener('change', function(e){ if (e.target.files.length) handleFiles(e.target.files); });
window.addEventListener('paste', function(e){
  var items = (e.clipboardData && e.clipboardData.items) || [];
  for (var i = 0; i < items.length; i++) if (items[i].type.indexOf('image') === 0){ if ($('plan').hidden) togglePlan(); handleFiles([items[i].getAsFile()]); e.preventDefault(); break; }
});
view.addEventListener('dragover', function(e){ e.preventDefault(); });
view.addEventListener('drop', function(e){ e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length){ if ($('plan').hidden) togglePlan(); handleFiles(e.dataTransfer.files); } });

