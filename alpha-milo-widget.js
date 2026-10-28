/*
 * Alpha Milo Personal Assistant - website chat widget
 * Add to books.html just before </body>:
 *   <script src="alpha-milo-widget.js" defer></script>
 *
 * Contains NO secrets. The only value here is the public Make webhook URL,
 * which is protected server-side (origin check, validation, rate limits, spend caps).
 * Self-contained: injects its own styles and does not touch existing page scripts.
 */
(function () {
  "use strict";

  var WEBHOOK_URL = "https://hook.us2.make.com/o9sypn6p11vmcdlhbxfgqsin35ltt7wh";
  // Public by design. Cloudflare Turnstile SITE key (never put the secret key here).
  var TURNSTILE_SITE_KEY = "0x4AAAAAAFppjoSBmZVsk7Gy";
  var MAX_LEN = 500;          // must match server-side validation
  var TIMEOUT_MS = 60000;     // covers the bot check plus Make's reply (Make times out around 40s)
  var MIN_GAP_MS = 2000;      // client-side throttle between sends
  var ALLOWED_LINK_HOSTS = [
    "bridgitmckinney.github.io", "payhip.com", "www.amazon.com", "books2read.com"
  ];
  var KEY = "alphaMiloSession";

  if (window.__alphaMiloLoaded) return;
  window.__alphaMiloLoaded = true;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" +
