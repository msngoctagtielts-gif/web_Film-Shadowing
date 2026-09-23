/**
 * exercises.js — sinh bài tập TỪ CHÍNH KỊCH BẢN của bài học.
 *
 * Lý do tồn tại: người soạn bài đã bỏ công gõ lời thoại, nghĩa tiếng Việt và
 * cụm trọng tâm rồi. Bắt họ ngồi soạn thêm một bộ bài tập nữa là công việc lặp
 * lại. Toàn bộ bài tập ở đây suy ra được từ dữ liệu đã có, nên bài học nào cũng
 * tự có bài tập mà người soạn không phải làm gì thêm.
 *
 * Năm dạng, xếp theo thứ tự sư phạm từ nhận ra → nhớ lại → tự dựng:
 *   match      nối từ mới với nghĩa            (nhận ra)
 *   listen     nghe câu rồi chọn câu đúng      (nhận ra bằng tai)
 *   gap        điền cụm trọng tâm còn thiếu    (nhớ lại)
 *   translate  thấy nghĩa tiếng Việt, chọn câu (nhớ lại)
 *   order      sắp xếp các từ thành câu        (tự dựng)
 *
 * Hàm thuần, có hạt giống ngẫu nhiên cố định nên kiểm thử được.
 */

import { tokenize, findPhraseSpan, normalizeText } from "./text.js";

/** Bộ sinh số giả ngẫu nhiên có hạt giống — cùng hạt giống cho cùng đề bài. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Xáo trộn một mảng (không sửa mảng gốc). */
export function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lấy tối đa n phần tử khác `except` từ `pool`. */
function pickOthers(pool, except, n, rnd) {
  const cand = pool.filter((x) => x !== except);
  return shuffle(cand, rnd).slice(0, n);
}

/* ------------------------------ từng dạng bài --------------------------- */

/**
 * Nối từ mới với nghĩa tiếng Việt.
 * Một câu hỏi cho mỗi từ, bốn phương án nghĩa.
 */
function makeMatch(lesson, rnd) {
  const vocab = (lesson.vocab || []).filter((v) => v.term && v.meaningVi);
  if (vocab.length < 2) return [];
  const meanings = vocab.map((v) => v.meaningVi);

  return vocab.map((v) => {
    const wrong = pickOthers(meanings, v.meaningVi, 3, rnd);
    return {
      type: "match",
      id: `match:${v.id}`,
      prompt: v.term,
      promptIpa: v.ipa || "",
      question: "Từ này nghĩa là gì?",
      options: shuffle([v.meaningVi, ...wrong], rnd),
      answer: v.meaningVi,
      speak: v.term,
      explain: v.example ? `Ví dụ: ${v.example}` : "",
      vocabId: v.id,
    };
  });
}

/**
 * Nghe câu rồi chọn đúng câu vừa nghe.
 * Phương án nhiễu lấy từ các câu khác trong cùng cảnh, nên học viên phải nghe
 * thật chứ không đoán được bằng ngữ cảnh.
 */
function makeListen(lesson, lines, rnd) {
  if (lines.length < 3) return [];
  const texts = lines.map((l) => l.text);

  return lines.map((line) => ({
    type: "listen",
    id: `listen:${line.id}`,
    prompt: "",
    question: "Nghe rồi chọn đúng câu bạn vừa nghe",
    options: shuffle([line.text, ...pickOthers(texts, line.text, 3, rnd)], rnd),
    answer: line.text,
    speak: line.text,
    lineId: line.id,
    explain: line.textVi ? `Nghĩa: ${line.textVi}` : "",
  }));
}

/**
 * Điền cụm trọng tâm còn thiếu.
 * Chỉ tạo cho câu có khai báo cụm trọng tâm — đúng chỗ người soạn muốn học viên
 * nhớ, không khoét lỗ bừa vào từ chức năng.
 */
function makeGap(lesson, lines, rnd) {
  const out = [];
  const allKeywords = [...new Set(lines.flatMap((l) => l.keywords || []))];
  if (allKeywords.length < 2) return out;

  for (const line of lines) {
    for (const kw of line.keywords || []) {
      const span = findPhraseSpan(tokenize(line.text), kw);
      if (!span) continue;

      // Khoét đúng cụm đó khỏi câu gốc, giữ nguyên chữ hoa và dấu câu quanh nó
      const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "i");
      if (!re.test(line.text)) continue;
      const blanked = line.text.replace(re, "______");

      out.push({
        type: "gap",
        id: `gap:${line.id}:${kw}`,
        prompt: blanked,
        question: "Điền cụm còn thiếu",
        options: shuffle([kw, ...pickOthers(allKeywords, kw, 3, rnd)], rnd),
        answer: kw,
        speak: line.text,
        lineId: line.id,
        explain: line.textVi ? `Cả câu: “${line.text}” — ${line.textVi}` : `Cả câu: “${line.text}”`,
      });
      break;   // mỗi câu một chỗ trống là đủ
    }
  }
  return out;
}

/** Thấy nghĩa tiếng Việt, chọn câu tiếng Anh đúng. */
function makeTranslate(lesson, lines, rnd) {
  const withVi = lines.filter((l) => l.textVi && l.textVi.trim());
  if (withVi.length < 3) return [];
  const texts = lines.map((l) => l.text);

  return withVi.map((line) => ({
    type: "translate",
    id: `translate:${line.id}`,
    prompt: line.textVi,
    question: "Câu tiếng Anh nào mang nghĩa này?",
    options: shuffle([line.text, ...pickOthers(texts, line.text, 3, rnd)], rnd),
    answer: line.text,
    speak: line.text,
    lineId: line.id,
    explain: "",
  }));
}

