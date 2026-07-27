import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadRuntime() {
  const window = {};
  window.window = window;
  const context = vm.createContext({
    window,
    crypto: webcrypto,
    Uint32Array,
    Object,
    Array,
    Number,
    Math,
    Set,
    Error,
    RangeError,
    TypeError,
  });

  for (const file of ["config.js", "random.js", "generator.js"]) {
    const source = readFileSync(resolve(ROOT, "js", file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }
  return window.PasswordGen;
}

const PG = loadRuntime();
const { SETS, OPTION_ORDER } = PG.config;
const { secureRandomInt, pick, secureShuffle } = PG.random;
const { poolFor, generatePassword, estimateStrength } = PG.generator;

test("configuration is immutable", () => {
  assert.equal(Object.isFrozen(PG.config), true);
  assert.equal(Object.isFrozen(SETS), true);
  assert.equal(Object.isFrozen(OPTION_ORDER), true);
  assert.equal(Object.isFrozen(PG.config.STRENGTH), true);
});

test("secureRandomInt validates bounds and stays in range", () => {
  for (const invalid of [0, -1, 1.5, Number.NaN, 0x100000001]) {
    assert.throws(() => secureRandomInt(invalid), RangeError);
  }
  for (const max of [1, 2, 3, 26, 95, 0x100000000]) {
    for (let i = 0; i < 500; i += 1) {
      const value = secureRandomInt(max);
      assert.equal(Number.isInteger(value), true);
      assert.equal(value >= 0 && value < max, true);
    }
  }
});

test("pick validates input and returns a member", () => {
  assert.throws(() => pick(""), TypeError);
  assert.throws(() => pick(null), TypeError);
  for (let i = 0; i < 200; i += 1) {
    assert.equal(SETS.symbols.includes(pick(SETS.symbols)), true);
  }
});

test("secureShuffle returns a permutation without mutating input", () => {
  const input = [1, 2, 3, 4, 5, 6];
  const before = input.slice();
  const shuffled = secureShuffle(input);
  assert.deepEqual(input, before);
  assert.deepEqual(shuffled.slice().sort(), before);
  assert.notEqual(shuffled, input);
  assert.throws(() => secureShuffle("not-an-array"), TypeError);
});

test("poolFor validates options", () => {
  assert.equal(
    poolFor(["uppercase", "numbers"]),
    SETS.uppercase + SETS.numbers
  );
  assert.throws(() => poolFor([]), /NO_OPTIONS/);
  assert.throws(() => poolFor(["uppercase", "uppercase"]), /INVALID_OPTIONS/);
  assert.throws(() => poolFor(["unknown"]), /INVALID_OPTIONS/);
});

test("generated passwords preserve length, charset, and selected-set coverage", () => {
  const combinations = [];
  for (let mask = 1; mask < 1 << OPTION_ORDER.length; mask += 1) {
    combinations.push(OPTION_ORDER.filter((_, index) => mask & (1 << index)));
  }

  for (const options of combinations) {
    const pool = poolFor(options);
    for (const length of new Set([options.length, 4, 16, 32])) {
      if (length < options.length) continue;
      for (let iteration = 0; iteration < 40; iteration += 1) {
        const password = generatePassword(length, options);
        assert.equal(password.length, length);
        assert.equal(
          [...password].every((character) => pool.includes(character)),
          true
        );
        for (const option of options) {
          assert.equal(
            [...password].some((character) => SETS[option].includes(character)),
            true
          );
        }
      }
    }
  }
});

test("generator rejects impossible or malformed requests", () => {
  assert.throws(() => generatePassword(0, ["uppercase"]), /INVALID_LENGTH/);
  assert.throws(() => generatePassword(4.5, ["uppercase"]), /INVALID_LENGTH/);
  assert.throws(() => generatePassword(3, OPTION_ORDER), /LENGTH_TOO_SHORT/);
  assert.throws(() => generatePassword(8, []), /NO_OPTIONS/);
  assert.throws(
    () => generatePassword(8, ["uppercase", "uppercase"]),
    /INVALID_OPTIONS/
  );
  assert.throws(() => generatePassword(8, ["not-real"]), /INVALID_OPTIONS/);
});

test("strength thresholds are stable at their boundaries", () => {
  assert.equal(estimateStrength(0, 26).level, "too-weak");
  assert.equal(estimateStrength(8, 26).level, "too-weak");
  assert.equal(estimateStrength(9, 26).level, "weak");
  assert.equal(estimateStrength(13, 26).level, "medium");
  assert.equal(estimateStrength(18, 26).level, "strong");
  assert.equal(estimateStrength(16, 0).level, "too-weak");
});
