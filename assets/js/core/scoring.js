/**
 * scoring.js — máy chấm điểm lồng tiếng.
 *
 * NGUYÊN TẮC TRUNG THỰC (đọc trước khi sửa file này):
 * Máy chấm ở bản này dựa trên KẾT QUẢ NHẬN DẠNG GIỌNG NÓI (ASR), không phải
 * chấm ở tầng âm vị (phoneme) như ELSA hay Azure Pronunciation Assessment.
 * Nghĩa là nó đo "người bản xứ có nghe ra bạn nói gì không" (intelligibility),
 * chứ không đo "khẩu hình của bạn đúng chưa". Đây là lựa chọn có ý thức: chạy
 * miễn phí ngay trên máy học viên, không tốn phí API, đủ tốt cho vòng luyện
 * hằng ngày. Khi cần điểm âm vị, thay `asr.js` + hàm `gradeAttempt` bằng
 * adapter gọi Azure/ELSA — giao diện dữ liệu (`AttemptResult`) giữ nguyên.
 *
 * Toàn bộ hàm ở đây là hàm thuần, kiểm thử được bằng Node (xem tests/).
 */

import { tokenize, wordSimilarity, findPhraseSpan, syllableCount, countFillers } from "./text.js";

/** Ngưỡng phân loại độ giống của một từ. */
export const SIM_GOOD = 0.88;
export const SIM_WARN = 0.60;

/** Trọng số theo trình độ. Tổng mỗi bộ = 1. */
export const PROFILES = {
  starter: { accuracy: 0.50, completeness: 0.25, keywords: 0.15, pacing: 0.10 },
  standard: { accuracy: 0.40, completeness: 0.20, keywords: 0.18, pacing: 0.22 },
  advanced: { accuracy: 0.34, completeness: 0.16, keywords: 0.20, pacing: 0.30 },
};

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n);

/**
 * Gióng hàng hai chuỗi từ bằng Levenshtein có chi phí thay thế theo độ giống.
 * Chi phí thay thế = 1 - wordSimilarity, nên "sheep"→"ship" rẻ hơn "sheep"→"dog".
 *
 * @param {string[]} ref Câu mẫu đã tokenize
 * @param {string[]} hyp Câu học viên nói, đã tokenize
 * @returns {Array<{type:'match'|'sub'|'del'|'ins', ref?:string, hyp?:string, sim:number, refIndex:number, hypIndex:number}>}
 */
