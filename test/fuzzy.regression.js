'use strict';
/*
 * Regression tests for lib/fuzzy.js, runnable directly with node:
 *
 *     node test/fuzzy.regression.js
 *
 * Covers the original mocha suite's expectations plus the Unicode /
 * case-folding bugs found by differential fuzzing:
 *
 *   1. 'İ' (U+0130) lowercases to two code points ('i' + U+0307), which
 *      shifted every later comparison index and broke self-matching.
 *   2. 'Σ' lowercases context sensitively ('ς' at end of word), so
 *      folding must be done on the whole string, not per character.
 *   3. Astral characters were iterated as surrogate halves, producing
 *      lone surrogates in rendered output and letting a lone-surrogate
 *      pattern match half of a character.
 */

var assert = require('node:assert');
var fuzzy = require('../lib/fuzzy');

var tests = [];
function test(name, fn) { tests.push({name: name, fn: fn}); }

/* ---------- original suite, ported from test/fuzzy.test.js ---------- */

test('test: fuzzy match / no match', function() {
  assert.strictEqual(fuzzy.test('back', 'imaback'), true);
  assert.strictEqual(fuzzy.test('back', 'bakck'), true);
  assert.strictEqual(fuzzy.test('shig', 'osh kosh modkhigow'), true);
  assert.strictEqual(fuzzy.test('', 'osh kosh modkhigow'), true);
  assert.strictEqual(fuzzy.test('back', 'abck'), false);
  assert.strictEqual(fuzzy.test('okmgk', 'osh kosh modkhigow'), false);
});

test('simpleFilter filters a string array', function() {
  assert.deepStrictEqual(fuzzy.simpleFilter('a', ['a']), ['a']);
  assert.deepStrictEqual(fuzzy.simpleFilter('ab', ['aba', 'c', 'cacb']), ['aba', 'cacb']);
});

test('match renders pre/post and scores', function() {
  var results = fuzzy.match('ab', 'ZaZbZ', {pre: '<', post: '>'});
  assert.strictEqual(results.rendered, 'Z<a>Z<b>Z');
  assert.ok('score' in results);
  assert.strictEqual(fuzzy.match('ab', 'ZaZbZ').rendered, 'ZaZbZ');
  assert.strictEqual(fuzzy.match('ZEBRA!', 'ZaZbZ'), null);
  var consecutiveScore = fuzzy.match('abcd', 'zabcd').score;
  var scatteredScore = fuzzy.match('abcd', 'azbcd').score;
  assert.ok(consecutiveScore > scatteredScore);
});

test('case sensitivity options', function() {
  assert.strictEqual(fuzzy.filter('a', ['A'])[0].string, 'A');
  assert.strictEqual(fuzzy.match('Ab', 'aB', {caseSensitive: true}), null);
  assert.notStrictEqual(fuzzy.match('AB', 'AB', {caseSensitive: false}), null);
});

test('filter returns matches sorted by score', function() {
  var entries = fuzzy.filter('a', ['a', 'ba', 'c']);
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].original, 'a');
  assert.deepStrictEqual(fuzzy.filter('ab', ['aba', 'cacb'], {}).map(function(e) { return e.original; }), ['aba', 'cacb']);
});

/* ---------- bug 1: multi-code-point case expansion ('İ') ---------- */

test('U+0130 matches itself case-insensitively', function() {
  assert.strictEqual(fuzzy.test('İ', 'İ'), true);
  assert.strictEqual(fuzzy.test('aİb', 'aİb'), true);
  assert.strictEqual(fuzzy.test('ԑİΕŗn', 'ԑİΕŗn'), true);
});

test('expansion does not shift later comparison positions', function() {
  // 'İ'.toLowerCase() is two code points; characters after it must
  // still be compared at the right position
  assert.strictEqual(fuzzy.test('ab', 'aİb'), true);
  assert.strictEqual(fuzzy.test('ix', 'İx'), true);
  assert.strictEqual(fuzzy.test('cİ', 'ꙏĳcƄnİ'), true);
  assert.strictEqual(fuzzy.test('ԟİƫ', 'ԟİｅvƫ'), true);
});

test('pattern and string expansions align', function() {
  // folded('İ') === 'i̇' (i + combining dot above)
  assert.strictEqual(fuzzy.test('i̇', 'İ'), true);
  assert.strictEqual(fuzzy.test('İ', 'i̇'), true);
  assert.strictEqual(fuzzy.test('i', 'İ'), true);
  assert.strictEqual(fuzzy.test('̇', 'İ'), true);
  // exact fold equality still maxes the score
  assert.strictEqual(fuzzy.match('İ', 'i̇').score, Infinity);
  assert.strictEqual(fuzzy.match('i̇', 'İ').score, Infinity);
});

