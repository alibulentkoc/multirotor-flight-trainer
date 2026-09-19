// Docs build script: converts docs/USER_MANUAL.md into docs/manual/index.html.
//   node tools/build-docs.js   (or: npm run build:docs)
// No dependencies. The page reuses the <style> block of docs/labs/index.html, so the manual
// always looks like the lab pages, and it loads the fonts from ../labs/fonts/.
// Supported Markdown is what the manual uses: headings, paragraphs, bold, inline code, links,
// ordered and unordered lists, tables, fenced code blocks, and horizontal rules.
// Anything else (block quotes, images, nested lists) throws, so it cannot render wrong in silence.
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var SRC = 'docs/USER_MANUAL.md', OUT = 'docs/manual/index.html', STYLE_FROM = 'docs/labs/index.html';
var CONTENTS = 'Contents';   // the list under this heading becomes links to the sections
// Rules the lab pages do not need: h3, inline code, and print breaks.
var EXTRA_CSS = [
  'h2,h3{scroll-margin-top:12px}',
  'h3{font-size:1.05rem;font-weight:700;margin:1.5rem 0 .4rem}',
  'code{font:.85em "Latin Modern Mono","CMU Typewriter Text","Courier New",monospace;background:var(--chip);padding:0 .2em}',
  'pre code{font:inherit;background:none;padding:0}',
  'ol.toc{columns:2;column-gap:2.4rem} ol.toc li{break-inside:avoid}',
  '@media (max-width:760px){ol.toc{columns:1}}',
  '@media print{h2,h3{break-after:avoid} tr,pre{break-inside:avoid}}'
].join('\n');

