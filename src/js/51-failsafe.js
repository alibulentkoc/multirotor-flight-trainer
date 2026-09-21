// ---------- return to home and battery: settings, battery bar, messages, beep ----------
// All decisions are made in 00-sim.js. This fragment only shows them and passes the settings in.
var FAILSAFE_UI = {
  flashSeconds: 8,               // how long a one-off battery message stays in the task box
  beep: { hz: 880, ms: 140, gapMs: 110, gain: 0.08 } // warning beeps once, low twice, critical three times
};
var fsCfg = store.get('uavtrainer.failsafe.v1', { rthAlt: PARAMS.rth.alt, warn: PARAMS.batt.warn, low: PARAMS.batt.low, crit: PARAMS.batt.crit, autoRth: true, beep: false });
var fsFlash = { html: '', until: 0 }, fsLastReason = null, audioCtx = null;
function fsNow(){ return performance.now()/1000; }
function flashTask(html){ fsFlash = { html: html, until: fsNow() + FAILSAFE_UI.flashSeconds }; }
function applyFailsafeCfg(){
  sim.rthAlt = fsCfg.rthAlt; sim.battCfg = { warn: fsCfg.warn, low: fsCfg.low, crit: fsCfg.crit, autoRth: fsCfg.autoRth };
  store.set('uavtrainer.failsafe.v1', fsCfg);
}
function readFailsafeInputs(){
  var R = PARAMS.rth, alt = parseFloat($('rthAlt').value), w = parseFloat($('bWarn').value), l = parseFloat($('bLow').value), c = parseFloat($('bCrit').value), msg = $('battMsg');
  var err = battCfgError(w, l, c);
  if (!err && (isNaN(alt) || alt < R.altMin || alt > R.altMax)) err = 'RTH altitude must be between ' + R.altMin + ' and ' + R.altMax + ' m.';
  if (err){ msg.textContent = err + ' Still using ' + fsCfg.warn + ', ' + fsCfg.low + ', ' + fsCfg.crit + ' % and ' + fsCfg.rthAlt + ' m.'; msg.className = 'note warn'; return; }
  msg.textContent = ''; msg.className = 'note';
  fsCfg.rthAlt = alt; fsCfg.warn = w; fsCfg.low = l; fsCfg.crit = c; applyFailsafeCfg(); if (!$('plan').hidden) computePlan();
}
function beep(n){
  if (!fsCfg.beep || !audioCtx) return;
  var B = FAILSAFE_UI.beep;
  for (var i = 0; i < n; i++){
    var t0 = audioCtx.currentTime + i*(B.ms + B.gapMs)/1000, o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = B.hz; g.gain.value = B.gain; o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + B.ms/1000);
  }
}
function toggleRth(){ sim.command(sim.auto === 'rth' ? 'cancel_rth' : 'rth'); }
// Called from sim.onEvent (30-drills.js).
function failsafeEvent(ev){
  var tel = sim.telemetry(), b = Math.round(tel.battery);
  if (ev === 'batt_warn'){ beep(1); flashTask('<b>Battery warning: ' + b + ' %.</b> Plan your return.'); }
  else if (ev === 'batt_margin'){ var need = tel.rth_needed_pct; flashTask('<b>Battery is getting short for the trip home.</b> ' + (isFinite(need) ? 'The return needs about ' + Math.ceil(need) + ' % and you have ' + b + ' %.' : 'The wind is too strong to fly home against at this height.') + ' Head back now.'); }
  else if (ev === 'batt_low'){ beep(2); if (!fsCfg.autoRth) flashTask('<b>Low battery: ' + b + ' %.</b> Automatic RTH is off. Fly home and land.'); }
  else if (ev === 'batt_crit') beep(3);
  else if (ev === 'rth_cancel') flashTask('<b>Return to home cancelled.</b> You have control in ' + MODENAMES[sim.mode].toLowerCase() + ' mode.' + (fsLastReason === 'battery' ? ' The battery is still low: land soon.' : ''));
}
// The task box text while a failsafe is active, or a recent one-off message. Returns msg unchanged otherwise.
function failsafeTask(tel, msg){
  fsLastReason = tel.auto_reason || (tel.auto ? null : fsLastReason);
  if (tel.auto === 'rth'){
    var d = Math.hypot(tel.x, tel.z), ph = tel.rth_phase;
    return '<b>' + (tel.auto_reason === 'battery' ? 'Low battery: returning home.' : 'Returning home.') + '</b> ' +
      (ph === 'climb' ? 'Climbing to ' + Math.round(sim.rthAlt) + ' m.' : ph === 'cruise' ? Math.round(d) + ' m to go at ' + Math.round(tel.altitude_m) + ' m.' : 'Descending over home.') +
      ' It does not steer around obstacles. Move the right stick or press H to cancel.';
  }
  if (tel.auto === 'critland'){
    var need = tel.rth_needed_pct, why = tel.auto_reason === 'unreachable'
      ? '<b>Low battery, and home is out of reach.</b> ' + (isFinite(need) ? 'The return needs about ' + Math.ceil(need) + ' % and you have ' + Math.round(tel.battery) + ' %.' : 'The wind is too strong to fly home against.') + ' Landing here instead.'
      : '<b>Critical battery: emergency landing.</b>';
    return why + ' This cannot be cancelled. Use the right stick to pick a clear spot.';
  }
  return fsNow() < fsFlash.until ? fsFlash.html : msg;
}
var BATT_LABEL = { ok: 'OK', warning: 'WARNING', low: 'LOW', critical: 'CRITICAL' };
function updateBatteryUI(tel){
  var state = tel.battery_state, box = $('battBox');
  $('battPct').textContent = Math.round(tel.battery) + ' %'; $('battCell').textContent = tel.cell_voltage.toFixed(2) + ' V/cell'; $('battState').textContent = BATT_LABEL[state];
  $('battFill').style.width = tel.battery.toFixed(0) + '%'; box.className = state === 'ok' ? 'ok' : (state === 'critical' ? 'critical' : 'warning');
  $('tBat').textContent = Math.round(tel.battery) + ' %'; $('tBat').style.color = state === 'ok' ? '' : 'var(--warn)'; $('tBatState').textContent = BATT_LABEL[state];
  $('tVolt').textContent = tel.voltage.toFixed(1) + ' V'; $('tCell').textContent = tel.cell_voltage.toFixed(2) + ' V'; $('tAmp').textContent = tel.current_a.toFixed(0) + ' A';
  $('tMin').textContent = tel.minutes_left === null ? 'n/a' : (tel.minutes_left > 99 ? 'over 99 min' : tel.minutes_left.toFixed(1) + ' min');
  var b = $('bRth'); b.textContent = tel.auto === 'rth' ? 'Cancel RTH' : 'Return to home'; b.disabled = tel.on_ground || tel.auto === 'critland' || !!sim.crashed;
}
if (battCfgError(fsCfg.warn, fsCfg.low, fsCfg.crit) || !(fsCfg.rthAlt >= PARAMS.rth.altMin && fsCfg.rthAlt <= PARAMS.rth.altMax)) fsCfg = { rthAlt: PARAMS.rth.alt, warn: PARAMS.batt.warn, low: PARAMS.batt.low, crit: PARAMS.batt.crit, autoRth: fsCfg.autoRth !== false, beep: !!fsCfg.beep };
$('rthAlt').value = fsCfg.rthAlt; $('bWarn').value = fsCfg.warn; $('bLow').value = fsCfg.low; $('bCrit').value = fsCfg.crit; $('autoRth').checked = fsCfg.autoRth; $('battBeep').checked = false; fsCfg.beep = false;
applyFailsafeCfg();
['rthAlt', 'bWarn', 'bLow', 'bCrit'].forEach(function(id){ $(id).addEventListener('change', readFailsafeInputs); });
$('autoRth').addEventListener('change', function(e){ fsCfg.autoRth = e.target.checked; applyFailsafeCfg(); });
// The beep always starts off: a browser only lets a page make sound after a click, and this click is it.
$('battBeep').addEventListener('change', function(e){
  fsCfg.beep = e.target.checked; store.set('uavtrainer.failsafe.v1', fsCfg);
  if (fsCfg.beep && !audioCtx){ var AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
  if (fsCfg.beep) beep(1);
});
$('bRth').addEventListener('click', function(e){ toggleRth(); e.target.blur(); });