test('expansion renders the original character whole', function() {
  assert.strictEqual(fuzzy.match('i', 'İx', {pre: '<', post: '>'}).rendered, '<İ>x');
  assert.strictEqual(fuzzy.match('i̇', 'İx', {pre: '<', post: '>'}).rendered, '<İ>x');
});

/* ---------- bug 2: context-sensitive folding (final sigma) ---------- */

test('sigma folds to final form at end of word', function() {
  assert.strictEqual('ΟΣ'.toLowerCase(), 'ος');
  assert.strictEqual(fuzzy.test('ος', 'ΟΣ'), true);
  assert.strictEqual(fuzzy.test('ΟΣ', 'ος'), true);
  assert.strictEqual(fuzzy.test('ς', 'ΟΣ'), true);
  // non-final sigma stays medial
  assert.strictEqual(fuzzy.test('σ', 'ΟΣΑ'), true);
  assert.strictEqual(fuzzy.test('ƄＩFΣ', 'ԟɄƄＩFΣ'), true);
  assert.strictEqual(fuzzy.test('γǳȻΣ＝', 'γǳȻΣ＝'), true);
});

/* ---------- bug 3: astral characters / surrogate pairs ---------- */

test('astral characters match themselves', function() {
  assert.strictEqual(fuzzy.test('💩', '💩'), true);
  assert.strictEqual(fuzzy.test('𐐀', '𐐀'), true);
  assert.strictEqual(fuzzy.test('𝄞', '𝄞'), true);
  assert.strictEqual(fuzzy.test('a💩b', 'a💩b'), true);
});

test('astral case folding works on whole code points', function() {
  // Deseret: 𐐀 (U+10400) <-> 𐐨 (U+10428)
  assert.strictEqual(fuzzy.test('𐐨', '𐐀'), true);
  assert.strictEqual(fuzzy.test('𐐀', '𐐨'), true);
  assert.strictEqual(fuzzy.test('𐐨𐐷', '𐐀x𐐏'), true);
});

test('rendering never splits a surrogate pair', function() {
  assert.strictEqual(fuzzy.match('💩', 'x💩y', {pre: '<', post: '>'}).rendered, 'x<💩>y');
  assert.strictEqual(fuzzy.match('𐐀', '𐐀', {pre: '<', post: '>'}).rendered, '<𐐀>');
  assert.strictEqual(fuzzy.match('𐐀', '𐐀', {pre: '<', post: '>', caseSensitive: true}).rendered, '<𐐀>');
  var rendered = fuzzy.match('ꙭ𝄞', 'ꙭ𝄞', {pre: '<', post: '>'}).rendered;
  assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(rendered));
});

test('a lone surrogate pattern cannot match half a character', function() {
  assert.strictEqual(fuzzy.test('\ud83d', '💩'), false);
  assert.strictEqual(fuzzy.test('\udca9', '💩'), false);
  // but a lone surrogate still matches itself
  assert.strictEqual(fuzzy.test('\ud83d', '\ud83d'), true);
});

/* ---------- invariants over generated Unicode input ---------- */

function toCps(str) { return Array.from(str); }

// Reference semantics: case-insensitive fuzzy match is a subsequence
// test over the code points of the lowercased strings.
function referenceTest(pattern, str, caseSensitive) {
  var p = toCps(caseSensitive ? pattern : pattern.toLowerCase());
  var s = toCps(caseSensitive ? str : str.toLowerCase());
  var i = 0;
  for (var k = 0; k < s.length && i < p.length; k++) {
    if (s[k] === p[i]) { i++; }
  }
  return i === p.length;
}