/**
 * Sắp xếp các từ thành câu đúng.
 *
 * Ba điều kiện, mỗi điều kiện vì một lý do cụ thể:
 *  · 4–10 từ — ngắn quá thì không có gì để sắp, dài quá thì thành trò đố mẹo.
 *  · CHỈ MỘT CÂU — lời thoại kiểu "That is fine. I am not in a hurry anymore."
 *    gồm hai câu; gộp lại thành một chuỗi từ sẽ ra đáp án không đúng ngữ pháp,
 *    và học viên học nhầm. Thà bỏ qua dòng đó còn hơn ra đề sai.
 */
function isSingleSentence(text) {
  const t = text.trim();
  // Không có dấu kết câu ở giữa: chỉ được phép xuất hiện ở ký tự cuối cùng.
  return !/[.!?]\s+\S/.test(t);
}

function makeOrder(lesson, lines, rnd) {
  return lines
    .filter((l) => {
      const n = l.text.trim().split(/\s+/).length;
      return n >= 4 && n <= 10 && isSingleSentence(l.text);
    })
    .map((line) => {
      const words = line.text.replace(/[.?!,]/g, "").trim().split(/\s+/);
      return {
        type: "order",
        id: `order:${line.id}`,
        prompt: line.textVi || "",
        question: "Sắp xếp thành câu đúng",
        tiles: shuffle(words, rnd),
        answer: words.join(" "),
        speak: line.text,
        lineId: line.id,
        explain: line.textVi ? `“${line.text}” — ${line.textVi}` : "",
      };
    });
}

/* ------------------------------ bộ đề hoàn chỉnh ------------------------- */

export const EXERCISE_LABELS = {
  match: "Nối từ với nghĩa",
  listen: "Nghe và chọn",
  gap: "Điền cụm còn thiếu",
  translate: "Chọn câu đúng nghĩa",
  order: "Sắp xếp thành câu",
};

/**
 * Sinh bộ bài tập cho một bài học.
 *
 * Trộn xen kẽ các dạng thay vì làm hết dạng này tới dạng kia: năm câu nối từ
 * liên tiếp thì học viên chuyển sang chế độ đoán, xen kẽ thì phải đọc đề.
 *
 * @param {object} lesson Bài học đã chuẩn hoá
 * @param {object} [opts]
 * @param {number} [opts.limit=12] Số câu tối đa
 * @param {number} [opts.seed=1]   Hạt giống, đổi để ra đề khác
 * @param {string[]} [opts.lineIds] Chỉ lấy một số câu (ví dụ những câu vừa học)
 * @param {string[]} [opts.types]  Chỉ lấy một số dạng
 * @returns {Array<object>}
 */
export function generateExercises(lesson, opts = {}) {
  const { limit = 12, seed = 1, lineIds = null, types = null } = opts;
  const rnd = seededRandom(seed);

  const lines = (lesson.lines || [])
    .filter((l) => l.text && l.text.trim())
    .filter((l) => !lineIds || lineIds.includes(l.id));
  if (!lines.length) return [];

  const byType = {
    match: makeMatch(lesson, rnd),
    listen: makeListen(lesson, lines, rnd),
    gap: makeGap(lesson, lines, rnd),
    translate: makeTranslate(lesson, lines, rnd),
    order: makeOrder(lesson, lines, rnd),
  };

  const order = ["match", "gap", "listen", "translate", "order"]
    .filter((t) => !types || types.includes(t))
    .map((t) => shuffle(byType[t], rnd));

  // Rút xen kẽ: mỗi vòng lấy một câu của từng dạng còn hàng
  const out = [];
  let round = 0;
  while (out.length < limit && order.some((q) => q.length > round)) {
    for (const queue of order) {
      if (queue.length > round) out.push(queue[round]);
      if (out.length >= limit) break;
    }
    round++;
  }
  return out;
}

/** Bài học này sinh được bao nhiêu câu, theo từng dạng — Studio hiện cho người soạn. */
export function exerciseCoverage(lesson) {
  const rnd = seededRandom(1);
  const lines = (lesson.lines || []).filter((l) => l.text && l.text.trim());
  return {
    match: makeMatch(lesson, rnd).length,
    listen: makeListen(lesson, lines, rnd).length,
    gap: makeGap(lesson, lines, rnd).length,
    translate: makeTranslate(lesson, lines, rnd).length,
    order: makeOrder(lesson, lines, rnd).length,
  };
}

/**
 * Chấm một câu trả lời.
 * So sau khi chuẩn hoá, nên thừa dấu câu hay khác hoa thường vẫn tính đúng.
 */
export function checkAnswer(exercise, given) {
  if (given === null || given === undefined) return false;
  return normalizeText(String(given)) === normalizeText(String(exercise.answer));
}

/** Tổng kết một lượt làm bài tập. */
export function summarizeQuiz(results) {
  const total = results.length;
  const right = results.filter((r) => r.correct).length;
  const byType = {};
  for (const r of results) {
    const t = (byType[r.type] ||= { total: 0, right: 0 });
    t.total++;
    if (r.correct) t.right++;
  }
  const percent = total ? Math.round((right / total) * 100) : 0;
  const weakest = Object.entries(byType)
    .filter(([, v]) => v.total >= 2)
    .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)[0];
  return {
    total, right, percent, byType,
    weakestType: weakest && weakest[1].right / weakest[1].total < 0.7 ? weakest[0] : null,
  };
}
