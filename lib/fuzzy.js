/*
 * Fuzzy
 * https://github.com/myork/fuzzy
 *
 * Copyright (c) 2012 Matt York
 * Licensed under the MIT license.
 */

(function() {

var root = this;

var fuzzy = {};

// Use in node or in browser
if (typeof exports !== 'undefined') {
  module.exports = fuzzy;
} else {
  root.fuzzy = fuzzy;
}

// --- Unicode-aware comparison helpers -------------------------------------

// Full case folding overrides, generated from Unicode CaseFolding.txt
// (version 16.0.0, status C and F mappings; Turkic `T` mappings excluded).
// Contains every character whose full case fold differs from
// `String.prototype.toLowerCase`: multi-code-unit expansions
// ('\u00df' -> 'ss', '\u0130' -> 'i\u0307'), folds that lowercase misses
// ('\u03c2' -> '\u03c3', '\u00b5' -> '\u03bc', ligatures like '\ufb01' -> 'fi')
// and identity entries that stop `toLowerCase` from folding a character
// that Unicode considers already caseless-normalized (e.g. Cherokee
// uppercase, which is the fold target for Cherokee lowercase).
var caseFoldOverrides = {
  "µ": "μ", "ß": "ss", "ŉ": "ʼn", "ſ": "s", "ǰ": "ǰ", "ͅ": "ι",
  "ΐ": "ΐ", "ΰ": "ΰ", "ς": "σ", "ϐ": "β", "ϑ": "θ", "ϕ": "φ",
  "ϖ": "π", "ϰ": "κ", "ϱ": "ρ", "ϵ": "ε", "և": "եւ", "Ꭰ": "Ꭰ",
  "Ꭱ": "Ꭱ", "Ꭲ": "Ꭲ", "Ꭳ": "Ꭳ", "Ꭴ": "Ꭴ", "Ꭵ": "Ꭵ", "Ꭶ": "Ꭶ",
  "Ꭷ": "Ꭷ", "Ꭸ": "Ꭸ", "Ꭹ": "Ꭹ", "Ꭺ": "Ꭺ", "Ꭻ": "Ꭻ", "Ꭼ": "Ꭼ",
  "Ꭽ": "Ꭽ", "Ꭾ": "Ꭾ", "Ꭿ": "Ꭿ", "Ꮀ": "Ꮀ", "Ꮁ": "Ꮁ", "Ꮂ": "Ꮂ",
  "Ꮃ": "Ꮃ", "Ꮄ": "Ꮄ", "Ꮅ": "Ꮅ", "Ꮆ": "Ꮆ", "Ꮇ": "Ꮇ", "Ꮈ": "Ꮈ",
  "Ꮉ": "Ꮉ", "Ꮊ": "Ꮊ", "Ꮋ": "Ꮋ", "Ꮌ": "Ꮌ", "Ꮍ": "Ꮍ", "Ꮎ": "Ꮎ",
  "Ꮏ": "Ꮏ", "Ꮐ": "Ꮐ", "Ꮑ": "Ꮑ", "Ꮒ": "Ꮒ", "Ꮓ": "Ꮓ", "Ꮔ": "Ꮔ",
  "Ꮕ": "Ꮕ", "Ꮖ": "Ꮖ", "Ꮗ": "Ꮗ", "Ꮘ": "Ꮘ", "Ꮙ": "Ꮙ", "Ꮚ": "Ꮚ",
  "Ꮛ": "Ꮛ", "Ꮜ": "Ꮜ", "Ꮝ": "Ꮝ", "Ꮞ": "Ꮞ", "Ꮟ": "Ꮟ", "Ꮠ": "Ꮠ",
  "Ꮡ": "Ꮡ", "Ꮢ": "Ꮢ", "Ꮣ": "Ꮣ", "Ꮤ": "Ꮤ", "Ꮥ": "Ꮥ", "Ꮦ": "Ꮦ",
  "Ꮧ": "Ꮧ", "Ꮨ": "Ꮨ", "Ꮩ": "Ꮩ", "Ꮪ": "Ꮪ", "Ꮫ": "Ꮫ", "Ꮬ": "Ꮬ",
  "Ꮭ": "Ꮭ", "Ꮮ": "Ꮮ", "Ꮯ": "Ꮯ", "Ꮰ": "Ꮰ", "Ꮱ": "Ꮱ", "Ꮲ": "Ꮲ",
  "Ꮳ": "Ꮳ", "Ꮴ": "Ꮴ", "Ꮵ": "Ꮵ", "Ꮶ": "Ꮶ", "Ꮷ": "Ꮷ", "Ꮸ": "Ꮸ",
  "Ꮹ": "Ꮹ", "Ꮺ": "Ꮺ", "Ꮻ": "Ꮻ", "Ꮼ": "Ꮼ", "Ꮽ": "Ꮽ", "Ꮾ": "Ꮾ",
  "Ꮿ": "Ꮿ", "Ᏸ": "Ᏸ", "Ᏹ": "Ᏹ", "Ᏺ": "Ᏺ", "Ᏻ": "Ᏻ", "Ᏼ": "Ᏼ",
  "Ᏽ": "Ᏽ", "ᏸ": "Ᏸ", "ᏹ": "Ᏹ", "ᏺ": "Ᏺ", "ᏻ": "Ᏻ", "ᏼ": "Ᏼ",
  "ᏽ": "Ᏽ", "ᲀ": "в", "ᲁ": "д", "ᲂ": "о", "ᲃ": "с", "ᲄ": "т",
  "ᲅ": "т", "ᲆ": "ъ", "ᲇ": "ѣ", "ᲈ": "ꙋ", "ẖ": "ẖ", "ẗ": "ẗ",
  "ẘ": "ẘ", "ẙ": "ẙ", "ẚ": "aʾ", "ẛ": "ṡ", "ẞ": "ss", "ὐ": "ὐ",
  "ὒ": "ὒ", "ὔ": "ὔ", "ὖ": "ὖ", "ᾀ": "ἀι", "ᾁ": "ἁι", "ᾂ": "ἂι",
  "ᾃ": "ἃι", "ᾄ": "ἄι", "ᾅ": "ἅι", "ᾆ": "ἆι", "ᾇ": "ἇι", "ᾈ": "ἀι",
  "ᾉ": "ἁι", "ᾊ": "ἂι", "ᾋ": "ἃι", "ᾌ": "ἄι", "ᾍ": "ἅι", "ᾎ": "ἆι",
  "ᾏ": "ἇι", "ᾐ": "ἠι", "ᾑ": "ἡι", "ᾒ": "ἢι", "ᾓ": "ἣι", "ᾔ": "ἤι",
  "ᾕ": "ἥι", "ᾖ": "ἦι", "ᾗ": "ἧι", "ᾘ": "ἠι", "ᾙ": "ἡι", "ᾚ": "ἢι",
  "ᾛ": "ἣι", "ᾜ": "ἤι", "ᾝ": "ἥι", "ᾞ": "ἦι", "ᾟ": "ἧι", "ᾠ": "ὠι",
  "ᾡ": "ὡι", "ᾢ": "ὢι", "ᾣ": "ὣι", "ᾤ": "ὤι", "ᾥ": "ὥι", "ᾦ": "ὦι",
  "ᾧ": "ὧι", "ᾨ": "ὠι", "ᾩ": "ὡι", "ᾪ": "ὢι", "ᾫ": "ὣι", "ᾬ": "ὤι",
  "ᾭ": "ὥι", "ᾮ": "ὦι", "ᾯ": "ὧι", "ᾲ": "ὰι", "ᾳ": "αι", "ᾴ": "άι",
  "ᾶ": "ᾶ", "ᾷ": "ᾶι", "ᾼ": "αι", "ι": "ι", "ῂ": "ὴι", "ῃ": "ηι",
  "ῄ": "ήι", "ῆ": "ῆ", "ῇ": "ῆι", "ῌ": "ηι", "ῒ": "ῒ", "ΐ": "ΐ",
  "ῖ": "ῖ", "ῗ": "ῗ", "ῢ": "ῢ", "ΰ": "ΰ", "ῤ": "ῤ", "ῦ": "ῦ",
  "ῧ": "ῧ", "ῲ": "ὼι", "ῳ": "ωι", "ῴ": "ώι", "ῶ": "ῶ", "ῷ": "ῶι",
  "ῼ": "ωι", "ꭰ": "Ꭰ", "ꭱ": "Ꭱ", "ꭲ": "Ꭲ", "ꭳ": "Ꭳ", "ꭴ": "Ꭴ",
  "ꭵ": "Ꭵ", "ꭶ": "Ꭶ", "ꭷ": "Ꭷ", "ꭸ": "Ꭸ", "ꭹ": "Ꭹ", "ꭺ": "Ꭺ",
  "ꭻ": "Ꭻ", "ꭼ": "Ꭼ", "ꭽ": "Ꭽ", "ꭾ": "Ꭾ", "ꭿ": "Ꭿ", "ꮀ": "Ꮀ",
  "ꮁ": "Ꮁ", "ꮂ": "Ꮂ", "ꮃ": "Ꮃ", "ꮄ": "Ꮄ", "ꮅ": "Ꮅ", "ꮆ": "Ꮆ",
  "ꮇ": "Ꮇ", "ꮈ": "Ꮈ", "ꮉ": "Ꮉ", "ꮊ": "Ꮊ", "ꮋ": "Ꮋ", "ꮌ": "Ꮌ",
  "ꮍ": "Ꮍ", "ꮎ": "Ꮎ", "ꮏ": "Ꮏ", "ꮐ": "Ꮐ", "ꮑ": "Ꮑ", "ꮒ": "Ꮒ",
  "ꮓ": "Ꮓ", "ꮔ": "Ꮔ", "ꮕ": "Ꮕ", "ꮖ": "Ꮖ", "ꮗ": "Ꮗ", "ꮘ": "Ꮘ",
  "ꮙ": "Ꮙ", "ꮚ": "Ꮚ", "ꮛ": "Ꮛ", "ꮜ": "Ꮜ", "ꮝ": "Ꮝ", "ꮞ": "Ꮞ",
  "ꮟ": "Ꮟ", "ꮠ": "Ꮠ", "ꮡ": "Ꮡ", "ꮢ": "Ꮢ", "ꮣ": "Ꮣ", "ꮤ": "Ꮤ",
  "ꮥ": "Ꮥ", "ꮦ": "Ꮦ", "ꮧ": "Ꮧ", "ꮨ": "Ꮨ", "ꮩ": "Ꮩ", "ꮪ": "Ꮪ",
  "ꮫ": "Ꮫ", "ꮬ": "Ꮬ", "ꮭ": "Ꮭ", "ꮮ": "Ꮮ", "ꮯ": "Ꮯ", "ꮰ": "Ꮰ",
  "ꮱ": "Ꮱ", "ꮲ": "Ꮲ", "ꮳ": "Ꮳ", "ꮴ": "Ꮴ", "ꮵ": "Ꮵ", "ꮶ": "Ꮶ",
  "ꮷ": "Ꮷ", "ꮸ": "Ꮸ", "ꮹ": "Ꮹ", "ꮺ": "Ꮺ", "ꮻ": "Ꮻ", "ꮼ": "Ꮼ",
  "ꮽ": "Ꮽ", "ꮾ": "Ꮾ", "ꮿ": "Ꮿ", "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl",
  "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st", "ﬓ": "մն", "ﬔ": "մե",
  "ﬕ": "մի", "ﬖ": "վն", "ﬗ": "մխ"
};

// Fold a single code point for case-insensitive comparison. The result
// may be several code points long ('\u00df' -> 'ss', '\u0130' -> 'i\u0307').
function foldCodePoint(ch) {
  var folded = caseFoldOverrides[ch];
  return folded !== undefined ? folded : ch.toLowerCase();
}

// Split a string into code points so surrogate pairs (emoji, non-BMP
// scripts) are never split apart.
function toCodePoints(str) {
  var chars = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      var trail = str.charCodeAt(i + 1);
      if (trail >= 0xdc00 && trail <= 0xdfff) {
        chars.push(str.slice(i, i + 2));
        i++;
        continue;
      }
    }
    chars.push(str[i]);
  }
  return chars;
}

