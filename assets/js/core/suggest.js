/**
 * suggest.js — biến một đoạn kịch bản dán vào thành bài học gần hoàn chỉnh.
 *
 * Việc tốn thời gian nhất khi soạn bài không phải là gõ chữ, mà là gõ từng
 * dòng một rồi đặt mốc thời gian cho từng dòng. Ở đây người soạn dán cả đoạn
 * hội thoại một lần, máy tách dòng, đoán vai, ước lượng thời lượng từng câu,
 * gợi ý cụm trọng tâm và từ mới. Người soạn chỉ còn việc chỉnh lại.
 *
 * Mọi thứ đều là GỢI Ý và sửa được — máy không biết cảnh phim, người soạn biết.
 */

import { tokenize, syllableCount } from "./text.js";
import { estimateSeconds } from "./scoring.js";

/**
 * Cụm động từ và thành ngữ hay gặp trong hội thoại đời thường.
 * Dùng để gợi ý "cụm trọng tâm" — đây đúng là loại cụm đáng dạy: lặp lại nhiều,
 * nghĩa không đoán được từ từng từ, và người học Việt Nam thường né dùng.
 */
const PHRASES = [
  "hold on", "hang on", "come on", "go on", "get up", "wake up", "give up", "grow up",
  "look after", "look for", "look forward to", "look out", "find out", "figure out",
  "work out", "turn on", "turn off", "turn up", "turn down", "put on", "put off",
  "take off", "take care of", "take over", "pick up", "drop off", "show up", "run out of",
  "check in", "check out", "call back", "call off", "get along", "get back", "get in",
  "get off", "get on", "get out", "get over", "get rid of", "break down", "break up",
  "bring up", "carry on", "catch up", "cut down", "deal with", "end up", "fill in",
  "give back", "hand in", "hang out", "keep on", "let down", "log in", "make up",
  "move in", "move out", "pass away", "pay back", "point out", "put up with",
  "set up", "sit down", "stand up", "stay up", "talk about", "think about", "throw away",
  "try on", "wait for", "warm up", "watch out", "work on", "write down",
  "in a hurry", "on time", "in time", "at least", "at last", "as soon as", "by the way",
  "of course", "for a while", "right now", "right away", "no way", "make it",
  "give someone a ride", "give you a ride", "a couple of", "kind of", "sort of",
  "excuse me", "never mind", "take your time", "go ahead", "how come", "what about",
];

/**
 * Từ thông dụng — không gợi ý làm "từ mới" vì học viên đã biết.
 * Danh sách ngắn, cố ý chỉ gồm từ chức năng và từ cơ bản nhất.
 */
const COMMON = new Set(`
a an the and or but so if because as of to in on at by for with from into about
i you he she it we they me him her us them my your his its our their this that these those
is am are was were be been being do does did done have has had having will would can could
shall should may might must not no yes there here what when where who whom which why how
one two three four five six seven eight nine ten first last next now then very just too also
some any all many much more most few little other another same such own than very
go goes went gone going come came get got give gave take took make made know knew think
thought see saw say said tell told want wanted need needed like liked look looked
good bad big small new old long short high low right left up down out off over under
day days night time times year years week month today tomorrow yesterday morning evening
man woman boy girl people person thing things way ways place home work school house
`.trim().split(/\s+/));

/**
 * Tách một đoạn văn bản dán vào thành các dòng thoại.
 *
 * Nhận cả hai kiểu viết:
 *   MAI: It is, but the board says it is delayed again.
 *   It is, but the board says it is delayed again.
 *
 * @param {string} raw
 * @returns {Array<{speaker:string, text:string}>}
 */
