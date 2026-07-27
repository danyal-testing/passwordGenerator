/**
 * generator.js
 * -------------------------------------------------------------------------
 * Pure password-generation logic and strength estimation.
 * Depends on: config (character sets) and random (secure primitives).
 * -------------------------------------------------------------------------
 */
(function (PG) {
  "use strict";

  const SETS = PG.config.SETS;
  const STRENGTH = PG.config.STRENGTH;
  const pick = PG.random.pick;
  const secureShuffle = PG.random.secureShuffle;

  /** Concatenate the character pools for the selected options. */
  function poolFor(options) {
    if (!Array.isArray(options) || options.length === 0) {
      throw new Error("NO_OPTIONS");
    }
    if (new Set(options).size !== options.length) {
      throw new Error("INVALID_OPTIONS");
    }
    options.forEach(function (option) {
      if (!Object.prototype.hasOwnProperty.call(SETS, option)) {
        throw new Error("INVALID_OPTIONS");
      }
    });
    return options
      .map(function (o) {
        return SETS[o];
      })
      .join("");
  }

  /**
   * Generate a password of `length` characters using the selected options.
   * At least one character from each selected set is guaranteed (up to the
   * requested length); the remainder is filled from the combined pool and
   * the whole result is shuffled so guaranteed characters are not ordered.
   * @param {number} length Requested length (1..32 in the UI).
   * @param {string[]} options Selected option keys.
   * @throws {Error} "NO_OPTIONS" when no option is selected.
   * @returns {string}
   */
  function generatePassword(length, options) {
    if (!Number.isSafeInteger(length) || length < 1) {
      throw new RangeError("INVALID_LENGTH");
    }
    const pool = poolFor(options);
    if (length < options.length) throw new RangeError("LENGTH_TOO_SHORT");
    const chars = [];
    const guaranteed = options.slice();
    for (let i = 0; i < guaranteed.length; i++) {
      chars.push(pick(SETS[guaranteed[i]]));
    }
    while (chars.length < length) chars.push(pick(pool));
    return secureShuffle(chars).join("");
  }

  /** Estimate strength from entropy (bits = length x log2(poolSize)). */
  function estimateStrength(length, poolSize) {
    const bits = poolSize > 0 ? length * Math.log2(poolSize) : 0;
    for (let i = 0; i < STRENGTH.length; i++) {
      if (bits < STRENGTH[i].maxBits) return STRENGTH[i];
    }
    return STRENGTH[STRENGTH.length - 1];
  }

  PG.generator = {
    poolFor: poolFor,
    generatePassword: generatePassword,
    estimateStrength: estimateStrength,
  };
})((window.PasswordGen = window.PasswordGen || {}));
