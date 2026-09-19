// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
(function(){
var $ = function(id){ return document.getElementById(id); };
var sim = new Sim();
var store = {
  get: function(k, d){ try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e){ return d; } },
  set: function(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e){} }
};

