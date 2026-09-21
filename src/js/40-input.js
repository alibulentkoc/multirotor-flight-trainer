// ---------- input ----------
var keys = {}, kb = { thr: 0, yaw: 0, pitch: 0, roll: 0 }, touch = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
var sticks = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
var padMap = store.get('uavtrainer.pad.v1', { thr: [1, true], yaw: [0, false], pitch: [3, true], roll: [2, false] });
var CAMS = ['los', 'chase', 'fpv'], CAMNAMES = { los: 'pilot', chase: 'chase', fpv: 'onboard' };
function expo(x){ return x*(0.55 + 0.45*x*x); }
function dead(x){ return Math.abs(x) < 0.06 ? 0 : (x - Math.sign(x)*0.06)/0.94; }
window.addEventListener('keydown', function(e){
  if (e.target.tagName === 'SELECT' || (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox')) return;
  if (e.target.tagName === 'INPUT') { if (e.code !== 'Space' && e.code.indexOf('Arrow') !== 0) return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0){ e.preventDefault(); if (document.activeElement) document.activeElement.blur(); }
  if (e.repeat){ return; }
  keys[e.code] = true;
  if (e.code === 'Space') sim.command(sim.armed ? 'disarm' : 'arm');
  if (e.code === 'KeyT') sim.command('takeoff');
  if (e.code === 'KeyL') sim.command('land');
  if (e.code === 'KeyH') toggleRth();
  if (e.code === 'KeyR') startDrill(drill.id);
  if (e.code === 'KeyP') togglePlan();
  if (e.code === 'KeyC') setCam(CAMS[(CAMS.indexOf(cam) + 1) % 3]);
  if (e.code === 'Digit1') setMode('pos'); if (e.code === 'Digit2') setMode('alt'); if (e.code === 'Digit3') setMode('angle');
});
window.addEventListener('keyup', function(e){ keys[e.code] = false; });
window.addEventListener('blur', function(){ keys = {}; });
function slew(cur, target, dt){ var rate = target === 0 ? 7 : 4.5, d = target - cur, s = rate*dt; return Math.abs(d) <= s ? target : cur + Math.sign(d)*s; }
function readInputs(dt){
  var amt = (keys.ShiftLeft || keys.ShiftRight) ? 1 : 0.7;
  kb.thr = slew(kb.thr, ((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0))*amt, dt);
  kb.yaw = slew(kb.yaw, ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0))*amt, dt);
  kb.pitch = slew(kb.pitch, ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0))*amt, dt);
  kb.roll = slew(kb.roll, ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0))*amt, dt);
  var gp = { thr: 0, yaw: 0, pitch: 0, roll: 0 }, pad = null;
  var pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (var i = 0; i < pads.length; i++){ if (pads[i] && pads[i].connected){ pad = pads[i]; break; } }
  if (pad){
    ['thr', 'yaw', 'pitch', 'roll'].forEach(function(ch){
      var raw = pad.axes[padMap[ch][0]] || 0; if (padMap[ch][1]) raw = -raw;
      gp[ch] = (ch === 'thr' && !sim.thrCentered) ? raw : expo(dead(raw));
    });
  }
  if (pad) padActionsTick({ buttons: [].map.call(pad.buttons, function(b){ return b.pressed || b.value > 0.5; }), axes: [].slice.call(pad.axes) }); else { actState = null; assigning = null; }
  updatePadUI(pad);
  ['thr', 'yaw', 'pitch', 'roll'].forEach(function(ch){ sticks[ch] = clamp(kb[ch] + gp[ch] + expo(touch[ch]), -1, 1); });
}
function bindStick(el, chX, chY){
  var knob = el.querySelector('.knob'), active = false;
  function set(e){
    var r = el.getBoundingClientRect(), R = r.width/2;
    var x = (e.clientX - r.left - R)/(R*0.7), y = -(e.clientY - r.top - R)/(R*0.7);
    var n = Math.hypot(x, y); if (n > 1){ x /= n; y /= n; }
    touch[chX] = x; touch[chY] = y;
  }
  el.addEventListener('pointerdown', function(e){ active = true; el.setPointerCapture(e.pointerId); set(e); e.preventDefault(); });
  el.addEventListener('pointermove', function(e){ if (active) set(e); });
  function up(){ active = false; touch[chX] = 0; touch[chY] = 0; }
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  return function(){ var R = el.clientWidth/2, k = knob.offsetWidth/2; knob.style.left = (R - k + sticks[chX]*R*0.7) + 'px'; knob.style.top = (R - k - sticks[chY]*R*0.7) + 'px'; };
}
var drawL = bindStick($('stickL'), 'yaw', 'thr'), drawR = bindStick($('stickR'), 'roll', 'pitch');

