/**
 * components.js — các khối hiển thị nhỏ, dùng lại nhiều nơi.
 * Mỗi hàm trả về chuỗi HTML hoặc gắn nội dung vào phần tử đã có.
 */

/** Thoát ký tự để chèn văn bản người dùng vào HTML an toàn. */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** mm:ss từ số giây. */
export function fmtTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const tone = (v) => (v >= 75 ? "ok" : v >= 60 ? "warn" : "bad");

/** Vòng tròn điểm tổng. */
export function scoreRing(score, label = "điểm") {
  const r = 46, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = { ok: "var(--ok)", warn: "var(--gold-500)", bad: "var(--bad)" }[tone(score)];
  return `<div class="ring">
    <svg width="108" height="108" aria-hidden="true">
      <circle cx="54" cy="54" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="9"/>
      <circle cx="54" cy="54" r="${r}" fill="none" stroke="${color}" stroke-width="9"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}"
        stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/>
    </svg>
    <div class="ring__num">${Math.round(score)}<small>${esc(label)}</small></div>
  </div>`;
}

/** Thanh chỉ số có nhãn. */
export function meter(label, value, help = "") {
  if (value === null || value === undefined) {
    return `<div class="meter"><span>${esc(label)}</span>
      <span class="hint">không đo được</span><span></span></div>`;
  }
  return `<div class="meter" ${help ? `title="${esc(help)}"` : ""}>
    <span>${esc(label)}</span>
    <span class="meter__bar"><i data-v="${tone(value)}" style="width:${Math.max(2, value)}%"></i></span>
    <span class="meter__num">${Math.round(value)}</span>
  </div>`;
}

/** Bản đồ từng từ: xanh đúng, vàng gần đúng, đỏ chưa ra, xám nói thêm. */
export function wordMapHtml(words) {
  if (!words?.length) return "";
  const labels = { good: "đúng", warn: "gần đúng", miss: "chưa nghe ra", extra: "nói thêm" };
  return `<div class="wordmap">${words.map((w) => {
    const title = w.verdict === "extra"
      ? `nói thêm: ${esc(w.text)}`
      : `${labels[w.verdict]}${w.heard && w.heard !== w.text ? ` — máy nghe thành “${esc(w.heard)}”` : ""}`;
    return `<span data-v="${w.verdict}" title="${title}">${esc(w.text)}</span>`;
  }).join("")}</div>`;
}

/** Danh sách góp ý. */
export function adviceHtml(advice) {
  if (!advice?.length) return "";
  return `<ul class="advice">${advice.map((a) => `<li><span aria-hidden="true">→</span><span>${esc(a.text)}</span></li>`).join("")}</ul>`;
}

/** Bảng điểm đầy đủ sau một lượt thu. */
export function scoreCardHtml(result, { refText = "" } = {}) {
  const p = result.parts;
  const heard = result.heardText?.trim();
  return `
    <div class="row" style="align-items:flex-start;gap:18px">
      ${scoreRing(result.overall)}
      <div class="stack stack--sm" style="flex:1 1 220px;min-width:200px">
        <div><span class="tag tag--${result.band.tone === "ok" ? "ok" : result.band.tone === "warn" ? "gold" : "bad"}">${esc(result.band.label)}</span></div>
        ${meter("Chính xác", p.accuracy, "Mức khớp từng từ so với kịch bản")}
        ${meter("Đầy đủ", p.completeness, "Tỉ lệ từ trong câu đã nói ra nghe hiểu được")}
        ${meter("Cụm trọng tâm", p.keywords, "Các từ/cụm mục tiêu của câu — tính điểm nặng")}
        ${meter("Nhịp & tốc độ", p.pacing, "So thời lượng và độ ngắt với bản mẫu")}
      </div>
    </div>
    ${refText ? `<div class="stack stack--sm" style="margin-top:14px">
      <div class="hint">Kịch bản</div>${wordMapHtml(result.words)}
    </div>` : ""}
    ${heard ? `<div class="stack stack--sm" style="margin-top:12px">
      <div class="hint">Máy nghe được</div>
      <div style="font-size:.92rem;background:var(--surface-2);padding:8px 11px;border-radius:8px">“${esc(heard)}”</div>
    </div>` : ""}
    <div style="margin-top:14px">${adviceHtml(result.advice)}</div>
    <details style="margin-top:12px">
      <summary class="hint" style="cursor:pointer">Số đo chi tiết</summary>
      <table class="tbl" style="margin-top:8px">
        <tr><th>Số từ trong câu</th><td>${result.stats.refWords}</td><th>Máy nghe được</th><td>${result.stats.heardWords} từ</td></tr>
        <tr><th>Thời lượng mẫu</th><td>${result.stats.refSec}s</td><th>Bản thu của bạn</th><td>${result.stats.userSec}s</td></tr>
        <tr><th>Tỉ lệ tốc độ</th><td>${result.stats.rate ?? "—"}</td><th>Ngắt dài giữa câu</th><td>${result.stats.longPauses}</td></tr>
        <tr><th>Tiếng đệm</th><td>${result.stats.fillers}</td><th>Tỉ lệ có tiếng</th><td>${result.stats.speechRatio ?? "—"}</td></tr>
      </table>
    </details>`;
}

