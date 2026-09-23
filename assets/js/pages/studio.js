/**
 * studio.js — công cụ soạn bài.
 *
 * Việc tốn thời gian nhất khi làm bài lồng tiếng là bắt mốc thời gian từng câu.
 * Ở đây người soạn vừa xem video vừa bấm hai nút, mốc được lấy trực tiếp từ
 * trình phát nên khớp đúng khung hình, không phải ngồi đếm bằng tay.
 */

import { createPlayer } from "../core/player.js";
import { validateLesson, normalizeLesson } from "../core/lesson-loader.js";
import { glyphKeys } from "../ui/illustrations.js";
import { appBar, wireTheme, esc, banner, fmtTime } from "../ui/components.js";

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = "film-shadowing:draft:v1";

let player = null;
let pendingStart = null;

/** Bản nháp đang soạn. */
let draft = loadDraft() || {
  id: "",
  title: "",
  level: "",
  summary: "",
  notes: "",
  source: { type: "youtube", videoId: "", voiceLang: "en-US", rightsNote: "" },
  scoring: { profile: "standard", passMark: 70 },
  vocab: [],
  keyphrases: [],
  lines: [],
};

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { console.warn("Không lưu được bản nháp:", e); }
}

/** Lấy mã video từ đường dẫn YouTube ở mọi dạng thường gặp. */
export function parseVideoId(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : "";
}

/* --------------------------------- khởi động ----------------------------- */

function boot() {
  $("appbar").innerHTML = appBar("studio");
  wireTheme();
  fillMeta();
  renderLines();
  renderVocab();
  wireMeta();
  wireButtons();
  runValidate();
}

function fillMeta() {
  $("inSource").value = draft.source.type;
  $("inVideoId").value = draft.source.videoId || "";
  $("inFileUrl").value = draft.source.url || "";
  $("inId").value = draft.id || "";
  $("inTitle").value = draft.title || "";
  $("inLevel").value = draft.level || "";
  $("inSummary").value = draft.summary || "";
  $("inProfile").value = draft.scoring.profile;
  $("inPass").value = draft.scoring.passMark;
  $("inRights").value = draft.source.rightsNote || "";
  toggleSourceFields();
}

function toggleSourceFields() {
  const t = $("inSource").value;
  $("wrapVideoId").hidden = t !== "youtube";
  $("wrapFileUrl").hidden = t !== "file";
}

function wireMeta() {
  const bind = (id, fn) => $(id).addEventListener("input", () => { fn($(id).value); saveDraft(); runValidate(); });
  bind("inId", (v) => draft.id = v.trim());
  bind("inTitle", (v) => draft.title = v);
  bind("inLevel", (v) => draft.level = v);
  bind("inSummary", (v) => draft.summary = v);
  bind("inRights", (v) => draft.source.rightsNote = v);
  bind("inVideoId", (v) => draft.source.videoId = parseVideoId(v));
  bind("inFileUrl", (v) => draft.source.url = v.trim());
  $("inProfile").addEventListener("change", () => { draft.scoring.profile = $("inProfile").value; saveDraft(); });
  $("inPass").addEventListener("change", () => { draft.scoring.passMark = Number($("inPass").value) || 70; saveDraft(); });
  $("inSource").addEventListener("change", () => {
    draft.source.type = $("inSource").value;
    toggleSourceFields(); saveDraft(); runValidate();
  });
}

/* --------------------------------- trình phát ---------------------------- */

async function loadVideo() {
  const type = $("inSource").value;
  draft.source.type = type;
  if (type === "youtube") {
    const id = parseVideoId($("inVideoId").value);
    if (!id) { alert("Chưa nhận ra mã video. Dán link YouTube đầy đủ hoặc mã 11 ký tự."); return; }
    draft.source.videoId = id;
    $("inVideoId").value = id;
  } else if (type === "file") {
    draft.source.url = $("inFileUrl").value.trim();
    if (!draft.source.url) { alert("Nhập đường dẫn tệp trước."); return; }
  }
  saveDraft();

  try {
    player?.destroy();
    const mount = $("playerMount");
    mount.style.display = "";
    mount.textContent = "";
    player = await createPlayer({
      mount,
      lesson: { ...draft, lines: draft.lines.length ? draft.lines : [{ id: "tmp", text: draft.title || "Preview", start: 0, end: 3 }] },
    });
    player.on("time", (t) => { $("nowTime").textContent = `${t.toFixed(2)}s`; });
  } catch (err) {
    $("playerMount").textContent = "Không nạp được: " + err.message;
  }
}