var esc = function(s){ return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

// Inline Markdown: `code`, [text](url), **bold**. Code spans are split off first, so nothing inside them is formatted.
function inline(s){
  if (/!\[/.test(s)) throw new Error('images are not supported: ' + s);
  return s.split('`').map(function(part, i){
    if (i % 2) return '<code>' + esc(part) + '</code>';
    return esc(part)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }).join('');
}

// Heading text without Markdown marks, for ids and for matching the Contents list.
var plain = function(s){ return s.replace(/`/g, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim(); };
function slugger(){
  var used = {};
  return function(text){
    var base = plain(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section', id = base, n = 2;
    while (used[id]) id = base + '-' + (n++);
    used[id] = true; return id;
  };
}

var RE = { fence: /^```/, heading: /^(#{1,6})\s+(.+?)\s*#*$/, hr: /^(-{3,}|\*{3,}|_{3,})$/, ul: /^[-*]\s+(.*)$/, ol: /^(\d+)\.\s+(.*)$/, row: /^\|.*\|\s*$/, sep: /^\|[\s:|-]+\|\s*$/ };
var cells = function(line){ return line.trim().replace(/^\||\|$/g, '').split('|').map(function(c){ return c.trim(); }); };

// Markdown text -> array of blocks: {t:'h',level,text} {t:'p',text} {t:'ul'|'ol',start,items} {t:'table',head,rows} {t:'pre',text} {t:'hr'}
function parse(md){
  var lines = md.replace(/\r\n?/g, '\n').split('\n'), blocks = [], i = 0, m;
  var startsBlock = function(l){ return RE.fence.test(l) || RE.heading.test(l) || RE.hr.test(l) || RE.ul.test(l) || RE.ol.test(l) || RE.row.test(l); };
  while (i < lines.length){
    var line = lines[i];
    if (!line.trim()){ i++; continue; }
    if (RE.fence.test(line)){
      var code = []; i++;
      while (i < lines.length && !RE.fence.test(lines[i])) code.push(lines[i++]);
      if (i >= lines.length) throw new Error('unclosed code fence');
      i++; blocks.push({ t: 'pre', text: code.join('\n') }); continue;
    }
    if (/^>/.test(line)) throw new Error('block quotes are not supported: ' + line);
    if (/^\s+([-*]|\d+\.)\s/.test(line)) throw new Error('nested lists are not supported: ' + line);
    if ((m = RE.heading.exec(line))){ blocks.push({ t: 'h', level: m[1].length, text: m[2] }); i++; continue; }
    if (RE.hr.test(line)){ blocks.push({ t: 'hr' }); i++; continue; }
    if (RE.row.test(line) && i + 1 < lines.length && RE.sep.test(lines[i + 1])){
      var head = cells(line), rows = []; i += 2;
      while (i < lines.length && RE.row.test(lines[i])){
        var r = cells(lines[i++]);
        if (r.length !== head.length) throw new Error('table row has ' + r.length + ' cells, header has ' + head.length + ': ' + r[0]);
        rows.push(r);
      }
      blocks.push({ t: 'table', head: head, rows: rows }); continue;
    }
    if (RE.ul.test(line) || RE.ol.test(line)){
      var ordered = RE.ol.test(line), re = ordered ? RE.ol : RE.ul, items = [], start = ordered ? +RE.ol.exec(line)[1] : 1;
      while (i < lines.length && (m = re.exec(lines[i]))){
        var item = m[ordered ? 2 : 1]; i++;
        // indented lines continue the item
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^\s+([-*]|\d+\.)\s/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(item);
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', start: start, items: items }); continue;
    }
    var para = [line.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) para.push(lines[i++].trim());
    blocks.push({ t: 'p', text: para.join(' ') });
  }
  return blocks;
}

// Blocks -> { title, html }. Every heading gets an id. The list under "Contents" links to the h2 sections.
function render(blocks){
  var slug = slugger(), title = '', sections = {};
  blocks.forEach(function(b){
    if (b.t !== 'h') return;
    b.id = slug(b.text);
    if (b.level === 1 && !title) title = plain(b.text);
    if (b.level === 2) sections[plain(b.text)] = b.id;
  });
  var html = blocks.map(function(b, k){
    if (b.t === 'h') return '<h' + b.level + ' id="' + b.id + '">' + inline(b.text) + '</h' + b.level + '>';
    if (b.t === 'p') return '<p>' + inline(b.text) + '</p>';
    if (b.t === 'hr') return '<hr>';
    if (b.t === 'pre') return '<pre><code>' + esc(b.text) + '\n</code></pre>';
    if (b.t === 'table') return '<div class="scroll"><table>\n<thead>\n<tr>' + b.head.map(function(c){ return '<th>' + inline(c) + '</th>'; }).join('') + '</tr>\n</thead>\n<tbody>\n' +
      b.rows.map(function(r){ return '<tr>' + r.map(function(c){ return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('\n') + '\n</tbody>\n</table></div>';
    var prev = blocks[k - 1], toc = !!prev && prev.t === 'h' && plain(prev.text) === CONTENTS;
    var open = '<' + b.t + (toc ? ' class="toc"' : '') + (b.t === 'ol' && b.start !== 1 ? ' start="' + b.start + '"' : '') + '>';
    return open + '\n' + b.items.map(function(it, n){
      if (!toc) return '<li>' + inline(it) + '</li>';
      // a Contents entry matches a section heading either as written or with its list number in front
      var id = sections[plain(it)] || sections[(b.start + n) + '. ' + plain(it)];
      if (!id) throw new Error('Contents entry has no matching section heading: ' + it);
      return '<li><a href="#' + id + '">' + inline(it) + '</a></li>';
    }).join('\n') + '\n</' + b.t + '>';
  }).join('\n');
  return { title: title, html: html };
}

// The lab pages' CSS, with the font paths pointed at the labs folder.
function labsCss(labsHtml){
  var m = /<style>([\s\S]*?)<\/style>/.exec(labsHtml.replace(/\r\n?/g, '\n'));
  if (!m) throw new Error('no <style> block found in ' + STYLE_FROM);
  if (m[1].indexOf('url("fonts/') < 0) throw new Error('no font urls found in the <style> block of ' + STYLE_FROM);
  return m[1].replace(/url\("fonts\//g, 'url("../labs/fonts/').replace(/\n?$/, '\n');
}

function page(md, css){
  var doc = render(parse(md));
  if (!doc.title) throw new Error(SRC + ' needs a level 1 heading for the page title');
  var out = [
    '<!DOCTYPE html>',
    '<!-- Generated from ' + SRC + ' by tools/build-docs.js. Do not edit by hand. Run: npm run build:docs -->',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + esc(doc.title) + '</title>',
    '<link rel="preload" href="../labs/fonts/LM-regular.woff2" as="font" type="font/woff2" crossorigin>',
    '<style>' + css + EXTRA_CSS,
    '</style>',
    '</head>',
    '<body>',
    '<div class="top"><a class="brand" href="index.html">' + esc(doc.title) + '</a><span class="nav"><a href="../learn/index.html">Fundamentals</a><a href="../labs/index.html">Labs</a><a class="btn" href="../../index.html" target="_blank" rel="noopener">Open the trainer</a></span></div>',
    '<main>',
    doc.html,
    '</main>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
  var bad = out.match(/[^\x00-\x7F]/);
  if (bad) throw new Error('Non-ASCII character U+' + bad[0].charCodeAt(0).toString(16) + ' in output. Authored text must be ASCII.');
  return out;
}

var read = function(p){ return fs.readFileSync(path.join(root, p), 'utf8'); };
function buildManual(){ return page(read(SRC), labsCss(read(STYLE_FROM))); }

module.exports = { inline: inline, parse: parse, render: render, labsCss: labsCss, page: page, buildManual: buildManual, OUT: OUT };

if (require.main === module){
  var out = buildManual(), target = path.join(root, OUT);
  if (!fs.existsSync(path.dirname(target))) fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out);
  console.log('built ' + OUT + ' (' + out.length + ' bytes)');
}
