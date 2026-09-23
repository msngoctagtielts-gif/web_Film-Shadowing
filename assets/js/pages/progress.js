/**
 * progress.js — bảng tiến độ và xuất/nhập dữ liệu học.
 *
 * Chọn "câu yếu nhất" thay vì chỉ hiện điểm trung bình: học viên cần biết mở
 * bài nào, câu nào ra luyện tiếp, chứ không cần một con số để tự hài lòng.
 */

import { loadCatalog, loadLesson } from "../core/lesson-loader.js";
import { store } from "../core/store.js";
import { srsStats } from "../core/srs.js";
import { appBar, wireTheme, esc, banner, scoreRing, fmtTime } from "../ui/components.js";

const $ = (id) => document.getElementById(id);

async function boot() {
  $("appbar").innerHTML = appBar("progress");
  wireTheme();
  wireData();

  const streak = store.streak();
  const totals = store.totals();

  let catalog;
  try { catalog = await loadCatalog(); }
  catch (err) {
    $("summary").innerHTML = banner("bad", `Không nạp được danh mục: ${esc(err.message)}`);
    return;
  }

  const items = catalog.courses.flatMap((c) => c.lessons);
  const cards = [`
    <div class="card"><div class="card__body row" style="gap:16px">
      ${scoreRing(Math.min(100, streak.count * 10), "ngày")}
      <div><b style="font-size:1.05rem">Chuỗi ${streak.count} ngày</b>
        <div class="hint">${totals.attempts} lượt thu · ${Math.round(totals.recordedSec / 60)} phút đã nói ra tiếng</div>
        <div class="hint">${streak.days?.length || 0} ngày có luyện</div></div>
    </div></div>`];

  const weak = [];

  for (const item of items) {
    let lesson = null;
    try { ({ lesson } = await loadLesson(`data/lessons/${item.id}.json`)); } catch { continue; }
    const ids = lesson.lines.map((l) => l.id);
    const sum = store.summary(item.id, ids, lesson.scoring.passMark);
    const prog = store.lesson(item.id);
    const vocabCards = lesson.vocab.map((v) => `${item.id}:${v.id}`);
    const srs = srsStats(vocabCards);

    cards.push(`<div class="card"><div class="card__body stack stack--sm">
      <div class="row"><b>${esc(item.title)}</b>
        <span class="tag ${sum.completed ? "tag--ok" : ""}" style="margin-left:auto">${sum.percent}%</span></div>
      <div class="progress"><i style="width:${sum.percent}%"></i></div>
      <div class="hint">${sum.done}/${sum.total} câu đạt · TB ${sum.avg} điểm</div>
      <div class="hint">Từ vựng: ${srs.learned}/${srs.total} đã vững${srs.due ? ` · ${srs.due} thẻ đến hạn ôn` : ""}</div>
      <a class="btn btn--sm btn--block" href="lesson.html?lesson=${encodeURIComponent(item.id)}">
        ${sum.attempted ? "Học tiếp" : "Bắt đầu"}</a>
    </div></div>`);

    for (const line of lesson.lines) {
      const best = prog.lines?.[line.id]?.best;
      if (best !== undefined && best !== null && best < lesson.scoring.passMark) {
        weak.push({ lessonId: item.id, lessonTitle: item.title, line, best });
      }
    }
  }

  $("summary").innerHTML = cards.join("");

  weak.sort((a, b) => a.best - b.best);
  $("weakLines").innerHTML = weak.length
    ? weak.slice(0, 12).map((w) => `
      <a href="lesson.html?lesson=${encodeURIComponent(w.lessonId)}" class="script-line" style="text-decoration:none;color:inherit">
        <span class="script-line__time">${w.best}</span>
        <span><span class="script-line__speaker">${esc(w.lessonTitle)} · ${fmtTime(w.line.start)}</span>
        <span class="script-line__text">${esc(w.line.text)}</span></span>
      </a>`).join("")
    : '<p class="hint" style="padding:16px">Chưa có câu nào dưới mức đạt. Hoặc bạn chưa thu, hoặc bạn đang làm rất tốt.</p>';
}

function wireData() {
  // Tên học viên đi kèm tệp xuất, để bảng theo dõi của giáo viên nhận ra ai là ai.
  const nameBox = $("inName");
  nameBox.value = store.getProfile().name || "";
  nameBox.addEventListener("change", () => store.setProfile({ name: nameBox.value.trim() }));

  $("btnExport").addEventListener("click", () => {
    const blob = new Blob([store.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tien-do-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });

  $("inImport").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("Nhập tệp sẽ GHI ĐÈ tiến độ hiện tại trên máy này. Tiếp tục?")) return;
    const ok = store.importJson(await file.text());
    alert(ok ? "Đã nhập tiến độ." : "Tệp không đúng định dạng tiến độ.");
    if (ok) location.reload();
  });

  $("btnReset").addEventListener("click", () => {
    if (!confirm("Xoá toàn bộ tiến độ và lịch ôn từ vựng trên máy này? Không lấy lại được.")) return;
    store.reset();
    location.reload();
  });
}

boot();
