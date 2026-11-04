// Lone Bull Games - hareketli sahne
// Arka katman: yağmur, şimşek, sayfanın tepesinden dibine düşen bloklar.
// Ön katman: tilkinin mermileri, kovanlar, namlu dumanı, vurulan blokların parçaları, ejderin dumanı.
(function () {
  var azHareket = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------- karakterler (oyundaki sprite sayfaları) ----------------
  function Karakter(id, url, fw, fh, sutun) {
    this.el = document.getElementById(id);
    this.fw = fw; this.fh = fh; this.sutun = sutun; this.kare = -1;
    if (this.el) this.el.style.backgroundImage = "url(" + url + ")";
  }
  Karakter.prototype.ciz = function (k) {
    if (!this.el || k === this.kare) return;
    this.kare = k;
    var w = this.el.clientWidth, h = this.fh * (w / this.fw);
    this.el.style.backgroundSize = (this.sutun * w) + "px auto";
    this.el.style.backgroundPosition = (-(k % this.sutun) * w) + "px " + (-Math.floor(k / this.sutun) * h) + "px";
  };
  Karakter.prototype.yenile = function () { var k = this.kare; this.kare = -1; this.ciz(Math.max(k, 0)); };
  Karakter.prototype.kutu = function () { return this.el ? this.el.getBoundingClientRect() : null; };

  var canavar = new Karakter("canavar", "img/anim_dev.webp", 240, 404, 8);           // 40 kare: boydan Fırtına Devi
  var tilki = new Karakter("tilki", "img/anim_tilki.webp", 224, 224, 5);             // 25 kare: kaldır, tara, indir
  var ejder = new Karakter("ejder", "img/anim_ejder_nefes.webp", 224, 224, 8);       // 38 kare: ağzını açar, duman üfler

  // oyundaki namlu ucu ve ağız yerleri (karenin içinde 0..1)
  var NAMLU = [[.095,.544],[.095,.544],[.097,.543],[.097,.537],[.097,.538],[.090,.538],[.100,.537],[.104,.534],[.104,.533],[.104,.535],[.107,.530],[.104,.533],[.104,.538],[.090,.538],[.090,.562],[.143,.533],[.156,.535],[.169,.537],[.183,.544],[.090,.538],[.097,.538],[.097,.537],[.097,.543],[.095,.544],[.095,.544]];
  var AGIZ = [[.516,.263],[.513,.316],[.512,.370],[.510,.370],[.462,.342],[.462,.342],[.461,.327],[.461,.327],[.479,.332],[.479,.331],[.480,.327],[.482,.321],[.480,.316],[.480,.311],[.482,.308],[.480,.311],[.480,.316],[.482,.321],[.480,.327],[.482,.321],[.480,.316],[.480,.311],[.482,.308],[.482,.308],[.480,.311],[.480,.316],[.482,.321],[.480,.327],[.479,.331],[.479,.332],[.461,.327],[.461,.327],[.462,.342],[.462,.342],[.510,.370],[.512,.370],[.513,.316],[.516,.263]];

  function canavarKare(t) {          // ileri-geri, saniyede 11 kare
    var n = 40, tur = 2 * (n - 1), f = Math.floor(t * 11) % tur;
    return f < n ? f : tur - f;
  }
  // tilki: bekle, tüfeği kaldır, 3 tur tara (ateş), indir
  var T_BEKLE = 2.2, T_KALDIR = 6 / 16, T_TARA = 3 * 13 / 16, T_INDIR = 6 / 10, T_TOP = T_BEKLE + T_KALDIR + T_TARA + T_INDIR;
  function tilkiDurum(t) {
    var x = t % T_TOP;
    if (x < T_BEKLE) return { kare: 0, ates: false };
    x -= T_BEKLE;
    if (x < T_KALDIR) return { kare: Math.floor(x * 16), ates: false };
    x -= T_KALDIR;
    if (x < T_TARA) return { kare: 6 + Math.floor(x * 16) % 13, ates: true };
    x -= T_TARA;
    return { kare: Math.min(24, 19 + Math.floor(x * 10)), ates: false, sonra: x };
  }
  // ejder: bekle (burnundan ince duman), ağzını açıp duman üfle
  var E_BEKLE = 2.8, E_NEFES = 38 / 16;
  function ejderDurum(t) {
    var x = t % (E_BEKLE + E_NEFES);
    if (x < E_BEKLE) return { kare: 0, nefes: false };
    var k = Math.min(37, Math.floor((x - E_BEKLE) * 16));
    return { kare: k, nefes: k >= 4 && k <= 33 };
  }

  // ---------------- katmanlar ----------------
  var arka = document.getElementById("gok");
  var on = document.getElementById("efekt");
  var ax = arka ? arka.getContext("2d") : null;
  var ox = on ? on.getContext("2d") : null;
  var W = 0, H = 0, dpr = 1, simsekX = 0;
  var damlalar = [], bloklar = [], simsekler = [], parlama = 0, sonrakiSimsek = 1.2, sonrakiBlok = 0.2;
  var mermiler = [], parcalar = [], kovanlar = [], dumanlar = [], kivilcimlar = [], flasler = [], alevler = [], kuller = [];
  var RENKLER = ["#3fd8ff", "#ffd23f", "#b46bff", "#45e07a", "#ff5a6e", "#4f8bff", "#ff9a3c"];
  var SEKILLER = [[[0,0],[1,0],[2,0],[3,0]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[2,0],[1,1]],
    [[1,0],[2,0],[0,1],[1,1]], [[0,0],[1,0],[1,1],[2,1]], [[0,0],[0,1],[1,1],[2,1]], [[2,0],[0,1],[1,1],[2,1]]];
  var hucreResmi = {};

  function hucre(renk, b) {
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
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    [[arka, ax], [on, ox]].forEach(function (k) {
      if (!k[0]) return;
      k[0].width = Math.round(W * dpr); k[0].height = Math.round(H * dpr);
      k[1].setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    var n = Math.round(W / (W < 700 ? 16 : 12));
    damlalar = [];
    for (var i = 0; i < n; i++) damlalar.push(yeniDamla(true));
    [canavar, tilki, ejder].forEach(function (k) { k.yenile(); });
  }
  function yeniDamla(ilk) {
    return { x: Math.random() * (W + 200) - 100, y: ilk ? Math.random() * H : -30 - Math.random() * 60,
      v: 650 + Math.random() * 350, u: 12 + Math.random() * 16, a: 0.06 + Math.random() * 0.13 };
  }
  function blokX(gen) {             // geniş ekranda kenarlardan, dar ekranda her yerden düşer
    if (W > 900) return Math.random() < 0.5 ? Math.random() * (W * 0.30 - gen) : W * 0.70 + Math.random() * (W * 0.30 - gen);
    return Math.random() * (W - gen);
  }
  function yeniBlok(x, y) {
    var b = W < 700 ? 13 : 17, sekil = SEKILLER[Math.floor(Math.random() * SEKILLER.length)];
    var gen = 0, yuk = 0;
    sekil.forEach(function (h) { gen = Math.max(gen, (h[0] + 1) * b); yuk = Math.max(yuk, (h[1] + 1) * b); });
    var k = { x: x !== undefined ? x : blokX(gen), y: y !== undefined ? y : -b * 3, v: 55 + Math.random() * 60, b: b, gen: gen, yuk: yuk,
      sekil: sekil, renk: RENKLER[Math.floor(Math.random() * RENKLER.length)], a: W < 700 ? 0.45 : 0.62, can: 3 };
    bloklar.push(k);
    return k;
  }
  function yeniSimsek() {
    var genis = W > 900, sol = Math.random() < 0.5;
    var x = genis ? (sol ? W * (0.05 + Math.random() * 0.15) : W * (0.80 + Math.random() * 0.15)) : W * (0.1 + Math.random() * 0.8);
    var xMin = genis ? (sol ? 10 : W * 0.76) : 10, xMax = genis ? (sol ? W * 0.24 : W - 10) : W - 10;
    simsekX = x;
    var dal = [], y = 0, hedef = Math.min(H, 700) * (0.55 + Math.random() * 0.4), yollar = [];
    dal.push([x, y]);
    while (y < hedef) {
      y += 14 + Math.random() * 22; x = Math.min(xMax, Math.max(xMin, x + (Math.random() - 0.5) * 34));
      dal.push([x, y]);
      if (Math.random() < 0.13 && y < hedef * 0.8) {
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
    ax.beginPath(); ax.moveTo(yol[0][0], yol[0][1]);
    for (var i = 1; i < yol.length; i++) ax.lineTo(yol[i][0], yol[i][1]);
    ax.lineWidth = kalinlik; ax.strokeStyle = renk; ax.stroke();
  }

  // ---------------- tilki: hedef seç, ateş et ----------------
  var atesSayac = 0, hedef = null, dumanSayac = 0, sonAtes = -9;
  function tilkiYonu() { return W > 900 ? -1 : 1; }            // geniş ekranda sola, dar ekranda sağa bakar
  function namluYeri(r, kare, yon) {
    var n = NAMLU[kare], w = r.width;
    return { x: r.left + (yon < 0 ? n[0] : 1 - n[0]) * w, y: r.top + n[1] * w };
  }
  function hedefBul(m, yon) {
    var en = null, enD = 1e9;
    for (var i = 0; i < bloklar.length; i++) {
      var k = bloklar[i], cx_ = k.x + k.gen / 2, cy_ = k.y + k.yuk / 2;
      var ileri = (cx_ - m.x) * yon, yukari = m.y - cy_;
      if (ileri < 40 || cy_ < 0) continue;
      if (W <= 900 && cx_ > W * 0.6) continue;               // dar ekranda ejderin üstündekilere ateş etmesin
      var aci = Math.atan2(yukari, ileri) * 180 / Math.PI;      // namlunun baktığı yöne yakın olanlar (-10°..40°)
      if (aci < 5 || aci > 50) continue;
      var d = Math.hypot(cx_ - m.x, cy_ - m.y);
      if (d < 900 && d < enD) { en = k; enD = d; }
    }
    return en;
  }
  function bloguParcala(k) {
    var i = bloklar.indexOf(k);
    if (i < 0) return;
    bloklar.splice(i, 1);
    k.sekil.forEach(function (h) {
      for (var j = 0; j < 3; j++) {
        var a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 260;
        parcalar.push({ x: k.x + h[0] * k.b + k.b / 2, y: k.y + h[1] * k.b + k.b / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120,
          s: k.b * (0.25 + Math.random() * 0.3), renk: k.renk, t: 0, sure: 0.6 + Math.random() * 0.4, don: (Math.random() - 0.5) * 12 });
      }
    });
    flasler.push({ x: k.x + k.gen / 2, y: k.y + k.yuk / 2, t: 0, sure: 0.16, r: k.gen * 0.6, renk: "255,240,200" });
  }
  var hazirlanan = null;
  function onuneBlokKoy(m, yon) {   // tüfeği kaldırırken namlunun önüne düşecek bir blok gönder
    var ileri = W > 900 ? 170 + Math.random() * 150 : 90 + Math.random() * 70;
    var hx = Math.max(6, Math.min(W - 80, m.x + yon * ileri));
    var k = yeniBlok(hx, m.y - Math.abs(hx - m.x) * 0.75 - 200);
    k.v = 130; k.can = 6;
    return k;
  }
  function tilkiEfekt(t, dt) {
    var r = tilki.kutu();
    if (!r || r.width < 10 || r.bottom < -100 || r.top > H + 100) return;
    var d = tilkiDurum(t), yon = tilkiYonu();
    tilki.el.style.transform = yon > 0 ? "scaleX(-1)" : "";
    var m = namluYeri(r, d.kare, yon);
    if (!d.ates && d.kare > 0 && d.kare < 6 && !hazirlanan) hazirlanan = onuneBlokKoy(m, yon);
    if (d.kare === 0) hazirlanan = null;
    if (d.ates) {
      if (!hedef || bloklar.indexOf(hedef) < 0) {
        hedef = hedefBul(m, yon);
        if (!hedef && (!hazirlanan || bloklar.indexOf(hazirlanan) < 0)) hazirlanan = onuneBlokKoy(m, yon);
      }
      atesSayac -= dt;
      while (atesSayac <= 0) {
        atesSayac += 1 / 17;
        sonAtes = t;
        var tx, ty;
        if (hedef) { tx = hedef.x + hedef.gen / 2 + (Math.random() - 0.5) * hedef.gen * 0.6; ty = hedef.y + hedef.yuk / 2 + (Math.random() - 0.5) * hedef.yuk * 0.6; }
        else { tx = m.x + yon * (W > 900 ? 700 : 260); ty = m.y - (W > 900 ? 240 : 520); }      // hedef yoksa hafif yukarı, havaya
        var dx = tx - m.x, dy = ty - m.y, uz = Math.hypot(dx, dy) || 1;
        mermiler.push({ x: m.x, y: m.y, ux: dx / uz, uy: dy / uz, kalan: uz, hedef: hedef });
        flasler.push({ x: m.x, y: m.y, t: 0, sure: 0.05, r: r.width * 0.09, renk: "255,220,120" });
        // kovan: tüfeğin gövdesinden geriye ve yukarı fırlar, yere düşer
        kovanlar.push({ x: r.left + r.width * 0.5, y: r.top + r.width * 0.52, vx: -yon * (60 + Math.random() * 90), vy: -(160 + Math.random() * 120),
          zemin: r.top + r.width * 0.97, t: 0, aci: Math.random() * 6, don: (Math.random() - 0.5) * 30, sekti: false });
      }
    } else {
      atesSayac = 0;
      hedef = null;
    }
    // ateş bittikten sonra namlu tüter
    if (t - sonAtes < 1.6) {
      dumanSayac -= dt;
      if (dumanSayac <= 0) {
        dumanSayac = 0.06;
        dumanlar.push({ x: m.x, y: m.y, vx: yon * 10 + (Math.random() - 0.5) * 14, vy: -30 - Math.random() * 25, r: 3, buyu: 16, t: 0, sure: 1.1, renk: "190,190,195", a: 0.35 * (1 - (t - sonAtes) / 1.6) });
      }
    }
  }

  // ---------------- ejder: ağzından duman ve kıvılcım ----------------
  var ejderSayac = 0, alevSayac = 0, ejderHedef = null, ejderHazir = false;
  function ejderHedefBul(mx, my) {
    var en = null, enD = 1e9;
    for (var i = 0; i < bloklar.length; i++) {
      var k = bloklar[i], cx_ = k.x + k.gen / 2, cy_ = k.y + k.yuk / 2;
      if (cy_ > my - 40 || cy_ < 0 || Math.abs(cx_ - mx) > 360 || k.kul) continue;
      if (W <= 900 && cx_ < W * 0.45) continue;              // dar ekranda tilkinin tarafına üflemesin
      var d = Math.hypot(cx_ - mx, cy_ - my);
      if (d < 470 && d < enD) { en = k; enD = d; }
    }
    return en;
  }
  function kulEt(k) {               // lav olmuş blok kül olup savrulur
    var i = bloklar.indexOf(k);
    if (i < 0) return;
    bloklar.splice(i, 1);
    k.sekil.forEach(function (h) {
      var bx = k.x + h[0] * k.b + k.b / 2, by = k.y + h[1] * k.b + k.b / 2;
      for (var j = 0; j < 5; j++) {
        var gri = 70 + Math.floor(Math.random() * 60);
        kuller.push({ x: bx + (Math.random() - 0.5) * k.b, y: by + (Math.random() - 0.5) * k.b, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 50,
          s: 1.5 + Math.random() * 3, renk: gri + "," + (gri - 5) + "," + (gri - 8), t: 0, sure: 1.4 + Math.random() * 1.2, sal: Math.random() * 6 });
      }
      for (var e = 0; e < 3; e++) kivilcimlar.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 140, vy: -60 - Math.random() * 120, t: 0, sure: 0.5 + Math.random() * 0.6 });
    });
    flasler.push({ x: k.x + k.gen / 2, y: k.y + k.yuk / 2, t: 0, sure: 0.22, r: k.gen * 0.7, renk: "255,120,30" });
  }
  function ejderEfekt(t, dt) {
    var r = ejder.kutu();
    if (!r || r.width < 10 || r.bottom < -100 || r.top > H + 100) return;
    var d = ejderDurum(t), a = AGIZ[d.kare], w = r.width;
    var mx = r.left + a[0] * w, my = r.top + a[1] * w;
    ejderSayac -= dt;
    // ağzını açmadan hemen önce hedef seç; yakında blok yoksa tepesine bir tane gönder
    if (!d.nefes && d.kare > 0 && d.kare < 4 && !ejderHazir) {
      ejderHazir = true;
      ejderHedef = ejderHedefBul(mx, my);
      if (!ejderHedef) {
        var hx = W > 900 ? Math.max(6, mx - 60 - Math.random() * 170) : Math.min(W - 70, W * 0.5 + Math.random() * W * 0.3);   // canavarın / tilkinin olmadığı yere
        ejderHedef = yeniBlok(hx, my - 300 - Math.random() * 40);
        ejderHedef.v = 115;
      }
    }
    if (d.kare === 0) { ejderHazir = false; }
    if (d.nefes) {
      if (ejderHedef && (bloklar.indexOf(ejderHedef) < 0 || ejderHedef.kul)) ejderHedef = ejderHedefBul(mx, my);
      var hx_ = W > 900 ? -0.45 : 0.05, hy_ = -0.95;    // hedef yoksa yukarı
      if (ejderHedef) {
        var tx = ejderHedef.x + ejderHedef.gen / 2 - mx, ty = ejderHedef.y + ejderHedef.yuk / 2 - my, uz = Math.hypot(tx, ty) || 1;
        hx_ = tx / uz; hy_ = ty / uz;
      }
      alevSayac -= dt;
      while (alevSayac <= 0) {
        alevSayac += 1 / 150;
        var sap = (Math.random() - 0.5) * 0.28, cs = Math.cos(sap), sn = Math.sin(sap);
        var vx = (hx_ * cs - hy_ * sn), vy = (hx_ * sn + hy_ * cs), hiz = 430 + Math.random() * 170;
        alevler.push({ x: mx, y: my, vx: vx * hiz, vy: vy * hiz, t: 0, sure: 0.6 + Math.random() * 0.3, r0: w * 0.05, r1: w * (0.16 + Math.random() * 0.1), hedef: ejderHedef });
      }
      if (ejderSayac <= 0) {
        ejderSayac = 0.07;
        dumanlar.push({ x: mx, y: my, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 40,
          r: w * 0.03, buyu: w * 0.16, t: 0, sure: 1.2, renk: "95,90,95", a: 0.3 });
      }
    } else if (ejderSayac <= 0) {     // dururken burnundan ince duman
      ejderSayac = 0.5 + Math.random() * 0.7;
      for (var i = -1; i <= 1; i += 2)
        dumanlar.push({ x: mx + i * w * 0.035, y: my + w * 0.01, vx: i * 8, vy: -28 - Math.random() * 14, r: w * 0.015, buyu: w * 0.07, t: 0, sure: 1.2, renk: "120,115,120", a: 0.35 });
    }
  }

  // ---------------- çizim ----------------
  function arkaCiz(dt) {
    ax.clearRect(0, 0, W, H);
    if (parlama > 0) {
      var pg = ax.createRadialGradient(simsekX, 0, 0, simsekX, 0, Math.min(W * 0.55, H * 0.92));
      pg.addColorStop(0, "rgba(150,190,255," + (0.20 * parlama) + ")");
      pg.addColorStop(1, "rgba(150,190,255,0)");
      ax.fillStyle = pg; ax.fillRect(0, 0, W, H);
      parlama = Math.max(0, parlama - dt * 3.2);
    }
    ax.lineCap = "round";
    for (var i = 0; i < damlalar.length; i++) {
      var d = damlalar[i];
      d.y += d.v * dt; d.x -= d.v * dt * 0.12;
      if (d.y > H + 30) damlalar[i] = d = yeniDamla(false);
      ax.strokeStyle = "rgba(170,205,255," + d.a + ")"; ax.lineWidth = 1.2;
      ax.beginPath(); ax.moveTo(d.x, d.y); ax.lineTo(d.x + d.u * 0.12, d.y - d.u); ax.stroke();
    }
    sonrakiBlok -= dt;
    if (sonrakiBlok <= 0) { yeniBlok(); sonrakiBlok = (W < 700 ? 0.9 : 0.45) + Math.random() * 0.6; }
    for (var j = bloklar.length - 1; j >= 0; j--) {
      var k = bloklar[j];
      k.y += k.v * dt;
      if (k.y > H + 20) { bloklar.splice(j, 1); continue; }
      var son = Math.min(1, (H + 10 - k.y) / 60);          // ekranın en altına kadar iner
      ax.globalAlpha = k.a * Math.max(0, son) * (k.vurus ? 0.7 + 0.3 * Math.random() : 1);
      var res = hucre(k.renk, k.b);
      for (var h = 0; h < k.sekil.length; h++) ax.drawImage(res, k.x + k.sekil[h][0] * k.b - 10, k.y + k.sekil[h][1] * k.b - 10);
      if (k.isi > 0) {                                     // alev değen blok kızarıp lava döner
        var lav = hucre(Math.random() < 0.5 ? "#ff6a1a" : "#ffb02a", k.b);
        ax.globalAlpha = Math.min(1, k.isi * 1.4) * Math.max(0, son);
        for (var h2 = 0; h2 < k.sekil.length; h2++) ax.drawImage(lav, k.x + k.sekil[h2][0] * k.b - 10, k.y + k.sekil[h2][1] * k.b - 10);
        k.isi = Math.max(0, k.isi - dt * 0.15);
      }
    }
    ax.globalAlpha = 1;
    sonrakiSimsek -= dt;
    if (sonrakiSimsek <= 0) { yeniSimsek(); sonrakiSimsek = 2.4 + Math.random() * 3.2; }
    for (var s = simsekler.length - 1; s >= 0; s--) {
      var sm = simsekler[s];
      sm.t += dt;
      if (sm.t > sm.sure) { simsekler.splice(s, 1); continue; }
      var g = 1 - sm.t / sm.sure;
      if (Math.random() < 0.25) g *= 0.4;
      ax.save();
      ax.shadowColor = "rgba(120,180,255,1)"; ax.shadowBlur = 18;
      sm.yollar.forEach(function (yol, n) {
        yolCiz(yol, n === 0 ? 5 : 2.5, "rgba(110,170,255," + (0.45 * g) + ")");
        yolCiz(yol, n === 0 ? 2 : 1, "rgba(235,245,255," + g + ")");
      });
      ax.restore();
    }
  }

  function onCiz(dt) {
    ox.clearRect(0, 0, W, H);
    // dumanlar
    for (var i = dumanlar.length - 1; i >= 0; i--) {
      var d = dumanlar[i];
      d.t += dt;
      if (d.t > d.sure) { dumanlar.splice(i, 1); continue; }
      var f = d.t / d.sure;
      d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.98;
      var rr = d.r + d.buyu * f;
      var gr = ox.createRadialGradient(d.x, d.y, 0, d.x, d.y, rr);
      gr.addColorStop(0, "rgba(" + d.renk + "," + (d.a * (1 - f)) + ")");
      gr.addColorStop(1, "rgba(" + d.renk + ",0)");
      ox.fillStyle = gr;
      ox.beginPath(); ox.arc(d.x, d.y, rr, 0, Math.PI * 2); ox.fill();
    }
    // alev: ağızdan çıkar, sarıdan kırmızıya, sonra dumana döner
    ox.globalCompositeOperation = "lighter";
    for (var a2 = alevler.length - 1; a2 >= 0; a2--) {
      var al = alevler[a2];
      al.t += dt;
      if (al.t > al.sure) { alevler.splice(a2, 1); continue; }
      var fa = al.t / al.sure;
      al.vx *= 0.985; al.vy = al.vy * 0.985 - 40 * dt;
      al.x += al.vx * dt; al.y += al.vy * dt;
      var hk = al.hedef;
      if (hk && !hk.kul && al.x > hk.x - 4 && al.x < hk.x + hk.gen + 4 && al.y > hk.y - 4 && al.y < hk.y + hk.yuk + 4) {
        hk.isi = (hk.isi || 0) + 0.022;
        al.t = Math.max(al.t, al.sure * 0.7);
        if (hk.isi >= 1) { hk.kul = true; kulEt(hk); }
      }
      var rr2 = al.r0 + (al.r1 - al.r0) * fa;
      var renk2 = fa < 0.25 ? "255,240,170" : fa < 0.55 ? "255,150,40" : "220,60,20";
      var ag = ox.createRadialGradient(al.x, al.y, 0, al.x, al.y, rr2);
      ag.addColorStop(0, "rgba(" + renk2 + "," + (0.85 * (1 - fa * fa)) + ")");
      ag.addColorStop(0.5, "rgba(" + renk2 + "," + (0.35 * (1 - fa)) + ")");
      ag.addColorStop(1, "rgba(" + renk2 + ",0)");
      ox.fillStyle = ag;
      ox.beginPath(); ox.arc(al.x, al.y, rr2, 0, Math.PI * 2); ox.fill();
    }
    ox.globalCompositeOperation = "source-over";
    // kül: yavaşça savrulup kaybolur
    for (var u = kuller.length - 1; u >= 0; u--) {
      var ku = kuller[u];
      ku.t += dt;
      if (ku.t > ku.sure) { kuller.splice(u, 1); continue; }
      ku.vy += 25 * dt; ku.x += (ku.vx + Math.sin(ku.t * 3 + ku.sal) * 20) * dt; ku.y += ku.vy * dt;
      ox.fillStyle = "rgba(" + ku.renk + "," + (0.9 * (1 - ku.t / ku.sure)) + ")";
      ox.fillRect(ku.x, ku.y, ku.s, ku.s);
    }
    // mermi izleri
    ox.lineCap = "round";
    for (var j = mermiler.length - 1; j >= 0; j--) {
      var m = mermiler[j], adim = 2400 * dt;
      var bx = m.x, by = m.y;
      m.x += m.ux * Math.min(adim, m.kalan); m.y += m.uy * Math.min(adim, m.kalan); m.kalan -= adim;
      ox.strokeStyle = "rgba(255,225,140,0.95)"; ox.lineWidth = 2;
      ox.beginPath(); ox.moveTo(bx - m.ux * 26, by - m.uy * 26); ox.lineTo(m.x, m.y); ox.stroke();
      if (m.kalan <= 0) {
        mermiler.splice(j, 1);
        if (m.hedef && bloklar.indexOf(m.hedef) >= 0) {
          flasler.push({ x: m.x, y: m.y, t: 0, sure: 0.07, r: 9, renk: "255,250,220" });
          m.hedef.vurus = true;
          m.hedef.can -= 1;
          if (m.hedef.can <= 0) bloguParcala(m.hedef);
        }
      }
    }
    // kovanlar: düşer, bir kere seker, kaybolur
    for (var k = kovanlar.length - 1; k >= 0; k--) {
      var c = kovanlar[k];
      c.t += dt;
      if (c.t > 1.4) { kovanlar.splice(k, 1); continue; }
      c.vy += 1500 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.aci += c.don * dt;
      if (c.y > c.zemin) {
        c.y = c.zemin;
        if (!c.sekti) { c.vy *= -0.35; c.vx *= 0.5; c.don *= 0.4; c.sekti = true; } else { c.vy = 0; c.vx *= 0.8; c.don = 0; }
      }
      ox.save(); ox.translate(c.x, c.y); ox.rotate(c.aci);
      ox.globalAlpha = Math.min(1, (1.4 - c.t) / 0.4);
      ox.fillStyle = "#e8b54a"; ox.fillRect(-3, -1.3, 6, 2.6);
      ox.fillStyle = "#fff0b8"; ox.fillRect(-3, -1.3, 2, 2.6);
      ox.restore();
    }
    ox.globalAlpha = 1;
    // blok parçaları
    for (var p = parcalar.length - 1; p >= 0; p--) {
      var q = parcalar[p];
      q.t += dt;
      if (q.t > q.sure) { parcalar.splice(p, 1); continue; }
      q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      ox.save(); ox.translate(q.x, q.y); ox.rotate(q.don * q.t);
      ox.globalAlpha = 1 - q.t / q.sure;
      ox.fillStyle = q.renk; ox.fillRect(-q.s / 2, -q.s / 2, q.s, q.s);
      ox.restore();
    }
    ox.globalAlpha = 1;
    // kıvılcımlar
    for (var e = kivilcimlar.length - 1; e >= 0; e--) {
      var kv = kivilcimlar[e];
      kv.t += dt;
      if (kv.t > kv.sure) { kivilcimlar.splice(e, 1); continue; }
      kv.vy += 60 * dt; kv.x += kv.vx * dt; kv.y += kv.vy * dt;
      ox.fillStyle = "rgba(255," + (140 + Math.floor(Math.random() * 80)) + ",40," + (1 - kv.t / kv.sure) + ")";
      ox.fillRect(kv.x - 1.2, kv.y - 1.2, 2.4, 2.4);
    }
    // parlamalar (namlu ağzı, vuruş)
    for (var f2 = flasler.length - 1; f2 >= 0; f2--) {
      var fl = flasler[f2];
      fl.t += dt;
      if (fl.t > fl.sure) { flasler.splice(f2, 1); continue; }
      var g2 = 1 - fl.t / fl.sure;
      var gg = ox.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fl.r);
      gg.addColorStop(0, "rgba(255,255,255," + g2 + ")");
      gg.addColorStop(0.35, "rgba(" + fl.renk + "," + (0.8 * g2) + ")");
      gg.addColorStop(1, "rgba(" + fl.renk + ",0)");
      ox.fillStyle = gg;
      ox.beginPath(); ox.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2); ox.fill();
    }
  }

  // ---------------- döngü ----------------
  var t0 = null, onceki = 0;
  function dongu(zaman) {
    if (t0 === null) { t0 = zaman; onceki = zaman; }
    var dt = Math.min(0.05, (zaman - onceki) / 1000), t = (zaman - t0) / 1000;
    onceki = zaman;
    canavar.ciz(canavarKare(t));
    tilki.ciz(tilkiDurum(t).kare);
    ejder.ciz(ejderDurum(t).kare);
    if (ax) arkaCiz(dt);
    if (ox) { tilkiEfekt(t, dt); ejderEfekt(t, dt); onCiz(dt); }
    requestAnimationFrame(dongu);
  }

  boyutla();
  window.addEventListener("resize", boyutla);
  if (azHareket) {                                      // hareket istemeyenlere sabit görüntü
    canavar.ciz(0); tilki.ciz(10); ejder.ciz(0);
    if (tilki.el && tilkiYonu() > 0) tilki.el.style.transform = "scaleX(-1)";
    return;
  }
  requestAnimationFrame(dongu);
})();
