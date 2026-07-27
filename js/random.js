/**
 * random.js
 * -------------------------------------------------------------------------
 * Cryptographically secure randomness helpers built on the Web Crypto API
 * (crypto.getRandomValues). Math.random() is deliberately NOT used: it is a
 * pseudo-random generator and is unsuitable for security-sensitive values.
 * -------------------------------------------------------------------------
 */
(function (PG) {
  "use strict";

  /**
   * Return a uniformly distributed integer in the range [0, max).
   * Rejection sampling removes the modulo bias a naive `value % max` has
   * when 2^32 is not an exact multiple of `max`.
   * @param {number} max Exclusive upper bound (positive integer).
   * @returns {number}
   */
  function secureRandomInt(max) {
    if (!Number.isInteger(max) || max <= 0 || max > 0x100000000) {
      throw new RangeError("max must be an integer between 1 and 2^32");
    }
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    let value;
    do {
      crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % max;
  }

  /** Pick a single random character from a string. */
  function pick(str) {
    if (typeof str !== "string" || str.length === 0) {
      throw new TypeError("str must be a non-empty string");
    }
    return str[secureRandomInt(str.length)];
  }

  /** Return a securely shuffled copy of an array (Fisher-Yates). */
  function secureShuffle(items) {
    if (!Array.isArray(items)) throw new TypeError("items must be an array");
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  }

  PG.random = {
    secureRandomInt: secureRandomInt,
    pick: pick,
    secureShuffle: secureShuffle,
  };
})((window.PasswordGen = window.PasswordGen || {}));