/* ----------------------------- bắt mốc thời gian ------------------------- */

function markStart() {
  if (!player) { alert("Nạp video trước đã."); return; }
  pendingStart = Number(player.getTime().toFixed(2));
  $("btnMarkStart").textContent = `⤓ Bắt đầu: ${pendingStart}s`;
}

function markEnd() {
  if (!player) { alert("Nạp video trước đã."); return; }
  const end = Number(player.getTime().toFixed(2));
  if (pendingStart === null) { alert("Bấm “Mốc bắt đầu” trước."); return; }
  if (end <= pendingStart) { alert("Mốc kết thúc phải sau mốc bắt đầu."); return; }
  addLine({ start: pendingStart, end });
  pendingStart = null;
  $("btnMarkStart").textContent = "⤓ Mốc bắt đầu";
}

function addLine(partial = {}) {
  const n = draft.lines.length + 1;
  const last = draft.lines[draft.lines.length - 1];
  draft.lines.push({
    id: `l${n}`,
    speaker: last?.speaker === "A" ? "B" : "A",
    start: partial.start ?? (last ? last.end + 0.2 : 0),
    end: partial.end ?? (last ? last.end + 3.2 : 3),
    text: "",
    textVi: "",
    keywords: [],
    vocabIds: [],
    notes: "",
    difficulty: 1,
  });
  saveDraft();
  renderLines();
  runValidate();
  // đưa con trỏ vào ô lời thoại vừa tạo
  $("lineList").querySelector(`[data-field="text"][data-i="${draft.lines.length - 1}"]`)?.focus();
}

/* ------------------------------- bảng câu thoại -------------------------- */

function renderLines() {
  $("lineCount").textContent = `${draft.lines.length} câu`;
  if (!draft.lines.length) {
    $("lineList").innerHTML = '<p class="hint" style="padding:16px">Chưa có câu nào. Nạp video, bấm ⤓ và ⤒ để bắt mốc câu đầu tiên.</p>';
    return;
  }
  $("lineList").innerHTML = draft.lines.map((l, i) => `
    <div style="padding:12px 14px;border-bottom:1px solid var(--line)">
      <div class="row" style="gap:7px;margin-bottom:7px">
        <b class="hint">#${i + 1}</b>
        <input type="text" data-field="speaker" data-i="${i}" value="${esc(l.speaker)}" style="width:70px" aria-label="Vai">
        <input type="number" step="0.05" data-field="start" data-i="${i}" value="${l.start}" style="width:86px" aria-label="Giây bắt đầu">
        <input type="number" step="0.05" data-field="end" data-i="${i}" value="${l.end}" style="width:86px" aria-label="Giây kết thúc">
        <span class="tag">${(l.end - l.start).toFixed(2)}s</span>
        <span style="margin-left:auto"></span>
        <button class="btn btn--sm btn--ghost" data-act="play" data-i="${i}" title="Nghe câu này">▶</button>
        <button class="btn btn--sm btn--ghost" data-act="up" data-i="${i}" title="Lên">↑</button>
        <button class="btn btn--sm btn--ghost" data-act="del" data-i="${i}" title="Xoá">✕</button>
      </div>
      <input type="text" data-field="text" data-i="${i}" value="${esc(l.text)}" placeholder="Lời thoại tiếng Anh" style="margin-bottom:6px">
      <input type="text" data-field="textVi" data-i="${i}" value="${esc(l.textVi)}" placeholder="Nghĩa tiếng Việt" style="margin-bottom:6px">
      <div class="field-row">
        <input type="text" data-field="keywords" data-i="${i}" value="${esc((l.keywords || []).join(", "))}" placeholder="Cụm trọng tâm, cách nhau bởi dấu phẩy">
        <input type="text" data-field="notes" data-i="${i}" value="${esc(l.notes)}" placeholder="Lưu ý phát âm">
      </div>
    </div>`).join("");

  $("lineList").querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("change", () => {
      const i = Number(el.dataset.i), f = el.dataset.field;
      const line = draft.lines[i];
      if (f === "keywords") line.keywords = el.value.split(",").map((s) => s.trim()).filter(Boolean);
      else if (f === "start" || f === "end") line[f] = Number(el.value);
      else line[f] = el.value;
      saveDraft();
      if (f === "start" || f === "end" || f === "keywords") { renderLines(); }
      runValidate();
    });
  });

  $("lineList").querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.i);
      if (btn.dataset.act === "del") {
        if (confirm(`Xoá câu #${i + 1}?`)) { draft.lines.splice(i, 1); saveDraft(); renderLines(); runValidate(); }
      } else if (btn.dataset.act === "up" && i > 0) {
        [draft.lines[i - 1], draft.lines[i]] = [draft.lines[i], draft.lines[i - 1]];
        saveDraft(); renderLines();
      } else if (btn.dataset.act === "play") {
        if (!player) { alert("Nạp video trước."); return; }
        player.playSegment(draft.lines[i].start, draft.lines[i].end, { loop: false });
      }
    });
  });
}

