/*
 * Site music player for bridgitmckinney.github.io
 * Add to every page just before </head>:
 *   <script src="music-player.js?v=YYYYMMDDx" defer></script>
 *
 * Plays the songs in SONGS in a random order. Browsers do not allow a page to
 * start sound by itself, so the visitor presses Play once; after that the music
 * keeps going from page to page and picks up where it left off.
 *
 * TO ADD A SONG: put the .mp3 in the music/ folder and add one line to SONGS.
 * "about" is optional: a link to the place on the site that explains the song.
 * A page can offer its own button for a song:
 *   <button type="button" data-bm-song="music/where-we-land.mp3">Play the song</button>
 * Self-contained: injects its own styles and touches nothing else on the page.
 */
(function () {
  "use strict";

  var SONGS = [
    { file: "music/where-we-land.mp3?v=20261112a", title: "Where We Land", by: "Ryder Kane and Kira Vane",
      about: "books.html#where-we-land" },
    { file: "music/the-quiet-little-moments.mp3?v=20261112a", title: "The Quiet Little Moments", by: "Kira Vane",
      about: "books.html#where-we-land" },
    { file: "music/empty-place-beside-me.mp3?v=20261113a", title: "Empty Place Beside Me", by: "Ryder Kane",
      about: "books.html#empty-place-beside-me" }
  ];

  var KEY = "bmMusic";
  if (window.__bmMusicLoaded || !SONGS.length) return;
  window.__bmMusicLoaded = true;

  function load() {
    try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(s) {
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function shuffled(n, notFirst) {
    var a = [], i, j, t;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    // never start a new round with the song that just finished
    if (n > 1 && a[0] === notFirst) { t = a[0]; a[0] = a[1]; a[1] = t; }
    return a;
  }

  var state = load();
  var valid = state.order && state.order.length === SONGS.length &&
    state.order.every(function (x) { return x >= 0 && x < SONGS.length; });
  if (!valid) {
    state = { order: shuffled(SONGS.length, -1), pos: 0, time: 0, on: false };
  }

  var css = "\
#bm-music{position:fixed;left:20px;bottom:20px;z-index:99997;display:flex;align-items:center;gap:.5rem;\
max-width:calc(100vw - 110px);padding:.45rem .8rem .45rem .5rem;border-radius:999px;background:#16212e;color:#fff;\
font:15px/1.3 \"Alegreya Sans\",Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.35)}\
#bm-music button{flex:none;width:40px;height:40px;border-radius:50%;border:0;cursor:pointer;\
background:#f3c07a;color:#16212e;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center}\
#bm-music button.bm-next{width:34px;height:34px;background:transparent;color:#f3c07a;border:1px solid #f3c07a;font-size:14px}\
#bm-music button:focus-visible{outline:3px solid #fff;outline-offset:2px}\
#bm-music .bm-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
#bm-music .bm-title{font-weight:700}\
#bm-music .bm-by{color:#c9d2d8}\
#bm-music.bm-off .bm-next,#bm-music.bm-one .bm-next{display:none}\
#bm-music a{color:#f3c07a;white-space:nowrap;flex:none}\
#bm-music a:focus-visible{outline:3px solid #fff;outline-offset:2px}\
#bm-music.bm-off a{display:none}\
.song-box{margin:1.4rem 0 0;padding:.9rem 1.1rem 1rem;border-left:3px solid #a8500f;background:rgba(0,0,0,.035);scroll-margin-top:1.5rem}\
.song-box h3{margin:0 0 .3rem;font-size:1.15rem}\
.song-box p{margin:.3rem 0}\
.song-box .song-credit{font-family:\"Alegreya Sans\",Arial,sans-serif;font-size:1rem;color:#40566a}\
.song-box button{margin-top:.5rem;padding:.55rem 1.2rem;border:0;border-radius:6px;cursor:pointer;background:#16212e;color:#fff;\
font:700 1rem \"Alegreya Sans\",Arial,sans-serif}\
.song-box button:focus-visible{outline:3px solid #a8500f;outline-offset:3px}\
@media (max-width:520px){#bm-music{left:12px;bottom:12px;font-size:14px}#bm-music .bm-by{display:none}}\
@media print{#bm-music{display:none}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var bar = document.createElement("div");
  bar.id = "bm-music";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Music player");
  var playBtn = document.createElement("button");
  playBtn.type = "button";
  var nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "bm-next";
  nextBtn.setAttribute("aria-label", "Next song");
  nextBtn.textContent = "⏭︎";
  var text = document.createElement("span");
  text.className = "bm-text";
  var aboutLink = document.createElement("a");
  aboutLink.textContent = "About";
  bar.appendChild(playBtn);
  bar.appendChild(text);
  bar.appendChild(aboutLink);
  bar.appendChild(nextBtn);

  var audio = new Audio();
  audio.preload = "none";

  function song() { return SONGS[state.order[state.pos]]; }

  function show() {
    var playing = !audio.paused;
    bar.className = (state.on ? "" : "bm-off") + (SONGS.length < 2 ? " bm-one" : "");
    if (song().about) {
      aboutLink.href = song().about;
      aboutLink.setAttribute("aria-label", "About the song " + song().title);
      aboutLink.style.display = "";
    } else { aboutLink.style.display = "none"; }
    pageButtons(playing);
    playBtn.textContent = playing ? "⏸︎" : "▶︎";
    playBtn.setAttribute("aria-label", playing ? "Pause music" : "Play music");
    text.textContent = "";
    if (state.on) {
      var t = document.createElement("span");
      t.className = "bm-title";
      t.textContent = song().title;
      text.appendChild(t);
      if (song().by) {
        var b = document.createElement("span");
        b.className = "bm-by";
        b.textContent = " · " + song().by;
        text.appendChild(b);
      }
    } else {
      text.textContent = "Play music from the books";
    }
  }

  function bare(f) { return String(f).split("?")[0]; }
  function pageButtons(playing) {
    var bs = document.querySelectorAll("[data-bm-song]"), i, mine;
    for (i = 0; i < bs.length; i++) {
      mine = playing && bare(song().file) === bare(bs[i].getAttribute("data-bm-song"));
      bs[i].textContent = mine ? "\u23F8\uFE0E Pause the song" : "\u25B6\uFE0E Play the song";
    }
  }

  function start(fromTime) {
    audio.src = song().file;
    var seek = fromTime || 0;
    if (seek > 0) {
      audio.addEventListener("loadedmetadata", function once() {
        audio.removeEventListener("loadedmetadata", once);
        try { audio.currentTime = seek; } catch (e) {}
      });
    }
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () { show(); });   // browser said no: stay paused, visitor can press Play
    }
  }

  function next() {
    if (SONGS.length < 2 && audio.ended) {
      // only one song on the site: let it finish and go quiet instead of looping
      state.on = false; state.time = 0; save(state); show();
      return;
    }
    var last = state.order[state.pos];
    state.pos++;
    if (state.pos >= state.order.length) {
      state.order = shuffled(SONGS.length, last);
      state.pos = 0;
    }
    state.time = 0;
    save(state);
    start(0);
    show();
  }

  // The visitor's last choice always wins. "on" is only ever true while music is
  // actually playing, so a visitor who stops it (our button, a keyboard media key,
  // a headset button, the phone's lock-screen controls) stays stopped on every
  // page after that, until they press Play again themselves.
  var leaving = false;
  var channel = null;
  try { channel = new BroadcastChannel("bm-music"); } catch (e) {}

  playBtn.addEventListener("click", function () {
    if (audio.paused) {
      if (audio.src && audio.currentTime > 0) { audio.play(); } else { start(state.time); }
      if (window.bmStats) window.bmStats.send("music/play", "Music: play pressed", true);
    } else {
      audio.pause();
    }
  });
  nextBtn.addEventListener("click", next);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-bm-song]");
    if (!b) return;
    var want = bare(b.getAttribute("data-bm-song")), i, at = -1;
    for (i = 0; i < state.order.length; i++) {
      if (bare(SONGS[state.order[i]].file) === want) at = i;
    }
    if (at < 0) return;
    if (at === state.pos && !audio.paused) { audio.pause(); return; }
    if (at === state.pos && audio.src && audio.currentTime > 0 && !audio.ended) { audio.play(); }
    else { state.pos = at; state.time = 0; save(state); start(0); }
    if (window.bmStats) window.bmStats.send("music/play/" + want.replace(/^music\/|\.mp3$/g, ""), "Music: " + SONGS[state.order[at]].title + " played from its page", true);
  });
  audio.addEventListener("ended", next);
  audio.addEventListener("play", function () {
    state.on = true;
    save(state);
    if (channel) channel.postMessage("playing");   // only one tab sings at a time
    show();
  });
  audio.addEventListener("pause", function () {
    // Not a real stop when the song simply finished or the page is being left.
    if (!leaving && !audio.ended) {
      state.on = false;
      state.time = audio.currentTime;
      save(state);
    }
    show();
  });
  if (channel) {
    channel.onmessage = function () {
      // Another tab of the site started playing: go quiet here, but do not
      // record it as the visitor stopping the music.
      if (!audio.paused) { leaving = true; audio.pause(); leaving = false; show(); }
    };
  }
  audio.addEventListener("error", function () {
    // a missing or broken file: skip it instead of going silent
    if (state.on && SONGS.length > 1) next();
  });
  audio.addEventListener("timeupdate", function () {
    if (Math.abs(audio.currentTime - state.time) >= 2) {
      state.time = audio.currentTime;
      save(state);
    }
  });
  window.addEventListener("beforeunload", function () { leaving = true; });
  window.addEventListener("pagehide", function () {
    leaving = true;
    if (!audio.paused) state.time = audio.currentTime;
    save(state);
  });
  window.addEventListener("pageshow", function (e) {
    // Back/forward can bring a saved page back to life: follow the latest choice.
    leaving = false;
    if (e.persisted) {
      var latest = load();
      if (latest.order) state = latest;
      if (!state.on && !audio.paused) audio.pause();
      show();
    }
  });

  function mount() {
    document.body.appendChild(bar);
    show();
    if (state.on) start(state.time);   // carry the music on to the next page
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
