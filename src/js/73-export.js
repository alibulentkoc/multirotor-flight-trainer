// --- export ---
function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function exportKML(){
  if (!geo) return null; var P = plan, c = function(x, z, y){ var l = xz2ll(x, z); return l[1].toFixed(7) + ',' + l[0].toFixed(7) + ',' + (y || 0).toFixed(1); };
  var k = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Flight plan</name>\n';
  k += '<Placemark><name>Home</name><Point><coordinates>' + c(0, 0, 0) + '</coordinates></Point></Placemark>\n';
  if (poly.length >= 3) k += '<Placemark><name>Survey boundary</name><Polygon><outerBoundaryIs><LinearRing><coordinates>' + poly.concat([poly[0]]).map(function(p){ return c(p[0], p[1], 0); }).join(' ') + '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>\n';
  if (P.wps.length) k += '<Placemark><name>' + esc(P.mode === 'area' ? 'Flight lines' : 'Waypoint route') + '</name><description>' + esc('Altitude above ground. Speed ' + P.speed + ' m/s.') + '</description><LineString><altitudeMode>relativeToGround</altitudeMode><coordinates>' + P.wps.map(function(q){ return c(q.x, q.z, q.y); }).join(' ') + '</coordinates></LineString></Placemark>\n';
  P.wps.forEach(function(q, i){ k += '<Placemark><name>WP' + (i + 1) + '</name><Point><altitudeMode>relativeToGround</altitudeMode><coordinates>' + c(q.x, q.z, q.y) + '</coordinates></Point></Placemark>\n'; });
  return k + '</Document></kml>\n';
}
function exportCSV(){
  var P = plan, head = geo ? 'waypoint,latitude,longitude,altitude_agl_m,speed_ms,action' : 'waypoint,x_east_m,y_north_m,altitude_agl_m,speed_ms,action';
  return head + '\n' + P.wps.map(function(q, i){ var a = q.survey ? 'photo_every_' + P.trig.toFixed(1) + '_m_on_this_leg' : (q.photo ? 'photo' : (q.hold ? 'hover_' + q.hold + '_s' : 'none'));
    var xy = geo ? xz2ll(q.x, q.z).map(function(v){ return v.toFixed(7); }) : [q.x.toFixed(2), (-q.z).toFixed(2)];
    return [i + 1, xy[0], xy[1], q.y, P.speed, a].join(','); }).join('\n') + '\n';
}
function offer(name, text){
  var ta = $('exportText'); ta.hidden = false; ta.value = text; $('exportMsg').textContent = 'The text is below. Copy it, or use the save prompt if one appears.';
  if (window.claude && window.claude.use){
    var hosted = /\.kml$/.test(name) ? name + '.txt' : name;
    window.claude.use('downloads').then(function(d){ if (!d) return; return d.save({ filename: hosted, data: text }).then(function(){ $('exportMsg').textContent = hosted === name ? 'Saved.' : 'Saved as ' + hosted + '. Rename it to end in .kml before opening it in Google Earth.'; }); }).catch(function(){});
  } else {
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e){}
  }
}
$('expKML').addEventListener('click', function(){ if (!plan || !plan.ok){ $('exportMsg').textContent = 'Make a plan first.'; return; } var k = exportKML(); if (!k){ $('exportMsg').textContent = 'KML needs latitude and longitude. Import a KML, KMZ, GeoTIFF, GeoJSON, or an image with a degree-based world file first. CSV export works without it.'; return; } offer('flight-plan.kml', k); });
$('expCSV').addEventListener('click', function(){ if (!plan || !plan.ok){ $('exportMsg').textContent = 'Make a plan first.'; return; } offer('flight-plan.csv', exportCSV()); });
setPlanMode('area'); geoNote();