/* --------------------------------- từ mới -------------------------------- */

function renderVocab() {
  $("vocabCount").textContent = `${draft.vocab.length} từ`;
  const keys = glyphKeys();
  if (!draft.vocab.length) {
    $("vocabList").innerHTML = '<p class="hint" style="padding:16px">Chưa có từ mới. Mỗi bài nên có 5–8 từ, đúng những từ chặn học viên lại.</p>';
    return;
  }
  $("vocabList").innerHTML = draft.vocab.map((v, i) => `
    <div style="padding:12px 14px;border-bottom:1px solid var(--line)" class="stack stack--sm">
      <div class="field-row">
        <input type="text" data-vf="term" data-i="${i}" value="${esc(v.term)}" placeholder="Từ / cụm">
        <input type="text" data-vf="ipa" data-i="${i}" value="${esc(v.ipa || "")}" placeholder="/ɪpə/">
        <input type="text" data-vf="pos" data-i="${i}" value="${esc(v.pos || "")}" placeholder="n / v / adj">
      </div>
      <input type="text" data-vf="meaningVi" data-i="${i}" value="${esc(v.meaningVi || "")}" placeholder="Nghĩa tiếng Việt">
      <input type="text" data-vf="example" data-i="${i}" value="${esc(v.example || "")}" placeholder="Câu ví dụ tiếng Anh">
      <div class="row">
        <select data-vf="imageKey" data-i="${i}" style="max-width:190px">
          <option value="">— hình tự chọn theo nghĩa —</option>
          ${keys.map((k) => `<option value="${k}" ${v.image?.key === k ? "selected" : ""}>${k}</option>`).join("")}
        </select>
        <input type="text" data-vf="lineIds" data-i="${i}" value="${esc((v.lineIds || []).join(", "))}" placeholder="Câu chứa từ: l1, l3" style="max-width:190px">
        <span style="margin-left:auto"></span>
        <button class="btn btn--sm btn--ghost" data-vact="del" data-i="${i}">✕</button>
      </div>
    </div>`).join("");

  $("vocabList").querySelectorAll("[data-vf]").forEach((el) => {
    el.addEventListener("change", () => {
      const i = Number(el.dataset.i), f = el.dataset.vf, v = draft.vocab[i];
      if (f === "imageKey") v.image = el.value ? { kind: "builtin", key: el.value } : undefined;
      else if (f === "lineIds") v.lineIds = el.value.split(",").map((s) => s.trim()).filter(Boolean);
      else v[f] = el.value;
      saveDraft(); runValidate();
    });
  });
  $("vocabList").querySelectorAll("[data-vact]").forEach((btn) => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.i);
    if (confirm(`Xoá từ "${draft.vocab[i].term}"?`)) { draft.vocab.splice(i, 1); saveDraft(); renderVocab(); runValidate(); }
  }));
}

