/*ACTIONS-BEGIN*/
// ---------- controller actions: switches and buttons assigned to commands ----------
// Pure logic, no DOM and no gamepad API, so test/run.js loads this whole file headless.
// A source is { kind: 'button' | 'axis', index, dir, latch }. dir (+1 or -1) is the side of an axis that means "on".
// latch is true for a switch that stays where you put it and false for a momentary button.
var ACTION_PARAMS = {
  axisOn: 0.5, axisOff: 0.3,     // an axis source turns on above axisOn and off below axisOff (hysteresis)
  detectMove: 0.5,               // Assign picks an axis once it has moved this far from where it was
  modeBand: 1/3,                 // three-position source: below -modeBand, between, above +modeBand
  modeHyst: 0.05                 // extra travel needed to leave the current position
};
var ACTIONS = [
  { id: 'rth', name: 'Return to home' },
  { id: 'arm', name: 'Arm or disarm' },
  { id: 'land', name: 'Land' },
  { id: 'cam', name: 'Change camera' },
  { id: 'mode3', name: 'Flight mode (3-position switch)', button: false },
  { id: 'modePos', name: 'Mode: Position hold' },
  { id: 'modeAlt', name: 'Mode: Altitude hold' },
  { id: 'modeAngle', name: 'Mode: Stabilized' }
];
var MODE_BUTTONS = { modePos: 'pos', modeAlt: 'alt', modeAngle: 'angle' };
function srcValue(src, inp){
  if (src.kind === 'button') return inp.buttons[src.index] ? 1 : 0;
  return (inp.axes[src.index] || 0)*(src.dir < 0 ? -1 : 1);
}
function srcOn(src, inp, was){
  if (src.kind === 'button') return !!inp.buttons[src.index];
  var v = srcValue(src, inp); return was ? v > ACTION_PARAMS.axisOff : v > ACTION_PARAMS.axisOn;
}
function mode3Pos(src, inp, was){
  var v = srcValue(src, inp), b = ACTION_PARAMS.modeBand, h = ACTION_PARAMS.modeHyst;
  if (was === 'pos' && v < -b + h) return 'pos';
  if (was === 'angle' && v > b - h) return 'angle';
  if (was === 'alt' && Math.abs(v) < b + h) return 'alt';
  return v < -b ? 'pos' : (v > b ? 'angle' : 'alt');
}
// The Assign flow: the first button pressed, or the first axis moved, since the snapshot `base` was taken.
// Axes already used by the sticks are skipped. allow = { button, axis } limits what an action accepts.
function detectSource(base, inp, stickAxes, allow){
  var i;
  if (!allow || allow.button !== false) for (i = 0; i < inp.buttons.length; i++) if (inp.buttons[i] && !base.buttons[i]) return { kind: 'button', index: i, dir: 1, latch: false };
  if (!allow || allow.axis !== false) for (i = 0; i < inp.axes.length; i++){
    if (stickAxes.indexOf(i) >= 0) continue;
    var v = inp.axes[i] || 0; if (Math.abs(v - (base.axes[i] || 0)) > ACTION_PARAMS.detectMove) return { kind: 'axis', index: i, dir: v < (base.axes[i] || 0) ? -1 : 1, latch: true };
  }
  return null;
}
// One decision step. assign = { actionId: source }, prev = the state returned last time (null on the first call),
// inp = { buttons: [bool], axes: [number] }, ctx = { armed, rthActive }.
// Returns { state, cmds }. Commands fire on edges only: the first sight of a source records it without firing,
// so a switch left on does not act at start, and does not restart RTH after the pilot cancels with the stick.
function actionStep(assign, prev, inp, ctx){
  var state = { on: {}, mode3: null }, cmds = [];
  Object.keys(assign).forEach(function(id){
    var src = assign[id]; if (!src) return;
    if (id === 'mode3'){
      var was3 = prev ? prev.mode3 : null, pos = mode3Pos(src, inp, was3); state.mode3 = pos;
      if (was3 !== null && pos !== was3) cmds.push('mode:' + pos);
      return;
    }
    var seen = prev && prev.on[id] !== undefined, was = seen ? prev.on[id] : false, on = srcOn(src, inp, was); state.on[id] = on;
    if (!seen || on === was) return;
    if (id === 'rth'){ if (src.latch) cmds.push(on ? 'rth' : 'cancel_rth'); else if (on) cmds.push(ctx.rthActive ? 'cancel_rth' : 'rth'); }
    else if (id === 'arm'){ if (src.latch) cmds.push(on ? 'arm' : 'disarm'); else if (on) cmds.push(ctx.armed ? 'disarm' : 'arm'); }
    else if (on){ if (id === 'land') cmds.push('land'); else if (id === 'cam') cmds.push('cam'); else if (MODE_BUTTONS[id]) cmds.push('mode:' + MODE_BUTTONS[id]); }
  });
  return { state: state, cmds: cmds };
}
/*ACTIONS-END*/

