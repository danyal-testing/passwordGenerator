/**
 * clipboard.js
 * -------------------------------------------------------------------------
 * Copy-to-clipboard helper with a graceful fallback.
 *
 * The async Clipboard API is used when available and permitted. Some
 * browsers reject it over file://, so a hidden-textarea + execCommand("copy")
 * fallback is provided, which works in far more contexts.
 * -------------------------------------------------------------------------
 */
(function (PG) {
  "use strict";

  /** Legacy fallback using a temporary, off-screen textarea. */
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  /**
   * Copy text to the clipboard.
   * @param {string} text
   * @returns {Promise<void>} resolves on success, rejects on failure.
   */
  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Clipboard API blocked (often on file://) - fall through to fallback.
      }
    }
    if (!fallbackCopy(text)) throw new Error("COPY_FAILED");
  }

  PG.clipboard = { copyText: copyText };
})((window.PasswordGen = window.PasswordGen || {}));
