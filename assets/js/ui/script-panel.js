/**
 * script-panel.js — bảng kịch bản nằm BÊN CẠNH trình phát.
 *
 * Đây là thứ học viên dùng nhiều nhất: bấm câu nào là nghe lại đúng câu đó.
 * Vị trí bên cạnh (không phủ lên khung phát) vừa là yêu cầu của chính sách
 * nhúng YouTube, vừa dễ đọc hơn phụ đề chạy dưới video.
 */

import { esc, fmtTime, highlightKeywords } from "./components.js";

/**
 * @param {object} args
 * @param {HTMLElement} args.mount
 * @param {object} args.lesson
 * @param {(line:object)=>void} args.onPick   Bấm vào một câu
 * @param {()=>object} args.getState          Trả về {hideText, showVi, bestScores}
 */
export function createScriptPanel({ mount, lesson, onPick, getState }) {
  mount.classList.add("script-panel");

  function render() {
    const st = getState();
    mount.innerHTML = lesson.lines.map((line) => {
      const best = st.bestScores?.[line.id];
      const done = best !== undefined && best !== null && best >= (lesson.scoring.passMark ?? 70);
      return `<button type="button" class="script-line" data-line="${esc(line.id)}"
        data-done="${done}" data-hide-text="${Boolean(st.hideText)}" aria-current="false">
        <span class="script-line__time">${fmtTime(line.start)}</span>
        <span>
          ${line.speaker ? `<span class="script-line__speaker">${esc(line.speaker)}</span>` : ""}
          <span class="script-line__text">${highlightKeywords(line.text, line.keywords)}</span>
          ${best !== undefined && best !== null ? `<span class="script-line__score">${best}</span>` : ""}
          ${st.showVi && line.textVi ? `<div class="script-line__vi">${esc(line.textVi)}</div>` : ""}
        </span>
      </button>`;
    }).join("");

    mount.querySelectorAll(".script-line").forEach((btn) => {
      btn.addEventListener("click", () => {
        const line = lesson.lines.find((l) => l.id === btn.dataset.line);
        if (line) onPick(line);
      });
    });
  }

  /** Tô sáng câu đang phát và tự cuộn tới. */
  function setActive(lineId, { scroll = true } = {}) {
    let target = null;
    mount.querySelectorAll(".script-line").forEach((btn) => {
      const on = btn.dataset.line === lineId;
      btn.setAttribute("aria-current", on ? "true" : "false");
      if (on) target = btn;
    });
    if (target && scroll) {
      const box = mount.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      if (r.top < box.top + 8 || r.bottom > box.bottom - 8) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }

  render();
  return { render, setActive };
}

/** Câu tương ứng với một mốc thời gian. */
export function lineAtTime(lesson, sec) {
  return lesson.lines.find((l) => sec >= l.start && sec < l.end) || null;
}
