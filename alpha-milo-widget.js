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
  var TIMEOUT_MS = 30000;     // Make webhook responses time out around 40s
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
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function getSession() {
    try {
      var s = localStorage.getItem(KEY);
      if (!s) { s = uuid(); localStorage.setItem(KEY, s); }
      return s;
    } catch (e) { return window.__milo_tmp || (window.__milo_tmp = uuid()); }
  }
  function resetSession() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    window.__milo_tmp = null;
  }

  var css = "\
#milo-btn{position:fixed;right:20px;bottom:20px;z-index:99998;width:60px;height:60px;border-radius:50%;border:0;background:#4a2c6d;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}\
#milo-panel{position:fixed;right:20px;bottom:90px;z-index:99999;width:360px;max-width:calc(100vw - 24px);height:500px;max-height:calc(100vh - 110px);background:#fff;color:#222;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.35);display:none;flex-direction:column;overflow:hidden;font:15px/1.4 system-ui,Segoe UI,Arial,sans-serif}\
#milo-panel.open{display:flex}\
#milo-head{background:#4a2c6d;color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center}\
#milo-head b{font-size:16px}\
#milo-head button{background:none;border:0;color:#fff;cursor:pointer;font-size:13px;margin-left:10px;text-decoration:underline}\
#milo-log{flex:1;overflow-y:auto;padding:12px;background:#f6f3fa}\
.milo-m{max-width:85%;margin:6px 0;padding:8px 11px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}\
.milo-u{background:#4a2c6d;color:#fff;margin-left:auto;border-bottom-right-radius:3px}\
.milo-a{background:#fff;border:1px solid #ddd5e8;border-bottom-left-radius:3px}\
.milo-a a{color:#4a2c6d;text-decoration:underline}\
#milo-foot{border-top:1px solid #ddd;padding:8px;display:flex;gap:6px;background:#fff}\
#milo-in{flex:1;border:1px solid #bbb;border-radius:8px;padding:8px;font:inherit}\
#milo-send{border:0;background:#4a2c6d;color:#fff;border-radius:8px;padding:0 14px;cursor:pointer}\
#milo-send:disabled{opacity:.5;cursor:default}\
#milo-note{font-size:11px;color:#666;text-align:center;padding:2px 6px 6px;background:#fff}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement("button");
  btn.id = "milo-btn"; btn.type = "button"; btn.setAttribute("aria-label", "Chat with Alpha Milo");
  btn.textContent = "\uD83D\uDC3A";

  var panel = document.createElement("div");
  panel.id = "milo-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Alpha Milo chat");
  panel.innerHTML =
    '<div id="milo-head"><b>Alpha Milo</b><span><button type="button" id="milo-new">New chat</button><button type="button" id="milo-x" aria-label="Close">Close</button></span></div>' +
    '<div id="milo-log" aria-live="polite"></div>' +
    '<div id="milo-foot"><input id="milo-in" type="text" maxlength="' + MAX_LEN + '" placeholder="Ask about the books..." autocomplete="off"><button id="milo-send" type="button">Send</button></div>' +
    '<div id="milo-note">AI assistant. Please don\u2019t share passwords or payment details.</div>';
  document.body.appendChild(btn); document.body.appendChild(panel);

  var log = panel.querySelector("#milo-log");
  var input = panel.querySelector("#milo-in");
  var send = panel.querySelector("#milo-send");
  var busy = false, lastSent = 0;

  // Safe rendering: text nodes only; URLs become links only for allowed hosts.
  function renderSafe(el, text) {
    var re = /https:\/\/[^\s<>"')]+/g, last = 0, m;
    while ((m = re.exec(text))) {
      el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var url = m[0].replace(/[.,;!?]+$/, ""), host = "";
      try { host = new URL(url).hostname; } catch (e) {}
      if (ALLOWED_LINK_HOSTS.indexOf(host) !== -1) {
        var a = document.createElement("a");
        a.href = url; a.textContent = url; a.target = "_blank"; a.rel = "noopener noreferrer";
        el.appendChild(a);
      } else { el.appendChild(document.createTextNode(url)); }
      last = m.index + url.length; re.lastIndex = last;
    }
    el.appendChild(document.createTextNode(text.slice(last)));
  }
  function add(role, text) {
    var d = document.createElement("div");
    d.className = "milo-m " + (role === "user" ? "milo-u" : "milo-a");
    if (role === "user") d.textContent = text; else renderSafe(d, text);
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function greet() {
    add("bot", "Hi, I\u2019m Alpha Milo, Bridgit McKinney\u2019s AI assistant. Tell me what you like to read and I\u2019ll find your next book, or ask me anything about the series.");
  }

  // Cloudflare Turnstile: a fresh one-time token is requested for every message.
  var tsHolder = document.createElement("div");
  tsHolder.style.cssText = "position:fixed;right:20px;bottom:90px;z-index:100000";
  document.body.appendChild(tsHolder);
  var tsWidgetId = null, tsPending = null;
  function loadTurnstile() {
    return new Promise(function (resolve, reject) {
      if (window.turnstile) return resolve();
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("turnstile-load")); };
      document.head.appendChild(s);
    });
  }
  function getToken() {
    return loadTurnstile().then(function () {
      return new Promise(function (resolve, reject) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; reject(new Error("turnstile-timeout")); } }, 15000);
        function ok(t) { if (!done) { done = true; clearTimeout(timer); resolve(t); } }
        function bad() { if (!done) { done = true; clearTimeout(timer); reject(new Error("turnstile-failed")); } }
        if (tsWidgetId === null) {
          tsWidgetId = turnstile.render(tsHolder, {
            sitekey: TURNSTILE_SITE_KEY, appearance: "interaction-only", execution: "execute",
            callback: ok, "error-callback": bad, "expired-callback": bad
          });
        } else { turnstile.reset(tsWidgetId); }
        turnstile.execute(tsWidgetId);
      });
    });
  }

  async function sendMsg() {
    var text = input.value.trim();
    if (!text || busy) return;
    if (Date.now() - lastSent < MIN_GAP_MS) return;
    if (WEBHOOK_URL.indexOf("PASTE_") === 0) { add("bot", "Alpha Milo isn\u2019t connected yet."); return; }
    busy = true; send.disabled = true; lastSent = Date.now();
    input.value = ""; add("user", text);
    var typing = add("bot", "\u2026");
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
    try {
      var token = await getToken();
      // text/plain keeps this a CORS "simple request" (no preflight), which Make webhooks need.
      var res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({
          sessionId: getSession(), message: text.slice(0, MAX_LEN),
          page: location.pathname, ts: Date.now(), turnstileToken: token
        }),
        signal: ctl.signal, credentials: "omit", referrerPolicy: "origin"
      });
      var data = await res.json().catch(function () { return null; });
      typing.remove();
      if (res.status === 429) add("bot", (data && data.reply) || "I\u2019m getting a lot of questions right now. Please try again in a few minutes.");
      else if (!res.ok || !data || typeof data.reply !== "string") add("bot", "Sorry, I hit a snag. Please try again, or use the Contact page.");
      else add("bot", data.reply.slice(0, 2000));
    } catch (e) {
      typing.remove();
      var m = e && e.message || "";
      add("bot", e && e.name === "AbortError" ? "That took too long. Please try again."
        : m.indexOf("turnstile") === 0 ? "I couldn\u2019t verify your browser. Please refresh the page and try again."
        : "I can\u2019t reach my brain right now. Please try again shortly.");
    } finally {
      clearTimeout(timer); busy = false; send.disabled = false; input.focus();
    }
  }

  btn.addEventListener("click", function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) { if (!log.children.length) greet(); input.focus(); }
  });
  panel.querySelector("#milo-x").addEventListener("click", function () { panel.classList.remove("open"); });
  panel.querySelector("#milo-new").addEventListener("click", function () { resetSession(); log.textContent = ""; greet(); });
  send.addEventListener("click", sendMsg);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); sendMsg(); } });
})();
