(function () {
  const H = window.HOUSE;

  // ---------- House text ----------
  document.querySelectorAll("[data-house]").forEach(el => {
    el.textContent = H[el.dataset.house] || "";
  });
  document.title = H.name + " · " + H.region;
  document.getElementById("facts").innerHTML = H.facts
    .map(f => `<li><strong>${f.value}</strong><span>${f.label}</span></li>`).join("");
  const mail = document.getElementById("mailLink");
  mail.href = "mailto:" + H.email;
  mail.textContent = H.email;

  // ---------- Photos ----------
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbCap = document.getElementById("lbCap");
  function openLightbox(src, cap) {
    lbImg.src = src; lbImg.alt = cap; lbCap.textContent = cap; lb.hidden = false;
  }
  document.getElementById("lbClose").onclick = () => (lb.hidden = true);
  lb.onclick = e => { if (e.target === lb) lb.hidden = true; };
  document.addEventListener("keydown", e => { if (e.key === "Escape") lb.hidden = true; });

  fetch("photos/photos.json")
    .then(r => r.json())
    .then(photos => {
      if (photos[0]) {
        document.getElementById("heroImg").style.backgroundImage = `url("photos/${photos[0].file}")`;
      }
      for (const section of ["house", "surroundings"]) {
        const box = document.getElementById("gallery-" + section);
        photos.filter(p => (p.section || "house") === section).forEach(p => {
          const fig = document.createElement("figure");
          const img = document.createElement("img");
          img.src = "photos/" + p.file;
          img.alt = p.caption || "";
          img.loading = "lazy";
          const cap = document.createElement("figcaption");
          cap.textContent = p.caption || "";
          fig.append(img, cap);
          fig.onclick = () => openLightbox(img.src, p.caption || "");
          box.append(fig);
        });
      }
    })
    .catch(() => {});

  // ---------- Calendar ----------
  // A booking blocks the nights from `start` up to (not including) `end`,
  // so the departure day can be someone else's arrival day.
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW = ["Mo","Tu","We","Th","Fr","Sa","Su"];
  const booked = new Set();
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const nice = d => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstView = new Date(view);
  let arrival = null, departure = null;

  function rangeFree(a, b) {
    for (let d = a; d < b; d = addDays(d, 1)) if (booked.has(iso(d))) return false;
    return true;
  }

  function render() {
    const box = document.getElementById("calendars");
    box.innerHTML = "";
    for (let k = 0; k < 2; k++) {
      const m = new Date(view.getFullYear(), view.getMonth() + k, 1);
      const cal = document.createElement("div");
      cal.className = "cal";
      cal.innerHTML = `<h3>${MONTHS[m.getMonth()]} ${m.getFullYear()}</h3>`;
      const grid = document.createElement("div");
      grid.className = "cal-grid";
      DOW.forEach(d => grid.insertAdjacentHTML("beforeend", `<div class="dow">${d}</div>`));
      const offset = (m.getDay() + 6) % 7;
      for (let i = 0; i < offset; i++) grid.append(document.createElement("span"));
      const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= days; i++) {
        const d = new Date(m.getFullYear(), m.getMonth(), i);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "day";
        b.textContent = i;
        const key = iso(d);
        if (d < today) { b.classList.add("past"); b.disabled = true; }
        else if (booked.has(key)) { b.classList.add("booked"); b.title = "Taken"; }
        if (+d === +today) b.classList.add("today");
        if (arrival && +d === +arrival) b.classList.add("sel");
        if (departure && +d === +departure) b.classList.add("sel");
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
    const isBooked = booked.has(iso(d));
    if (arrival && !departure && d > arrival && rangeFree(arrival, d)) {
      departure = d;                       // departure may fall on a taken day
    } else if (!isBooked) {
      arrival = d; departure = null;       // start a new selection
    } else {
      return;
    }
    render();
  }

  function updateSelection() {
    const el = document.getElementById("selection");
    if (!arrival) { el.textContent = "No dates selected yet."; return; }
    if (!departure) { el.textContent = `Arrival ${nice(arrival)}. Now pick your departure day.`; return; }
    const nights = Math.round((departure - arrival) / 86400000);
    const warn = nights < H.minNights ? ` (minimum stay is ${H.minNights} nights)` : "";
    el.textContent = `${nice(arrival)} to ${nice(departure)}: ${nights} night${nights > 1 ? "s" : ""}${warn}`;
  }

  document.getElementById("prev").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); };
  document.getElementById("next").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };

  fetch("data/availability.json", { cache: "no-store" })
    .then(r => r.json())
    .then(data => {
      (data.booked || []).forEach(r => {
        for (let d = parse(r.start); d < parse(r.end); d = addDays(d, 1)) booked.add(iso(d));
      });
      if (data.updated) {
        const t = new Date(data.updated);
        document.getElementById("updated").textContent =
          "Last updated " + t.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + ".";
      }
    })
    .catch(() => {})
    .finally(render);

  // ---------- Request by email ----------
  document.getElementById("request").addEventListener("submit", e => {
    e.preventDefault();
    if (!arrival || !departure) {
      alert("Please pick your arrival and departure day in the calendar first.");
      document.getElementById("availability").scrollIntoView();
      return;
    }
    const f = new FormData(e.target);
    const nights = Math.round((departure - arrival) / 86400000);
    const subject = `Booking request ${iso(arrival)} to ${iso(departure)}`;
    const body =
      `Hello,\n\nI would like to stay at ${H.name}.\n\n` +
      `Arrival: ${nice(arrival)}\nDeparture: ${nice(departure)}\nNights: ${nights}\n` +
      `Guests: ${f.get("guests")}\n\n${f.get("message") || ""}\n\nBest regards,\n${f.get("name")}`;
    location.href = `mailto:${H.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();
