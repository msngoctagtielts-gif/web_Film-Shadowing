/**
 * teacher.js — bảng theo dõi lớp cho giáo viên.
 *
 * Bản này chưa có máy chủ, nên dữ liệu đi theo đường đơn giản nhất mà vẫn chạy
 * được ngay hôm nay: học viên bấm "Xuất tiến độ" ở trang Tiến độ và gửi tệp cho
 * cô; cô kéo thả tệp vào đây. Khi có máy chủ (giai đoạn 2 trong lộ trình), chỉ
 * cần thay phần nạp tệp bằng một lệnh gọi API — phần phân tích và hiển thị giữ
 * nguyên.
 *
 * Bảng trả lời đúng ba câu hỏi giáo viên hỏi trước mỗi buổi:
 *   1. Hôm nay nên gọi ai?           → thẻ "Cần chú ý"
 *   2. Cả lớp đang vướng ở đâu?      → bảng "Điểm nghẽn"
 *   3. Em này tiến bộ thật không?    → đường điểm theo ngày ở "Từng em"
 */

import { loadCatalog, loadLesson } from "../core/lesson-loader.js";
import {
  summarizeStudent, classBottlenecks, classWeakPhrases, classStats,
  scoreSeries, weakLinesFor, parseStudentFile,
} from "../core/analytics.js";
import { barsHtml, sparkHtml, tilesHtml, riskPill } from "../ui/charts.js";
import { appBar, wireTheme, esc, banner, fmtTime, openModal } from "../ui/components.js";

const $ = (id) => document.getElementById(id);
const KEY = "film-shadowing:class:v1";

const state = {
  students: [],     // [{name, data}]
  lessons: [],      // bài học đã chuẩn hoá
  rows: [],         // kết quả summarizeStudent
  selected: null,   // tên em đang xem ở tab "Từng em"
  sort: { key: "risk", dir: "desc" },
};

/* ------------------------------ lưu trữ lớp ------------------------------ */

function saveClass() {
  try { localStorage.setItem(KEY, JSON.stringify(state.students)); }
  catch (e) { console.warn("Không lưu được lớp:", e); }
}
function loadClass() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

/* -------------------------------- khởi động ------------------------------ */

async function boot() {
  $("appbar").innerHTML = appBar("teacher");
  wireTheme();
  wireControls();

  try {
    const catalog = await loadCatalog();
    const ids = catalog.courses.flatMap((c) => c.lessons.map((l) => l.id));
    for (const id of ids) {
      try { const { lesson } = await loadLesson(`data/lessons/${id}.json`); state.lessons.push(lesson); }
      catch (e) { console.warn("Bỏ qua bài lỗi:", id, e.message); }
    }
  } catch (err) {
    $("notice").innerHTML = banner("bad", `Không nạp được danh mục bài học: ${esc(err.message)}`);
  }

  state.students = loadClass();
  if (!state.students.length) await loadDemo({ quiet: true });
  render();
}

/* --------------------------------- nạp dữ liệu --------------------------- */

