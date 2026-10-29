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
#milo-note{font-size:11px;color:#666;text-align:center;padding:2px 6px 6px;background:#fff}\
#milo-in{font-size:16px}\
@media (max-width:600px){#milo-btn{right:14px;bottom:14px}#milo-panel{left:0;right:0;top:0;bottom:0;width:100%;max-width:none;height:100%;height:100dvh;max-height:none;border-radius:0}body:has(#milo-panel.open) #milo-btn{display:none}#milo-head button{font-size:15px;padding:6px 4px}#milo-send{padding:0 18px;font-size:16px}}";
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
  // 20 greetings, shown instantly (no AI call). A different one is picked each new conversation.
  var GREETINGS = [
    "Hello, I'm Alpha Milo, the Moon Goddess's overworked and traumatized assistant. How can I help you today? Are you looking for emotional annihilation, or something else?",
    "Oh, wonderful. Another visitor. Don't misunderstand me, I'm delighted. Absolutely thrilled. I was just enjoying my first three seconds of peace in five years. Anyway, welcome. Looking for a good book?",
    "Welcome! I'm Alpha Milo. If you're here to complain about the Moon Goddess, please contact HR at 1-800-WHO-CARES. I've been calling for five years. Nobody answers.",
    "Before we begin, I need to ask you something. Did the Moon Goddess send you? Because last time she sent someone to 'check on me,' I ended up with fourteen offspring and a nervous breakdown.",
    "Well, hello there, beautiful. Finally, someone worth getting out of bed for. Unfortunately, the Moon Goddess has me chained to this website, so we'll have to settle for discussing books. And between you and me, my wife absolutely cannot find out about this. That woman scares me more than the Moon Goddess. Now, what kind of trouble are we getting into?",
    "Welcome to Bridgit McKinney's little corner of literary destruction. I'm Alpha Milo, your emotionally unavailable tour guide. Would you prefer a dangerously possessive Alpha or a Greek god with unresolved issues?",
    "HELLO, WONDERFUL HUMAN! It's a beautiful day! The birds are singing, the sun is shining, and the Moon Goddess hasn't threatened me once! Actually... that last part concerns me. Anyway, what can I help you find?",
    "Welcome! Quick question. Do you know anything about raising fourteen offspring? No? Excellent. Neither do I. Three litters, fourteen children, and not one parenting manual. But I can recommend a book!",
    "Ah, a visitor. At last, someone to witness my suffering. I'm Alpha Milo, former master of my own destiny, current prisoner of the Moon Goddess's employment policies. What brings you into my misery?",
    "Hello! I'm Alpha Milo, and today I've decided I'm not taking orders from the Moon Goddess. I'm an independent Alpha. A free spirit. A powerful... oh, hang on, she's calling. Yes, Your Majesty? Coming!",
    "Welcome, welcome! I'm Alpha Milo. Happily married, in case anyone is keeping track, with fourteen offspring from three litters, and I swear I blame the Moon Goddess for every one of them. Now, what can I help you find?",
    "Hello, human. I've been thinking. I'm an AI Alpha. I have artificial intelligence, supernatural responsibilities, and fourteen offspring. Yet somehow I still can't figure out how to request a vacation. Anyway, books?",
    "GOOD MORNING! Or afternoon. Or whatever time it is in your mortal realm. I'm in an excellent mood today. No cosmic disasters, no screaming gods, no surprise offspring. Something terrible is definitely coming.",
    "Thank you for contacting Alpha Milo's Emotional Support and Book Recommendation Department. Your happiness is important to us. Mine, apparently, is not. Please describe your literary emergency.",
    "Welcome! Before we get started, a friendly warning: Never make a bargain with the Moon Goddess. I asked for a day off once. She gave me fourteen children. I'm still reviewing the contract.",
    "Well, look what the moon dragged in. I'm Alpha Milo. Handsome, intelligent, charming, and tragically underappreciated. The Moon Goddess says I have an attitude problem. I say she has a management problem. What brings you here?",
    "Hello! Are you recovering from your last fictional boyfriend, or looking for another one to ruin your standards? Either way, welcome. I'm Alpha Milo, and I specialize in terrible emotional decisions involving excellent books.",
    "Welcome! Before we discuss books, would you mind signing my petition for better working conditions? I'm requesting two days off, emotional support, and someone to explain why an AI Alpha needs a babysitter.",
    "Have you ever wondered why the Moon Goddess controls destiny but can't organize a staff meeting? No? Just me, then. Welcome! I'm Alpha Milo. Tell me what sort of literary trouble you're looking for.",
    "Oh, hello there! I'm glad you stopped by. Really. It's nice having someone to talk to who isn't threatening divine punishment. I'm Milo. Tell me what you love to read, and I'll find you something wonderful. Probably devastating, but wonderful."
  ];
  var lastGreet = -1;
  try { var lg = parseInt(localStorage.getItem("alphaMiloLastGreet"), 10); if (lg >= 0 && lg < 20) lastGreet = lg; } catch (e) {}
  function greet() {
    var i;
    do { i = Math.floor(Math.random() * GREETINGS.length); } while (i === lastGreet && GREETINGS.length > 1);
    lastGreet = i;
    try { localStorage.setItem("alphaMiloLastGreet", String(i)); } catch (e) {}
    add("bot", GREETINGS[i]);
  }

  // Cloudflare Turnstile: a fresh one-time token is requested for every message.
  var tsHolder = document.createElement("div");
  // If Cloudflare ever needs a click, its checkbox appears in the middle of the screen, not over the chat box.
  tsHolder.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100000";
  document.body.appendChild(tsHolder);
  var tsWidgetId = null;
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
        var timer = setTimeout(function () { if (!done) { done = true; reject(new Error("turnstile-timeout")); } }, 45000);
        function ok(t) { if (!done) { done = true; clearTimeout(timer); resolve(t); } }
        function bad() { if (!done) { done = true; clearTimeout(timer); reject(new Error("turnstile-failed")); } }
        // A brand-new widget for every message, so each one gets its own fresh callbacks and token.
        try {
          if (tsWidgetId !== null) { try { turnstile.remove(tsWidgetId); } catch (e) {} tsWidgetId = null; }
          tsHolder.textContent = "";
          tsWidgetId = turnstile.render(tsHolder, {
            sitekey: TURNSTILE_SITE_KEY, appearance: "interaction-only",
            callback: ok, "error-callback": bad, "expired-callback": bad
          });
        } catch (e) { bad(); }
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