function addVocab() {
  draft.vocab.push({ id: `v${draft.vocab.length + 1}`, term: "", ipa: "", pos: "", meaningVi: "", example: "", lineIds: [] });
  saveDraft(); renderVocab();
}

/* -------------------------------- kiểm tra ------------------------------- */

function runValidate() {
  const { issues, ok } = validateLesson(draft);
  const errs = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warning");
  $("validateBox").innerHTML =
    (ok ? banner("ok", "<b>Không còn lỗi chặn.</b> Bài này xuất được.")
        : banner("bad", `<b>${errs.length} lỗi phải sửa</b> trước khi dạy.`)) +
    (issues.length ? `<table class="tbl" style="margin-top:10px">
      ${[...errs, ...warns].map((i) => `<tr>
        <td><span class="tag tag--${i.level === "error" ? "bad" : "gold"}">${i.level === "error" ? "lỗi" : "nhắc"}</span></td>
        <td><code style="font-size:.78rem">${esc(i.where)}</code><div>${esc(i.message)}</div></td>
      </tr>`).join("")}</table>` : "");
  return ok;
}

/* --------------------------------- xuất / nhập --------------------------- */

function buildJson() {
  const out = structuredClone(draft);
  out.episodeLabel = out.episodeLabel || out.title?.split("—")[0]?.trim() || "Bài";
  if (out.source.type !== "youtube") delete out.source.videoId;
  if (out.source.type !== "file") delete out.source.url;
  out.vocab = out.vocab.filter((v) => v.term);
  return JSON.stringify(out, null, 2);
}

function exportJson() {
  if (!runValidate() && !confirm("Bài còn lỗi chặn. Vẫn xuất?")) return;
  const blob = new Blob([buildJson()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${draft.id || "bai-hoc"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function previewLesson() {
  if (!runValidate()) { alert("Sửa hết lỗi chặn rồi mới thử học được."); return; }
  // Giữ tab này mở: bài thử nạp qua blob URL của chính trang Soạn bài.
  const blob = new Blob([buildJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  window.open(`lesson.html?src=${encodeURIComponent(url)}`, "_blank");
}

function wireButtons() {
  $("btnLoadVideo").addEventListener("click", loadVideo);
  $("btnMarkStart").addEventListener("click", markStart);
  $("btnMarkEnd").addEventListener("click", markEnd);
  $("btnAddLine").addEventListener("click", () => addLine());
  $("btnAddVocab").addEventListener("click", addVocab);
  $("btnValidate").addEventListener("click", runValidate);
  $("btnExport").addEventListener("click", exportJson);
  $("btnPreview").addEventListener("click", previewLesson);
  $("btnSortLines").addEventListener("click", () => {
    draft.lines.sort((a, b) => a.start - b.start);
    draft.lines.forEach((l, i) => { l.id = `l${i + 1}`; });
    saveDraft(); renderLines(); runValidate();
  });
  $("btnCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(buildJson()); $("btnCopy").textContent = "Đã sao chép ✓"; }
    catch { alert("Trình duyệt không cho sao chép. Dùng nút Xuất tệp."); }
    setTimeout(() => { $("btnCopy").textContent = "Sao chép JSON"; }, 1800);
  });
  $("inImport").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const { ok, issues } = validateLesson(parsed);
      if (!ok && !confirm(`Tệp có ${issues.filter((i) => i.level === "error").length} lỗi. Vẫn mở để sửa?`)) return;
      draft = normalizeLesson(parsed);
      saveDraft(); fillMeta(); renderLines(); renderVocab(); runValidate();
    } catch (err) {
      alert("Không đọc được tệp: " + err.message);
    }
  });

  // phím tắt cho người soạn: I = mốc bắt đầu, O = mốc kết thúc (như phần mềm dựng)
  document.addEventListener("keydown", (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "i" || e.key === "I") markStart();
    if (e.key === "o" || e.key === "O") markEnd();
  });
}

boot();
