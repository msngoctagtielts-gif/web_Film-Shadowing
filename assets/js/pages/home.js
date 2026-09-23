/**
 * home.js — danh mục khoá học và tiến độ tổng.
 */

import { loadCatalog } from "../core/lesson-loader.js";
import { store } from "../core/store.js";
import { appBar, wireTheme, esc, banner } from "../ui/components.js";

async function boot() {
  document.getElementById("appbar").innerHTML = appBar("home");
  wireTheme();

  const streak = store.streak();
  const totals = store.totals();
  document.getElementById("streakInfo").textContent = streak.count > 0
    ? `Chuỗi ${streak.count} ngày · ${totals.attempts} lượt thu · ${Math.round(totals.recordedSec / 60)} phút đã nói`
    : "Chưa có lượt thu nào — bắt đầu bài mẫu bên dưới.";

  const box = document.getElementById("catalog");
  try {
    const catalog = await loadCatalog();
    const cards = [];
    for (const course of catalog.courses) {
      cards.push(`<div style="grid-column:1/-1;margin-top:8px">
        <h3 style="margin:0">${esc(course.title)}</h3>
        <p class="hint" style="margin:2px 0 0">${esc(course.description || "")}</p>
      </div>`);
      for (const item of course.lessons) {
        const prog = store.lesson(item.id);
        const lineCount = item.lineCount || 0;
        const doneLines = Object.values(prog.lines || {}).filter((l) => (l.best ?? 0) >= 70).length;
        const pct = lineCount ? Math.round((doneLines / lineCount) * 100) : 0;
        const badge = prog.completedAt ? '<span class="tag tag--ok">đã xong</span>'
          : doneLines > 0 ? '<span class="tag tag--gold">đang học</span>' : '<span class="tag">chưa học</span>';
        cards.push(`
          <a class="card lesson-card" href="lesson.html?lesson=${encodeURIComponent(item.id)}">
            <div class="lesson-card__thumb">
              <span class="lesson-card__ep">${esc(item.episodeLabel || "Bài")}</span>
              ${item.thumb ? `<img src="${esc(item.thumb)}" alt="">` : "🎬"}
            </div>
            <div class="lesson-card__body">
              <h3>${esc(item.title)}</h3>
              <p class="hint" style="margin:0">${esc(item.summary || "")}</p>
              <div class="progress" style="margin-top:6px"><i style="width:${pct}%"></i></div>
              <div class="lesson-card__meta">
                ${badge}
                <span class="tag">${esc(item.level || "—")}</span>
                <span class="tag">${lineCount} câu</span>
                ${item.sourceKind === "youtube" ? '<span class="tag">YouTube</span>' : '<span class="tag">giọng máy</span>'}
              </div>
            </div>
          </a>`);
      }
    }
    box.innerHTML = cards.join("");
  } catch (err) {
    box.innerHTML = banner("bad", `<b>Không nạp được danh mục.</b> ${esc(err.message)}
      <br>Nếu bạn mở tệp bằng <code>file://</code>, trình duyệt sẽ chặn đọc JSON.
      Chạy <code>npm run serve</code> rồi mở <code>http://localhost:4173</code>.`);
  }
}

boot();