var alphabet = (function() {
  var a = [];
  for (var c = 32; c < 127; c++) { a.push(String.fromCharCode(c)); }
  a.push('İ', 'ı', 'ß', 'ẞ', 'é', 'É', 'Σ', 'σ', 'ς', 'ﬁ', 'ǅ', 'ſ', 'K', 'µ',
         '́', '̇', '̃', 'ͅ',
         '𐐀', '𐐨', '💩', '𝄞', '𝒜', '𝒶', '🧑‍🚀', '👍🏽');
  var cp;
  for (cp = 0x0100; cp < 0x0250; cp += 3) { a.push(String.fromCodePoint(cp)); }
  for (cp = 0x0386; cp < 0x0400; cp += 5) { a.push(String.fromCodePoint(cp)); }
  for (cp = 0x0400; cp < 0x0530; cp += 7) { a.push(String.fromCodePoint(cp)); }
  for (cp = 0x1E00; cp < 0x1F00; cp += 7) { a.push(String.fromCodePoint(cp)); }
  for (cp = 0xA640; cp < 0xA6A0; cp += 3) { a.push(String.fromCodePoint(cp)); }
  for (cp = 0xFF01; cp < 0xFF5F; cp += 4) { a.push(String.fromCodePoint(cp)); }
  for (cp = 0x10400; cp < 0x10450; cp += 1) { a.push(String.fromCodePoint(cp)); }
  return a;
})();

var seed = 0xC0FFEE;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function randStr(maxLen) {
  var n = Math.floor(rnd() * maxLen), s = '';
  for (var i = 0; i < n; i++) { s += pick(alphabet); }
  return s;
}

test('every alphabet character matches itself', function() {
  alphabet.forEach(function(ch) {
    assert.strictEqual(fuzzy.test(ch, ch), true, 'self-match failed for ' + JSON.stringify(ch));
  });
});

test('invariant: any string matches itself (case-insensitive and sensitive)', function() {
  for (var t = 0; t < 20000; t++) {
    var s = randStr(8);
    assert.strictEqual(fuzzy.test(s, s), true, 'self-match failed for ' + JSON.stringify(s));
    assert.ok(fuzzy.match(s, s, {caseSensitive: true}), 'cs self-match failed for ' + JSON.stringify(s));
  }
});

test('invariant: strings equal after folding match each other', function() {
  for (var t = 0; t < 20000; t++) {
    var a = randStr(5);
    var b = a.toLowerCase();
    assert.strictEqual(fuzzy.test(a, b), true, JSON.stringify(a) + ' vs ' + JSON.stringify(b));
    assert.strictEqual(fuzzy.test(b, a), true, JSON.stringify(b) + ' vs ' + JSON.stringify(a));
  }
});

test('differential: matches reference subsequence semantics', function() {
  for (var t = 0; t < 50000; t++) {
    var str = randStr(7);
    var pat = rnd() < 0.5
      ? randStr(4)
      : toCps(str).filter(function() { return rnd() < 0.6; }).join('');
    var cs = rnd() < 0.15;
    var got = !!fuzzy.match(pat, str, cs ? {caseSensitive: true} : undefined);
    assert.strictEqual(got, referenceTest(pat, str, cs),
      'pat=' + JSON.stringify(pat) + ' str=' + JSON.stringify(str) + ' cs=' + cs);
  }
});

test('invariant: rendered output strips back to the original string', function() {
  for (var t = 0; t < 20000; t++) {
    var str = randStr(6);
    var pat = toCps(str).filter(function() { return rnd() < 0.7; }).join('');
    var m = fuzzy.match(pat, str, {pre: '', post: ''});
    if (!m) { continue; }
    assert.strictEqual(m.rendered.split('').join('').split('').join(''), str);
    // score is Infinity iff the folded strings are identical
    assert.strictEqual(m.score === Infinity, str.toLowerCase() === pat.toLowerCase(),
      'score for pat=' + JSON.stringify(pat) + ' str=' + JSON.stringify(str));
  }
});

test('edge cases', function() {
  assert.strictEqual(fuzzy.test('', ''), true);
  assert.strictEqual(fuzzy.test('', 'abc'), true);
  assert.strictEqual(fuzzy.test('a', ''), false);
  assert.strictEqual(fuzzy.match('AbC', 'aBc').score, Infinity);
  assert.strictEqual(fuzzy.match('a', 'A', {caseSensitive: true}), null);
  assert.strictEqual(fuzzy.match('İ', 'İ', {caseSensitive: true}).rendered, 'İ');
});

/* ---------- runner ---------- */

var failures = 0;
tests.forEach(function(t) {
  try {
    t.fn();
    console.log('  ✓ ' + t.name);
  } catch (err) {
    failures++;
    console.error('  ✗ ' + t.name);
    console.error('    ' + String(err && err.message).split('\n').join('\n    '));
  }
});
console.log(failures === 0
  ? '\n' + tests.length + ' tests passed'
  : '\n' + failures + ' of ' + tests.length + ' tests FAILED');
process.exit(failures === 0 ? 0 : 1);
