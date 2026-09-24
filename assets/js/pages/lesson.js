/**
 * lesson.js — điều phối màn luyện lồng tiếng.
 *
 * Bốn vòng luyện, cố định theo thứ tự sư phạm:
 *   1. Nghe        — nghe câu mẫu, lặp bao nhiêu lần cũng được
 *   2. Đọc chồng   — đọc cùng lúc với bản mẫu để bắt nhịp và ngữ điệu
 *   3. Lồng tiếng  — video chạy, tiếng gốc tắt, học viên thay giọng
 *   4. Kiểm tra    — ẩn chữ, thu một lượt, lấy điểm vào tiến độ
 *
 * Vòng 3 là lý do của cả sản phẩm: học viên phải nói vừa đúng, vừa kịp nhịp
 * của diễn viên — đó là áp lực thật của hội thoại, khác hẳn đọc to một câu.
 */

import { loadLesson } from "../core/lesson-loader.js";
import { createPlayer, createNullPlayer, speakOnce } from "../core/player.js";
import { createRecorder, recorderSupport, drawVu, effectiveDuration } from "../core/recorder.js";
import { asrSupport, listen, pickBestAlternative } from "../core/asr.js";
import { gradeAttempt, shouldSoftenScore } from "../core/scoring.js";
import { store } from "../core/store.js";
import { createScriptPanel, lineAtTime } from "../ui/script-panel.js";
import { openVocabPreview } from "../ui/vocab-preview.js";
import { openExercises } from "../ui/exercise-panel.js";
import { buildCaption, activeIndex, suggestRate, suggestLeadIn } from "../core/karaoke.js";
import { illustrationFor } from "../ui/illustrations.js";
import { appBar, wireTheme, banner, cueHtml, scoreCardHtml, wordMapHtml, esc, fmtTime } from "../ui/components.js";

const $ = (id) => document.getElementById(id);

/* --------------------------- trạng thái màn hình -------------------------- */
const state = {
  lesson: null,
  player: null,
  panel: null,
  recorder: null,
  asr: null,              // phiên nhận dạng đang chạy
  line: null,             // câu đang chọn
  step: "listen",
  loop: false,
  rate: 1,
  hideText: false,
  showVi: true,
  asrEnabled: null,       // null = chưa hỏi
  recording: false,
  lastTake: null,
  playerWarning: null,   // cảnh báo khi nguồn video hỏng
  leadSec: 0.4,          // chữ chạy trước tiếng bao nhiêu giây
  prepMode: "auto",      // thời gian chuẩn bị trước khi thu
  gentle: true,          // chế độ nhẹ nhàng: luyện thì không hiện điểm
  captionOn: true,
  prepTimer: null,
  prepResolve: null,
  vuRaf: null,
  autoStop: null,
};

/* --------------------------------- khởi động ----------------------------- */

async function boot() {
  $("appbar").innerHTML = appBar("");
  wireTheme();

  const params = new URLSearchParams(location.search);
  const lessonFile = params.get("src") || (params.get("lesson")
    ? `data/lessons/${params.get("lesson")}.json`
    : "data/lessons/demo-doan-thoai-ga-tau.json");

  try {
    const { lesson, issues } = await loadLesson(lessonFile);
    state.lesson = lesson;
    const s = store.getSettings();
    state.rate = s.rate ?? 1;
    state.hideText = Boolean(s.hideText);
    state.showVi = s.showVi !== false;
    state.asrEnabled = s.asrEnabled;
    state.leadSec = s.leadSec ?? 0.4;
    state.prepMode = s.prepMode ?? "auto";
    state.gentle = s.gentle !== false;
    state.captionOn = s.captionOn !== false;
    store.markLessonStarted(lesson.id);

    $("loadState").hidden = true;
    $("lessonRoot").hidden = false;
    renderHeader(issues);
    await setupPlayer();
    setupPanel();
    setupVocabTab();
    setupNotesTab();
    setupControls();
    renderAsrNotice();
    refreshProgress();
    drawVu($("vu"), 0);   // vẽ cột mờ lúc nghỉ, tránh một ô trắng trống trơn

    // Lần đầu mở bài: học từ mới trước khi vào phim.
    const seen = Object.keys(store.lesson(lesson.id).vocab || {}).length;
    if (lesson.vocab.length && seen === 0) openVocab();
    else if (lesson.lines.length) selectLine(lesson.lines[0], { play: false });
  } catch (err) {
    console.error(err);
    $("loadState").innerHTML = banner("bad",
      `<b>Không mở được bài học.</b><br>${esc(err.message)}
       ${err.issues ? `<ul>${err.issues.filter((i) => i.level === "error").map((i) => `<li>${esc(i.where)}: ${esc(i.message)}</li>`).join("")}</ul>` : ""}
       <p style="margin:8px 0 0"><a href="index.html">← Về danh sách khoá học</a></p>`);
  }
}

