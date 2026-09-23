/**
 * vocab-preview.js — vòng học từ mới TRƯỚC khi vào lồng tiếng.
 *
 * Lý do đặt trước: học viên gặp từ lạ ngay trong lúc thu sẽ dừng lại tra từ,
 * mất nhịp và mất tự tin. Xem trước 5–8 từ, mỗi từ một hình, một nghĩa, một câu
 * ví dụ nghe được, rồi mới vào phim.
 */

import { esc, openModal } from "./components.js";
import { illustrationFor } from "./illustrations.js";
import { speakOnce } from "../core/player.js";
import { review as srsReview, cardState } from "../core/srs.js";

/**
 * Mở bộ thẻ từ vựng.
 * @param {object} args
 * @param {object} args.lesson
 * @param {string[]} [args.vocabIds] Chỉ học một số từ (mặc định: tất cả)
 * @param {()=>void} [args.onDone]
 * @param {(vocabId:string, known:boolean)=>void} [args.onCard]
 */
export function openVocabPreview({ lesson, vocabIds = null, onDone = null, onCard = null }) {
  const list = (lesson.vocab || []).filter((v) => !vocabIds || vocabIds.includes(v.id));
  if (!list.length) { onDone?.(); return null; }

  let i = 0;

  const dots = () => `<div class="dots" aria-hidden="true">${list.map((_, k) => `<i data-on="${k <= i}"></i>`).join("")}</div>`;

  const cardHtml = () => {
    const v = list[i];
    const state = cardState(`${lesson.id}:${v.id}`);
    const lines = (v.lineIds || []).map((id) => lesson.lines.find((l) => l.id === id)).filter(Boolean);
    return `<div class="flash">
      <div class="flash__art">${illustrationFor(v)}</div>
      <div class="stack stack--sm">
        <div class="row" style="gap:10px">
          <h3 class="flash__term">${esc(v.term)}</h3>
          ${v.pos ? `<span class="tag">${esc(v.pos)}</span>` : ""}
          ${state ? `<span class="tag tag--gold">đã học ${state.reps} lần</span>` : `<span class="tag">từ mới</span>`}
          <button class="btn btn--sm btn--ghost" data-say="${esc(v.term)}" style="margin-left:auto">🔊 Nghe</button>
        </div>
        ${v.ipa ? `<div class="flash__ipa">${esc(v.ipa)}</div>` : ""}
        <div class="flash__vi">${esc(v.meaningVi || "")}</div>
        ${v.definitionEn ? `<div class="hint">${esc(v.definitionEn)}</div>` : ""}
        ${v.example ? `<div class="flash__ex">${esc(v.example)}
          <button class="btn btn--sm btn--ghost" data-say="${esc(v.example)}">🔊</button></div>` : ""}
        ${lines.length ? `<div class="hint">Xuất hiện ở câu: ${lines.map((l) => `“${esc(l.text.slice(0, 46))}${l.text.length > 46 ? "…" : ""}”`).join(" · ")}</div>` : ""}
      </div>
    </div>`;
  };

  const footHtml = `
    <span class="hint" data-role="counter"></span>
    <span style="margin-left:auto"></span>
    <button class="btn btn--sm" data-grade="again">Chưa thuộc</button>
    <button class="btn btn--sm" data-grade="good">Đã hiểu</button>
    <button class="btn btn--sm btn--gold" data-grade="easy">Biết rồi</button>`;

  const modal = openModal({
    title: `Từ mới trước khi lồng tiếng — ${lesson.title || ""}`,
    bodyHtml: `<div data-role="card">${cardHtml()}</div><div style="margin-top:14px" data-role="dots">${dots()}</div>`,
    footHtml,
    onClose: () => onDone?.(),
  });

  const body = modal.el.querySelector('[data-role="card"]');
  const dotBox = modal.el.querySelector('[data-role="dots"]');
  const counter = modal.el.querySelector('[data-role="counter"]');

  function paint() {
    body.innerHTML = cardHtml();
    dotBox.innerHTML = dots();
    counter.textContent = `Thẻ ${i + 1}/${list.length}`;
    body.querySelectorAll("[data-say]").forEach((b) =>
      b.addEventListener("click", () => speakOnce(b.dataset.say, { lang: lesson.source.voiceLang || "en-US", rate: 0.92 })));
    // nghe ngay khi mở thẻ mới giúp gắn âm với hình
    speakOnce(list[i].term, { lang: lesson.source.voiceLang || "en-US", rate: 0.9 });
  }

  modal.el.querySelectorAll("[data-grade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = list[i];
      srsReview(`${lesson.id}:${v.id}`, btn.dataset.grade);
      onCard?.(v.id, btn.dataset.grade !== "again");
      if (i < list.length - 1) { i++; paint(); }
      else modal.close();
    });
  });

  paint();
  return modal;
}
