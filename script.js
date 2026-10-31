(function () {
  const H = window.HOUSE;
  const LANGS = ["nl", "en", "es"];
  const LOCALE = { nl: "nl-NL", en: "en-GB", es: "es-ES" };

  // ---------- Language ----------
  function startLang() {
    try { const s = localStorage.getItem("lang"); if (LANGS.includes(s)) return s; } catch (e) {}
    for (const l of navigator.languages || [navigator.language || "en"]) {
      const code = l.slice(0, 2).toLowerCase();
      if (LANGS.includes(code)) return code;
    }
    return "en";
  }
  let lang = startLang();
  const t = (key, vars = {}) =>
    String(TEXTS[lang][key] ?? TEXTS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

  let photos = [];

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-t]").forEach(el => (el.textContent = t(el.dataset.t)));
    document.querySelectorAll("[data-list]").forEach(el => {
      el.innerHTML = "";
      (TEXTS[lang][el.dataset.list] || []).forEach(item => {
        const li = document.createElement("li"); li.textContent = item; el.append(li);
      });
    });
    document.querySelectorAll("#langs button").forEach(b => b.classList.toggle("on", b.dataset.lang === lang));
    document.querySelector("textarea[name=message]").placeholder = t("messagePh");
    document.getElementById("prev").setAttribute("aria-label", t("prev"));
    document.getElementById("next").setAttribute("aria-label", t("next"));
    document.getElementById("lbClose").setAttribute("aria-label", t("close"));
    document.title = H.name + " · " + t("region");
    document.getElementById("facts").innerHTML = [
      [H.bedrooms, t("factBedrooms")], [H.beds, t("factBeds")],
      [H.bathrooms, t("factBathrooms")], [t("guestsValue", { n: H.maxGuests }), t("factGuests")],
    ].map(([v, l]) => `<li><strong>${v}</strong><span>${l}</span></li>`).join("");
    renderGalleries();
    showUpdated();
    render();
  }
  document.querySelectorAll("#langs button").forEach(b => (b.onclick = () => {
    lang = b.dataset.lang;
    try { localStorage.setItem("lang", lang); } catch (e) {}
    applyLang();
  }));

  // ---------- House basics ----------
  document.querySelectorAll("[data-house]").forEach(el => (el.textContent = H[el.dataset.house] || ""));
  const mail = document.getElementById("mailLink");
  mail.href = "mailto:" + H.email;
  mail.textContent = H.email;

  // ---------- Photos ----------
  const caption = p => (typeof p.caption === "string" ? p.caption : (p.caption?.[lang] ?? p.caption?.en ?? ""));
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbCap = document.getElementById("lbCap");
  let lbIndex = 0;
  function openLightbox(i) {
    lbIndex = (i + photos.length) % photos.length;
    const p = photos[lbIndex];
    lbImg.src = "photos/" + p.file; lbImg.alt = caption(p); lbCap.textContent = caption(p);
    lb.hidden = false;
  }
  document.getElementById("lbClose").onclick = () => (lb.hidden = true);
  document.getElementById("lbPrev").onclick = e => { e.stopPropagation(); openLightbox(lbIndex - 1); };
  document.getElementById("lbNext").onclick = e => { e.stopPropagation(); openLightbox(lbIndex + 1); };
  lb.onclick = e => { if (e.target === lb) lb.hidden = true; };
  document.addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") lb.hidden = true;
    if (e.key === "ArrowLeft") openLightbox(lbIndex - 1);
    if (e.key === "ArrowRight") openLightbox(lbIndex + 1);
  });

  function renderGalleries() {
    for (const section of ["house", "surroundings"]) {
      const box = document.getElementById("gallery-" + section);
      box.innerHTML = "";
      photos.forEach((p, i) => {
        if ((p.section || "house") !== section) return;
        const fig = document.createElement("figure");
        const img = document.createElement("img");
        img.src = "photos/" + p.file;
        img.alt = caption(p);
        img.loading = "lazy";
        const cap = document.createElement("figcaption");
        cap.textContent = caption(p);
        fig.append(img, cap);
        fig.onclick = () => openLightbox(i);
        box.append(fig);
      });
    }
  }

  fetch("photos/photos.json")
    .then(r => r.json())
    .then(list => {
      photos = list;
      if (photos[0]) document.getElementById("heroImg").style.backgroundImage = `url("photos/${photos[0].file}")`;
      renderGalleries();
    })
    .catch(() => {});

  // ---------- Calendar ----------
  // A booking blocks the nights from `start` up to (not including) `end`,
  // so a departure day can be the next guest's arrival day.
  const booked = new Set();
  let updatedAt = null;
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const nice = d => d.toLocaleDateString(LOCALE[lang], { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstView = new Date(view);
  let arrival = null, departure = null;

  const rangeFree = (a, b) => { for (let d = a; d < b; d = addDays(d, 1)) if (booked.has(iso(d))) return false; return true; };
  const nightsOf = () => Math.round((departure - arrival) / 86400000);

  function render() {
    const box = document.getElementById("calendars");
    box.innerHTML = "";
    const dow = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(LOCALE[lang], { weekday: "short" }).slice(0, 2));
    for (let k = 0; k < 2; k++) {
      const m = new Date(view.getFullYear(), view.getMonth() + k, 1);
      const cal = document.createElement("div");
      cal.className = "cal";
      const title = m.toLocaleDateString(LOCALE[lang], { month: "long", year: "numeric" });
      cal.innerHTML = `<h3>${title.charAt(0).toUpperCase() + title.slice(1)}</h3>`;
      const grid = document.createElement("div");
      grid.className = "cal-grid";
      dow.forEach(d => grid.insertAdjacentHTML("beforeend", `<div class="dow">${d}</div>`));
      const offset = (m.getDay() + 6) % 7;
      for (let i = 0; i < offset; i++) grid.append(document.createElement("span"));
      const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= days; i++) {
        const d = new Date(m.getFullYear(), m.getMonth(), i);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "day";
        b.textContent = i;
        if (d < today) { b.classList.add("past"); b.disabled = true; }
        else if (booked.has(iso(d))) { b.classList.add("booked"); b.title = t("taken"); }
        if (+d === +today) b.classList.add("today");
        if ((arrival && +d === +arrival) || (departure && +d === +departure)) b.classList.add("sel");
        if (arrival && departure && d > arrival && d < departure) b.classList.add("in-range");
        b.onclick = () => pick(d);
        grid.append(b);
      }
      cal.append(grid);
      box.append(cal);
    }
    document.getElementById("prev").disabled = +view <= +firstView;
    updateSelection();
  }

  function pick(d) {
    if (arrival && !departure && d > arrival && rangeFree(arrival, d)) departure = d;
    else if (!booked.has(iso(d))) { arrival = d; departure = null; }
    else return;
    render();
  }

  function updateSelection() {
    const el = document.getElementById("selection");
    if (!arrival) el.textContent = t("noDates");
    else if (!departure) el.textContent = t("pickDeparture", { a: nice(arrival) });
    else {
      const n = nightsOf();
      el.textContent = t("selected", { a: nice(arrival), d: nice(departure), n }) + (n < H.minNights ? t("minStay", { min: H.minNights }) : "");
    }
  }

  function showUpdated() {
    document.getElementById("updated").textContent = updatedAt
      ? t("updated", { date: updatedAt.toLocaleString(LOCALE[lang], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })
      : "";
  }

  document.getElementById("prev").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); };
  document.getElementById("next").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };

  fetch("data/availability.json", { cache: "no-store" })
    .then(r => r.json())
    .then(data => {
      (data.booked || []).forEach(r => { for (let d = parse(r.start); d < parse(r.end); d = addDays(d, 1)) booked.add(iso(d)); });
      if (data.updated) updatedAt = new Date(data.updated);
    })
    .catch(() => {})
    .finally(() => { showUpdated(); render(); });

  // ---------- Request by email ----------
  document.getElementById("request").addEventListener("submit", e => {
    e.preventDefault();
    if (!arrival || !departure) {
      alert(t("pickFirst"));
      document.getElementById("availability").scrollIntoView();
      return;
    }
    const f = new FormData(e.target);
    const subject = t("mailSubject", { a: iso(arrival), d: iso(departure) });
    const body = t("mailBody", {
      name: H.name, a: nice(arrival), d: nice(departure), n: nightsOf(),
      g: f.get("guests"), msg: f.get("message") || "", who: f.get("name"),
    });
    location.href = `mailto:${H.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  applyLang();
})();