function renderHeader(issues) {
  const L = state.lesson;
  $("lsTitle").textContent = L.title || L.id;
  $("lsLevel").textContent = L.level || "—";
  const srcLabel = { youtube: "YouTube (nhúng)", file: "Tệp của trung tâm", tts: "Giọng đọc máy" }[L.source.type];
  $("lsSource").textContent = srcLabel;
  $("lsSubtitle").textContent = `${L.lines.length} câu thoại · ${L.vocab.length} từ mới · ${L.keyphrases.length} cụm trọng tâm`;
  document.title = `${L.title} — Film Shadowing`;

  const note = L.source.rightsNote || L.rightsNote;
  $("rightsNote").innerHTML = note
    ? `Nguồn tư liệu: ${esc(note)}`
    : "Bài học dùng giọng đọc máy trên kịch bản tự viết — không dùng tư liệu của bên thứ ba.";

  const warns = (issues || []).filter((i) => i.level === "warning");
  if (warns.length) {
    console.warn("Bài học có cảnh báo:", warns);
  }
}

/* --------------------------------- trình phát ---------------------------- */

async function setupPlayer() {
  try {
    state.player = await createPlayer({ mount: $("playerMount"), lesson: state.lesson });
  } catch (err) {
    // Video hỏng thì buổi học vẫn phải học được: thay bằng player rỗng rồi đi tiếp.
    console.error("Không nạp được nguồn video:", err);
    state.player = createNullPlayer($("playerMount"), err.message || String(err));
    state.playerWarning = banner("warn",
      `<b>Không phát được video của bài này.</b> ${esc(err.message || "")}
       <br>Thường là do mạng chặn YouTube, hoặc chủ kênh đã tắt cho phép nhúng.
       Bạn vẫn xem được kịch bản, thu âm và chấm điểm bình thường — chỉ không nghe được bản mẫu.`);
  }
  state.player.setRate(state.rate);

  state.player.on("time", (t) => {
    $("lsClock").textContent = fmtTime(t);
    if (caption.mode === "player" && caption.line) {
      tickCaption(t - caption.line.start);
    }
    const l = lineAtTime(state.lesson, t);
    if (l && (!state.line || l.id !== state.line.id) && !state.recording) {
      // video tự chạy sang câu khác: đồng bộ bảng kịch bản, không ép đổi câu đang luyện
      state.panel.setActive(l.id);
    }
  });

  state.player.on("segmentend", () => {
    if (state.step === "listen" || state.step === "chorus") return;
  });
}

/* ------------------------------- phụ đề chạy ----------------------------- */

/**
 * Phụ đề chạy theo nhịp, chữ sáng dần từng từ.
 *
 * Hai nguồn nhịp:
 *   "player" — bám theo đồng hồ của trình phát, dùng khi có tiếng mẫu.
 *   "timer"  — tự chạy bằng đồng hồ riêng, dùng ở vòng Lồng tiếng khi tiếng gốc
 *              đã tắt. Lúc đó chính phụ đề là nhịp để học viên bám vào.
 *
 * Chữ luôn sáng TRƯỚC tiếng một khoảng (state.leadSec). Nếu sáng đúng lúc tiếng
 * phát ra thì học viên luôn chậm nửa nhịp và luôn thấy mình kém — đó là kiểu áp
 * lực bài học này cố tình tránh.
 */
const caption = { line: null, words: [], mode: "idle", raf: null, t0: 0 };

