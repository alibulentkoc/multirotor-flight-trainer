// Build script: assembles the single-file application.
//   node build.js          -> index.html   (three.js inlined, runs with no network)
//   node build.js --cdn    -> dist/index.cdn.html (three.js from cdnjs, small file for hosted viewers)
// No dependencies. Fragments in src/js are concatenated in file-name order.
var fs = require('fs'), path = require('path');
var cdn = process.argv.indexOf('--cdn') >= 0, root = __dirname;
var read = function(p){ return fs.readFileSync(path.join(root, p), 'utf8'); };
var jsDir = path.join(root, 'src/js');
var app = fs.readdirSync(jsDir).filter(function(f){ return /\.js$/.test(f); }).sort().map(function(f){ return fs.readFileSync(path.join(jsDir, f), 'utf8'); }).join('');
var three = cdn
  ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
  : '<script>\n/* three.js r128, vendored inline so the simulator runs with no network. MIT License:\n' + read('vendor/three.LICENSE.txt') + '*/\n' + read('vendor/three.min.js') + '\n</script>';
// split/join avoids the special meaning of "$" in String.replace replacement text
var put = function(s, key, val){ var parts = s.split(key + '\n'); if (parts.length !== 2) throw new Error('placeholder ' + key + ' must appear exactly once'); return parts.join(val.replace(/\n?$/, '\n')); };
var out = read('src/index.template.html');
out = put(out, '{{CSS}}', read('src/styles.css'));
out = put(out, '{{THREE}}', three);
out = put(out, '{{APP}}', app);
var bad = out.match(/[^\x00-\x7F]/);
if (bad) throw new Error('Non-ASCII character U+' + bad[0].charCodeAt(0).toString(16) + ' in output. Authored text must be ASCII.');
var target = cdn ? 'dist/index.cdn.html' : 'index.html';
if (cdn && !fs.existsSync(path.join(root, 'dist'))) fs.mkdirSync(path.join(root, 'dist'));
fs.writeFileSync(path.join(root, target), out);
console.log('built ' + target + ' (' + out.length + ' bytes)');
