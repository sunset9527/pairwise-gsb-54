/*
 * Unicode regression tests for lib/fuzzy.js — plain node, built-in assert.
 *
 *     node test/unicode.test.js
 *
 * Each section pins down a class of bug found by differential fuzzing
 * (see test/differential.js) against correct Unicode caseless-matching
 * semantics: full case folding (CaseFolding.txt, non-Turkic) applied to
 * NFD-decomposed code points, matched as a greedy subsequence.
 */
'use strict';
var assert = require('assert');
var fuzzy = require('../lib/fuzzy');

var n = 0;
function ok(name, fn) {
  fn();
  n++;
  console.log('  ok - ' + name);
}

console.log('unicode regression tests');

// --- 1. Reflexivity: any string matches itself (case-insensitive default) --
ok('reflexivity for chars with length-changing folds', function () {
  // 'İ'.toLowerCase() is TWO code units ('i' + U+0307); the old code
  // compared them against a 1-unit string and never matched itself.
  ['İ', 'ﬁ', 'ﬀ', 'ǰ', 'ŉ', 'ΐ', 'ΰ', 'ẞ', 'ß', 'ᾀ', 'ᾈ', 'ῼ'].forEach(function (s) {
    assert.strictEqual(fuzzy.test(s, s), true, JSON.stringify(s) + ' must match itself');
    assert.strictEqual(fuzzy.test(s, 'x' + s + 'y'), true, JSON.stringify(s) + ' embedded');
  });
});

ok('reflexivity for non-BMP chars (surrogate pairs)', function () {
  ['💩', '𝕊', '𐐀', '𐐨', '𐒰', '𐓘', '𞤀', '𞤢'].forEach(function (s) {
    assert.strictEqual(fuzzy.test(s, s), true, JSON.stringify(s) + ' must match itself');
  });
});

ok('reflexivity sweep over cased + combining + non-BMP ranges', function () {
  var ranges = [[0x41, 0x5a], [0x61, 0x7a], [0xc0, 0x17f], [0x391, 0x3c9],
                [0x300, 0x36f], [0x13a0, 0x13f5], [0xab70, 0xabbf],
                [0x1e00, 0x1eff], [0x1f80, 0x1ffc], [0x10400, 0x1044f],
                [0x104b0, 0x104fb], [0x1e900, 0x1e943], [0x1f600, 0x1f64f]];
  ranges.forEach(function (r) {
    for (var cp = r[0]; cp <= r[1]; cp++) {
      var s = String.fromCodePoint(cp);
      assert.strictEqual(fuzzy.test(s, s), true, 'U+' + cp.toString(16));
    }
  });
});

// --- 2. Length-changing folds: no index misalignment -----------------------
ok('multi-unit expansions do not shift later characters', function () {
  // 'İ' folds to 'i\u0307'; characters after it must still be found.
  assert.strictEqual(fuzzy.test('iy', 'xİy'), true);
  assert.strictEqual(fuzzy.test('i̇', 'İ'), true);   // decomposed pattern vs precomposed str
  assert.strictEqual(fuzzy.test('İ', 'i̇'), true);   // and vice versa
  assert.strictEqual(fuzzy.test('̇', 'İ'), true);    // combining dot reachable
  assert.strictEqual(fuzzy.test('fi', 'xﬁy'), true); // ligature expands to 'fi'
  assert.strictEqual(fuzzy.test('ﬁ', 'fi'), true);
});

ok('full case folding expansions (ß -> ss etc.)', function () {
  assert.strictEqual(fuzzy.test('ss', 'ß'), true);
  assert.strictEqual(fuzzy.test('ss', 'ẞ'), true);
  assert.strictEqual(fuzzy.test('ß', 'ss'), true);
  assert.strictEqual(fuzzy.test('fi', 'ﬁ'), true);
  assert.strictEqual(fuzzy.test('st', 'ﬅ'), true);
  assert.strictEqual(fuzzy.test('եւ', 'և'), true);   // Armenian ligature
  assert.strictEqual(fuzzy.test('ʼn', 'ŉ'), true);
});