// Expand one original character into the folded code points used for
// comparison. The character is first decomposed (NFD) so that precomposed
// and decomposed spellings compare equal ('\u00e1' === 'a\u0301') and so
// that characters folding through their decomposition (Greek letters with
// ypogegrammeni, '\u0130') line up with their folded forms.
function foldedUnits(ch) {
  var units = [];
  var decomposed = ch.normalize("NFD");
  var cps = toCodePoints(decomposed);
  for (var i = 0; i < cps.length; i++) {
    var folded = foldCodePoint(cps[i]);
    var fps = toCodePoints(folded.normalize("NFD"));
    for (var j = 0; j < fps.length; j++) {
      units.push(fps[j]);
    }
  }
  return units;
}

// Return all elements of `array` that have a fuzzy
// match against `pattern`.
fuzzy.simpleFilter = function(pattern, array) {
  return array.filter(function(str) {
    return fuzzy.test(pattern, str);
  });
};

// Does `pattern` fuzzy match `str`?
fuzzy.test = function(pattern, str) {
  return fuzzy.match(pattern, str) !== null;
};

// If `pattern` matches `str`, wrap each matching character
// in `opts.pre` and `opts.post`. If no match, return null
fuzzy.match = function(pattern, str, opts) {
  opts = opts || {};
  var patternIdx = 0
    , result = []
    , totalScore = 0
    , currScore = 0
    // prefix
    , pre = opts.pre || ''
    // suffix
    , post = opts.post || ''
    , caseSensitive = !!opts.caseSensitive
    // The original string, as an array of code points
    , strChars = toCodePoints(str)
    // Folded comparison units of `str`, one entry per folded code point.
    // A single original character can expand to several units ('\u00df' ->
    // 'ss'), so `strUnitChar[u]` records which `strChars` entry unit `u`
    // came from; that is what gets wrapped when rendering.
    , strUnits = []
    , strUnitChar = []
    // Folded comparison units of the pattern
    , patternUnits = []
    // strChars indexes that participated in the match
    , matched = {}
    , i, j, units;

  for(i = 0; i < strChars.length; i++) {
    units = caseSensitive ? [strChars[i]] : foldedUnits(strChars[i]);
    for(j = 0; j < units.length; j++) {
      strUnitChar[strUnits.length] = i;
      strUnits[strUnits.length] = units[j];
    }
  }

  var patternChars = toCodePoints(pattern);
  for(i = 0; i < patternChars.length; i++) {
    units = caseSensitive ? [patternChars[i]] : foldedUnits(patternChars[i]);
    for(j = 0; j < units.length; j++) {
      patternUnits[patternUnits.length] = units[j];
    }
  }

  // For each folded unit in the string, either mark its original
  // character as matched or reset the consecutive-match score
  for(i = 0; i < strUnits.length; i++) {
    if(strUnits[i] === patternUnits[patternIdx]) {
      matched[strUnitChar[i]] = true;
      patternIdx += 1;

      // consecutive characters should increase the score more than linearly
      currScore += 1 + currScore;
    } else {
      currScore = 0;
    }
    totalScore += currScore;
  }

  // return rendered string if we have a match for every char
  if(patternIdx === patternUnits.length) {
    for(i = 0; i < strChars.length; i++) {
      result[result.length] = matched[i] ? pre + strChars[i] + post : strChars[i];
    }
    // if the string is an exact match with pattern, totalScore should be maxed
    totalScore = (strUnits.join('') === patternUnits.join('')) ? Infinity : totalScore;
    return {rendered: result.join(''), score: totalScore};
  }

  return null;
};

