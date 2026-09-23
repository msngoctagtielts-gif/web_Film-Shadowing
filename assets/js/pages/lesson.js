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
import { createPlayer, speakOnce } from "../core/player.js";
import { createRecorder, recorderSupport, drawVu, effectiveDuration } from "../core/recorder.js";
import { asrSupport, listen, pickBestAlternative } from "../core/asr.js";
import { gradeAttempt } from "../core/scoring.js";
import { store } from "../core/store.js";
import { createScriptPanel, lineAtTime } from "../ui/script-panel.js";
import { openVocabPreview } from "../ui/vocab-preview.js";
import { illustrationFor } from "../ui/illustrations.js";
import { appBar, wireTheme, banner, cueHtml, scoreCardHtml, esc, fmtTime } from "../ui/components.js";

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
  state.player = await createPlayer({ mount: $("playerMount"), lesson: state.lesson });
  state.player.setRate(state.rate);

  state.player.on("time", (t) => {
    $("lsClock").textContent = fmtTime(t);
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
  const sup = asrSupport();
  if (!sup.available) {
    $("asrNotice").innerHTML = banner("warn",
      `<b>Trình duyệt này không chấm điểm tự động được.</b> ${esc(sup.note)}
       Dùng Chrome hoặc Edge để có điểm. Bạn vẫn thu và nghe lại được ở đây.`);
    state.asrEnabled = false;
    return;
  }
  if (state.asrEnabled === true) {
    $("asrNotice").innerHTML = banner("ok",
      `Chấm điểm tự động: <b>đang bật</b>.
       <button class="btn btn--sm btn--ghost" id="btnAsrOff">Tắt</button>`);
    $("btnAsrOff")?.addEventListener("click", () => { setAsr(false); });
    return;
  }
  if (state.asrEnabled === false) {
    $("asrNotice").innerHTML = banner("info",
      `Chấm điểm tự động đang tắt — bạn tự nghe lại và tự đánh giá.
       <button class="btn btn--sm btn--ghost" id="btnAsrOn">Bật chấm điểm</button>`);
    $("btnAsrOn")?.addEventListener("click", () => { setAsr(true); });
    return;
  }
  // chưa hỏi lần nào: xin phép rõ ràng trước khi gửi giọng đi
  $("asrNotice").innerHTML = banner("warn",
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

async function startRecording() {
  if (!state.line) return;
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
    refSec: state.line.durationSec,
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

function renderScore(result, notes, asrResult) {
  $("scoreBox").hidden = false;
  const extra = [];
  if (asrResult?.error === "network") extra.push("Mất mạng giữa lúc nhận dạng — điểm có thể thấp hơn thực tế, thu lại khi mạng ổn.");
  if (asrResult?.error === "not-allowed") extra.push("Trình duyệt chặn nhận dạng giọng nói. Kiểm tra quyền micro của trang.");
  $("scoreBody").innerHTML =
    [...notes, ...extra].map((n) => banner("warn", esc(n))).join("") +
    scoreCardHtml(result, { refText: state.line.text }) +
    `<div class="btn-row" style="margin-top:14px">
      <button class="btn btn--sm" id="btnAgain">↻ Thu lại câu này</button>
      <button class="btn btn--sm btn--primary" id="btnGoNext">Câu tiếp →</button>
    </div>`;
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