// --- 3. Case folding preserves character semantics -------------------------
ok('greek sigma: final and medial forms are case-equivalent', function () {
  // Old code lowercased whole strings, so word-final 'Σ' became 'ς' while
  // patterns kept 'σ' -> false negatives/positives. Folding maps both to 'σ'.
  assert.strictEqual(fuzzy.test('σ', 'ς'), true);
  assert.strictEqual(fuzzy.test('ς', 'Σ'), true);
  assert.strictEqual(fuzzy.test('σ', 'zΣ'), true);   // was a false negative
  assert.strictEqual(fuzzy.test('Σ', 'zΣ'), true);   // was a false negative
  assert.strictEqual(fuzzy.test('οσ', 'ΟΣ'), true);  // final-sigma context
  assert.strictEqual(fuzzy.test('ος', 'ΟΣ'), true);
});

ok('folds that toLowerCase misses', function () {
  assert.strictEqual(fuzzy.test('μ', 'µ'), true);    // micro sign -> mu
  assert.strictEqual(fuzzy.test('k', 'K'), true);    // kelvin sign
  assert.strictEqual(fuzzy.test('s', 'ſ'), true);    // long s
  assert.strictEqual(fuzzy.test('Ꭰ', 'ꭰ'), true);    // Cherokee folds to uppercase
  assert.strictEqual(fuzzy.test('ꭰ', 'Ꭰ'), true);
  assert.strictEqual(fuzzy.test('𐐨', '𐐀'), true);   // Deseret (non-BMP cased)
  assert.strictEqual(fuzzy.test('𐐀', '𐐨'), true);
});

ok('canonical equivalence via NFD', function () {
  assert.strictEqual(fuzzy.test('á', 'á'), true);    // precomposed vs decomposed
  assert.strictEqual(fuzzy.test('á', 'á'), true);
  assert.strictEqual(fuzzy.test('a', 'á'), true);    // base char reachable through decomposition
  assert.strictEqual(fuzzy.test('ᾀ', 'ᾈ'), true);    // iota subscript vs adscript
});

ok('no Turkic folding: dotless i stays distinct', function () {
  assert.strictEqual(fuzzy.test('i', 'ı'), false);
  assert.strictEqual(fuzzy.test('ı', 'i'), false);
  assert.strictEqual(fuzzy.test('I', 'ı'), false);
  assert.strictEqual(fuzzy.test('ı', 'ı'), true);
});

// --- 4. Non-BMP: surrogate pairs stay intact --------------------------------
ok('rendering never splits a surrogate pair', function () {
  assert.strictEqual(fuzzy.match('💩', '💩', { pre: '<', post: '>' }).rendered, '<💩>');
  assert.strictEqual(fuzzy.match('💩', 'x💩y', { pre: '<', post: '>' }).rendered, 'x<💩>y');
  assert.strictEqual(fuzzy.match('𐐀', '𐐨', { pre: '<', post: '>' }).rendered, '<𐐨>');
  assert.strictEqual(fuzzy.match('ab', 'a💩b', { pre: '<', post: '>' }).rendered, '<a>💩<b>');
});

ok('lone surrogates do not match half a character', function () {
  assert.strictEqual(fuzzy.test('\ud83d', '💩'), false);
  assert.strictEqual(fuzzy.test('\udca9', '💩'), false);
});

// --- 5. Rendering / scoring invariants --------------------------------------
ok('rendered output strips back to the original string', function () {
  var cases = [['İ', 'xİy'], ['ss', 'ßß'], ['💩', 'a💩b💩c'], ['fi', 'ﬁle'],
               ['σ', 'ΟΣ'], ['Ꭰ', 'ꭰꭰ']];
  cases.forEach(function (c) {
    var m = fuzzy.match(c[0], c[1], { pre: '⟪', post: '⟫' });
    assert.ok(m, JSON.stringify(c[0]) + ' should match ' + JSON.stringify(c[1]));
    assert.strictEqual(m.rendered.split('⟪').join('').split('⟫').join(''), c[1]);
  });
});

ok('exact (fold-equal) matches score Infinity', function () {
  assert.strictEqual(fuzzy.match('abc', 'abc').score, Infinity);
  assert.strictEqual(fuzzy.match('ABC', 'abc').score, Infinity);
  assert.strictEqual(fuzzy.match('ss', 'ß').score, Infinity);
  assert.strictEqual(fuzzy.match('á', 'á').score, Infinity);
  assert.ok(fuzzy.match('abc', 'zabc').score < Infinity);
});