// controller mapping table
var padBuilt = false, padBars = {};
function buildPadUI(pad){
  var t = $('padMap'), names = { thr: 'Throttle', yaw: 'Yaw', pitch: 'Pitch', roll: 'Roll' };
  t.innerHTML = '<tr><th>Channel</th><th>Axis</th><th>Invert</th><th>Live</th></tr>';
  Object.keys(names).forEach(function(ch){
    var tr = document.createElement('tr'), opts = '';
    for (var a = 0; a < Math.max(4, pad.axes.length); a++) opts += '<option value="' + a + '"' + (a === padMap[ch][0] ? ' selected' : '') + '>' + a + '</option>';
    tr.innerHTML = '<td>' + names[ch] + '</td><td><select>' + opts + '</select></td><td><input type="checkbox"' + (padMap[ch][1] ? ' checked' : '') + '></td><td><div class="bar"><i></i></div></td>';
    tr.querySelector('select').addEventListener('change', function(e){ padMap[ch][0] = +e.target.value; store.set('uavtrainer.pad.v1', padMap); });
    tr.querySelector('input').addEventListener('change', function(e){ padMap[ch][1] = e.target.checked; store.set('uavtrainer.pad.v1', padMap); });
    padBars[ch] = tr.querySelector('i'); t.appendChild(tr);
  });
  $('padStatus').textContent = 'Connected: ' + pad.id.slice(0, 60) + '. Move each stick and check that the bar follows. Up and right should fill the bar.';
  buildActionsUI(); padBuilt = true;
}
function updatePadUI(pad){
  if (!pad){ if (padBuilt){ padBuilt = false; $('padMap').innerHTML = ''; $('padActions').innerHTML = ''; $('assignMsg').textContent = ''; actRows = {}; $('padStatus').textContent = 'Controller disconnected.'; } return; }
  if (!padBuilt) buildPadUI(pad);
  if (!$('padBox').open) return;
  Object.keys(padBars).forEach(function(ch){ var raw = pad.axes[padMap[ch][0]] || 0; if (padMap[ch][1]) raw = -raw; padBars[ch].style.width = ((raw + 1)*50).toFixed(0) + '%'; });
  updateActionsUI();
}
// switches and buttons assigned to actions. The decisions are made by actionStep in 41-actions.js.
if (!padMap.actions) padMap.actions = {};
var actState = null, assigning = null, actRows = {};
function stickAxes(){ return ['thr', 'yaw', 'pitch', 'roll'].map(function(ch){ return padMap[ch][0]; }); }
function savePad(){ store.set('uavtrainer.pad.v1', padMap); }
function runAction(c){
  if (c === 'cam') setCam(CAMS[(CAMS.indexOf(cam) + 1) % 3]);
  else if (c.indexOf('mode:') === 0) setMode(c.slice(5));
  else sim.command(c);
}
function padActionsTick(inp){
  if (assigning){ // nothing fires while an input is being picked
    if (!assigning.base) assigning.base = inp;
    var src = detectSource(assigning.base, inp, stickAxes(), { button: assigning.def.button });
    if (src){ padMap.actions[assigning.def.id] = src; savePad(); $('assignMsg').textContent = assigning.def.name + ' is now on ' + srcName(src) + '.'; assigning = null; actState = null; buildActionsUI(); }
    return;
  }
  var r = actionStep(padMap.actions, actState, inp, { armed: sim.armed, rthActive: sim.auto === 'rth' }); actState = r.state;
  r.cmds.forEach(runAction);
}
function srcName(src){ return src.kind === 'button' ? 'button ' + src.index : 'axis ' + src.index + (src.dir < 0 ? ' (reversed)' : ''); }
function buildActionsUI(){
  var t = $('padActions'); actRows = {};
  t.innerHTML = '<tr><th>Action</th><th>Input</th><th>Type</th><th>Live</th><th></th></tr>';
  ACTIONS.forEach(function(def){
    var src = padMap.actions[def.id], tr = document.createElement('tr'), busy = assigning && assigning.def === def;
    var type = !src ? '' : (def.id === 'mode3' ? '3-position' : '<select aria-label="Input type for ' + def.name + '"><option value="1"' + (src.latch ? ' selected' : '') + '>Switch</option><option value="0"' + (src.latch ? '' : ' selected') + '>Button</option></select>');
    tr.innerHTML = '<td>' + def.name + '</td><td>' + (busy ? 'waiting...' : (src ? srcName(src) : 'not set')) + '</td><td>' + type + '</td><td>' + (src ? '<span class="lamp">OFF</span>' : '') + '</td><td><button data-a="assign">' + (busy ? 'Cancel' : 'Assign') + '</button>' + (src ? ' <button data-a="clear">Clear</button>' : '') + '</td>';
    tr.querySelector('[data-a="assign"]').addEventListener('click', function(){
      assigning = busy ? null : { def: def, base: null };
      $('assignMsg').textContent = assigning ? 'Now flip the switch or press the button for "' + def.name + '".' + (def.button === false ? ' This one needs a 3-position switch.' : '') : '';
      buildActionsUI();
    });
    if (src){
      tr.querySelector('[data-a="clear"]').addEventListener('click', function(){ delete padMap.actions[def.id]; savePad(); actState = null; $('assignMsg').textContent = def.name + ' cleared.'; buildActionsUI(); });
      var sel = tr.querySelector('select'); if (sel) sel.addEventListener('change', function(e){ src.latch = e.target.value === '1'; savePad(); });
      actRows[def.id] = tr.querySelector('.lamp');
    }
    t.appendChild(tr);
  });
}
var MODE3_LAMP = { pos: 'POS', alt: 'ALT', angle: 'STAB' };
function updateActionsUI(){
  Object.keys(actRows).forEach(function(id){
    var lamp = actRows[id], on = actState ? (id === 'mode3' ? true : !!actState.on[id]) : false;
    lamp.textContent = id === 'mode3' ? (actState && actState.mode3 ? MODE3_LAMP[actState.mode3] : '...') : (on ? 'ON' : 'OFF'); lamp.className = 'lamp' + (on ? ' on' : '');
  });
}
$('thrCentered').addEventListener('change', function(e){ sim.thrCentered = e.target.checked; });