// The normal entry point. Filters `arr` for matches against `pattern`.
// It returns an array with matching values of the type:
//
//     [{
//         string:   '<b>lah' // The rendered string
//       , index:    2        // The index of the element in `arr`
//       , original: 'blah'   // The original element in `arr`
//     }]
//
// `opts` is an optional argument bag. Details:
//
//    opts = {
//        // string to put before a matching character
//        pre:     '<b>'
//
//        // string to put after matching character
//      , post:    '</b>'
//
//        // Optional function. Input is an entry in the given arr`,
//        // output should be the string to test `pattern` against.
//        // In this example, if `arr = [{crying: 'koala'}]` we would return
//        // 'koala'.
//      , extract: function(arg) { return arg.crying; }
//    }
fuzzy.filter = function(pattern, arr, opts) {
  if(!arr || arr.length === 0) {
    return [];
  }
  if (typeof pattern !== 'string') {
    return arr;
  }
  opts = opts || {};
  return arr
    .reduce(function(prev, element, idx, arr) {
      var str = element;
      if(opts.extract) {
        str = opts.extract(element);
      }
      var rendered = fuzzy.match(pattern, str, opts);
      if(rendered != null) {
        prev[prev.length] = {
            string: rendered.rendered
          , score: rendered.score
          , index: idx
          , original: element
        };
      }
      return prev;
    }, [])

    // Sort by score. Browsers are inconsistent wrt stable/unstable
    // sorting, so force stable by using the index in the case of tie.
    // See http://ofb.net/~sethml/is-sort-stable.html
    .sort(function(a,b) {
      var compare = b.score - a.score;
      if(compare) return compare;
      return a.index - b.index;
    });
};


}());

