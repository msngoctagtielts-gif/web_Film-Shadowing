/**
 * text.js — chuẩn hoá và so sánh chuỗi tiếng Anh cho việc chấm lồng tiếng.
 *
 * Toàn bộ hàm trong file này là hàm thuần (pure): cùng đầu vào cho ra cùng đầu ra,
 * không chạm DOM, không gọi mạng. Nhờ vậy `tests/` kiểm tra được bằng Node.
 */

/** Dấu câu cần bỏ, giữ lại dấu nháy và gạch nối bên trong từ (don't, well-known). */
const PUNCT = /[.,!?;:"“”„‟«»()\[\]{}…—–*_/\\|@#$%^&+=~`<>]/g;

/** Dạng nói tắt / biến thể chính tả → chuỗi token chuẩn. */
const EXPANSIONS = new Map(Object.entries({
  "gonna": "going to",
  "wanna": "want to",
  "gotta": "got to",
  "gimme": "give me",
  "lemme": "let me",
  "kinda": "kind of",
  "sorta": "sort of",
  "outta": "out of",
  "lotta": "lot of",
  "dunno": "do not know",
  "cause": "because",
  "'cause": "because",
  "cuz": "because",
  "ok": "okay",
  "o.k.": "okay",
  "alright": "all right",
  "yeah": "yes",
  "yep": "yes",
  "yup": "yes",
  "nope": "no",
  "nah": "no",
  "mr": "mister",
  "mrs": "missus",
  "dr": "doctor",
  "til": "until",
  "'til": "until",
  "till": "until",
}));

/** Số viết bằng chữ số → chữ, để ASR trả "2" vẫn khớp kịch bản viết "two". */
const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty"];

/** Từ đệm — không tính vào điểm chính xác nhưng dùng để nhắc học viên. */
export const FILLERS = new Set(["um", "uh", "er", "erm", "ah", "eh", "hmm", "mm", "uhm", "mhm"]);

/**
 * Chuẩn hoá thô một câu: bỏ dấu câu, hạ chữ thường, gộp khoảng trắng.
 * @param {string} input
 * @returns {string}
 */
export function normalizeText(input) {
  if (!input) return "";
  return String(input)
    .normalize("NFC")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tách câu thành danh sách từ đã chuẩn hoá và bung các dạng nói tắt.
 * @param {string} input
 * @param {{keepFillers?: boolean}} [opts]
 * @returns {string[]}
 */
export function tokenize(input, opts = {}) {
  const { keepFillers = false } = opts;
  const raw = normalizeText(input).split(" ").filter(Boolean);
  const out = [];
  for (let token of raw) {
    // bỏ dấu nháy đầu/cuối còn sót ("'cause" đã map ở EXPANSIONS)
    const expanded = EXPANSIONS.get(token) ?? EXPANSIONS.get(token.replace(/^'+|'+$/g, ""));
    if (expanded) { out.push(...expanded.split(" ")); continue; }
    token = token.replace(/^'+|'+$/g, "").replace(/^-+|-+$/g, "");
    if (!token) continue;
    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n >= 0 && n < NUMBERS.length) { out.push(NUMBERS[n]); continue; }
    }
    if (!keepFillers && FILLERS.has(token)) continue;
    out.push(token);
  }
  return out;
}

/** Đếm từ đệm trong một câu (dùng để góp ý, không trừ điểm chính xác). */
export function countFillers(input) {
  return normalizeText(input).split(" ").filter((w) => FILLERS.has(w)).length;
}

/**
 * Khoá ngữ âm giản lược (họ Metaphone). Mục đích: "ship" và "sheep" cho cùng
 * khoá, nhờ vậy lỗi nguyên âm được tính là "gần đúng" thay vì "sai hẳn" —
 * đúng với cách chấm lồng tiếng: nghe ra được là đã có điểm.
 * @param {string} word
 * @returns {string}
 */
