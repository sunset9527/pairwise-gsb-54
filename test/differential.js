/*
 * Differential fuzz harness: compares lib/fuzzy.js against an independent
 * reference implementation of Unicode caseless subsequence matching.
 *
 * Reference semantics (default caseless matching, Unicode 16):
 *  - Compare code points, never split surrogate pairs.
 *  - Full case folding (CaseFolding.txt, status C+F, non-Turkic), applied
 *    after NFD decomposition; a char may fold to several code points
 *    ('ß' -> 'ss', 'İ' -> 'i' + U+0307).
 *  - Match = greedy subsequence of folded pattern units over folded str
 *    units.
 *
 * The reference computes folding independently from the library: it uses
 * the toUpperCase().toLowerCase() round trip plus a small correction set
 * (verified against CaseFolding.txt to be the complete set of
 * discrepancies for NFD-stable chars: U+0131, U+1E9E, Cherokee).
 */
'use strict';
var fuzzy = require('../lib/fuzzy');

// --- independent reference ------------------------------------------------
function refFoldChar(ch) {
  var cp = ch.codePointAt(0);
  if (cp === 0x0131) return 'ı';            // dotless i folds to itself
  if (cp === 0x1E9E) return 'ss';           // capital sharp s
  if (cp >= 0x13A0 && cp <= 0x13F5) return ch;   // Cherokee uppercase: fold target
  if (cp >= 0x13F8 && cp <= 0x13FD) return String.fromCodePoint(cp - 8);
  if (cp >= 0xAB70 && cp <= 0xABBF) return String.fromCodePoint(cp - 0xAB70 + 0x13A0);
  return ch.toUpperCase().toLowerCase();
}

function refFoldUnits(str) {
  var units = [];
  var cps = Array.from(str);
  for (var i = 0; i < cps.length; i++) {
    var nfd = Array.from(cps[i].normalize('NFD'));
    for (var j = 0; j < nfd.length; j++) {
      var folded = Array.from(refFoldChar(nfd[j]).normalize('NFD'));
      for (var k = 0; k < folded.length; k++) units.push(folded[k]);
    }
  }
  return units;
}

function refMatch(pattern, str, caseSensitive) {
  var pUnits = caseSensitive ? Array.from(pattern) : refFoldUnits(pattern);
  var sUnits = caseSensitive ? Array.from(str) : refFoldUnits(str);
  var pi = 0;
  for (var si = 0; si < sUnits.length && pi < pUnits.length; si++) {
    if (sUnits[si] === pUnits[pi]) pi++;
  }
  return pi === pUnits.length;
}

// --- character pool -------------------------------------------------------
var pool = [];
function addRange(a, b) { for (var cp = a; cp <= b; cp++) pool.push(String.fromCodePoint(cp)); }
addRange(0x20, 0x7e);        // ASCII
addRange(0xc0, 0x17f);       // Latin-1 + Latin Extended-A (İ, ı, ß, Þ, ŉ...)
addRange(0x391, 0x3a9); addRange(0x3b1, 0x3c9); // Greek (sigma!)
addRange(0x300, 0x36f);      // combining diacriticals
addRange(0x13a0, 0x13f5); addRange(0xab70, 0xabbf); // Cherokee both cases
addRange(0x10d0, 0x10fa);    // Georgian
addRange(0x1e00, 0x1eff);    // Latin Extended Additional (ẞ, ẛ...)
addRange(0x1f80, 0x1ffc);    // Greek Extended (iota subscripts)
addRange(0x10400, 0x1044f);  // Deseret (non-BMP cased)
addRange(0x104b0, 0x104fb);  // Osage (non-BMP cased)
addRange(0x118a0, 0x118df);  // Warang Citi (non-BMP cased)
addRange(0x16e40, 0x16e7f);  // Medefaidrin (non-BMP cased)
addRange(0x1e900, 0x1e943);  // Adlam (non-BMP cased)
addRange(0x1f600, 0x1f64f);  // emoji
addRange(0x1d400, 0x1d433);  // mathematical alphanumeric (non-BMP)
addRange(0xfb00, 0xfb17);    // ligatures
pool.push('İ', 'ß', 'ẞ', 'ﬁ', 'ﬀ', 'ŉ', 'ǰ', 'ΐ', 'ΰ', 'ς', 'σ', 'Σ',
          '́', '̀', '̇', '💩', '𝕊', '𐐀', '𐐨', ' ', 'ᾀ', 'ᾈ', 'ῼ',
          'á', 'á', 'µ', 'μ', 'K', 'K', 'ſ', 'ﬅ', 'ﬆ', 'և');

