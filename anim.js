// Lone Bull Games - hareketli sahne: şimşek, yağmur, düşen bloklar ve karakterler
(function () {
  var azHareket = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------- karakterler (sprite sayfaları) ----------------
  function Karakter(id, url, fw, fh, sutun) {
    this.el = document.getElementById(id);
    this.fw = fw; this.fh = fh; this.sutun = sutun; this.kare = -1;
    if (!this.el) return;
    this.el.style.backgroundImage = "url(" + url + ")";
  }
  Karakter.prototype.ciz = function (k) {
    if (!this.el || k === this.kare) return;
    this.kare = k;
    var w = this.el.clientWidth, olc = w / this.fw, h = this.fh * olc;
    this.el.style.backgroundSize = (this.sutun * w) + "px auto";
    this.el.style.backgroundPosition = (-(k % this.sutun) * w) + "px " + (-Math.floor(k / this.sutun) * h) + "px";
  };
  Karakter.prototype.yenile = function () { var k = this.kare; this.kare = -1; this.ciz(Math.max(k, 0)); };

  var canavar = new Karakter("canavar", "img/anim_canavar.webp", 208, 234, 6);   // 18 kare: sağa sola bakar
  var tilki = new Karakter("tilki", "img/anim_tilki.webp", 224, 224, 5);         // 25 kare: tüfeği kaldır, tara, indir
  var ejder = new Karakter("ejder", "img/anim_ejder.webp", 224, 224, 8);         // 32 kare: kükrer, ateş üfler

  function canavarKare(t) {          // ileri-geri, saniyede 7 kare
    var n = 18, tur = 2 * (n - 1), f = Math.floor(t * 7) % tur;
    return f < n ? f : tur - f;
  }
  function tilkiKare(t) {
    var bekle = 2.4, kaldir = 6 / 16, tara = 3 * 13 / 16, indir = 6 / 10, top = bekle + kaldir + tara + indir;
    var x = t % top;
    if (x < bekle) return 0;
    x -= bekle;
    if (x < kaldir) return Math.floor(x * 16);
    x -= kaldir;
    if (x < tara) return 6 + Math.floor(x * 16) % 13;
    x -= tara;
    return Math.min(24, 19 + Math.floor(x * 10));
  }
  function ejderKare(t) {
    var bekle = 3.2, oyna = 3.0, x = t % (bekle + oyna);
    return x < bekle ? 0 : Math.min(31, Math.floor((x - bekle) / oyna * 32));
  }

  // ---------------- gökyüzü (canvas) ----------------
  var tuval = document.getElementById("gok");
  var cx = tuval ? tuval.getContext("2d") : null;
  var W = 0, H = 0, dpr = 1, simsekX = 0;
  var damlalar = [], bloklar = [], simsekler = [], parlama = 0, sonrakiSimsek = 1.2, sonrakiBlok = 0.3;
  var RENKLER = ["#3fd8ff", "#ffd23f", "#b46bff", "#45e07a", "#ff5a6e", "#4f8bff", "#ff9a3c"];
  var SEKILLER = [[[0,0],[1,0],[2,0],[3,0]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[2,0],[1,1]],
    [[1,0],[2,0],[0,1],[1,1]], [[0,0],[1,0],[1,1],[2,1]], [[0,0],[0,1],[1,1],[2,1]], [[2,0],[0,1],[1,1],[2,1]]];
  var hucreResmi = {};

  function hucre(renk, b) {          // parlak blok karesi (önceden çizilir, hızlı olsun)
    var key = renk + b;
    if (hucreResmi[key]) return hucreResmi[key];
    var p = 10, c = document.createElement("canvas"); c.width = c.height = b + p * 2;
    var g = c.getContext("2d");
    g.shadowColor = renk; g.shadowBlur = 9; g.fillStyle = renk;
    g.fillRect(p + 1, p + 1, b - 2, b - 2);
    g.shadowBlur = 0;
    var gr = g.createLinearGradient(0, p, 0, p + b);
    gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(0.5, "rgba(255,255,255,0.05)"); gr.addColorStop(1, "rgba(0,0,0,0.25)");
    g.fillStyle = gr; g.fillRect(p + 1, p + 1, b - 2, b - 2);
    g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 1; g.strokeRect(p + 1.5, p + 1.5, b - 3, b - 3);
    hucreResmi[key] = c;
    return c;
  }

  function boyutla() {
    if (!tuval) return;
    var r = tuval.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    tuval.width = Math.round(W * dpr); tuval.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(W / (W < 700 ? 14 : 11));
    damlalar = [];
    for (var i = 0; i < n; i++) damlalar.push(yeniDamla(true));
    [canavar, tilki, ejder].forEach(function (k) { k.yenile(); });
  }
  function yeniDamla(ilk) {
    return { x: Math.random() * (W + 200) - 100, y: ilk ? Math.random() * H : -30 - Math.random() * 60,
      v: 650 + Math.random() * 350, u: 12 + Math.random() * 16, a: 0.08 + Math.random() * 0.16 };
  }
  function blokX(gen) {             // geniş ekranda yazıların üstüne değil, kenarlara düşsün
    if (W > 900) return Math.random() < 0.5 ? Math.random() * (W * 0.30 - gen) : W * 0.70 + Math.random() * (W * 0.30 - gen);
    return Math.random() * (W - gen);
  }
  function yeniBlok() {
    var b = W < 700 ? 13 : 17, sekil = SEKILLER[Math.floor(Math.random() * SEKILLER.length)];
    var gen = 0;
    sekil.forEach(function (h) { gen = Math.max(gen, (h[0] + 1) * b); });
    bloklar.push({ x: blokX(gen), y: -b * 3, v: 45 + Math.random() * 55, b: b, sekil: sekil,
      renk: RENKLER[Math.floor(Math.random() * RENKLER.length)], a: W < 700 ? 0.38 : 0.62 });
  }
  function yeniSimsek() {
    var genis = W > 900, sol = Math.random() < 0.5;
    var x = genis ? (sol ? W * (0.05 + Math.random() * 0.15) : W * (0.80 + Math.random() * 0.15)) : W * (0.1 + Math.random() * 0.8);
    var xMin = genis ? (sol ? 10 : W * 0.76) : 10, xMax = genis ? (sol ? W * 0.24 : W - 10) : W - 10;   // yazıların üstüne kaymasın
    simsekX = x;
    var dal = [], y = 0, hedef = H * (0.55 + Math.random() * 0.4);
    var yollar = [];
    dal.push([x, y]);
    while (y < hedef) {
      y += 14 + Math.random() * 22; x = Math.min(xMax, Math.max(xMin, x + (Math.random() - 0.5) * 34));
      dal.push([x, y]);
      if (Math.random() < 0.13 && y < hedef * 0.8) {        // yan dal
        var bx = x, by = y, kol = [[bx, by]], yon = Math.random() < 0.5 ? -1 : 1;
        for (var i = 0; i < 4 + Math.random() * 4; i++) { bx += yon * (8 + Math.random() * 18); by += 10 + Math.random() * 16; kol.push([bx, by]); }
        yollar.push(kol);
      }
    }
    yollar.unshift(dal);
    simsekler.push({ yollar: yollar, t: 0, sure: 0.38 });
    parlama = 1;
    if (canavar.el) {
      canavar.el.classList.add("parla");
      setTimeout(function () { canavar.el.classList.remove("parla"); }, 380);
    }
  }
  function yolCiz(yol, kalinlik, renk) {
    cx.beginPath(); cx.moveTo(yol[0][0], yol[0][1]);
    for (var i = 1; i < yol.length; i++) cx.lineTo(yol[i][0], yol[i][1]);
    cx.lineWidth = kalinlik; cx.strokeStyle = renk; cx.stroke();
  }

  function gokGuncelle(dt) {
    if (!cx || W === 0) return;
    cx.clearRect(0, 0, W, H);
    // şimşek parlaması
    if (parlama > 0) {
      var pg = cx.createRadialGradient(simsekX, 0, 0, simsekX, 0, Math.min(W * 0.55, H * 0.92));   // şimşeğin çaktığı yerden yayılan ışık
      pg.addColorStop(0, "rgba(150,190,255," + (0.20 * parlama) + ")");
      pg.addColorStop(1, "rgba(150,190,255,0)");
      cx.fillStyle = pg; cx.fillRect(0, 0, W, H);
      parlama = Math.max(0, parlama - dt * 3.2);
    }
    // yağmur
    cx.lineCap = "round";
    for (var i = 0; i < damlalar.length; i++) {
      var d = damlalar[i];
      d.y += d.v * dt; d.x -= d.v * dt * 0.12;
      if (d.y > H + 30) damlalar[i] = d = yeniDamla(false);
      cx.strokeStyle = "rgba(170,205,255," + d.a + ")"; cx.lineWidth = 1.2;
      cx.beginPath(); cx.moveTo(d.x, d.y); cx.lineTo(d.x + d.u * 0.12, d.y - d.u); cx.stroke();
    }
    // düşen bloklar
    sonrakiBlok -= dt;
    if (sonrakiBlok <= 0) { yeniBlok(); sonrakiBlok = (W < 700 ? 1.1 : 0.55) + Math.random() * 0.7; }
    for (var j = bloklar.length - 1; j >= 0; j--) {
      var k = bloklar[j];
      k.y += k.v * dt;
      if (k.y > H + 20) { bloklar.splice(j, 1); continue; }
      var son = Math.min(1, (H - k.y) / (H * 0.25));      // aşağıda yavaşça kaybolur
      cx.globalAlpha = k.a * Math.max(0, son);
      var res = hucre(k.renk, k.b);
      for (var h = 0; h < k.sekil.length; h++) cx.drawImage(res, k.x + k.sekil[h][0] * k.b - 10, k.y + k.sekil[h][1] * k.b - 10);
    }
    cx.globalAlpha = 1;
    // şimşekler
    sonrakiSimsek -= dt;
    if (sonrakiSimsek <= 0) { yeniSimsek(); sonrakiSimsek = 2.4 + Math.random() * 3.2; }
    for (var s = simsekler.length - 1; s >= 0; s--) {
      var sm = simsekler[s];
      sm.t += dt;
      if (sm.t > sm.sure) { simsekler.splice(s, 1); continue; }
      var g = 1 - sm.t / sm.sure;
      if (Math.random() < 0.25) g *= 0.4;                 // titreme
      cx.save();
      cx.shadowColor = "rgba(120,180,255,1)"; cx.shadowBlur = 18;
      sm.yollar.forEach(function (yol, n) {
        var ana = n === 0;
        yolCiz(yol, ana ? 5 : 2.5, "rgba(110,170,255," + (0.45 * g) + ")");
        yolCiz(yol, ana ? 2 : 1, "rgba(235,245,255," + g + ")");
      });
      cx.restore();
    }
  }

  // ---------------- döngü ----------------
  var t0 = null, onceki = 0, gorunur = true;
  function dongu(zaman) {
    if (t0 === null) { t0 = zaman; onceki = zaman; }
    var dt = Math.min(0.05, (zaman - onceki) / 1000), t = (zaman - t0) / 1000;
    onceki = zaman;
    canavar.ciz(canavarKare(t));
    tilki.ciz(tilkiKare(t));
    ejder.ciz(ejderKare(t));
    if (gorunur) gokGuncelle(dt);
    requestAnimationFrame(dongu);
  }

  boyutla();
  window.addEventListener("resize", boyutla);
  if (azHareket) {                                      // hareket istemeyenlere sabit görüntü
    canavar.ciz(0); tilki.ciz(10); ejder.ciz(0);
    return;
  }
  if ("IntersectionObserver" in window && tuval) {
    new IntersectionObserver(function (e) { gorunur = e[0].isIntersecting; if (!gorunur && cx) cx.clearRect(0, 0, W, H); }).observe(tuval);
  }
  requestAnimationFrame(dongu);
})();
