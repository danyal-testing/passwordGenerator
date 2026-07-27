/**
 * config.js
 * -------------------------------------------------------------------------
 * Static configuration for the Password Generator.
 *
 * ARCHITECTURE NOTE
 * The app is intentionally split into several small "classic" scripts that
 * share a single global namespace (`window.PasswordGen`). This keeps the
 * code modular (one concern per file) while still working when index.html
 * is opened directly from disk via the file:// protocol.
 *
 * Native ES modules (import/export) are blocked by the browser's CORS policy
 * on file://, so they only work behind a web server. Ordered classic scripts
 * do not have that limitation, which is why this project uses them. The load
 * order is defined in index.html:
 *   config -> random -> generator -> theme -> clipboard -> main
 * Each file only relies on namespace members defined by files loaded earlier.
 * -------------------------------------------------------------------------
 */
(function (PG) {
  "use strict";

  const SETS = Object.freeze({
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?/~",
  });

  const STRENGTH = Object.freeze([
    Object.freeze({
      maxBits: 40,
      level: "too-weak",
      bars: 1,
      label: "TOO WEAK!",
    }),
    Object.freeze({ maxBits: 60, level: "weak", bars: 2, label: "WEAK" }),
    Object.freeze({ maxBits: 80, level: "medium", bars: 3, label: "MEDIUM" }),
    Object.freeze({
      maxBits: Infinity,
      level: "strong",
      bars: 4,
      label: "STRONG",
    }),
  ]);

  PG.config = Object.freeze({
    /** Character pools for each option. */
    SETS: SETS,

    /** Stable option order; also the priority for guaranteed characters. */
    OPTION_ORDER: Object.freeze([
      "uppercase",
      "lowercase",
      "numbers",
      "symbols",
    ]),

    /**
     * Strength buckets keyed by entropy in bits (length x log2(poolSize)).
     * The first bucket whose `maxBits` exceeds the estimate is selected.
     */
    STRENGTH: STRENGTH,

    /** Theme persistence key + browser UI colours per theme. */
    THEME_KEY: "pg-theme",
    THEME_COLORS: Object.freeze({ dark: "#0a0b0e", light: "#eef1f6" }),
  });
})((window.PasswordGen = window.PasswordGen || {}));