ok('consecutive matches still outscore scattered ones', function () {
  assert.ok(fuzzy.match('abcd', 'zabcd').score > fuzzy.match('abcd', 'azbcd').score);
});

ok('empty pattern matches everything, empty string only matches empty pattern', function () {
  assert.strictEqual(fuzzy.test('', 'anything'), true);
  assert.strictEqual(fuzzy.test('', ''), true);
  assert.strictEqual(fuzzy.test('a', ''), false);
});

// --- 6. Pre-existing ASCII behaviour (ported from the mocha suite) ----------
ok('legacy behaviour is preserved', function () {
  assert.strictEqual(fuzzy.test('back', 'imaback'), true);
  assert.strictEqual(fuzzy.test('back', 'bakck'), true);
  assert.strictEqual(fuzzy.test('back', 'abck'), false);
  assert.strictEqual(fuzzy.test('', 'osh kosh modkhigow'), true);
  assert.deepStrictEqual(fuzzy.simpleFilter('ab', ['aba', 'c', 'cacb']), ['aba', 'cacb']);
  assert.strictEqual(fuzzy.match('ab', 'ZaZbZ', { pre: '<', post: '>' }).rendered, 'Z<a>Z<b>Z');
  assert.strictEqual(fuzzy.match('ab', 'ZaZbZ').rendered, 'ZaZbZ');
  assert.strictEqual(fuzzy.match('ZEBRA!', 'ZaZbZ'), null);
  assert.strictEqual(fuzzy.filter('a', ['A'])[0].string, 'A');
  assert.strictEqual(fuzzy.match('Ab', 'aB', { caseSensitive: true }), null);
  assert.ok(fuzzy.match('AB', 'AB', { caseSensitive: false }) !== null);
  var arr = ['aba', 'c', 'cacb'];
  assert.strictEqual(fuzzy.filter(undefined, arr), arr);
  assert.deepStrictEqual(fuzzy.filter('pattern', undefined), []);
  assert.deepStrictEqual(fuzzy.filter('pattern', []), []);
});

// --- 7. Randomized differential smoke (heavy fuzzing: test/differential.js) -
ok('seeded random differential vs independent reference', function () {
  var seed = 42;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var pool = 'abcABCİıßẞσςΣµμﬁſK💩𐐀𐐨Ꭰꭰáá̇́ᾀᾈﬅ'.split(/(?=[\s\S])/u);
  function refUnits(s) {
    var out = [];
    Array.from(s).forEach(function (ch) {
      Array.from(ch.normalize('NFD')).forEach(function (cp) {
        var f, c = cp.codePointAt(0);
        if (c === 0x0131) f = 'ı';
        else if (c === 0x1e9e) f = 'ss';
        else if (c >= 0x13a0 && c <= 0x13f5) f = cp;
        else if (c >= 0x13f8 && c <= 0x13fd) f = String.fromCodePoint(c - 8);
        else if (c >= 0xab70 && c <= 0xabbf) f = String.fromCodePoint(c - 0xab70 + 0x13a0);
        else f = cp.toUpperCase().toLowerCase();
        Array.from(f.normalize('NFD')).forEach(function (u) { out.push(u); });
      });
    });
    return out;
  }
  function refMatch(p, s) {
    var pu = refUnits(p), su = refUnits(s), pi = 0;
    for (var i = 0; i < su.length && pi < pu.length; i++) if (su[i] === pu[pi]) pi++;
    return pi === pu.length;
  }
  for (var t = 0; t < 20000; t++) {
    var sl = Math.floor(rnd() * 5), pl = Math.floor(rnd() * 3), s = '', p = '';
    for (var i = 0; i < sl; i++) s += pool[Math.floor(rnd() * pool.length)];
    for (var j = 0; j < pl; j++) p += pool[Math.floor(rnd() * pool.length)];
    assert.strictEqual(fuzzy.test(p, s), refMatch(p, s),
      'pattern=' + JSON.stringify(p) + ' str=' + JSON.stringify(s));
  }
});

console.log('\n' + n + ' test groups passed');
