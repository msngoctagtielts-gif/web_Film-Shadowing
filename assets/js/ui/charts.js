/**
 * charts.js — biểu đồ vẽ tay bằng SVG, không dùng thư viện ngoài.
 *
 * Nguyên tắc áp dụng ở đây:
 *  · Mỗi biểu đồ chỉ một chuỗi số liệu và một trục — không bao giờ hai trục.
 *  · Chữ trên biểu đồ lấy màu từ bộ màu chung của giao diện, không lấy màu của
 *    cột, nhờ vậy đọc được ở cả nền sáng và nền tối.
 *  · Màu trạng thái (ổn / cần chú ý / gấp) tách riêng khỏi màu nhấn, và luôn
 *    đi kèm chữ — không bao giờ chỉ dùng màu để truyền thông tin.
 *  · Nhãn giá trị đặt chọn lọc, không dán số lên mọi điểm.
 */

import { esc } from "./components.js";

/**
 * Biểu đồ cột ngang cho số liệu độ lớn (ví dụ: bao nhiêu em trượt câu này).
 *
 * @param {Array<{label:string, value:number, max?:number, note?:string, tone?:'accent'|'bad'}>} rows
 * @param {{unit?:string, maxValue?:number, height?:number}} [opts]
 */
export function barsHtml(rows, opts = {}) {
  const { unit = "", maxValue = null } = opts;
  if (!rows.length) return '<p class="hint">Chưa đủ dữ liệu để dựng biểu đồ.</p>';
  const max = maxValue ?? Math.max(...rows.map((r) => r.value), 1);

  return `<div class="bars">${rows.map((r) => {
    const pct = Math.max(1.5, (r.value / max) * 100);
    const title = `${r.label}: ${r.value}${unit}${r.note ? " — " + r.note : ""}`;
    return `<div class="bars__row" title="${esc(title)}">
      <span class="bars__label">${esc(r.label)}</span>
      <span class="bars__track"><i class="bars__fill" data-tone="${r.tone || "accent"}" style="width:${pct}%"></i></span>
      <span class="bars__val">${r.value}${esc(unit)}</span>
    </div>`;
  }).join("")}</div>`;
}

/**
 * Đường điểm theo ngày của một học viên.
 *
 * Chỉ ghi nhãn điểm đầu và điểm cuối — dán số lên mọi điểm sẽ làm rối và che
 * mất chính hình dạng của đường.
 *
 * @param {Array<{day:string, score:number}>} series
 * @param {{width?:number, height?:number, passMark?:number}} [opts]
 */
export function sparkHtml(series, opts = {}) {
  const { width = 520, height = 140, passMark = 70 } = opts;
  if (series.length < 2) {
    return `<p class="hint">Cần ít nhất 2 ngày có thu để vẽ được đường tiến bộ.</p>`;
  }

  const padL = 34, padR = 44, padT = 14, padB = 26;
  const w = width - padL - padR, h = height - padT - padB;
  const xs = (i) => padL + (series.length === 1 ? w / 2 : (i / (series.length - 1)) * w);
  const ys = (v) => padT + h - (Math.max(0, Math.min(100, v)) / 100) * h;

  const pts = series.map((d, i) => [xs(i), ys(d.score)]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)} ${(padT + h).toFixed(1)} L${pts[0][0].toFixed(1)} ${(padT + h).toFixed(1)} Z`;
  const first = series[0], last = series[series.length - 1];
  const fmtDay = (d) => d.slice(8, 10) + "/" + d.slice(5, 7);

  return `<svg class="spark" viewBox="0 0 ${width} ${height}" role="img"
      aria-label="Điểm cao nhất theo ngày, từ ${first.score} ngày ${fmtDay(first.day)} đến ${last.score} ngày ${fmtDay(last.day)}">
    <line x1="${padL}" y1="${ys(passMark).toFixed(1)}" x2="${padL + w}" y2="${ys(passMark).toFixed(1)}"
      class="spark__pass"/>
    <text x="${padL + w + 4}" y="${(ys(passMark) + 3.5).toFixed(1)}" class="spark__tick">đạt</text>
    <text x="${padL - 6}" y="${(padT + 4).toFixed(1)}" class="spark__tick" text-anchor="end">100</text>
    <text x="${padL - 6}" y="${(padT + h + 4).toFixed(1)}" class="spark__tick" text-anchor="end">0</text>
    <path d="${area}" class="spark__area"/>
    <path d="${path}" class="spark__line"/>
    ${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.2}"
      class="spark__dot" data-end="${i === pts.length - 1}"><title>${esc(fmtDay(series[i].day))}: ${series[i].score} điểm</title></circle>`).join("")}
    <text x="${pts[0][0].toFixed(1)}" y="${(pts[0][1] - 9).toFixed(1)}" class="spark__val" text-anchor="start">${first.score}</text>
    <text x="${pts[pts.length - 1][0].toFixed(1)}" y="${(pts[pts.length - 1][1] - 11).toFixed(1)}" class="spark__val" text-anchor="end">${last.score}</text>
    <text x="${padL}" y="${height - 6}" class="spark__tick">${fmtDay(first.day)}</text>
    <text x="${padL + w}" y="${height - 6}" class="spark__tick" text-anchor="end">${fmtDay(last.day)}</text>
  </svg>`;
}

/**
 * Ô chỉ số lớn cho dải tổng quan đầu trang.
 * @param {Array<{label:string, value:string|number, sub?:string, tone?:string}>} tiles
 */
export function tilesHtml(tiles) {
  return `<div class="tiles">${tiles.map((t) => `
    <div class="tile" ${t.tone ? `data-tone="${t.tone}"` : ""}>
      <div class="tile__val">${esc(String(t.value))}</div>
      <div class="tile__label">${esc(t.label)}</div>
      ${t.sub ? `<div class="tile__sub">${esc(t.sub)}</div>` : ""}
    </div>`).join("")}</div>`;
}

/** Viên trạng thái — luôn có chữ, không bao giờ chỉ có màu. */
export function riskPill(level) {
  const map = {
    ok: { label: "Đang học đều", icon: "●", cls: "ok" },
    warning: { label: "Cần chú ý", icon: "▲", cls: "warn" },
    critical: { label: "Gọi ngay", icon: "■", cls: "bad" },
  };
  const m = map[level] || map.ok;
  return `<span class="pill pill--${m.cls}"><span aria-hidden="true">${m.icon}</span>${m.label}</span>`;
}
