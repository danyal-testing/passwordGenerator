/**
 * main.js
 * -------------------------------------------------------------------------
 * Bootstraps the UI: wires DOM elements to the generator, strength meter,
 * theme toggle and clipboard, then renders the initial state.
 * Runs LAST (see the script load order in index.html).
 * Depends on: config, generator, theme, clipboard.
 * -------------------------------------------------------------------------
 */
(function (PG) {
  "use strict";

  const cfg = PG.config;
  const gen = PG.generator;
  const theme = PG.theme;
  const clipboard = PG.clipboard;

  const PLACEHOLDER = "generator__password--placeholder";

  // Map a strength level to the CSS modifier class used to colour the bars.
  const LEVEL_CLASS = {
    "too-weak": "strength__bar--too-weak",
    weak: "strength__bar--weak",
    medium: "strength__bar--medium",
    strong: "strength__bar--strong",
  };
  const ALL_LEVELS = Object.keys(LEVEL_CLASS).map(function (k) {
    return LEVEL_CLASS[k];
  });

  function init() {
    /* ---------------------------- Theme ---------------------------- */
    const themeToggle = document.querySelector("[data-theme-toggle]");
    const themeLabel = document.querySelector("[data-theme-label]");
    const storedTheme = theme.readStoredTheme();
    let currentTheme = storedTheme ?? theme.systemTheme();
    let userPinnedTheme = storedTheme !== null;
    theme.applyTheme(currentTheme, themeToggle, themeLabel);
    if (themeToggle) {
      themeToggle.addEventListener("click", function () {
        currentTheme = currentTheme === "dark" ? "light" : "dark";
        userPinnedTheme = true;
        theme.applyTheme(currentTheme, themeToggle, themeLabel);
        theme.storeTheme(currentTheme);
      });
    }
    // Follow live OS colour-scheme changes until the user pins a preference.
    theme.watchSystemTheme(function (osTheme) {
      if (userPinnedTheme) return;
      currentTheme = osTheme;
      theme.applyTheme(currentTheme, themeToggle, themeLabel);
    });

    /* -------- Element references (bound only via data-* hooks) ------ */
    const els = {
      password: document.querySelector("[data-password-output]"),
      slider: document.querySelector("[data-length-input]"),
      lengthValue: document.querySelector("[data-length-output]"),
      form: document.querySelector("[data-form]"),
      copyButton: document.querySelector("[data-copy-button]"),
      copyText: document.querySelector("[data-copy-text]"),
      copyAnnouncement: document.querySelector("[data-copy-announcement]"),
      generationStatus: document.querySelector("[data-generation-status]"),
      error: document.querySelector("[data-error]"),
      errorText: document.querySelector("[data-error-text]"),
      strengthText: document.querySelector("[data-strength-text]"),
      strengthAnnouncement: document.querySelector(
        "[data-strength-announcement]"
      ),
      generateLabel: document.querySelector("[data-generate-label]"),
      bars: Array.prototype.slice.call(
        document.querySelectorAll("[data-strength-bar]")
      ),
      options: {},
    };
    cfg.OPTION_ORDER.forEach(function (name) {
      els.options[name] = document.querySelector(
        '[data-option="' + name + '"]'
      );
    });

    let copyTimer;
    const EMPTY_PASSWORD = "Generate a password";
    let generatedLength = 0;

    /* --------------------------- Helpers --------------------------- */
    /** Currently selected option keys, in stable order. */
    function selected() {
      return cfg.OPTION_ORDER.filter(function (n) {
        return els.options[n].checked;
      });
    }

    /** Sync the slider fill gradient and the numeric length readout. */
    function updateSlider() {
      const v = Number(els.slider.value);
      const min = Number(els.slider.min);
      const max = Number(els.slider.max);
      const pct = ((v - min) / (max - min)) * 100;
      els.slider.style.setProperty("--fill", pct + "%");
      els.lengthValue.textContent = els.slider.value;
      els.slider.setAttribute(
        "aria-valuetext",
        els.slider.value + " characters"
      );
    }

    /** Recompute and paint the strength meter. */
    function updateStrength() {
      const opts = selected();
      els.bars.forEach(function (b) {
        b.classList.remove.apply(b.classList, ALL_LEVELS);
      });
      if (opts.length === 0 || els.password.classList.contains(PLACEHOLDER)) {
        els.strengthText.textContent = "\u2014"; // em dash
        return null;
      }
      const r = gen.estimateStrength(
        Number(els.slider.value),
        gen.poolFor(opts).length
      );
      els.strengthText.textContent = r.label;
      for (let i = 0; i < r.bars; i++) {
        els.bars[i].classList.add(LEVEL_CLASS[r.level]);
      }
      return r;
    }

    /** Re-trigger a polite live region even when the same message repeats. */
    function announce(element, message) {
      element.textContent = "";
      requestAnimationFrame(function () {
        element.textContent = message;
      });
    }

    /** Replay the subtle "pop" animation on the password output. */
    function flashUpdated() {
      els.password.classList.remove("is-updated");
      void els.password.offsetWidth; // force reflow so the animation replays
      els.password.classList.add("is-updated");
    }

    /* Preserve a maximum of two lines for long passwords. A monospace glyph
       is approximately .62em wide, so sixteen characters per line gives a
       reliable two-line cap even in a narrow split-pane or folded viewport. */
    function fitPasswordTypography() {
      if (
        generatedLength < 28 ||
        els.password.classList.contains(PLACEHOLDER)
      ) {
        els.password.style.removeProperty("font-size");
        return;
      }
      const baseSize = Number.parseFloat(
        getComputedStyle(els.password).fontSize
      );
      const maxTwoLineSize = els.password.clientWidth / 16 / 0.62;
      const fittedSize = Math.max(12, Math.min(baseSize, maxTwoLineSize));
      els.password.style.fontSize = fittedSize.toFixed(2) + "px";
    }

    /** Generate a new password (or surface the "pick an option" error). */
    function render() {
      const opts = selected();
      const ok = opts.length > 0;
      els.error.hidden = ok;
      if (!ok) {
        els.errorText.textContent =
          "Select at least one character type to generate a password.";
        announce(els.generationStatus, "Select at least one character type.");
        return;
      }
      try {
        els.password.textContent = gen.generatePassword(
          Number(els.slider.value),
          opts
        );
      } catch {
        els.errorText.textContent =
          "Secure password generation is not available in this browser.";
        els.error.hidden = false;
        announce(
          els.generationStatus,
          "Secure password generation is not available in this browser."
        );
        return;
      }
      generatedLength = Number(els.slider.value);
      els.password.classList.remove(PLACEHOLDER);
      els.copyButton.disabled = false;
      els.copyButton.setAttribute("title", "Copy password to clipboard");
      els.generateLabel.textContent = "Generate another";
      requestAnimationFrame(function () {
        fitPasswordTypography();
        flashUpdated();
      });
      const strength = updateStrength();
      announce(
        els.generationStatus,
        "New password generated. Use the copy button to copy it."
      );
      if (strength) {
        announce(
          els.strengthAnnouncement,
          "Password strength: " + strength.label.replace("!", "")
        );
      }
    }

    function resetCopy() {
      els.copyButton.classList.remove("is-copied", "is-error");
      els.copyText.textContent = "";
    }

    /** Clear a generated value when its generating settings become stale. */
    function invalidatePassword() {
      if (els.password.classList.contains(PLACEHOLDER)) return;
      els.password.textContent = EMPTY_PASSWORD;
      generatedLength = 0;
      els.password.classList.add(PLACEHOLDER);
      els.password.style.removeProperty("font-size");
      els.copyButton.disabled = true;
      els.copyButton.setAttribute("title", "Generate a password first");
      els.generateLabel.textContent = "Generate password";
      els.strengthAnnouncement.textContent = "";
      announce(
        els.generationStatus,
        "Settings changed. Generate a new password."
      );
      clearTimeout(copyTimer);
      resetCopy();
    }

    /** Show the "Copied" success state, then auto-reset after 2s. */
    function flashCopied() {
      els.copyButton.classList.remove("is-error");
      els.copyButton.classList.add("is-copied");
      els.copyText.textContent = "Copied";
      announce(els.copyAnnouncement, "Password copied to clipboard.");
      clearTimeout(copyTimer);
      copyTimer = setTimeout(resetCopy, 2000);
    }

    /** Surface copy failures instead of failing silently. */
    function flashCopyError() {
      els.copyButton.classList.remove("is-copied");
      els.copyButton.classList.add("is-error");
      els.copyText.textContent = "Copy failed";
      announce(
        els.copyAnnouncement,
        "Copy failed. Select the password and copy it manually."
      );
      clearTimeout(copyTimer);
      copyTimer = setTimeout(resetCopy, 3000);
    }

    function onCopy() {
      if (els.copyButton.disabled) return;
      if (els.password.classList.contains(PLACEHOLDER)) return;
      const pw = els.password.textContent.trim();
      if (!pw) return;
      clipboard.copyText(pw).then(flashCopied, flashCopyError);
    }

    /* --------------------------- Events ---------------------------- */
    els.slider.addEventListener("input", function () {
      invalidatePassword();
      updateSlider();
      updateStrength();
    });
    cfg.OPTION_ORDER.forEach(function (name) {
      els.options[name].addEventListener("change", function () {
        invalidatePassword();
        if (selected().length > 0) els.error.hidden = true;
        updateStrength();
      });
    });
    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      render();
    });
    els.copyButton.addEventListener("click", onCopy);
    window.addEventListener("resize", fitPasswordTypography, { passive: true });

    /* ------------------------ Initial paint ------------------------ */
    updateSlider();
    updateStrength();
  }

  // Run after the DOM is ready. `defer` already guarantees this, but the
  // guard keeps the module safe if it is ever loaded differently.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})((window.PasswordGen = window.PasswordGen || {}));
