/* MK Equipamientos — interacciones del catálogo (sin dependencias) */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- toast ---------- */
  var toastEl = $(".toast"), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------- catálogo: filtros + buscador (estado en la URL) ---------- */
  var grid = $("#grid");
  if (grid && $("#q")) {
    var cards = $$(".card", grid);
    var q = $("#q"), count = $("#resultCount"), empty = $("#empty");
    var state = { cat: "", q: "" };
    var norm = function (s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); };
    var index = cards.map(function (c) { return norm(c.dataset.search); });

    var params = new URLSearchParams(location.search);
    state.cat = params.get("cat") || "";
    state.q = params.get("q") || "";
    q.value = state.q;

    function apply(push) {
      var terms = norm(state.q).split(" ").filter(Boolean);
      var n = 0;
      cards.forEach(function (c, i) {
        var ok = (!state.cat || c.dataset.cat === state.cat) &&
                 terms.every(function (t) { return index[i].indexOf(t) !== -1 || index[i].replace(/ /g, "").indexOf(t) !== -1; });
        c.hidden = !ok;
        if (ok) n++;
      });
      $$(".chip").forEach(function (b) {
        b.setAttribute("aria-pressed", String(state[b.dataset.filter] === b.dataset.value));
      });
      count.textContent = n === 1 ? "1 máquina" : n + " máquinas";
      empty.hidden = n !== 0;
      if (push) {
        var p = new URLSearchParams();
        if (state.cat) p.set("cat", state.cat);
        if (state.q) p.set("q", state.q);
        var qs = p.toString();
        history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + "#catalogo");
      }
    }

    $$(".chip").forEach(function (b) {
      b.addEventListener("click", function () { state[b.dataset.filter] = b.dataset.value; apply(true); });
    });
    var deb;
    q.addEventListener("input", function () {
      clearTimeout(deb);
      deb = setTimeout(function () { state.q = q.value; apply(true); }, 120);
    });
    var reset = $("#resetFilters");
    if (reset) reset.addEventListener("click", function () { state = { cat: "", q: "" }; q.value = ""; apply(true); q.focus(); });
    // tarjetas de categoría: filtran sin recargar
    $$("[data-cat-link]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        state.cat = a.dataset.catLink; apply(true);
        var t = $("#catalogo"); if (t) t.scrollIntoView({ behavior: "smooth" });
      });
    });
    apply(false);
  }

  /* ---------- detalle ---------- */
  var product = $(".product");
  if (product) {
    var pageUrl = location.origin + location.pathname;
    var title = product.dataset.title;

    // WhatsApp: usar la URL real donde está publicada la página
    if (location.protocol.indexOf("http") === 0) {
      var msg = "Hola MK Equipamientos, quiero consultar por la " + title + ".\n" + pageUrl;
      $$(".js-wa").forEach(function (a) {
        a.href = "https://wa.me/" + product.dataset.wa + "?text=" + encodeURIComponent(msg);
      });
    }

    // Compartir: Web Share API → portapapeles → prompt
    $$(".js-share").forEach(function (b) {
      b.addEventListener("click", function () {
        var data = { title: title, text: title + " — MK Equipamientos", url: pageUrl };
        if (navigator.share) {
          navigator.share(data).catch(function () {});
        } else if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(pageUrl).then(function () { toast("Link copiado. Pegalo donde quieras."); }, function () { window.prompt("Copiá el link:", pageUrl); });
        } else {
          window.prompt("Copiá el link:", pageUrl);
        }
      });
    });

    // Galería: scroll-snap + miniaturas sincronizadas
    var track = $("#galleryTrack");
    if (track) {
      var slides = $$(".gallery-slide", track), thumbs = $$(".thumb"), idxEl = $("#galleryIdx");
      var setActive = function (i) {
        thumbs.forEach(function (t, k) { t.setAttribute("aria-selected", String(k === i)); });
        if (idxEl) idxEl.textContent = i + 1;
      };
      var goTo = function (i) {
        i = Math.max(0, Math.min(slides.length - 1, i));
        track.scrollTo({ left: slides[i].offsetLeft, behavior: "smooth" });
        setActive(i);
      };
      thumbs.forEach(function (t) { t.addEventListener("click", function () { goTo(+t.dataset.index); }); });
      var raf;
      track.addEventListener("scroll", function () {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { setActive(Math.round(track.scrollLeft / track.clientWidth)); });
      }, { passive: true });
      track.addEventListener("keydown", function (e) {
        var cur = Math.round(track.scrollLeft / track.clientWidth);
        if (e.key === "ArrowRight") { e.preventDefault(); goTo(cur + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); goTo(cur - 1); }
      });
    }

    // Video liviano: carga el iframe de YouTube solo al hacer clic
    $$(".video-lite").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + b.dataset.yt + "?autoplay=1&rel=0";
        f.title = "Video de " + title;
        f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
        f.allowFullscreen = true;
        b.replaceWith(f);
      });
    });

    // Barra fija inferior (mobile): aparece cuando el CTA principal sale de pantalla
    var sticky = $(".sticky-cta"), mainCta = $(".product-actions");
    if (sticky && mainCta && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        sticky.classList.toggle("is-visible", !e.isIntersecting && e.boundingClientRect.top < 0);
      }).observe(mainCta);
    }
  }
})();

/* Carrusel de máquinas del inicio: cambia cada 5 s. Solo se detiene con el botón de pausa o si la pestaña está oculta. */
(function () {
  "use strict";
  var show = document.querySelector(".hero-show");
  if (!show) return;
  var slides = Array.prototype.slice.call(show.querySelectorAll(".hs-slide"));
  if (slides.length < 2) return;
  var dur = parseInt(show.dataset.interval, 10) || 5000;
  show.style.setProperty("--hs-dur", dur + "ms");
  var i = 0, timer = null, userPaused = false, hover = false;
  var bar = show.querySelector(".hs-bar"), toggle = show.querySelector(".hs-toggle");

  function load(k) {
    var img = slides[k].querySelector("img[data-src]");
    if (img) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
  }
  function restartBar() {
    show.classList.remove("is-running");
    void bar.offsetWidth; // reinicia la animación de la barra
    if (!userPaused && !hover && !document.hidden) show.classList.add("is-running");
  }
  function go(k) {
    k = (k + slides.length) % slides.length;
    load(k); load((k + 1) % slides.length);
    slides[i].classList.remove("is-active");
    slides[i].setAttribute("aria-hidden", "true"); slides[i].tabIndex = -1;
    i = k;
    slides[i].classList.add("is-active");
    slides[i].removeAttribute("aria-hidden"); slides[i].removeAttribute("tabindex");
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    restartBar();
    var paused = userPaused || hover || document.hidden;
    show.classList.toggle("is-paused", userPaused);
    if (!paused) timer = setTimeout(function () { go(i + 1); }, dur);
  }
  show.querySelector(".hs-next").addEventListener("click", function () { go(i + 1); });
  show.querySelector(".hs-prev").addEventListener("click", function () { go(i - 1); });
  toggle.addEventListener("click", function () {
    userPaused = !userPaused;
    toggle.setAttribute("aria-label", userPaused ? "Reproducir" : "Pausar");
    schedule();
  });
  var stage = show.querySelector(".hero-show-stage");
  document.addEventListener("visibilitychange", schedule);
  // deslizar con el dedo en el celular
  var x0 = null;
  stage.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
  });
  load(1);
  schedule();
})();
