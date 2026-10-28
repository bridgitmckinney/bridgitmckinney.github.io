/* Visitor counts for bridgitmckinney.goatcounter.com.
   Counts page visits, which free sample was opened, whether a reader reached
   the end of Chapter Two, and which store button was clicked. No cookies. */
(function(){
  function send(path, title, event){
    var tries = 0;
    (function go(){
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({path: path, title: title, event: !!event});
      } else if (tries++ < 40) { setTimeout(go, 250); }
    })();
  }
  window.bmStats = {send: send};

  // Store-button clicks anywhere on the site.
  document.addEventListener("click", function(e){
    var a = e.target.closest && e.target.closest("a");
    if (!a || !/amazon\.com|books2read\.com|payhip\.com/.test(a.href)) return;
    var book = a.getAttribute("data-book") || document.body.getAttribute("data-book");
    if (!book) {
      var row = a.closest("tr"), sec = a.closest("section.book");
      if (row) { var h = row.querySelector("th a"); book = h ? h.getAttribute("href").split("#").pop() : ""; }
      else if (sec) { book = sec.id; }
    }
    var col = a.closest("td") && a.closest("td").getAttribute("data-label");
    var label = (col ? col + " - " : "") + a.textContent.trim();
    var where = /read\.html/.test(location.pathname) ? "from free sample" : /month\.html/.test(location.pathname) ? "from book of the month" : /stores\.html/.test(location.pathname) ? "from where to buy" : "from books page";
    send("click/" + (book || "unknown") + "/" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
         "Store click: " + (book || "unknown") + " - " + label + " (" + where + ")", true);
  });
})();