export function phoneticKey(word) {
  let s = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return "";

  // tiền tố đặc biệt
  s = s.replace(/^(kn|gn|pn|ae|wr)/, (m) => m[1]);
  if (s.startsWith("x")) s = "s" + s.slice(1);
  if (s.startsWith("wh")) s = "w" + s.slice(2);

  const first = s[0];
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i], next = s[i + 1] || "", prev = s[i - 1] || "";
    let code = "";
    switch (c) {
      case "a": case "e": case "i": case "o": case "u": case "y":
        // Giữ ĐÚNG nguyên âm đầu từ, bỏ nguyên âm ở giữa. Bỏ hết nguyên âm thì
        // "in" và "on" ra cùng khoá — mà hai giới từ này khác nghĩa hẳn nhau.
        // Lệch nguyên âm giữa từ (ship/sheep) vẫn được coi là gần đúng.
        code = i === 0 ? c : ""; break;
      case "b": code = (i === s.length - 1 && prev === "m") ? "" : "b"; break; // lamb
      case "c":
        if (next === "h") { code = "x"; i++; }
        else if ("eiy".includes(next)) code = "s";
        else if (next === "k") { code = "k"; i++; }
        else code = "k";
        break;
      case "d": code = (next === "g") ? "j" : "d"; if (next === "g") i++; break;
      case "g":
        if (next === "h") { code = i + 1 === s.length - 1 ? "" : "f"; i++; }
        else if (next === "n") { code = ""; }
        else if ("eiy".includes(next)) code = "j";
        else code = "k";
        break;
      case "h": code = "aeiouy".includes(prev) && !"aeiouy".includes(next) ? "" : "h"; break;
      case "k": code = prev === "c" ? "" : "k"; break;
      case "p": if (next === "h") { code = "f"; i++; } else code = "p"; break;
      case "q": code = "k"; if (next === "u") i++; break;
      case "s":
        if (next === "h") { code = "x"; i++; }
        else code = "s";
        break;
      case "t":
        if (next === "h") { code = "0"; i++; }
        else if (s.slice(i, i + 3) === "tio" || s.slice(i, i + 3) === "tia") { code = "x"; }
        else code = "t";
        break;
      case "v": code = "f"; break;                  // v/f gần nhau với tai người Việt
      case "w": code = "aeiouy".includes(next) ? "w" : ""; break;
      case "x": code = "ks"; break;
      case "z": code = "s"; break;
      default: code = c;
    }
    out += code;
  }
  // gộp phụ âm lặp liền nhau
  out = out.replace(/(.)\1+/g, "$1");
  return (out || first).slice(0, 8);
}

/**
 * Khoảng cách Levenshtein trên ký tự, có giới hạn để trả về sớm.
 * @param {string} a @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  a = String(a); b = String(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur.slice();
  }
  return prev[b.length];
}

/** Độ tương đồng ký tự 0..1. */
export function charSimilarity(a, b) {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}

/**
 * Độ giống nhau giữa hai từ, kết hợp chính tả và ngữ âm.
 * 1 = trùng khớp; ~0.7–0.9 = nghe ra được nhưng lệch âm; <0.5 = khác từ.
 * @param {string} a @param {string} b
 * @returns {number} 0..1
 */
export function wordSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const chars = charSimilarity(a, b);
  const ka = phoneticKey(a), kb = phoneticKey(b);
  const phon = ka && kb ? charSimilarity(ka, kb) : 0;
  // ngữ âm trùng hoàn toàn: coi là gần đúng cao (lệch nguyên âm)
  if (ka && ka === kb) return Math.max(0.82, chars);
  const blended = 0.45 * chars + 0.55 * phon;
  // hai từ quá ngắn và khác nhau thì không cho điểm hào phóng
  if (Math.max(a.length, b.length) <= 3 && chars < 0.6) return Math.min(blended, 0.4);
  return Math.max(0, Math.min(1, blended));
}

/**
 * Tìm vị trí một cụm từ trong danh sách token (so khớp sau chuẩn hoá).
 * @param {string[]} tokens
 * @param {string} phrase
 * @returns {{start:number, end:number}|null} end là chỉ số loại trừ
 */
export function findPhraseSpan(tokens, phrase) {
  const needle = tokenize(phrase);
  if (!needle.length) return null;
  for (let i = 0; i + needle.length <= tokens.length; i++) {
    let hit = true;
    for (let j = 0; j < needle.length; j++) {
      if (tokens[i + j] !== needle[j]) { hit = false; break; }
    }
    if (hit) return { start: i, end: i + needle.length };
  }
  return null;
}

/** Ước lượng số âm tiết của một từ tiếng Anh (dùng cho nhịp nói). */
export function syllableCount(word) {
  const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Tổng số âm tiết của một câu. */
export function syllablesOf(text) {
  return tokenize(text).reduce((sum, w) => sum + syllableCount(w), 0);
}
