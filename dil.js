// Dil seçimi: ?lang=tr / ?lang=en, sonra seçilen dil, sonra tarayıcı dili
(function () {
  var kok = document.documentElement;
  function uygula(d) {
    kok.lang = d;
    var dugmeler = document.querySelectorAll("[data-sec]");
    for (var i = 0; i < dugmeler.length; i++) {
      dugmeler[i].classList.toggle("secili", dugmeler[i].getAttribute("data-sec") === d);
    }
  }
  var d = null;
  var m = location.search.match(/[?&]lang=(tr|en)/);
  if (m) d = m[1];
  if (!d) { try { d = localStorage.getItem("lbg_dil"); } catch (e) {} }
  if (d !== "tr" && d !== "en") d = (navigator.language || "en").toLowerCase().indexOf("tr") === 0 ? "tr" : "en";
  uygula(d);
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-sec]") : null;
    if (!b) return;
    var yeni = b.getAttribute("data-sec");
    uygula(yeni);
    try { localStorage.setItem("lbg_dil", yeni); } catch (e2) {}
  });
})();