/** Khung nhắc từ/cụm trọng tâm — đặt BÊN CẠNH trình phát, không phủ lên. */
export function cueHtml(items) {
  if (!items?.length) return "";
  return `<div class="cue-stack">${items.map((it) => `
    <div class="cue">
      <div class="cue__term">${esc(it.term)}${it.ipa ? ` <span class="cue__ipa">${esc(it.ipa)}</span>` : ""}</div>
      ${it.meaningVi ? `<div class="cue__vi">${esc(it.meaningVi)}</div>` : ""}
      ${it.note ? `<div class="hint">${esc(it.note)}</div>` : ""}
    </div>`).join("")}</div>`;
}

/** Banner thông báo. */
export function banner(kind, html) {
  const icon = { ok: "✓", warn: "!", bad: "×", info: "i" }[kind] || "i";
  return `<div class="banner banner--${kind === "info" ? "" : kind}"><b aria-hidden="true">${icon}</b><div>${html}</div></div>`;
}

/** Tô đậm các cụm trọng tâm trong một câu (an toàn với HTML). */
export function highlightKeywords(text, keywords = []) {
  let safe = esc(text);
  const list = [...keywords].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const kw of list) {
    const pattern = esc(kw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    safe = safe.replace(new RegExp(`\\b(${pattern})\\b`, "gi"), '<span class="kw">$1</span>');
  }
  return safe;
}

/** Hộp thoại đơn giản: trả về phần tử đã gắn vào body, kèm hàm close. */
export function openModal({ title, bodyHtml, footHtml = "", onClose = null, wide = false }) {
  const el = document.createElement("div");
  el.className = "modal";
  el.innerHTML = `
    <div class="modal__veil" data-close></div>
    <div class="modal__panel" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide ? 'style="width:min(980px,100%)"' : ""}>
      <div class="modal__head">
        <h2 style="margin:0;font-size:1.1rem">${esc(title)}</h2>
        <button class="btn btn--icon btn--ghost" data-close style="margin-left:auto" aria-label="Đóng">✕</button>
      </div>
      <div class="modal__body">${bodyHtml}</div>
      ${footHtml ? `<div class="modal__foot">${footHtml}</div>` : ""}
    </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";

  const close = () => {
    document.body.style.overflow = "";
    el.remove();
    document.removeEventListener("keydown", onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  el.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  document.addEventListener("keydown", onKey);
  el.querySelector(".modal__panel").focus?.();
  return { el, close };
}

/** Thanh điều hướng trên cùng, dùng chung cho mọi trang. */
export function appBar(current = "") {
  const link = (href, label, key) =>
    `<a href="${href}" ${current === key ? 'aria-current="page"' : ""}>${label}</a>`;
  return `<header class="appbar"><div class="appbar__inner">
    <a class="brand" href="index.html">
      <span class="brand__mark">FS</span>
      <span><span class="brand__name">Film Shadowing</span>
      <span class="brand__sub">Ms.Ngọc Elite English</span></span>
    </a>
    <nav class="appbar__nav">
      ${link("index.html", "Khoá học", "home")}
      ${link("studio.html", "Soạn bài", "studio")}
      ${link("progress.html", "Tiến độ", "progress")}
      <button id="themeToggle" title="Đổi nền sáng/tối" aria-label="Đổi nền sáng/tối">◐</button>
    </nav>
  </div></header>`;
}

/** Gắn nút đổi nền sáng/tối (ghi nhớ lựa chọn). */
export function wireTheme() {
  const KEY = "film-shadowing:theme";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) document.documentElement.dataset.theme = saved;
  } catch {}
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const now = document.documentElement.dataset.theme;
    const next = now === "dark" ? "light" : now === "light" ? "dark"
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch {}
  });
}