export function alignTokens(ref, hyp) {
  const n = ref.length, m = hyp.length;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const B = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1=sub/match 2=del 3=ins

  for (let i = 1; i <= n; i++) { D[i][0] = i; B[i][0] = 2; }
  for (let j = 1; j <= m; j++) { D[0][j] = j; B[0][j] = 3; }

  const simCache = new Map();
  const sim = (a, b) => {
    const k = a + "\u0000" + b;
    let v = simCache.get(k);
    if (v === undefined) { v = wordSimilarity(a, b); simCache.set(k, v); }
    return v;
  };

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sim(ref[i - 1], hyp[j - 1]);
      const subCost = D[i - 1][j - 1] + (1 - s);
      const delCost = D[i - 1][j] + 1;
      const insCost = D[i][j - 1] + 1;
      let best = subCost, op = 1;
      if (delCost < best) { best = delCost; op = 2; }
      if (insCost < best) { best = insCost; op = 3; }
      D[i][j] = best; B[i][j] = op;
    }
  }

  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const op = (i > 0 && j > 0) ? B[i][j] : (i > 0 ? 2 : 3);
    if (op === 1) {
      const s = sim(ref[i - 1], hyp[j - 1]);
      ops.push({
        type: s >= SIM_GOOD ? "match" : "sub",
        ref: ref[i - 1], hyp: hyp[j - 1], sim: s,
        refIndex: i - 1, hypIndex: j - 1,
      });
      i--; j--;
    } else if (op === 2) {
      ops.push({ type: "del", ref: ref[i - 1], sim: 0, refIndex: i - 1, hypIndex: -1 });
      i--;
    } else {
      ops.push({ type: "ins", hyp: hyp[j - 1], sim: 0, refIndex: -1, hypIndex: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}

/** Nhãn hiển thị cho một phép gióng hàng. */
export function verdictOf(op) {
  if (op.type === "ins") return "extra";
  if (op.type === "del") return "miss";
  if (op.sim >= SIM_GOOD) return "good";
  if (op.sim >= SIM_WARN) return "warn";
  return "miss";
}

/**
 * Bản đồ từng từ để tô màu trên giao diện, theo thứ tự câu mẫu
 * (từ thêm ra được chèn vào đúng chỗ).
 * @param {ReturnType<typeof alignTokens>} ops
 */
export function wordMap(ops) {
  return ops.map((op) => ({
    text: op.ref ?? op.hyp,
    heard: op.hyp ?? null,
    verdict: verdictOf(op),
    sim: Number(op.sim.toFixed(3)),
  }));
}

/**
 * Điểm chính xác: tổng độ giống trên từng từ mẫu, trừ nhẹ phần nói thêm.
 * @param {ReturnType<typeof alignTokens>} ops
 * @param {number} refCount
 */
export function scoreAccuracy(ops, refCount) {
  if (!refCount) return 0;
  let sum = 0, extras = 0;
  for (const op of ops) {
    if (op.type === "ins") extras++;
    else sum += op.sim;
  }
  // nói thêm bị trừ nhẹ: đọc lố vài từ không nghiêm trọng như đọc thiếu
  const penalty = 0.3 * Math.max(0, extras - 1);
  return clamp(((sum - penalty) / refCount) * 100);
}

/**
 * Điểm đầy đủ: bao nhiêu phần trăm từ trong câu mẫu đã được nói ra ở mức
 * nghe hiểu được (>= SIM_WARN).
 */
export function scoreCompleteness(ops, refCount) {
  if (!refCount) return 0;
  let hit = 0;
  for (const op of ops) {
    if ((op.type === "match" || op.type === "sub") && op.sim >= SIM_WARN) hit++;
  }
  return clamp((hit / refCount) * 100);
}

/**
 * Điểm từ/cụm trọng tâm của câu. Đây là phần cô giáo quan tâm nhất:
 * học viên có thể đọc trôi cả câu nhưng vẫn phải "ra" được cụm mục tiêu.
 *
 * @param {string[]} refTokens
 * @param {ReturnType<typeof alignTokens>} ops
 * @param {string[]} keywords Từ hoặc cụm từ (có thể nhiều từ)
 * @returns {{score:number, details:Array<{text:string, sim:number, hit:boolean}>}}
 */
export function scoreKeywords(refTokens, ops, keywords) {
  const list = (keywords || []).filter(Boolean);
  if (!list.length) return { score: null, details: [] };

  // độ giống tốt nhất đạt được cho từng vị trí trong câu mẫu
  const sims = new Array(refTokens.length).fill(0);
  for (const op of ops) {
    if (op.refIndex >= 0) sims[op.refIndex] = Math.max(sims[op.refIndex], op.sim);
  }

  const details = list.map((kw) => {
    const span = findPhraseSpan(refTokens, kw);
    if (!span) return { text: kw, sim: 0, hit: false, missingInScript: true };

    // Một cụm bị khuyết giữa ("call ___ back") KHÔNG phải là cụm đã ra, dù hai
    // từ còn lại đọc hoàn hảo. Vì vậy điểm cụm lấy cả trung bình lẫn từ yếu
    // nhất, và chỉ tính "đạt" khi TỪNG từ trong cụm đều nghe ra được.
    let sum = 0, worst = 1;
    for (let i = span.start; i < span.end; i++) {
      sum += sims[i];
      worst = Math.min(worst, sims[i]);
    }
    const avg = sum / (span.end - span.start);
    const s = 0.5 * avg + 0.5 * worst;
    return { text: kw, sim: Number(s.toFixed(3)), weakest: Number(worst.toFixed(3)), hit: worst >= SIM_WARN };
  });

  const scored = details.filter((d) => !d.missingInScript);
  if (!scored.length) return { score: null, details };
  const avg = scored.reduce((a, d) => a + d.sim, 0) / scored.length;
  return { score: clamp(avg * 100), details };
}

/**
 * Điểm nhịp & tốc độ. Đo bằng thời lượng thu so với thời lượng câu mẫu,
 * số lần ngắt dài giữa câu và tỉ lệ thời gian thực sự có tiếng.
 *
 * KHÔNG phải điểm ngữ điệu (intonation): muốn đo ngữ điệu cần dò cao độ F0
 * và có audio mẫu để so — xem docs/05-scoring-engine-spec.md.
 *
 * @param {{userSec:number, refSec:number, longPauses?:number, speechRatio?:number}} p
 * @returns {number} 0..100
 */
export function scorePacing({ userSec, refSec, longPauses = 0, speechRatio = null }) {
  if (!userSec || !refSec || refSec <= 0) return 0;
  const r = userSec / refSec;
  let s = 100;
  if (r < 0.80) s -= (0.80 - r) * 190;        // nói vống quá nhanh / đọc thiếu
  else if (r > 1.30) s -= (r - 1.30) * 120;   // rề rà, kéo dài
  s -= Math.min(30, longPauses * 9);          // ngắt vụn giữa câu
  if (speechRatio !== null && speechRatio < 0.50) s -= (0.50 - speechRatio) * 90;
  return clamp(s);
}

/** Xếp hạng hiển thị. */
export function band(score) {
  if (score >= 88) return { key: "excellent", label: "Xuất sắc", tone: "ok" };
  if (score >= 75) return { key: "good", label: "Tốt", tone: "ok" };
  if (score >= 60) return { key: "fair", label: "Tạm được", tone: "warn" };
  if (score >= 40) return { key: "weak", label: "Cần luyện lại", tone: "bad" };
  return { key: "retry", label: "Thu lại nhé", tone: "bad" };
}

/* ---------------------------------------------------------------------------
   Chẩn đoán lỗi âm — bảng bẫy quen thuộc của người học Việt Nam
   --------------------------------------------------------------------------- */

const DIAGNOSES = [
  {
    key: "final-s",
    test: (ref, hyp) => /(s|z)$/.test(ref) && !/(s|z)$/.test(hyp) && ref.slice(0, -1) === hyp,
    tip: (w) => `Rơi âm cuối /s/ hoặc /z/ ở "${w}" — bật nhẹ hơi ở cuối từ, đừng dừng đột ngột.`,
  },
  {
    key: "final-ed",
    test: (ref, hyp) => /ed$/.test(ref) && !/ed$/.test(hyp),
    tip: (w) => `Rơi âm cuối -ed ở "${w}" — quá khứ mất dấu thì người nghe hiểu sai thời gian.`,
  },
  {
    key: "th",
    test: (ref, hyp) => /^th/.test(ref) && /^(s|t|f|d|z)/.test(hyp),
    tip: (w) => `Âm /θ/ – /ð/ ở "${w}": đặt đầu lưỡi chạm nhẹ răng trên rồi thổi hơi, không đổi thành /s/ hay /t/.`,
  },
  {
    key: "sh-s",
    test: (ref, hyp) => /sh/.test(ref) && !/sh/.test(hyp) && /s/.test(hyp),
    tip: (w) => `Âm /ʃ/ ở "${w}": chu môi tròn về trước, khác hẳn /s/ của tiếng Việt.`,
  },
  {
    key: "vowel-length",
    test: (ref, hyp) => ref.length !== hyp.length && ref[0] === hyp[0] && ref.slice(-1) === hyp.slice(-1),
    tip: (w) => `Độ dài nguyên âm ở "${w}" chưa đúng — nguyên âm dài phải ngân rõ hơn hẳn nguyên âm ngắn.`,
  },
  {
    key: "cluster",
    test: (ref, hyp) => /[bcdfgklmnpqrstvwxz]{2}$/.test(ref) && hyp.length < ref.length,
    tip: (w) => `Cụm phụ âm cuối ở "${w}" bị lược — đọc rõ từng phụ âm, chậm lại cũng được.`,
  },
];

/**
 * Chẩn đoán lỗi âm cho một cặp từ mẫu/nghe được.
 * @returns {{key:string, tip:string}|null}
 */
export function diagnosePair(ref, hyp) {
  if (!ref || !hyp || ref === hyp) return null;
  for (const d of DIAGNOSES) {
    if (d.test(ref, hyp)) return { key: d.key, tip: d.tip(ref) };
  }
  return null;
}

/**
 * Sinh danh sách góp ý bằng tiếng Việt, xếp theo mức ưu tiên sửa.
 * @param {object} ctx
 * @returns {Array<{key:string, text:string}>}
 */
export function buildAdvice(ctx) {
  const {
    ops = [], parts = {}, keywordDetails = [], fillers = 0,
    userSec = 0, refSec = 0, longPauses = 0, overall = 0,
  } = ctx;
  const out = [];
  const push = (key, text) => { if (out.length < 5 && !out.some((a) => a.key === key)) out.push({ key, text }); };

  // 1. Cụm trọng tâm chưa ra — ưu tiên cao nhất
  const missedKw = keywordDetails.filter((d) => !d.hit && !d.missingInScript).map((d) => d.text);
  if (missedKw.length) {
    push("keywords", `Cụm trọng tâm chưa ra: ${missedKw.map((k) => `“${k}”`).join(", ")}. Nghe lại riêng cụm này 3 lần rồi thu lại — đây là phần tính điểm nặng nhất.`);
  }

  // 2. Lỗi âm cụ thể có chẩn đoán
  for (const op of ops) {
    if (op.type === "sub" && op.sim < SIM_GOOD) {
      const d = diagnosePair(op.ref, op.hyp);
      if (d) push("phon-" + d.key, d.tip);
    }
  }

  // 3. Từ bị bỏ hẳn
  const missed = ops.filter((o) => verdictOf(o) === "miss").map((o) => o.ref).filter(Boolean);
  if (missed.length) {
    const show = missed.slice(0, 4).map((w) => `“${w}”`).join(", ");
    push("missed", `Chưa nghe ra ${missed.length} từ: ${show}${missed.length > 4 ? "…" : ""}. Bật chế độ lặp câu, nghe 2 lượt rồi đọc chậm 0.75x trước khi thu.`);
  }

  // 4. Nhịp và tốc độ
  if (refSec > 0 && userSec > 0) {
    const r = userSec / refSec;
    if (r < 0.75) push("too-fast", `Bạn nói nhanh hơn bản mẫu ${Math.round((1 - r) * 100)}% — dễ mất âm cuối. Giữ nhịp bằng cách đọc theo cùng lúc với video (chế độ đọc chồng).`);
    else if (r > 1.45) push("too-slow", `Bạn nói chậm hơn bản mẫu ${Math.round((r - 1) * 100)}% — hội thoại phim cần phản xạ. Thử lặp câu ở 0.9x rồi lên 1.0x.`);
  }
  if (longPauses >= 2) push("pauses", `Có ${longPauses} lần ngắt dài giữa câu. Đọc thầm trọn câu một lượt trước khi bấm thu, đừng vừa đọc vừa nhớ.`);
  if (fillers >= 2) push("fillers", `Có ${fillers} tiếng đệm (“um”, “uh”). Trong lồng tiếng, thà im một nhịp còn hơn chèn tiếng đệm.`);

  // 5. Khen và nâng thử thách
  if (!out.length) {
    if (overall >= 92) push("next", "Câu này đã sạch. Nâng thử thách: ẩn phụ đề rồi thu lại, hoặc lồng tiếng liền 3 câu một lượt.");
    else push("next", "Câu này ổn rồi. Thu thêm một lượt nữa để điểm vào nhóm Xuất sắc, rồi chuyển câu.");
  }
  return out;
}

/**
 * Chấm một lượt thu.
 *
 * @param {object} input
 * @param {string} input.refText        Câu mẫu trong kịch bản
 * @param {string} input.hypText        Câu ASR nghe được từ học viên
 * @param {string[]} [input.keywords]   Từ/cụm trọng tâm của câu
 * @param {number} [input.refSec]       Thời lượng câu mẫu (giây)
 * @param {number} [input.userSec]      Thời lượng bản thu (giây)
 * @param {number} [input.longPauses]   Số lần ngắt dài trong bản thu
 * @param {number} [input.speechRatio]  Tỉ lệ thời gian có tiếng nói 0..1
 * @param {keyof PROFILES} [input.profile]
 * @returns {object} AttemptResult
 */
export function gradeAttempt(input) {
  const {
    refText, hypText = "", keywords = [], refSec = 0, userSec = 0,
    longPauses = 0, speechRatio = null, profile = "standard",
  } = input;

  const weights = PROFILES[profile] || PROFILES.standard;
  const refTokens = tokenize(refText);
  const hypTokens = tokenize(hypText);
  const ops = alignTokens(refTokens, hypTokens);

  // Không nghe được tiếng nào: trả về sớm, không chấm để tránh cho điểm ảo.
  if (!hypTokens.length) {
    return {
      overall: 0,
      band: band(0),
      parts: { accuracy: 0, completeness: 0, keywords: keywords.length ? 0 : null, pacing: null },
      weightsUsed: weights,
      words: refTokens.map((w) => ({ text: w, heard: null, verdict: "miss", sim: 0 })),
      keywordDetails: (keywords || []).map((k) => ({ text: k, sim: 0, hit: false })),
      advice: [{
        key: "no-speech",
        text: "Không nghe được tiếng nói nào. Kiểm tra micro, nói cách micro 15–20cm, và nhớ bấm thu TRƯỚC khi đọc.",
      }],
      stats: {
        refWords: refTokens.length, heardWords: 0, fillers: countFillers(hypText),
        refSec: Number(refSec.toFixed(2)), userSec: Number(userSec.toFixed(2)),
        rate: null, longPauses, speechRatio, syllables: 0,
      },
      heardText: hypText,
      mode: "no-speech",
    };
  }

  const accuracy = scoreAccuracy(ops, refTokens.length);
  const completeness = scoreCompleteness(ops, refTokens.length);
  const kw = scoreKeywords(refTokens, ops, keywords);
  // Nhịp chỉ có ý nghĩa khi học viên đã đọc phần lớn câu. Đọc được 2/10 từ mà
  // vẫn ăn điểm nhịp thì điểm tổng sẽ nói dối học viên.
  const pacing = (refSec > 0 && userSec > 0 && completeness >= 40)
    ? scorePacing({ userSec, refSec, longPauses, speechRatio })
    : null;

  // Trọng số của hạng mục không đo được sẽ chia lại cho các hạng mục còn lại,
  // để học viên không bị trừ điểm vì thiếu dữ liệu.
  const parts = { accuracy, completeness, keywords: kw.score, pacing };
  let wSum = 0, sSum = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (parts[k] === null || parts[k] === undefined) continue;
    wSum += w; sSum += w * parts[k];
  }
  const overall = wSum > 0 ? clamp(sSum / wSum) : 0;

  const fillers = countFillers(hypText);
  const advice = buildAdvice({
    ops, parts, keywordDetails: kw.details, fillers,
    userSec, refSec, longPauses, overall,
  });

  return {
    overall: round(overall),
    band: band(overall),
    parts: {
      accuracy: round(accuracy),
      completeness: round(completeness),
      keywords: kw.score === null ? null : round(kw.score),
      pacing: pacing === null ? null : round(pacing),
    },
    weightsUsed: weights,
    words: wordMap(ops),
    keywordDetails: kw.details,
    advice,
    stats: {
      refWords: refTokens.length,
      heardWords: hypTokens.length,
      fillers,
      refSec: Number(refSec.toFixed(2)),
      userSec: Number(userSec.toFixed(2)),
      rate: refSec > 0 ? Number((userSec / refSec).toFixed(2)) : null,
      longPauses,
      speechRatio: speechRatio === null ? null : Number(speechRatio.toFixed(2)),
      syllables: refTokens.reduce((a, w) => a + syllableCount(w), 0),
    },
    heardText: hypText,
    mode: "asr",
  };
}

/**
 * Ước lượng thời lượng đọc một câu ở tốc độ tự nhiên — dùng cho chế độ TTS
 * và để gợi ý nhịp khi kịch bản chưa có mốc thời gian thật.
 * @param {string} text
 * @param {number} [syllablesPerSec=4.2] Tốc độ hội thoại phim thông thường
 */
export function estimateSeconds(text, syllablesPerSec = 4.2) {
  const syl = tokenize(text).reduce((a, w) => a + syllableCount(w), 0);
  return Math.max(0.8, syl / syllablesPerSec + 0.35);
}
