/**
 * store.js — lưu tiến độ học trên máy học viên (localStorage).
 *
 * Bản MVP cố tình KHÔNG có máy chủ: không tài khoản, không thu thập dữ liệu,
 * học viên mở là học được ngay. Khi lên bản có lớp học và báo cáo cho phụ huynh,
 * thay phần thân của `read`/`write` bằng lệnh gọi API — phần còn lại của ứng
 * dụng không phải sửa. Xem docs/09-roadmap-va-chi-so.md.
 */

const KEY = "film-shadowing:v1";
const MAX_ATTEMPTS_PER_LINE = 8;

/** Lược đồ mặc định. */
function blank() {
  return {
    version: 1,
    profile: { name: "", level: "standard", createdAt: new Date().toISOString() },
    settings: { asrEnabled: null, rate: 1, hideText: false, showVi: true, voiceLang: "en-US" },
    lessons: {},        // lessonId -> { lines: {lineId: {best, attempts:[]}}, vocab: {...}, startedAt, completedAt }
    streak: { count: 0, lastDay: null, days: [] },
    totals: { attempts: 0, recordedSec: 0 },
  };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const data = JSON.parse(raw);
    return { ...blank(), ...data, settings: { ...blank().settings, ...(data.settings || {}) } };
  } catch (e) {
    console.warn("Không đọc được tiến độ, dùng dữ liệu mới:", e);
    return blank();
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    // Hết dung lượng: cắt bớt lịch sử lượt thu rồi thử lại một lần.
    console.warn("localStorage đầy, đang dọn lịch sử:", e);
    for (const lesson of Object.values(data.lessons || {})) {
      for (const line of Object.values(lesson.lines || {})) {
        if (line.attempts) line.attempts = line.attempts.slice(-2);
      }
    }
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch { return false; }
  }
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export const store = {
  all: () => read(),

  getSettings() { return read().settings; },

  setSettings(patch) {
    const d = read();
    d.settings = { ...d.settings, ...patch };
    write(d);
    return d.settings;
  },

  getProfile() { return read().profile; },

  setProfile(patch) {
    const d = read();
    d.profile = { ...d.profile, ...patch };
    write(d);
    return d.profile;
  },

  /** Tiến độ của một bài, luôn trả về đối tượng (không bao giờ undefined). */
  lesson(lessonId) {
    const d = read();
    return d.lessons[lessonId] || { lines: {}, vocab: {}, startedAt: null, completedAt: null };
  },

  markLessonStarted(lessonId) {
    const d = read();
    const l = (d.lessons[lessonId] ||= { lines: {}, vocab: {}, startedAt: null, completedAt: null });
    if (!l.startedAt) l.startedAt = new Date().toISOString();
    write(d);
  },

  /**
   * Ghi một lượt thu. Chỉ giữ điểm cao nhất và vài lượt gần nhất để không phình
   * dung lượng.
   * @param {string} lessonId @param {string} lineId
   * @param {{overall:number, parts:object, heardText:string, mode:string, durationSec:number}} attempt
   */
  saveAttempt(lessonId, lineId, attempt) {
    const d = read();
    const l = (d.lessons[lessonId] ||= { lines: {}, vocab: {}, startedAt: new Date().toISOString(), completedAt: null });
    const line = (l.lines[lineId] ||= { best: null, attempts: [] });
    const record = {
      at: new Date().toISOString(),
      overall: attempt.overall,
      parts: attempt.parts,
      heardText: attempt.heardText,
      mode: attempt.mode,
      durationSec: Number((attempt.durationSec || 0).toFixed(2)),
    };
    line.attempts.push(record);
    if (line.attempts.length > MAX_ATTEMPTS_PER_LINE) line.attempts = line.attempts.slice(-MAX_ATTEMPTS_PER_LINE);
    if (line.best === null || attempt.overall > line.best) line.best = attempt.overall;

    d.totals.attempts += 1;
    d.totals.recordedSec += record.durationSec;

    // chuỗi ngày học liên tiếp
    const day = todayKey();
    if (d.streak.lastDay !== day) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      d.streak.count = d.streak.lastDay === yesterday ? d.streak.count + 1 : 1;
      d.streak.lastDay = day;
      d.streak.days = [...new Set([...(d.streak.days || []), day])].slice(-120);
    }
    write(d);
    return line;
  },

  /** Đánh dấu học viên đã xem xong thẻ từ vựng. */
  markVocabSeen(lessonId, vocabId, known = null) {
    const d = read();
    const l = (d.lessons[lessonId] ||= { lines: {}, vocab: {}, startedAt: new Date().toISOString(), completedAt: null });
    l.vocab[vocabId] = { seenAt: new Date().toISOString(), known };
    write(d);
  },

  /**
   * Tổng kết một bài: số câu đã đạt, điểm trung bình, phần trăm hoàn thành.
   * @param {string} lessonId @param {string[]} lineIds @param {number} passMark
   */
  summary(lessonId, lineIds, passMark = 70) {
    const l = this.lesson(lessonId);
    const scores = lineIds.map((id) => l.lines[id]?.best ?? null);
    const done = scores.filter((s) => s !== null && s >= passMark).length;
    const attempted = scores.filter((s) => s !== null).length;
    const avg = attempted ? Math.round(scores.filter((s) => s !== null).reduce((a, b) => a + b, 0) / attempted) : 0;
    return {
      total: lineIds.length,
      attempted,
      done,
      avg,
      percent: lineIds.length ? Math.round((done / lineIds.length) * 100) : 0,
      completed: lineIds.length > 0 && done === lineIds.length,
    };
  },

  markLessonCompleted(lessonId) {
    const d = read();
    const l = (d.lessons[lessonId] ||= { lines: {}, vocab: {}, startedAt: new Date().toISOString(), completedAt: null });
    l.completedAt = new Date().toISOString();
    write(d);
  },

  streak() { return read().streak; },
  totals() { return read().totals; },

  /** Xuất toàn bộ tiến độ thành JSON để học viên gửi cho giáo viên. */
  exportJson() { return JSON.stringify(read(), null, 2); },

  /** Nhập lại từ tệp JSON đã xuất. Trả về true nếu hợp lệ. */
  importJson(text) {
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== "object" || !data.lessons) return false;
      return write({ ...blank(), ...data });
    } catch { return false; }
  },

  reset() {
    try { localStorage.removeItem(KEY); return true; } catch { return false; }
  },
};