var seed = 0xC0FFEE;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function randStr(maxLen) {
  var n = Math.floor(rnd() * (maxLen + 1)), s = '';
  for (var i = 0; i < n; i++) s += pick(pool);
  return s;
}

var failures = [];
function report(kind, pattern, str, extra) {
  failures.push({ kind: kind, pattern: pattern, str: str });
  if (failures.length <= 30) {
    console.log('[' + kind + '] pattern=' + JSON.stringify(pattern) +
                ' str=' + JSON.stringify(str) + (extra ? ' ' + extra : ''));
  }
}

function checkOne(pattern, str, caseSensitive) {
  var opts = { pre: '\u27ea', post: '\u27eb', caseSensitive: !!caseSensitive };
  var m = fuzzy.match(pattern, str, opts);
  var lib = m !== null;
  var ref = refMatch(pattern, str, caseSensitive);
  if (lib !== ref) {
    report(lib ? 'FALSE_POSITIVE' : 'FALSE_NEGATIVE', pattern, str,
           'lib=' + lib + ' ref=' + ref + (caseSensitive ? ' (caseSensitive)' : ''));
  }
  if (m) {
    var stripped = m.rendered.split('\u27ea').join('').split('\u27eb').join('');
    if (stripped !== str) report('RENDER_CORRUPT', pattern, str, JSON.stringify(m.rendered));
    for (var i = 0; i < m.rendered.length; i++) {
      var c = m.rendered.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) {
        var c2 = m.rendered.charCodeAt(i + 1);
        if (!(c2 >= 0xdc00 && c2 <= 0xdfff)) { report('LONE_SURROGATE', pattern, str, JSON.stringify(m.rendered)); break; }
        i++;
      } else if (c >= 0xdc00 && c <= 0xdfff) { report('LONE_SURROGATE', pattern, str, JSON.stringify(m.rendered)); break; }
    }
  }
}

// reflexivity over the whole pool
pool.forEach(function (s) {
  if (!fuzzy.test(s, s)) report('REFLEXIVITY', s, s);
  if (!fuzzy.test(s, 'x' + s + 'y')) report('REFLEXIVITY_EMBED', s, 'x' + s + 'y');
  if (fuzzy.test(s.toLowerCase(), s) !== refMatch(s.toLowerCase(), s)) report('LOWER_MISMATCH', s.toLowerCase(), s);
  if (fuzzy.test(s.toUpperCase(), s) !== refMatch(s.toUpperCase(), s)) report('UPPER_MISMATCH', s.toUpperCase(), s);
});

// exhaustive pairs over an interesting subset
var interesting = ['İ','i','I','ı','̇','ß','ẞ','s','S','σ','ς','Σ','ﬁ','f','ŉ','ǰ',
                   '💩','𐐀','𐐨','a','A','á','á','K','k','µ','μ','ᾀ','ᾈ','Ꭰ','ꭰ','ﬅ'];
interesting.forEach(function (p) {
  interesting.forEach(function (s) {
    checkOne(p, s); checkOne(p, s + s); checkOne(p + p, s); checkOne(p, 'z' + s);
    checkOne(p, s, true);
  });
});

// random differential
var N = parseInt(process.argv[2] || '200000', 10);
for (var t = 0; t < N; t++) {
  var str = randStr(6);
  var pattern;
  if (rnd() < 0.5) {
    pattern = Array.from(str).filter(function () { return rnd() < 0.5; }).join('');
  } else {
    pattern = randStr(3);
  }
  checkOne(pattern, str, rnd() < 0.1);
}

// optional: exhaustive sweep over every Unicode code point
if (process.argv.indexOf('--exhaustive') !== -1) {
  console.log('--- exhaustive code point sweep ---');
  for (var cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    if (cp === 0x27ea || cp === 0x27eb) continue; // collide with render markers
    var s = String.fromCodePoint(cp);
    if (!fuzzy.test(s, s)) report('EXH_REFLEXIVITY', s, s);
    if (fuzzy.test(s.toLowerCase(), s) !== refMatch(s.toLowerCase(), s)) report('EXH_LOWER', s.toLowerCase(), s);
    if (fuzzy.test(s.toUpperCase(), s) !== refMatch(s.toUpperCase(), s)) report('EXH_UPPER', s.toUpperCase(), s);
    checkOne(s, 'z' + s + 'w');
  }
}

console.log('checked ' + N + ' random cases + systematic sweeps');
console.log('Total failures: ' + failures.length);
var byKind = {};
failures.forEach(function (f) { byKind[f.kind] = (byKind[f.kind] || 0) + 1; });
console.log(byKind);
process.exit(failures.length ? 1 : 0);