function captionShell(line) {
  const { words } = buildCaption(line.text, line.durationSec);
  caption.line = line;
  caption.words = words;

  const kws = (line.keywords || []).map((k) => k.toLowerCase());
  const inKeyword = (w) => kws.some((k) => k.split(/\s+/).includes(w.toLowerCase().replace(/[^a-z'’-]/gi, "")));

  $("capSpeaker").textContent = line.speaker || "";
  $("capLine").innerHTML = words
    .map((w) => `<span class="cw" data-i="${w.index}" data-kw="${inKeyword(w.text)}">${esc(w.text)}</span>`)
    .join("");
  $("capProgress").style.width = "0%";
  $("captionBar").hidden = !state.captionOn;
  $("captionBar").classList.toggle("caption--hidden-text", state.hideText && state.step === "test");
  paintCaption(-1, 0);
}

function paintCaption(idx, pct) {
  const spans = $("capLine").children;
  for (let i = 0; i < spans.length; i++) {
    spans[i].dataset.state = i < idx ? "done" : i === idx ? "now" : "next";
  }
  $("capProgress").style.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
}

/** Cập nhật phụ đề theo giây tính từ đầu câu (đơn vị: thời gian của chính câu). */
function tickCaption(relSec) {
  if (!caption.words.length) return;
  const lead = state.leadSec * state.rate;   // đổi từ giây thật sang giây của câu
  paintCaption(activeIndex(caption.words, relSec, lead), relSec / caption.line.durationSec);
}

/** Cho phụ đề tự chạy — dùng khi không có tiếng mẫu để bám. */
function runCaptionTimer(line) {
  stopCaptionTimer();
  captionShell(line);
  caption.mode = "timer";
  caption.t0 = performance.now();
  const step = () => {
    if (caption.mode !== "timer") return;
    const elapsed = (performance.now() - caption.t0) / 1000;
    const rel = elapsed * state.rate;
    tickCaption(rel);
    if (rel < line.durationSec + 0.4) caption.raf = requestAnimationFrame(step);
  };
  step();
}

function stopCaptionTimer() {
  if (caption.raf) cancelAnimationFrame(caption.raf);
  caption.raf = null;
  if (caption.mode === "timer") caption.mode = "idle";
}

/* --------------------------------- kịch bản ------------------------------ */

function bestScores() {
  const prog = store.lesson(state.lesson.id);
  const out = {};
  for (const [id, v] of Object.entries(prog.lines || {})) out[id] = v.best;
  return out;
}

function setupPanel() {
  state.panel = createScriptPanel({
    mount: $("tabScript"),
    lesson: state.lesson,
    onPick: (line) => selectLine(line, { play: true }),
    getState: () => ({ hideText: state.hideText && state.step === "test", showVi: state.showVi, bestScores: bestScores() }),
  });

  document.querySelectorAll('[role="tab"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
      $("tabScript").hidden = btn.dataset.tab !== "script";
      $("tabVocab").hidden = btn.dataset.tab !== "vocab";
      $("tabNotes").hidden = btn.dataset.tab !== "notes";
    });
  });
}

function setupVocabTab() {
  const L = state.lesson;
  if (!L.vocab.length) { $("tabVocab").innerHTML = '<p class="hint">Bài này chưa có từ mới.</p>'; return; }
  $("tabVocab").innerHTML = `<div class="stack stack--sm">${L.vocab.map((v) => `
    <div class="row" style="gap:10px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:9px">
      <div style="flex:0 0 62px;height:40px;color:var(--navy-600)">${illustrationFor(v)}</div>
      <div style="flex:1 1 140px">
        <b>${esc(v.term)}</b> ${v.ipa ? `<span class="hint">${esc(v.ipa)}</span>` : ""}
        <div class="hint">${esc(v.meaningVi || "")}</div>
      </div>
      <button class="btn btn--sm btn--ghost" data-say="${esc(v.term)}" aria-label="Nghe ${esc(v.term)}">🔊</button>
    </div>`).join("")}
    <button class="btn btn--sm btn--block" id="btnVocabAgain">Học lại bộ thẻ từ mới</button></div>`;

  $("tabVocab").querySelectorAll("[data-say]").forEach((b) =>
    b.addEventListener("click", () => speakOnce(b.dataset.say, { lang: L.source.voiceLang, rate: 0.92 })));
  $("btnVocabAgain")?.addEventListener("click", openVocab);
}

function setupNotesTab() {
  const L = state.lesson;
  const notes = L.lines.filter((l) => l.notes);
  $("tabNotes").innerHTML = `
    ${L.notes ? `<div class="banner" style="margin-bottom:12px"><b>📝</b><div>${esc(L.notes)}</div></div>` : ""}
    ${L.keyphrases.length ? `<h3 style="font-size:.95rem">Cụm đáng thuộc cả bài</h3>
      <div class="stack stack--sm" style="margin-bottom:14px">${L.keyphrases.map((k) => `
        <div><b>${esc(k.text)}</b> — ${esc(k.meaningVi || "")}
        ${k.note ? `<div class="hint">${esc(k.note)}</div>` : ""}</div>`).join("")}</div>` : ""}
    ${notes.length ? `<h3 style="font-size:.95rem">Lưu ý phát âm theo câu</h3>
      <div class="stack stack--sm">${notes.map((l) => `
        <div><span class="hint">${fmtTime(l.start)}</span> ${esc(l.notes)}</div>`).join("")}</div>` : '<p class="hint">Chưa có ghi chú.</p>'}`;
}

/* ------------------------------ chọn câu, phát --------------------------- */

function selectLine(line, { play = true } = {}) {
  cancelRecording();
  state.line = line;
  state.panel.setActive(line.id);

  $("curSpeaker").textContent = line.speaker ? `${line.speaker} · ${fmtTime(line.start)}–${fmtTime(line.end)} (${line.durationSec}s)` : fmtTime(line.start);
  $("curText").innerHTML = (state.step === "test" && state.hideText)
    ? '<span class="hint">Chữ đã ẩn — nghe rồi lồng tiếng bằng tai.</span>'
    : esc(line.text);
  $("curVi").textContent = state.showVi ? (line.textVi || "") : "";

  renderCue(line);
  captionShell(line);
  renderRateTip(line);
  $("btnRec").disabled = false;
  $("recStatus").textContent = stepHint();
  $("playbackBox").hidden = true;
  $("scoreBox").hidden = true;
  if (play) playCurrentLine();
}

function renderCue(line) {
  const L = state.lesson;
  const items = [];
  for (const id of line.vocabIds || []) {
    const v = L.vocab.find((x) => x.id === id);
    if (v) items.push({ term: v.term, ipa: v.ipa, meaningVi: v.meaningVi });
  }
  for (const kw of line.keywords || []) {
    const kp = L.keyphrases.find((k) => k.text.toLowerCase() === kw.toLowerCase());
    items.push({ term: kw, meaningVi: kp?.meaningVi || "", note: kp?.note || "tính điểm nặng ở câu này" });
  }
  $("cueCard").hidden = items.length === 0;
  $("cueBox").innerHTML = cueHtml(items);
}

function playCurrentLine() {
  if (!state.line) return;
  muteModel(false);
  stopCaptionTimer();
  captionShell(state.line);
  caption.mode = "player";
  state.player.playSegment(state.line.start, state.line.end, { loop: state.loop, rate: state.rate });
}

function stepHint() {
  return {
    listen: "Nghe câu mẫu, lặp tới khi nhớ được nhịp.",
    chorus: "Bấm thu rồi đọc CÙNG LÚC với bản mẫu.",
    dub: "Bản mẫu sẽ tắt tiếng — bạn thay giọng diễn viên.",
    test: "Một lượt duy nhất, chữ ẩn. Điểm này vào tiến độ.",
  }[state.step];
}

/* --------------------------------- thu âm -------------------------------- */

function renderAsrNotice() {
  // Giữ lại cảnh báo về video (nếu có) — nó quan trọng hơn thông báo chấm điểm.
  const keep = state.playerWarning || "";
  const sup = asrSupport();
  if (!sup.available) {
    $("asrNotice").innerHTML = keep + banner("warn",
      `<b>Trình duyệt này không chấm điểm tự động được.</b> ${esc(sup.note)}
       Dùng Chrome hoặc Edge để có điểm. Bạn vẫn thu và nghe lại được ở đây.`);
    state.asrEnabled = false;
    return;
  }
  if (state.asrEnabled === true) {
    $("asrNotice").innerHTML = keep + banner("ok",
      `Chấm điểm tự động: <b>đang bật</b>.
       <button class="btn btn--sm btn--ghost" id="btnAsrOff">Tắt</button>`);
    $("btnAsrOff")?.addEventListener("click", () => { setAsr(false); });
    return;
  }
  if (state.asrEnabled === false) {
    $("asrNotice").innerHTML = keep + banner("info",
      `Chấm điểm tự động đang tắt — bạn tự nghe lại và tự đánh giá.
       <button class="btn btn--sm btn--ghost" id="btnAsrOn">Bật chấm điểm</button>`);
    $("btnAsrOn")?.addEventListener("click", () => { setAsr(true); });
    return;
  }
  // chưa hỏi lần nào: xin phép rõ ràng trước khi gửi giọng đi
  $("asrNotice").innerHTML = keep + banner("warn",
    `<b>Trước khi bật chấm điểm tự động.</b> Để chuyển giọng của bạn thành chữ,
     trình duyệt gửi đoạn thu tới dịch vụ nhận dạng của nhà cung cấp trình duyệt
     (Google với Chrome, Apple với Safari). Bản thu vẫn nằm trên máy bạn, không
     ai ở trung tâm nghe được nếu bạn không gửi.
     <div class="btn-row" style="margin-top:8px">
       <button class="btn btn--sm btn--primary" id="btnAsrYes">Đồng ý, bật chấm điểm</button>
       <button class="btn btn--sm" id="btnAsrNo">Không, tôi tự đánh giá</button>
     </div>`);
  $("btnAsrYes")?.addEventListener("click", () => setAsr(true));
  $("btnAsrNo")?.addEventListener("click", () => setAsr(false));
}

function setAsr(on) {
  state.asrEnabled = on;
  store.setSettings({ asrEnabled: on });
  renderAsrNotice();
}

async function ensureRecorder() {
  if (state.recorder) return state.recorder;
  const sup = recorderSupport();
  if (!sup.mediaRecorder) throw new Error("Trình duyệt này không thu âm được.");
  state.recorder = await createRecorder();
  return state.recorder;
}

/**
 * Gợi ý tốc độ cho câu đang chọn. CHỈ GỢI Ý — không tự đổi tốc độ của học viên.
 * Ép tốc độ cũng là một kiểu áp lực.
 */
function renderRateTip(line) {
  const tip = suggestRate(line.text, line.durationSec, state.lesson.scoring.profile);
  $("rateTip").innerHTML = tip.rate === 1 ? "" : banner("warn",
    `${esc(tip.reason)} <button class="btn btn--sm btn--ghost" id="btnUseRate">Đổi sang ${tip.rate}x</button>`);
  $("btnUseRate")?.addEventListener("click", () => {
    document.querySelector(`[data-rate="${tip.rate}"]`)?.click();
  });
}

/** Số giây chuẩn bị cho câu này, theo lựa chọn của học viên. */
function prepSecondsFor(line) {
  if (state.prepMode === "auto") return suggestLeadIn(line.text);
  return Number(state.prepMode) || 0;
}

/**
 * Màn chuẩn bị trước khi thu.
 *
 * Học viên thấy trọn câu và có thời gian đọc thầm TRƯỚC khi máy bắt đầu nghe.
 * Không có tiếng bíp, không có "3! 2! 1!" — vòng đếm chạy êm, và lúc nào cũng
 * có nút bỏ qua lẫn nút xin thêm giờ. Bị dồn vào thế phải nói ngay là lý do
 * phổ biến nhất khiến người lớn ngại mở miệng.
 *
 * @returns {Promise<boolean>} true nếu nên thu tiếp, false nếu học viên huỷ
 */
function runPrep(line) {
  const seconds = prepSecondsFor(line);
  if (seconds <= 0) return Promise.resolve(true);

  $("prepText").textContent = line.text;
  $("prepBox").hidden = false;
  $("btnRec").disabled = true;

  return new Promise((resolve) => {
    let left = seconds;
    const total = seconds;
    const paint = () => {
      $("prepNum").textContent = Math.ceil(left);
      $("prepRing").style.setProperty("--p", `${((total - left) / total) * 100}%`);
    };
    paint();

    const finish = (ok) => {
      clearInterval(state.prepTimer);
      state.prepTimer = null;
      state.prepResolve = null;
      $("prepBox").hidden = true;
      $("btnRec").disabled = false;
      resolve(ok);
    };
    state.prepResolve = finish;

    state.prepTimer = setInterval(() => {
      left -= 0.1;
      if (left <= 0) { finish(true); return; }
      paint();
    }, 100);
  });
}

async function startRecording() {
  if (!state.line) return;
  // Vòng Nghe không thu — chỉ nghe. Không ép học viên nói khi chưa muốn.
  const ok = await runPrep(state.line);
  if (!ok) return;
  let rec;
  try {
    rec = await ensureRecorder();
  } catch (err) {
    $("recStatus").innerHTML = `<span style="color:var(--bad)">${esc(err.message)} Hãy cho phép dùng micro rồi thử lại.</span>`;
    return;
  }

  state.recording = true;
  state.lastTake = null;
  $("btnRec").innerHTML = "■ Dừng thu";
  $("btnRec").classList.remove("btn--rec");
  $("btnRec").classList.add("btn--gold");
  $("recStatus").innerHTML = '<span class="rec-dot"></span> Đang thu…';
  $("playbackBox").hidden = true;
  $("scoreBox").hidden = true;
  $("partialBox").hidden = !state.asrEnabled;
  $("partialBox").textContent = "";

  try { rec.start(); } catch (e) { console.warn(e); }

  // nhận dạng chạy song song để một lần đọc vừa có bản thu vừa có chữ
  if (state.asrEnabled) {
    state.asr = listen({
      lang: state.lesson.source.voiceLang || "en-US",
      onPartial: (txt) => { $("partialBox").textContent = txt ? `nghe được: ${txt}` : ""; },
    });
  }

  // vòng "đọc chồng" phát kèm bản mẫu; vòng "lồng tiếng" phát video tắt tiếng
  if (state.step === "chorus") {
    state.player.playSegment(state.line.start, state.line.end, { loop: false, rate: state.rate });
  } else if (state.step === "dub" || state.step === "test") {
    // Vòng lồng tiếng: cảnh vẫn chạy nhưng tiếng gốc tắt, học viên thay giọng.
    // Với nguồn giọng máy thì đơn giản là im lặng — học viên tự giữ nhịp.
    muteModel(true);
    if (state.player.kind !== "tts") {
      state.player.playSegment(state.line.start, state.line.end, { loop: false, rate: state.rate });
    }
  }

  // Vòng có tiếng mẫu thì phụ đề bám theo trình phát; vòng lồng tiếng thì phụ
  // đề tự chạy — nó chính là nhịp để học viên bám vào.
  if (state.step === "chorus") { captionShell(state.line); caption.mode = "player"; }
  else runCaptionTimer(state.line);

  drawVuLoop();

  // tự dừng sau khi hết câu + khoảng dư, tránh học viên quên bấm dừng
  const budget = (state.line.durationSec / state.rate) * 1.9 + 2500 / 1000;
  state.autoStop = setTimeout(() => { if (state.recording) stopRecording(); }, budget * 1000);
}

/** Tắt/mở tiếng bản mẫu — vòng "lồng tiếng" cần video chạy mà không có giọng gốc. */
function muteModel(on) {
  try { on ? state.player.mute?.() : state.player.unmute?.(); } catch (e) { console.warn(e); }
}

function drawVuLoop() {
  const canvas = $("vu");
  const tick = () => {
    if (!state.recording || !state.recorder) { drawVu(canvas, 0); return; }
    drawVu(canvas, state.recorder.level());
    state.vuRaf = requestAnimationFrame(tick);
  };
  tick();
}

function cancelRecording() {
  if (state.prepResolve) state.prepResolve(false);
  stopCaptionTimer();
  if (!state.recording) return;
  clearTimeout(state.autoStop);
  cancelAnimationFrame(state.vuRaf);
  state.asr?.abort();
  state.recorder?.cancel();
  state.recording = false;
  resetRecButton();
}

function resetRecButton() {
  $("btnRec").innerHTML = "● Thu âm";
  $("btnRec").classList.add("btn--rec");
  $("btnRec").classList.remove("btn--gold");
  $("recStatus").textContent = stepHint();
  drawVu($("vu"), 0);
}

async function stopRecording() {
  if (!state.recording) return;
  clearTimeout(state.autoStop);
  cancelAnimationFrame(state.vuRaf);
  stopCaptionTimer();
  state.recording = false;
  $("recStatus").textContent = "Đang chấm…";
  muteModel(false);
  state.player.stop();

  let take;
  try {
    take = await state.recorder.stop();
  } catch (err) {
    resetRecButton();
    $("recStatus").innerHTML = `<span style="color:var(--bad)">Không lấy được bản thu: ${esc(err.message)}</span>`;
    return;
  }

  let asrResult = { transcript: "", alternatives: [] };
  if (state.asr) {
    state.asr.stop();
    asrResult = await state.asr.promise;
    state.asr = null;
  }
  $("partialBox").hidden = true;

  state.lastTake = take;
  $("myAudio").src = take.url;
  $("playbackBox").hidden = false;
  resetRecButton();

  // cảnh báo chất lượng thu trước khi nói về điểm
  const m = take.metrics;
  const notes = [];
  if (m.tooQuiet) notes.push("Micro quá nhỏ — lại gần hơn hoặc tăng mức thu, điểm sẽ không chính xác.");
  if (m.clipping) notes.push("Tiếng bị vỡ do quá to — nói xa micro hơn một chút.");

  if (!state.asrEnabled) {
    showSelfAssess(take, notes);
    return;
  }

  const userSec = effectiveDuration(take.durationSec, m);
  const quickScore = (ref, hyp) => gradeAttempt({ refText: ref, hypText: hyp }).overall;
  const picked = pickBestAlternative(asrResult, state.line.text, quickScore);

  const result = gradeAttempt({
    refText: state.line.text,
    hypText: picked.transcript,
    keywords: state.line.keywords,
    // Học viên luyện ở 0.75x thì bản mẫu họ đang bám theo dài hơn thật. Lấy
    // thời lượng gốc để chấm nhịp sẽ phạt oan người đang cố tập chậm cho chắc.
    refSec: state.line.durationSec / state.rate,
    userSec,
    longPauses: m.longPauses,
    speechRatio: m.speechRatio,
    profile: state.lesson.scoring.profile,
  });

  renderScore(result, notes, asrResult);

  store.saveAttempt(state.lesson.id, state.line.id, {
    overall: result.overall, parts: result.parts,
    heardText: result.heardText, mode: result.mode, durationSec: take.durationSec,
  });
  state.panel.render();
  state.panel.setActive(state.line.id);
  refreshProgress();
}

/**
 * Hiện kết quả một lượt thu.
 *
 * CHẾ ĐỘ NHẸ NHÀNG (bật sẵn). Ở ba vòng luyện, học viên KHÔNG thấy điểm số —
 * chỉ thấy từ nào chưa ra và một lời nhắc. Điểm chỉ hiện ở vòng Kiểm tra.
 *
 * Lý do: một con số chấm sau mỗi lần mở miệng biến việc luyện tập thành việc bị
 * đánh giá. Người lớn gặp điểm thấp vài lần là ngừng thu, và ngừng thu thì
 * không còn học nữa. Thông tin sửa lỗi vẫn đủ — chỉ bỏ cái nhãn phán xét.
 * Ai muốn xem vẫn có nút mở ra.
 */
function renderScore(result, notes, asrResult) {
  $("scoreBox").hidden = false;
  const extra = [];
  if (asrResult?.error === "network") extra.push("Mất mạng giữa lúc nhận dạng — điểm có thể thấp hơn thực tế, thu lại khi mạng ổn.");
  if (asrResult?.error === "not-allowed") extra.push("Trình duyệt chặn nhận dạng giọng nói. Kiểm tra quyền micro của trang.");

  const softened = shouldSoftenScore(state.gentle, state.step);
  const head = [...notes, ...extra].map((n) => banner("warn", esc(n))).join("");
  const tail = `<div class="btn-row" style="margin-top:14px">
      <button class="btn btn--sm" id="btnAgain">↻ Thu lại câu này</button>
      <button class="btn btn--sm btn--primary" id="btnGoNext">Câu tiếp →</button>
    </div>`;

  if (softened) {
    const good = result.words.filter((w) => w.verdict === "good").length;
    const tip = result.advice[0]?.text || "";
    $("scoreBody").innerHTML = head + `
      <p style="margin:0 0 10px">Máy nghe ra <b>${good}/${result.stats.refWords}</b> từ trong câu.</p>
      ${wordMapHtml(result.words)}
      ${tip ? `<ul class="advice" style="margin-top:12px"><li><span aria-hidden="true">→</span><span>${esc(tip)}</span></li></ul>` : ""}
      <p class="hint" style="margin-top:10px">Đang luyện nên chưa tính điểm. Điểm chỉ lấy ở vòng <b>Kiểm tra</b>.
        <button class="btn btn--sm btn--ghost" id="btnShowScore">Tôi vẫn muốn xem điểm</button></p>
      ${tail}`;
    $("btnShowScore")?.addEventListener("click", () => {
      $("scoreBody").innerHTML = head + scoreCardHtml(result, { refText: state.line.text }) + tail;
      $("btnAgain")?.addEventListener("click", () => startRecording());
      $("btnGoNext")?.addEventListener("click", gotoNext);
    });
  } else {
    $("scoreBody").innerHTML = head + scoreCardHtml(result, { refText: state.line.text }) + tail;
  }

  $("btnAgain")?.addEventListener("click", () => startRecording());
  $("btnGoNext")?.addEventListener("click", gotoNext);
}

/** Khi không dùng chấm tự động: học viên tự nghe lại và tự cho điểm. */
function showSelfAssess(take, notes) {
  $("scoreBox").hidden = false;
  $("scoreBody").innerHTML =
    notes.map((n) => banner("warn", esc(n))).join("") +
    `<p class="hint">Nghe lại bản thu rồi so với bản mẫu. Bạn tự chấm — thành thật thì tiến bộ nhanh hơn.</p>
     <div class="btn-row">
       ${[["Chưa ra câu", 40], ["Tạm được", 65], ["Khá giống", 80], ["Rất giống", 92]]
        .map(([label, v]) => `<button class="btn btn--sm" data-self="${v}">${label}</button>`).join("")}
     </div>`;
  $("scoreBody").querySelectorAll("[data-self]").forEach((b) => b.addEventListener("click", () => {
    const v = Number(b.dataset.self);
    store.saveAttempt(state.lesson.id, state.line.id, {
      overall: v, parts: { accuracy: null, completeness: null, keywords: null, pacing: null },
      heardText: "", mode: "self", durationSec: take.durationSec,
    });
    state.panel.render(); state.panel.setActive(state.line.id); refreshProgress();
    $("scoreBody").innerHTML = banner("ok", `Đã ghi <b>${v}</b> điểm tự đánh giá cho câu này.`) +
      `<div class="btn-row" style="margin-top:10px"><button class="btn btn--sm btn--primary" id="btnGoNext2">Câu tiếp →</button></div>`;
    $("btnGoNext2")?.addEventListener("click", gotoNext);
  }));
}

/* -------------------------------- điều khiển ----------------------------- */

function gotoNext() {
  const i = state.lesson.lines.findIndex((l) => l.id === state.line?.id);
  const next = state.lesson.lines[i + 1];
  if (next) selectLine(next, { play: true });
  else finishLesson();
}

function gotoPrev() {
  const i = state.lesson.lines.findIndex((l) => l.id === state.line?.id);
  const prev = state.lesson.lines[i - 1];
  if (prev) selectLine(prev, { play: true });
}

function finishLesson() {
  const ids = state.lesson.lines.map((l) => l.id);
  const sum = store.summary(state.lesson.id, ids, state.lesson.scoring.passMark);
  if (sum.completed) store.markLessonCompleted(state.lesson.id);
  $("scoreBox").hidden = false;
  $("scoreBody").innerHTML = `
    <h3>Hết bài rồi 🎬</h3>
    <p>Bạn đạt <b>${sum.done}/${sum.total}</b> câu, điểm trung bình <b>${sum.avg}</b>.</p>
    ${sum.completed
      ? banner("ok", "Cả bài đã đạt. Sang tập sau, hoặc quay lại vòng <b>Kiểm tra</b> để nâng điểm.")
      : banner("warn", `Còn ${sum.total - sum.done} câu chưa đạt ${state.lesson.scoring.passMark} điểm. Bấm vào câu có điểm thấp ở bảng kịch bản để luyện lại.`)}
    <div class="btn-row" style="margin-top:12px">
      <a class="btn btn--sm btn--primary" href="index.html">← Danh sách bài</a>
      <a class="btn btn--sm" href="progress.html">Xem tiến độ</a>
    </div>`;
}

function refreshProgress() {
  const ids = state.lesson.lines.map((l) => l.id);
  const sum = store.summary(state.lesson.id, ids, state.lesson.scoring.passMark);
  $("lsPercent").textContent = `${sum.percent}%`;
  $("lsBar").style.width = `${sum.percent}%`;
  $("lsCounts").textContent = `${sum.done}/${sum.total} câu đạt · TB ${sum.avg}`;
}

function openVocab() {
  openVocabPreview({
    lesson: state.lesson,
    onCard: (vocabId, known) => store.markVocabSeen(state.lesson.id, vocabId, known),
    onDone: () => {
      if (!state.line && state.lesson.lines.length) selectLine(state.lesson.lines[0], { play: false });
    },
  });
}

/**
 * Mở bài tập. Đề sinh ra từ chính kịch bản của bài, và câu nghe phát bằng đúng
 * nguồn của bài — video thật nếu có, giọng máy nếu là kịch bản tự viết.
 */
function openQuiz() {
  openExercises({
    lesson: state.lesson,
    playLine: (lineId) => {
      const line = state.lesson.lines.find((l) => l.id === lineId);
      if (!line) return;
      muteModel(false);
      state.player.playSegment(line.start, line.end, { loop: false, rate: 1 });
    },
  });
}

function setStep(step) {
  state.step = step;
  document.querySelectorAll("[data-step]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.step === step)));
  $("stepTag").textContent = {
    listen: "Vòng 1 · Nghe", chorus: "Vòng 2 · Đọc chồng",
    dub: "Vòng 3 · Lồng tiếng", test: "Vòng 4 · Kiểm tra",
  }[step];
  $("recStatus").textContent = stepHint();
  state.panel.render();
  if (state.line) { state.panel.setActive(state.line.id); selectLine(state.line, { play: false }); }
}

function setupControls() {
  $("btnPlayLine").addEventListener("click", () => playCurrentLine());
  $("btnPrev").addEventListener("click", gotoPrev);
  $("btnNext").addEventListener("click", gotoNext);
  $("btnVocab").addEventListener("click", openVocab);
  $("btnQuiz").addEventListener("click", openQuiz);

  $("btnLoop").addEventListener("click", () => {
    state.loop = !state.loop;
    $("btnLoop").setAttribute("aria-pressed", String(state.loop));
    if (state.loop) playCurrentLine(); else state.player.clearSegment();
  });

  document.querySelectorAll("[data-rate]").forEach((b) => b.addEventListener("click", () => {
    state.rate = Number(b.dataset.rate);
    document.querySelectorAll("[data-rate]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    state.player.setRate(state.rate);
    store.setSettings({ rate: state.rate });
  }));
  document.querySelectorAll("[data-rate]").forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.rate) === state.rate)));

  document.querySelectorAll("[data-step]").forEach((b) =>
    b.addEventListener("click", () => setStep(b.dataset.step)));

  $("btnRec").addEventListener("click", () => state.recording ? stopRecording() : startRecording());
  $("btnRetry").addEventListener("click", () => startRecording());
  $("btnCompare").addEventListener("click", async () => {
    // nghe mẫu rồi nghe mình, liền nhau — cách phát hiện lệch nhịp nhanh nhất
    playCurrentLine();
    const wait = (state.line.durationSec / state.rate) * 1000 + 400;
    setTimeout(() => { $("myAudio").currentTime = 0; $("myAudio").play(); }, wait);
  });

  $("btnCaption").addEventListener("click", () => {
    state.captionOn = !state.captionOn;
    $("btnCaption").setAttribute("aria-pressed", String(state.captionOn));
    $("captionBar").hidden = !state.captionOn;
    store.setSettings({ captionOn: state.captionOn });
  });

  $("chkGentle").checked = state.gentle;
  $("chkGentle").addEventListener("change", (e) => {
    state.gentle = e.target.checked;
    store.setSettings({ gentle: state.gentle });
  });

  $("selPrep").value = String(state.prepMode);
  $("selPrep").addEventListener("change", (e) => {
    state.prepMode = e.target.value;
    store.setSettings({ prepMode: state.prepMode });
  });

  $("selLead").value = String(state.leadSec);
  $("selLead").addEventListener("change", (e) => {
    state.leadSec = Number(e.target.value);
    store.setSettings({ leadSec: state.leadSec });
  });

  $("btnPrepGo").addEventListener("click", () => state.prepResolve?.(true));
  $("btnPrepCancel").addEventListener("click", () => state.prepResolve?.(false));
  $("btnPrepMore").addEventListener("click", () => {
    // Xin thêm giờ: dừng đồng hồ cũ rồi chạy lại từ đầu với 3 giây nữa.
    state.prepResolve?.(false);
    const line = state.line;
    setTimeout(() => {
      const keep = state.prepMode;
      state.prepMode = String(prepSecondsFor(line) + 3);
      runPrep(line).then((ok) => { state.prepMode = keep; if (ok) startRecording(); });
    }, 30);
  });

  $("chkHide").checked = state.hideText;
  $("chkHide").addEventListener("change", (e) => {
    state.hideText = e.target.checked;
    store.setSettings({ hideText: state.hideText });
    state.panel.render();
    if (state.line) { state.panel.setActive(state.line.id); selectLine(state.line, { play: false }); }
  });
  $("chkVi").checked = state.showVi;
  $("chkVi").addEventListener("change", (e) => {
    state.showVi = e.target.checked;
    store.setSettings({ showVi: state.showVi });
    state.panel.render();
    if (state.line) { state.panel.setActive(state.line.id); selectLine(state.line, { play: false }); }
  });

  document.addEventListener("keydown", (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
    switch (e.key) {
      case " ": e.preventDefault(); playCurrentLine(); break;
      case "r": case "R": e.preventDefault(); state.recording ? stopRecording() : startRecording(); break;
      case "ArrowRight": e.preventDefault(); gotoNext(); break;
      case "ArrowLeft": e.preventDefault(); gotoPrev(); break;
      case "l": case "L": $("btnLoop").click(); break;
    }
  });

  window.addEventListener("beforeunload", () => { state.recorder?.destroy(); state.player?.destroy(); });
}

boot();