async function loadDemo({ quiet = false } = {}) {
  try {
    const res = await fetch("data/demo-lop-hoc.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    const demo = await res.json();
    state.students = demo.students.map((s) => ({ name: s.name, data: s.data, demo: true }));
    saveClass();
    if (!quiet) render();
  } catch (err) {
    if (!quiet) $("notice").innerHTML = banner("warn", `Không nạp được lớp mẫu: ${esc(err.message)}`);
  }
}

async function addFiles(fileList) {
  const added = [], failed = [];
  for (const file of fileList) {
    const res = parseStudentFile(await file.text(), file.name);
    if (!res.ok) { failed.push(`${file.name}: ${res.error}`); continue; }
    // Cùng một em nạp lại thì ghi đè, không tạo bản trùng
    const i = state.students.findIndex((s) => s.name === res.student.name && !s.demo);
    if (i >= 0) state.students[i] = res.student; else state.students.push(res.student);
    added.push(res.student.name);
  }
  // Lớp mẫu tự nhường chỗ cho học viên thật
  if (added.length && state.students.some((s) => s.demo)) {
    state.students = state.students.filter((s) => !s.demo);
  }
  saveClass();
  render();
  $("notice").innerHTML = [
    added.length ? banner("ok", `Đã nạp ${added.length} học viên: ${esc(added.join(", "))}.`) : "",
    failed.length ? banner("bad", `<b>${failed.length} tệp không đọc được:</b><br>${failed.map(esc).join("<br>")}`) : "",
  ].join("");
}

/* --------------------------------- hiển thị ------------------------------ */

function lessonIndex() {
  return state.lessons.map((l) => ({
    id: l.id,
    lineIds: l.lines.map((x) => x.id),
    passMark: l.scoring.passMark,
  }));
}

function render() {
  const idx = lessonIndex();
  state.rows = state.students.map((s) => summarizeStudent(s, idx));
  const stats = classStats(state.rows);
  const isDemo = state.students.some((s) => s.demo);

  $("classMeta").innerHTML = state.students.length
    ? `${stats.students} học viên · ${stats.activeThisWeek} em có học trong 7 ngày qua`
      + (isDemo ? ' · <span class="tag tag--gold">lớp mẫu</span>' : "")
    : "Chưa có học viên nào.";

  $("tiles").innerHTML = tilesHtml([
    { label: "Sĩ số", value: stats.students },
    { label: "Cần chú ý", value: stats.needAttention, tone: stats.needAttention ? "bad" : "ok",
      sub: stats.needAttention ? "xem thẻ bên dưới" : "cả lớp đang đều" },
    { label: "Tiến độ TB", value: stats.avgPercent + "%" },
    { label: "Điểm TB", value: stats.avgScore },
    { label: "Phút đã nói", value: stats.minutesSpoken, sub: "cả lớp cộng lại" },
    { label: "Lượt thu", value: stats.attempts },
  ]);

  if (isDemo) {
    $("notice").innerHTML = banner("warn",
      "Đây là <b>lớp học mẫu</b> để cô xem bảng hoạt động thế nào — không phải học viên thật. "
      + "Nạp tệp tiến độ thật vào là lớp mẫu tự biến mất.");
  }

  renderAttention();
  renderRoster();
  renderBottlenecks();
  renderOne();
}

/* --- Tab 1: Cần chú ý — câu trả lời cho "hôm nay nên gọi ai" ------------- */

/** Việc nên làm, suy ra từ đúng lý do bị gắn cờ. */
function suggestedAction(row) {
  if (row.daysSinceActive === null) return "Gọi một cuộc: em chưa thu lượt nào. Thường là vướng micro hoặc chưa biết bắt đầu từ đâu.";
  if (row.daysSinceActive >= 10) return `Nhắn riêng hôm nay. Sau ${row.daysSinceActive} ngày im lặng, khả năng quay lại giảm rất nhanh — hỏi vướng gì chứ đừng nhắc bài.`;
  if (row.daysSinceActive >= 5) return "Nhắn một câu ngắn kèm một câu thoại cụ thể em đã làm tốt. Nhắc chung chung thì em không mở lại.";
  if (row.trend?.direction === "down") return "Nghe hai bản thu gần nhất của em. Thu lại mà tệ đi thường là đang chán, không phải kém.";
  if (row.avgBest > 0 && row.avgBest < 55) return "Hạ bài xuống một mức, hoặc chuyển em sang bộ trọng số starter. Thu 12 lượt không qua là bài sai mức, không phải em lười.";
  if (row.percent < 25) return "Ngồi cùng em 10 phút đầu buổi tới, làm mẫu một câu từ đầu đến cuối.";
  return "Theo dõi thêm một tuần.";
}

function renderAttention() {
  const need = state.rows
    .filter((r) => r.risk.level !== "ok")
    .sort((a, b) => (a.risk.level === "critical" ? -1 : 1) - (b.risk.level === "critical" ? -1 : 1));

  if (!need.length) {
    $("tabAttn").innerHTML = state.rows.length
      ? banner("ok", "<b>Không có em nào cần gọi hôm nay.</b> Cả lớp đang học đều.")
      : '<p class="hint">Chưa có học viên nào. Nạp tệp tiến độ, hoặc bấm “Xem lớp mẫu”.</p>';
    return;
  }

  $("tabAttn").innerHTML = `
    <p class="hint" style="margin-top:0">Xếp theo mức khẩn. Mỗi thẻ nói rõ vì sao và nên làm gì — không chỉ báo đỏ.</p>
    <div class="attn">${need.map((r) => `
      <div class="attn__card" data-level="${r.risk.level}">
        <div class="attn__head">
          <span class="attn__name">${esc(r.name)}</span>
          ${riskPill(r.risk.level)}
          <span class="hint">${r.percent}% · TB ${r.avgBest} · ${r.attempts} lượt thu</span>
          <span style="margin-left:auto"></span>
          <button class="btn btn--sm btn--ghost" data-open="${esc(r.name)}">Xem chi tiết</button>
        </div>
        <ul class="attn__why">${r.risk.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <div class="attn__do"><b>Nên làm:</b> ${esc(suggestedAction(r))}</div>
      </div>`).join("")}</div>`;

  $("tabAttn").querySelectorAll("[data-open]").forEach((b) =>
    b.addEventListener("click", () => openStudent(b.dataset.open)));
}

/* --- Tab 2: Cả lớp ------------------------------------------------------- */

const COLS = [
  { key: "name", label: "Học viên", get: (r) => r.name },
  { key: "risk", label: "Trạng thái", get: (r) => ({ critical: 2, warning: 1, ok: 0 }[r.risk.level]) },
  { key: "percent", label: "Tiến độ", num: true, get: (r) => r.percent },
  { key: "avgBest", label: "Điểm TB", num: true, get: (r) => r.avgBest },
  { key: "attempts", label: "Lượt thu", num: true, get: (r) => r.attempts },
  { key: "minutesSpoken", label: "Phút nói", num: true, get: (r) => r.minutesSpoken },
  { key: "daysSinceActive", label: "Vắng (ngày)", num: true, get: (r) => r.daysSinceActive ?? 999 },
  { key: "trend", label: "Thu lại", get: (r) => (r.trend ? r.trend.delta : -999) },
];

function renderRoster() {
  if (!state.rows.length) { $("tabRoster").innerHTML = '<p class="hint">Chưa có học viên nào.</p>'; return; }
  const col = COLS.find((c) => c.key === state.sort.key) || COLS[0];
  const dir = state.sort.dir === "asc" ? 1 : -1;
  const rows = [...state.rows].sort((a, b) => {
    const x = col.get(a), y = col.get(b);
    return (typeof x === "string" ? x.localeCompare(y, "vi") : x - y) * dir;
  });

  const trendCell = (r) => {
    if (!r.trend) return '<span class="hint">chưa đủ dữ liệu</span>';
    const m = { up: ["↑", "ok", "tốt lên"], flat: ["→", "", "đi ngang"], down: ["↓", "bad", "tệ đi"] }[r.trend.direction];
    return `<span class="pill ${m[1] ? "pill--" + m[1] : ""}"><span aria-hidden="true">${m[0]}</span>${m[2]} ${r.trend.delta > 0 ? "+" : ""}${r.trend.delta}</span>`;
  };

  $("tabRoster").innerHTML = `
    <p class="hint" style="margin-top:0">Bấm tiêu đề cột để sắp xếp. Cột “Thu lại” cho biết khi em thu lại cùng một câu thì điểm tốt lên hay tệ đi.</p>
    <div class="tbl-wrap"><table class="roster">
      <thead><tr>${COLS.map((c) => `<th data-sort="${c.key}" ${state.sort.key === c.key ? `aria-sort="${state.sort.dir === "asc" ? "ascending" : "descending"}"` : ""}
        class="${c.num ? "num" : ""}">${c.label}${state.sort.key === c.key ? (state.sort.dir === "asc" ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><span class="roster__name" data-open="${esc(r.name)}">${esc(r.name)}</span></td>
        <td>${riskPill(r.risk.level)}</td>
        <td class="num">${r.percent}%</td>
        <td class="num">${r.avgBest || "—"}</td>
        <td class="num">${r.attempts}</td>
        <td class="num">${r.minutesSpoken}</td>
        <td class="num">${r.daysSinceActive === null ? "—" : r.daysSinceActive}</td>
        <td>${trendCell(r)}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;

  $("tabRoster").querySelectorAll("th[data-sort]").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.sort;
    state.sort = { key: k, dir: state.sort.key === k && state.sort.dir === "desc" ? "asc" : "desc" };
    renderRoster();
  }));
  $("tabRoster").querySelectorAll("[data-open]").forEach((el) =>
    el.addEventListener("click", () => openStudent(el.dataset.open)));
}

/* --- Tab 3: Điểm nghẽn — câu trả lời cho "dạy lại gì đầu buổi sau" ------- */

function renderBottlenecks() {
  const blocks = classBottlenecks(state.students, state.lessons, { minStudents: 2 });
  if (!blocks.length) {
    $("tabBlock").innerHTML = '<p class="hint">Cần ít nhất 2 học viên cùng thu một câu thì mới kết luận được câu đó là điểm nghẽn của lớp.</p>';
    return;
  }
  const top = blocks.filter((b) => b.failedBy > 0).slice(0, 10);
  const phrases = classWeakPhrases(blocks, 6);

  $("tabBlock").innerHTML = `
    <p class="hint" style="margin-top:0">
      Câu có nhiều em chưa qua nhất, xếp trên cùng. Đây là danh sách dạy lại 5 phút đầu buổi sau.
      Chỉ tính câu đã có ít nhất 2 em thu.
    </p>

    <h3 style="font-size:.95rem;margin:16px 0 4px">Số em chưa qua, theo câu</h3>
    <p class="hint" style="margin:0 0 9px">Đơn vị: số học viên</p>
    ${barsHtml(top.map((b) => ({
      label: `${b.speaker ? b.speaker + ": " : ""}${b.text}`,
      value: b.failedBy,
      tone: "bad",
      note: `${b.failedBy}/${b.attemptedBy} em chưa qua, điểm TB ${b.avgBest}`,
    })))}

    ${phrases.length ? `<h3 style="font-size:.95rem;margin:22px 0 4px">Cụm cả lớp cùng vướng</h3>
      <p class="hint" style="margin:0 0 9px">Đơn vị: số lượt trượt của cả lớp</p>
      ${barsHtml(phrases.map((p) => ({ label: p.text, value: p.students, note: `xuất hiện ở ${p.lines} câu` })))}
      <p class="hint" style="margin-top:8px">Dạy lại đúng mấy cụm này trước khi cho lớp thu tiếp sẽ hiệu quả hơn nhắc “chú ý phát âm”.</p>` : ""}

    <h3 style="font-size:.95rem;margin:22px 0 8px">Chi tiết từng câu</h3>
    <div class="tbl-wrap"><table class="roster">
      <thead><tr><th>Câu</th><th class="num">Chưa qua</th><th class="num">Điểm TB</th><th class="num">Lượt thu TB</th><th>Lưu ý để dạy lại</th></tr></thead>
      <tbody>${top.map((b) => `<tr>
        <td><div style="font-weight:600">${esc(b.text)}</div>
          <div class="hint">${esc(b.lessonTitle)} · ${fmtTime(b.start)}${b.keywords.length ? " · cụm: " + esc(b.keywords.join(", ")) : ""}</div></td>
        <td class="num">${b.failedBy}/${b.attemptedBy}</td>
        <td class="num">${b.avgBest}</td>
        <td class="num">${b.avgAttempts}</td>
        <td class="hint">${esc(b.notes || "—")}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
}

/* --- Tab 4: Từng em ------------------------------------------------------ */

function renderOne() {
  if (!state.rows.length) { $("tabOne").innerHTML = '<p class="hint">Chưa có học viên nào.</p>'; return; }
  const name = state.selected || state.rows[0].name;
  const row = state.rows.find((r) => r.name === name) || state.rows[0];
  const student = state.students.find((s) => s.name === row.name);
  const series = scoreSeries(student.data);
  const weak = weakLinesFor(student, state.lessons, 6);

  $("tabOne").innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <label for="pickStudent" style="margin:0">Học viên</label>
      <select id="pickStudent" style="max-width:240px">
        ${state.rows.map((r) => `<option ${r.name === row.name ? "selected" : ""}>${esc(r.name)}</option>`).join("")}
      </select>
      ${riskPill(row.risk.level)}
      <span class="hint">${row.lessonsStarted} bài đang học · chuỗi ${row.streak} ngày · lần cuối ${row.lastActive || "chưa có"}</span>
    </div>

    ${tilesHtml([
      { label: "Câu đã đạt", value: `${row.linesDone}/${row.linesTotal}` },
      { label: "Điểm TB", value: row.avgBest || "—" },
      { label: "Lượt thu", value: row.attempts },
      { label: "Phút đã nói", value: row.minutesSpoken },
    ])}

    <h3 style="font-size:.95rem;margin:20px 0 6px">Điểm cao nhất theo ngày</h3>
    ${sparkHtml(series, { passMark: state.lessons[0]?.scoring.passMark ?? 70 })}

    ${weak.length ? `<h3 style="font-size:.95rem;margin:22px 0 8px">Câu em còn vướng</h3>
      <p class="hint" style="margin:0 0 9px">Đơn vị: điểm cao nhất em đạt được, trên thang 100</p>
      ${barsHtml(weak.map((w) => ({ label: w.text, value: w.best, tone: "bad",
        note: w.keywords.length ? "cụm: " + w.keywords.join(", ") : "" })), { maxValue: 100 })}`
    : banner("ok", "Không còn câu nào dưới mức đạt.")}

    <h3 style="font-size:.95rem;margin:22px 0 8px">Theo từng bài</h3>
    <div class="tbl-wrap"><table class="roster">
      <thead><tr><th>Bài</th><th class="num">Đã đạt</th><th class="num">Điểm TB</th><th class="num">Tiến độ</th></tr></thead>
      <tbody>${row.perLesson.map((p) => {
        const L = state.lessons.find((x) => x.id === p.lessonId);
        return `<tr><td>${esc(L?.title || p.lessonId)}</td>
          <td class="num">${p.done}/${p.total}</td><td class="num">${p.avg || "—"}</td>
          <td class="num">${p.percent}%${p.completed ? " ✓" : ""}</td></tr>`;
      }).join("")}</tbody>
    </table></div>`;

  $("pickStudent").addEventListener("change", (e) => { state.selected = e.target.value; renderOne(); });
}

function openStudent(name) {
  state.selected = name;
  document.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === "one")));
  showTab("one");
  renderOne();
  $("tabOne").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showTab(key) {
  $("tabAttn").hidden = key !== "attn";
  $("tabRoster").hidden = key !== "roster";
  $("tabBlock").hidden = key !== "block";
  $("tabOne").hidden = key !== "one";
}

/* ------------------------------- báo cáo buổi tới ------------------------ */

/** Bản tóm tắt dán được vào tin nhắn hoặc giáo án buổi sau. */
function buildReport() {
  const stats = classStats(state.rows);
  const need = state.rows.filter((r) => r.risk.level !== "ok");
  const blocks = classBottlenecks(state.students, state.lessons, { minStudents: 2 })
    .filter((b) => b.failedBy > 0).slice(0, 5);
  const phrases = classWeakPhrases(blocks, 5);
  const d = new Date().toLocaleDateString("vi-VN");

  return [
    `CHUẨN BỊ BUỔI TỚI — ${d}`,
    ``,
    `Lớp: ${stats.students} em · tiến độ TB ${stats.avgPercent}% · điểm TB ${stats.avgScore} · ${stats.minutesSpoken} phút đã nói`,
    ``,
    `1. GỌI TRƯỚC BUỔI HỌC (${need.length} em)`,
    ...(need.length ? need.map((r) => `   · ${r.name} — ${r.risk.reasons[0]}\n     → ${suggestedAction(r)}`) : ["   (không có em nào)"]),
    ``,
    `2. DẠY LẠI 5 PHÚT ĐẦU BUỔI`,
    ...(blocks.length ? blocks.map((b, i) =>
      `   ${i + 1}. "${b.text}" — ${b.failedBy}/${b.attemptedBy} em chưa qua (TB ${b.avgBest})`
      + (b.notes ? `\n      Lưu ý: ${b.notes}` : "")) : ["   (chưa đủ dữ liệu)"]),
    ``,
    ...(phrases.length ? [`3. CỤM CẦN LUYỆN CHUNG`, ...phrases.map((p) => `   · ${p.text} — ${p.students} lượt trượt`)] : []),
  ].join("\n");
}

/* --------------------------------- điều khiển ---------------------------- */

function wireControls() {
  document.querySelectorAll('[role="tab"]').forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    showTab(btn.dataset.tab);
  }));

  $("inFiles").addEventListener("change", (e) => {
    if (e.target.files?.length) addFiles([...e.target.files]);
    e.target.value = "";
  });

  $("btnDemo").addEventListener("click", () => loadDemo());

  // Xác nhận ngay trên trang thay vì dùng hộp thoại confirm của trình duyệt:
  // trang khi được xuất bản lên web không hiện được hộp thoại đó, nút sẽ im
  // lặng không làm gì. Bấm hai lần cũng đủ chặn thao tác nhỡ tay.
  let clearArmed = null;
  $("btnClear").addEventListener("click", () => {
    if (!clearArmed) {
      $("btnClear").textContent = "Bấm lần nữa để xoá";
      $("btnClear").classList.add("btn--rec");
      $("notice").innerHTML = banner("warn",
        "Sắp xoá toàn bộ học viên khỏi bảng này. Tệp gốc của các em không bị ảnh hưởng. "
        + "Bấm lại nút <b>Bấm lần nữa để xoá</b> để xác nhận, hoặc chờ 5 giây để huỷ.");
      clearArmed = setTimeout(() => {
        clearArmed = null;
        $("btnClear").textContent = "Xoá lớp";
        $("btnClear").classList.remove("btn--rec");
        $("notice").innerHTML = "";
      }, 5000);
      return;
    }
    clearTimeout(clearArmed); clearArmed = null;
    $("btnClear").textContent = "Xoá lớp";
    $("btnClear").classList.remove("btn--rec");
    state.students = []; state.selected = null; saveClass(); render();
    $("notice").innerHTML = banner("ok", "Đã xoá lớp. Nạp tệp mới hoặc bấm “Xem lớp mẫu”.");
  });

  $("btnReport").addEventListener("click", () => {
    if (!state.rows.length) {
      $("notice").innerHTML = banner("warn", "Chưa có học viên nào để làm báo cáo. Nạp tệp tiến độ, hoặc bấm “Xem lớp mẫu”.");
      return;
    }
    const text = buildReport();
    const m = openModal({
      title: "Chuẩn bị buổi tới",
      bodyHtml: `<textarea id="reportText" style="min-height:340px;width:100%">${esc(text)}</textarea>`,
      footHtml: `<span class="hint">Dán thẳng vào giáo án hoặc tin nhắn nhóm lớp.</span>
        <span style="margin-left:auto"></span>
        <button class="btn btn--sm btn--primary" id="btnCopyReport">Sao chép</button>`,
    });
    m.el.querySelector("#btnCopyReport").addEventListener("click", async (ev) => {
      try { await navigator.clipboard.writeText(text); ev.target.textContent = "Đã sao chép ✓"; }
      catch { m.el.querySelector("#reportText").select(); ev.target.textContent = "Bôi đen rồi Ctrl+C"; }
    });
  });

  const drop = $("drop");
  ["dragenter", "dragover"].forEach((e) => drop.addEventListener(e, (ev) => {
    ev.preventDefault(); drop.dataset.over = "true";
  }));
  ["dragleave", "drop"].forEach((e) => drop.addEventListener(e, (ev) => {
    ev.preventDefault(); drop.dataset.over = "false";
  }));
  drop.addEventListener("drop", (ev) => {
    const files = [...(ev.dataTransfer?.files || [])].filter((f) => /\.json$/i.test(f.name));
    if (files.length) addFiles(files);
    else $("notice").innerHTML = banner("warn", "Chỉ nhận tệp .json xuất từ trang Tiến độ.");
  });
}

boot();
