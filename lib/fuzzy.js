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

// Split `str` into an array of its Unicode code points. Astral
// characters (surrogate pairs) are kept whole instead of being
// treated as two separate UTF-16 code units.
function toChars(str) {
  var chars = []
    , idx = 0
    , lead
    , trail;
  while(idx < str.length) {
    lead = str.charCodeAt(idx);
    if(lead >= 0xd800 && lead <= 0xdbff && idx + 1 < str.length) {
      trail = str.charCodeAt(idx + 1);
      if(trail >= 0xdc00 && trail <= 0xdfff) {
        chars[chars.length] = str.slice(idx, idx + 2);
        idx += 2;
        continue;
      }
    }
    chars[chars.length] = str[idx];
    idx += 1;
  }
  return chars;
}

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
    // The characters of `str`, as whole code points
    , strChars = toChars(str)
    // The characters to compare against. In case-insensitive mode this
    // is the lowercased form of `str`. The whole string is lowercased
    // at once because some mappings are context sensitive (e.g. 'Σ'
    // lowercases to 'ς' at the end of a word, 'σ' elsewhere)
    , compareChars = caseSensitive ? strChars.slice() : toChars(str.toLowerCase())
    // Maps each entry of `compareChars` back to the index of the
    // original character in `strChars`. Lowercasing a single character
    // may produce several code points (e.g. 'İ' -> 'i̇'), so
    // `compareChars` can be longer than `strChars`
    , compareToStr = []
    // Which characters of `strChars` participated in the match
    , matched = []
    , width
    , compareIdx
    , idx
    , k
    , ch;

  pattern = caseSensitive ? pattern : pattern.toLowerCase();
  var patternChars = toChars(pattern);

  // Align the comparison characters back to the original characters by
  // letting each original character consume as many comparison
  // characters as its own lowercased form contains
  compareIdx = 0;
  for(idx = 0; idx < strChars.length; idx++) {
    width = caseSensitive ? 1 : toChars(strChars[idx].toLowerCase()).length;
    for(k = 0; k < width && compareIdx < compareChars.length; k++) {
      compareToStr[compareIdx] = idx;
      compareIdx += 1;
    }
  }
  // If folding changed the length in an unexpected way, keep the
  // mapping total by assigning the rest to the last character
  for(; compareIdx < compareChars.length; compareIdx++) {
    compareToStr[compareIdx] = strChars.length - 1;
  }

  // Greedily walk the comparison characters; whenever one matches the
  // next pattern character, mark its original character as matched
  for(idx = 0; idx < compareChars.length; idx++) {
    if(patternIdx < patternChars.length && compareChars[idx] === patternChars[patternIdx]) {
      matched[compareToStr[idx]] = true;
      patternIdx += 1;

      // consecutive characters should increase the score more than linearly
      currScore += 1 + currScore;
    } else {
      currScore = 0;
    }
    totalScore += currScore;
  }

  // return rendered string if we have a match for every char
  if(patternIdx === patternChars.length) {
    // Wrap each matching character of the original string in the
    // template, keeping surrogate pairs and multi-code-point
    // case expansions intact
    for(idx = 0; idx < strChars.length; idx++) {
      ch = strChars[idx];
      if(matched[idx]) {
        ch = pre + ch + post;
      }
      result[result.length] = ch;
    }
    // if the string is an exact match with pattern, totalScore should be maxed
    totalScore = (compareChars.join('') === pattern) ? Infinity : totalScore;
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
