/**
 * srs.js — lịch ôn từ vựng theo khoảng cách giãn dần (spaced repetition).
 *
 * Dùng bản rút gọn của SM-2: đủ để từ mới quay lại đúng lúc sắp quên, mà không
 * cần máy chủ. Trạng thái nằm cùng localStorage với tiến độ học.
 */

const KEY = "film-shadowing:srs:v1";

/** Khoảng cách ôn (ngày) theo số lần trả lời đúng liên tiếp. */
const STEPS = [0, 1, 3, 7, 16, 35, 75];

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function writeAll(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

/**
 * Ghi nhận một lần ôn.
 * @param {string} cardId Thường là `${lessonId}:${vocabId}`
 * @param {'again'|'hard'|'good'|'easy'} grade
 */
export function review(cardId, grade) {
  const all = readAll();
  const card = all[cardId] || { streak: 0, step: 0, due: today(), reps: 0, lapses: 0 };
  card.reps += 1;

  switch (grade) {
    case "again":
      card.lapses += 1; card.streak = 0; card.step = 0; break;
    case "hard":
      card.streak = Math.max(0, card.streak); card.step = Math.max(1, card.step); break;
    case "easy":
      card.streak += 1; card.step = Math.min(STEPS.length - 1, card.step + 2); break;
    case "good":
    default:
      card.streak += 1; card.step = Math.min(STEPS.length - 1, card.step + 1); break;
  }

  card.due = addDays(STEPS[card.step]);
  card.lastAt = new Date().toISOString();
  all[cardId] = card;
  writeAll(all);
  return card;
}

/** Thẻ đến hạn ôn hôm nay, trong danh sách thẻ truyền vào. */
export function dueCards(cardIds) {
  const all = readAll();
  const t = today();
  return cardIds.filter((id) => {
    const c = all[id];
    return !c || c.due <= t;
  });
}

/** Trạng thái một thẻ (null nếu chưa học). */
export function cardState(cardId) { return readAll()[cardId] || null; }

/** Thống kê nhanh cho bảng tiến độ. */
export function srsStats(cardIds) {
  const all = readAll();
  const t = today();
  let seen = 0, due = 0, learned = 0;
  for (const id of cardIds) {
    const c = all[id];
    if (!c) { due++; continue; }
    seen++;
    if (c.due <= t) due++;
    if (c.step >= 3) learned++;
  }
  return { total: cardIds.length, seen, due, learned, fresh: cardIds.length - seen };
}

export function resetSrs() { try { localStorage.removeItem(KEY); } catch {} }
