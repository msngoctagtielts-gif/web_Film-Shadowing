/**
 * exercise-panel.js — màn làm bài tập.
 *
 * Một câu một màn, trả lời xong biết đúng sai ngay. Lý do không gom cả 12 câu
 * lên một trang rồi chấm cuối: học viên sai câu 2 mà tới câu 12 mới biết thì đã
 * lặp lại cái sai đó mười lần.
 *
 * Câu nghe phát bằng đúng nguồn của bài học — video thật nếu có, giọng máy nếu
 * bài dùng kịch bản tự viết.
 */

import { esc, openModal, banner } from "./components.js";
import { generateExercises, checkAnswer, summarizeQuiz, EXERCISE_LABELS } from "../core/exercises.js";
import { speakOnce } from "../core/player.js";

/**
 * Mở màn bài tập.
 *
 * @param {object} args
 * @param {object} args.lesson
 * @param {string[]} [args.lineIds]  Chỉ ra đề trên mấy câu vừa học
 * @param {number} [args.limit]
 * @param {(lineId:string)=>void} [args.playLine] Phát đúng đoạn video của câu đó
 * @param {(summary:object)=>void} [args.onDone]
 */
export function openExercises({ lesson, lineIds = null, limit = 12, playLine = null, onDone = null }) {
  const seed = Math.floor(Math.random() * 100000);
  const items = generateExercises(lesson, { limit, seed, lineIds });

  if (!items.length) {
    openModal({
      title: "Bài tập",
      bodyHtml: banner("warn",
        "<b>Bài này chưa đủ dữ liệu để ra đề.</b> Bài tập được sinh ra từ chính kịch bản, "
        + "nên cần ít nhất vài câu thoại có nghĩa tiếng Việt, và vài từ mới có nghĩa. "
        + "Mở trang <b>Soạn bài</b> để bổ sung."),
    });
    return null;
  }

  let i = 0;
  const results = [];
  /** @type {string|string[]|null} */
  let picked = null;
  let answered = false;

  const lang = lesson.source?.voiceLang || "en-US";
  const say = (text, rate = 0.95) => {
    const ex = items[i];
    if (playLine && ex.lineId) playLine(ex.lineId);
    else speakOnce(text, { lang, rate });
  };

  const modal = openModal({
    title: `Bài tập — ${lesson.title || ""}`,
    bodyHtml: '<div data-role="quiz"></div>',
    footHtml: `<span class="hint" data-role="count"></span>
      <span style="margin-left:auto"></span>
      <button class="btn btn--sm btn--primary" data-role="next">Kiểm tra</button>`,
    wide: true,
    onClose: () => onDone?.(summarizeQuiz(results)),
  });

  const body = modal.el.querySelector('[data-role="quiz"]');
  const btnNext = modal.el.querySelector('[data-role="next"]');
  const counter = modal.el.querySelector('[data-role="count"]');

  /* ------------------------------- vẽ một câu ---------------------------- */

  function renderQuestion() {
    const ex = items[i];
    picked = ex.type === "order" ? [] : null;
    answered = false;
    btnNext.textContent = "Kiểm tra";
    btnNext.disabled = true;
    counter.textContent = `Câu ${i + 1}/${items.length}`;

    const dots = `<div class="dots" style="margin-bottom:12px">${items
      .map((_, k) => `<i data-on="${k < i || (k === i && answered)}"></i>`).join("")}</div>`;

    const head = `${dots}
      <div class="row" style="gap:8px;margin-bottom:10px">
        <span class="tag tag--gold">${esc(EXERCISE_LABELS[ex.type])}</span>
        ${ex.speak ? `<button class="btn btn--sm btn--ghost" data-role="say">🔊 Nghe</button>` : ""}
      </div>
      <p style="font-weight:600;margin:0 0 4px">${esc(ex.question)}</p>`;

    let main = "";
    if (ex.type === "order") {
      main = `
        <div class="ex-answer" data-role="slot" aria-label="Câu bạn đang xếp"></div>
        ${ex.prompt ? `<p class="hint" style="margin:8px 0 0">Gợi ý nghĩa: ${esc(ex.prompt)}</p>` : ""}
        <div class="ex-tiles" data-role="tiles">
          ${ex.tiles.map((w, k) => `<button class="ex-tile" data-tile="${k}">${esc(w)}</button>`).join("")}
        </div>`;
    } else {
      main = `
        ${ex.prompt ? `<p class="ex-prompt">${esc(ex.prompt)}${ex.promptIpa ? ` <span class="hint">${esc(ex.promptIpa)}</span>` : ""}</p>` : ""}
        <div class="ex-options">
          ${ex.options.map((o, k) => `<button class="ex-option" data-opt="${k}">${esc(o)}</button>`).join("")}
        </div>`;
    }

    body.innerHTML = head + main + '<div data-role="feedback"></div>';
    wireQuestion(ex);

    // Câu nghe thì phát ngay, khỏi bắt học viên bấm thêm một nút
    if (ex.type === "listen") setTimeout(() => say(ex.speak), 250);
  }

  function wireQuestion(ex) {
    body.querySelector('[data-role="say"]')?.addEventListener("click", () => say(ex.speak));

    body.querySelectorAll("[data-opt]").forEach((btn) => btn.addEventListener("click", () => {
      if (answered) return;
      body.querySelectorAll("[data-opt]").forEach((b) => b.removeAttribute("data-picked"));
      btn.setAttribute("data-picked", "true");
      picked = ex.options[Number(btn.dataset.opt)];
      btnNext.disabled = false;
    }));

    if (ex.type === "order") {
      const slot = body.querySelector('[data-role="slot"]');
      const redrawSlot = () => {
        slot.innerHTML = picked.length
          ? picked.map((w, k) => `<button class="ex-tile ex-tile--placed" data-un="${k}">${esc(w)}</button>`).join("")
          : '<span class="hint">Bấm các từ bên dưới theo đúng thứ tự</span>';
        slot.querySelectorAll("[data-un]").forEach((b) => b.addEventListener("click", () => {
          if (answered) return;
          const k = Number(b.dataset.un);
          const word = picked[k];
          picked.splice(k, 1);
          const back = [...body.querySelectorAll("[data-tile]")].find(
            (t) => t.textContent === word && t.hasAttribute("data-used"));
          back?.removeAttribute("data-used");
          redrawSlot();
          btnNext.disabled = picked.length === 0;
        }));
      };
      redrawSlot();

      body.querySelectorAll("[data-tile]").forEach((btn) => btn.addEventListener("click", () => {
        if (answered || btn.hasAttribute("data-used")) return;
        btn.setAttribute("data-used", "true");
        picked.push(btn.textContent);
        redrawSlot();
        btnNext.disabled = false;
      }));
    }
  }

  /* --------------------------------- chấm -------------------------------- */

  function grade() {
    const ex = items[i];
    const given = ex.type === "order" ? picked.join(" ") : picked;
    const correct = checkAnswer(ex, given);
    answered = true;
    results.push({ id: ex.id, type: ex.type, correct, given, answer: ex.answer });

    if (ex.type === "order") {
      body.querySelector('[data-role="slot"]').setAttribute("data-verdict", correct ? "right" : "wrong");
    } else {
      body.querySelectorAll("[data-opt]").forEach((b) => {
        const val = ex.options[Number(b.dataset.opt)];
        if (val === ex.answer) b.setAttribute("data-verdict", "right");
        else if (b.hasAttribute("data-picked")) b.setAttribute("data-verdict", "wrong");
        b.disabled = true;
      });
    }

    body.querySelector('[data-role="feedback"]').innerHTML = correct
      ? banner("ok", `<b>Đúng.</b> ${esc(ex.explain || "")}`)
      : banner("bad", `<b>Chưa đúng.</b> Đáp án: <b>${esc(ex.answer)}</b>. ${esc(ex.explain || "")}`);

    if (!correct && ex.speak) setTimeout(() => say(ex.speak, 0.85), 400);

    btnNext.disabled = false;
    btnNext.textContent = i < items.length - 1 ? "Câu tiếp →" : "Xem kết quả";
  }

  /* ------------------------------- tổng kết ------------------------------ */

  function renderSummary() {
    const s = summarizeQuiz(results);
    const wrong = results.filter((r) => !r.correct);
    const tone = s.percent >= 80 ? "ok" : s.percent >= 60 ? "warn" : "bad";

    body.innerHTML = `
      <div class="row" style="gap:18px;align-items:center;margin-bottom:14px">
        <div class="tile" data-tone="${tone === "ok" ? "ok" : tone === "bad" ? "bad" : ""}" style="min-width:130px">
          <div class="tile__val">${s.right}/${s.total}</div>
          <div class="tile__label">câu đúng · ${s.percent}%</div>
        </div>
        <div style="flex:1 1 200px">
          ${Object.entries(s.byType).map(([t, v]) =>
            `<div class="meter"><span>${esc(EXERCISE_LABELS[t])}</span>
              <span class="meter__bar"><i data-v="${v.right / v.total >= 0.8 ? "ok" : v.right / v.total >= 0.6 ? "warn" : "bad"}"
                style="width:${Math.max(3, (v.right / v.total) * 100)}%"></i></span>
              <span class="meter__num">${v.right}/${v.total}</span></div>`).join("")}
        </div>
      </div>
      ${s.weakestType ? banner("warn",
        `Dạng <b>${esc(EXERCISE_LABELS[s.weakestType])}</b> còn yếu nhất. `
        + (s.weakestType === "listen" ? "Nghe lại cảnh một lượt trước khi làm lại."
         : s.weakestType === "order" ? "Mở bảng kịch bản đọc to từng câu, chú ý thứ tự từ."
         : s.weakestType === "gap" ? "Xem lại mục Cụm trọng tâm ở tab Ghi chú."
         : "Học lại bộ thẻ từ mới rồi làm lại.")) : ""}
      ${wrong.length ? `<h3 style="font-size:.95rem;margin:16px 0 8px">Câu làm sai</h3>
        <div class="stack stack--sm">${wrong.map((r) => `
          <div style="border-left:3px solid var(--bad);padding:6px 11px;background:var(--surface-2);border-radius:0 8px 8px 0">
            <div class="hint">${esc(EXERCISE_LABELS[r.type])}</div>
            <div>Bạn chọn: <span style="color:var(--bad)">${esc(String(r.given || "(bỏ trống)"))}</span></div>
            <div>Đáp án: <b>${esc(r.answer)}</b></div>
          </div>`).join("")}</div>`
        : banner("ok", "<b>Đúng hết.</b> Quay lại vòng Kiểm tra để nâng điểm lồng tiếng.")}`;

    counter.textContent = "";
    btnNext.textContent = "Làm lại bộ đề khác";
    btnNext.disabled = false;
    btnNext.onclick = () => {
      modal.close();
      openExercises({ lesson, lineIds, limit, playLine, onDone });
    };
  }

  btnNext.addEventListener("click", () => {
    if (btnNext.textContent === "Làm lại bộ đề khác") return;
    if (!answered) { grade(); return; }
    if (i < items.length - 1) { i++; renderQuestion(); }
    else renderSummary();
  });

  renderQuestion();
  return modal;
}
