/**
 * karaoke.js — tính nhịp cho phụ đề chạy theo từng từ.
 *
 * VÌ SAO CẦN CÁI NÀY. Học viên nhìn cả câu một lúc thì không biết đang ở đâu
 * trong câu, đọc chậm nửa nhịp là mất hút. Chữ sáng dần theo lời nói cho họ
 * thấy mình đang ở đâu — giống hát karaoke.
 *
 * ĐIỂM QUAN TRỌNG NHẤT: chữ chạy TRƯỚC tiếng một khoảng (`leadSec`). Người ta
 * cần thấy từ rồi mới nói được từ đó — nếu chữ sáng đúng lúc tiếng phát ra thì
 * học viên luôn chậm sau nửa nhịp và luôn thấy mình kém. Đây chính là chỗ tạo
 * áp lực mà bài học phải tránh.
 *
 * Hàm thuần, kiểm thử được.
 */

import { syllableCount } from "./text.js";

/** Dấu câu giữa câu kéo theo một nhịp ngắt — cộng thêm trọng số. */
const PAUSE_WEIGHT = { ",": 0.45, ";": 0.5, ":": 0.5, ".": 0.7, "!": 0.7, "?": 0.7, "—": 0.5, "…": 0.8 };

/**
 * Chia một câu thoại thành các từ kèm mốc thời gian tương đối trong câu.
 *
 * Trọng số mỗi từ = số âm tiết + nhịp ngắt của dấu câu đi kèm. Cách này không
 * chính xác tuyệt đối như dò sóng âm, nhưng đủ để mắt bám theo, và quan trọng
 * là chạy được ngay trên mọi nguồn — kể cả video nhúng không cho đọc sóng âm.
 *
 * @param {string} text
 * @param {number} durationSec Thời lượng câu, tính từ mốc bắt đầu tới mốc kết thúc
 * @returns {{words: Array<{text:string, start:number, end:number, index:number}>, durationSec:number}}
 */
export function buildCaption(text, durationSec) {
  const raw = String(text || "").trim().split(/\s+/).filter(Boolean);
  const dur = Math.max(0.3, Number(durationSec) || 0.3);
  if (!raw.length) return { words: [], durationSec: dur };

  const weights = raw.map((w) => {
    const bare = w.replace(/[^A-Za-z'’-]/g, "");
    let weight = Math.max(1, syllableCount(bare));
    for (const ch of w) weight += PAUSE_WEIGHT[ch] || 0;
    return weight;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  const words = [];
  let t = 0;
  raw.forEach((w, i) => {
    const span = (weights[i] / total) * dur;
    words.push({
      text: w,
      start: Number(t.toFixed(3)),
      end: Number((t + span).toFixed(3)),
      index: i,
    });
    t += span;
  });
  // ép từ cuối kết thúc đúng ở mốc cuối, tránh lệch do làm tròn
  words[words.length - 1].end = Number(dur.toFixed(3));
  return { words, durationSec: dur };
}

/**
 * Từ nào đang được đọc tại thời điểm `relSec` trong câu.
 *
 * @param {Array} words Kết quả buildCaption().words
 * @param {number} relSec Giây tính từ đầu câu
 * @param {number} [leadSec=0] Cho chữ chạy trước tiếng bao nhiêu giây
 * @returns {number} chỉ số từ, hoặc -1 nếu chưa tới câu
 */
export function activeIndex(words, relSec, leadSec = 0) {
  if (!words?.length) return -1;
  const t = relSec + leadSec;
  if (t < 0) return -1;
  for (let i = 0; i < words.length; i++) {
    if (t < words[i].end) return i;
  }
  return words.length - 1;
}

/**
 * Tốc độ câu này, tính bằng âm tiết mỗi giây — dùng để cảnh báo người soạn khi
 * một câu bị nhồi quá nhanh so với sức đọc của học viên.
 *
 * Hội thoại phim bình thường khoảng 4–5 âm tiết/giây. Trên 6,5 là nhanh tới
 * mức người mới học không thể theo kịp dù có cố.
 */
export function syllablesPerSecond(text, durationSec) {
  const syl = String(text || "").trim().split(/\s+/).filter(Boolean)
    .reduce((s, w) => s + Math.max(1, syllableCount(w.replace(/[^A-Za-z'’-]/g, ""))), 0);
  const dur = Math.max(0.1, Number(durationSec) || 0.1);
  return Number((syl / dur).toFixed(2));
}

/**
 * Tốc độ phát nên dùng để học viên theo kịp, dựa trên độ nhanh của câu và
 * trình độ đặt cho bài.
 *
 * Trả về con số gợi ý, KHÔNG tự ép — học viên vẫn tự chọn được. Ép tốc độ là
 * một kiểu tạo áp lực khác.
 *
 * @returns {{rate:number, reason:string}}
 */
export function suggestRate(text, durationSec, profile = "standard") {
  const sps = syllablesPerSecond(text, durationSec);
  const comfortable = { starter: 4.0, standard: 4.8, advanced: 5.6 }[profile] ?? 4.8;
  if (sps <= comfortable) return { rate: 1, reason: "Câu này ở tốc độ vừa, nghe 1x là theo được." };
  const raw = comfortable / sps;
  const rate = [0.5, 0.75, 0.9].reduce((best, r) => (Math.abs(r - raw) < Math.abs(best - raw) ? r : best), 0.9);
  return {
    rate,
    reason: `Câu này ${sps} âm tiết mỗi giây — nhanh hơn mức dễ theo. Thử ${rate}x trước, quen rồi hãy lên 1x.`,
  };
}

/**
 * Thời gian chuẩn bị nên cho trước khi học viên phải nói.
 *
 * Câu dài cần nhiều thời gian đọc hơn câu ngắn. Đây là con số mặc định, học
 * viên chỉnh được trong phần thiết lập.
 *
 * @returns {number} giây
 */
export function suggestLeadIn(text, { min = 2, max = 6, perWord = 0.28 } = {}) {
  const n = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.round(Math.min(max, Math.max(min, n * perWord)) * 10) / 10;
}