export function parseScript(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^[-=_*#]{3,}$/.test(l))          // bỏ dòng kẻ ngang
    .map((line) => {
      // Bỏ mốc thời gian dạng phụ đề nếu người soạn chép từ tệp .srt
      const noStamp = line.replace(/^\s*\d+\s*$/, "")
        .replace(/^\s*\d{1,2}:\d{2}(:\d{2})?([.,]\d{1,3})?\s*(-->|–|-)\s*\d{1,2}:\d{2}(:\d{2})?([.,]\d{1,3})?\s*$/, "")
        .replace(/^\s*\[?\d{1,2}:\d{2}\]?\s*/, "");
      if (!noStamp.trim()) return null;

      // "TÊN: nội dung" — tên tối đa 20 ký tự để không cắt nhầm câu có dấu hai chấm
      const m = noStamp.match(/^\s*([A-Za-zÀ-ỹ0-9 .'_-]{1,20})\s*[:：]\s*(.+)$/);
      if (m && !/\s{2,}/.test(m[1])) {
        return { speaker: m[1].trim().toUpperCase(), text: m[2].trim() };
      }
      return { speaker: "", text: noStamp.trim() };
    })
    .filter(Boolean)
    .filter((l) => l.text.length > 0);
}

/**
 * Gán mốc thời gian nối tiếp nhau, ước lượng theo số âm tiết của từng câu.
 *
 * Đây chỉ là mốc TẠM để bài chạy được ngay. Người soạn vẫn nên bấm I/O trên
 * video thật cho khớp khung hình — nhưng bắt đầu từ mốc gần đúng nhanh hơn
 * nhiều so với bắt đầu từ số 0.
 *
 * @param {Array<{text:string}>} lines
 * @param {{startSec?:number, gapSec?:number, pace?:number}} [opts]
 */
export function layoutTimings(lines, opts = {}) {
  const { startSec = 0, gapSec = 0.3, pace = 4.2 } = opts;
  let t = startSec;
  return lines.map((l) => {
    const dur = estimateSeconds(l.text, pace);
    const out = { ...l, start: Number(t.toFixed(2)), end: Number((t + dur).toFixed(2)) };
    t += dur + gapSec;
    return out;
  });
}

/**
 * Gợi ý cụm trọng tâm có trong một câu.
 * Trả về cụm dài nhất khớp trước, tối đa `max` cụm — một câu nhồi 5 cụm trọng
 * tâm thì không còn cụm nào là trọng tâm nữa.
 */
export function suggestKeyphrases(text, max = 2) {
  const hay = " " + tokenize(text).join(" ") + " ";
  const hits = PHRASES
    .filter((p) => hay.includes(" " + tokenize(p).join(" ") + " "))
    .sort((a, b) => b.length - a.length);

  // bỏ cụm nằm lọt trong cụm dài hơn đã chọn ("make it" trong "we will make it")
  const out = [];
  for (const p of hits) {
    if (out.some((q) => q.includes(p))) continue;
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Gợi ý từ mới cho cả bài: từ không nằm trong danh sách thông dụng, ưu tiên từ
 * xuất hiện lại nhiều lần và từ dài.
 *
 * @param {Array<{text:string}>} lines
 * @param {number} [max=8]
 * @returns {Array<{term:string, count:number, lineIds:string[]}>}
 */
export function suggestVocab(lines, max = 8) {
  const tally = new Map();
  for (const line of lines) {
    for (const w of new Set(tokenize(line.text))) {
      if (COMMON.has(w) || w.length < 4 || w.includes("'")) continue;
      const cur = tally.get(w) || { term: w, count: 0, lineIds: [] };
      cur.count++;
      if (line.id) cur.lineIds.push(line.id);
      tally.set(w, cur);
    }
  }
  return [...tally.values()]
    .sort((a, b) => (b.count - a.count) || (b.term.length - a.term.length))
    .slice(0, max);
}

/**
 * Dựng bộ câu thoại hoàn chỉnh từ một đoạn kịch bản dán vào.
 *
 * @param {string} raw
 * @param {{startSec?:number, idPrefix?:string}} [opts]
 * @returns {{lines:Array<object>, vocabSuggestions:Array<object>, warnings:string[]}}
 */
export function buildLinesFromScript(raw, opts = {}) {
  const { startSec = 0, idPrefix = "l" } = opts;
  const parsed = parseScript(raw);
  const warnings = [];

  if (!parsed.length) {
    return { lines: [], vocabSuggestions: [], warnings: ["Không tách được dòng thoại nào từ đoạn văn bản này."] };
  }

  const timed = layoutTimings(parsed, { startSec });
  const lines = timed.map((l, i) => ({
    id: `${idPrefix}${i + 1}`,
    speaker: l.speaker || (i % 2 === 0 ? "A" : "B"),
    start: l.start,
    end: l.end,
    text: l.text,
    textVi: "",
    keywords: suggestKeyphrases(l.text),
    vocabIds: [],
    notes: "",
    difficulty: 1,
  }));

  const longOnes = lines.filter((l) => l.end - l.start > 15);
  if (longOnes.length) {
    warnings.push(`${longOnes.length} câu dài hơn 15 giây — nên cắt nhỏ để học viên thu từng câu một.`);
  }
  if (!parsed.some((l) => l.speaker)) {
    warnings.push('Không thấy tên vai trong kịch bản. Máy tự đặt A và B xen kẽ — sửa lại nếu hội thoại không luân phiên.');
  }
  warnings.push("Mốc thời gian là ước lượng theo số âm tiết. Hãy mở video và bấm I/O để chỉnh cho khớp khung hình.");

  return { lines, vocabSuggestions: suggestVocab(lines), warnings };
}
