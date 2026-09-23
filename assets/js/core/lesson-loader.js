/**
 * lesson-loader.js — nạp và KIỂM TRA bài học.
 *
 * Bài học do người soạn viết bằng tay hoặc xuất từ Studio, nên sai sót là
 * chuyện bình thường: mốc thời gian chồng nhau, câu thiếu chữ, từ trọng tâm
 * không có trong kịch bản. Bộ kiểm tra này bắt lỗi ngay khi nạp và nói rõ lỗi
 * ở đâu, thay vì để giao diện vỡ giữa buổi học của học viên.
 */

import { estimateSeconds } from "./scoring.js";
import { findPhraseSpan, tokenize } from "./text.js";

/**
 * @typedef {object} ValidationIssue
 * @property {'error'|'warning'} level
 * @property {string} where
 * @property {string} message
 */

/**
 * Kiểm tra một bài học.
 * @param {object} lesson
 * @returns {{issues: ValidationIssue[], ok: boolean}}
 */
export function validateLesson(lesson) {
  /** @type {ValidationIssue[]} */
  const issues = [];
  const err = (where, message) => issues.push({ level: "error", where, message });
  const warn = (where, message) => issues.push({ level: "warning", where, message });

  if (!lesson || typeof lesson !== "object") {
    return { issues: [{ level: "error", where: "lesson", message: "Bài học không phải một đối tượng JSON." }], ok: false };
  }
  if (!lesson.id) err("lesson.id", "Thiếu mã bài học (id).");
  if (!lesson.title) warn("lesson.title", "Thiếu tiêu đề bài học.");

  const source = lesson.source || {};
  if (!["youtube", "file", "tts"].includes(source.type)) {
    err("source.type", `Nguồn "${source.type}" không hỗ trợ. Dùng youtube | file | tts.`);
  }
  if (source.type === "youtube" && !source.videoId) err("source.videoId", "Nguồn YouTube thiếu videoId.");
  if (source.type === "file" && !source.url) err("source.url", "Nguồn file thiếu url.");
  if (source.type === "youtube" && !source.rightsNote) {
    warn("source.rightsNote", "Chưa ghi chú quyền sử dụng. Bài dùng video của người khác cần ghi rõ nguồn và cơ sở sử dụng.");
  }

  const lines = Array.isArray(lesson.lines) ? lesson.lines : [];
  if (!lines.length) err("lines", "Bài học chưa có câu thoại nào.");

  const ids = new Set();
  lines.forEach((line, i) => {
    const at = `lines[${i}]`;
    if (!line.id) err(at + ".id", "Câu thiếu id.");
    else if (ids.has(line.id)) err(at + ".id", `Trùng id câu: "${line.id}".`);
    else ids.add(line.id);

    if (!line.text || !String(line.text).trim()) err(at + ".text", "Câu thiếu nội dung tiếng Anh.");
    if (typeof line.start !== "number" || typeof line.end !== "number") {
      err(at + ".start/end", "Mốc thời gian phải là số (giây).");
    } else {
      if (line.end <= line.start) err(at, `Mốc kết thúc (${line.end}s) không sau mốc bắt đầu (${line.start}s).`);
      const span = line.end - line.start;
      if (span > 0 && span < 0.5) warn(at, `Câu chỉ dài ${span.toFixed(2)}s — quá ngắn để lồng tiếng.`);
      if (span > 20) warn(at, `Câu dài ${span.toFixed(1)}s — nên cắt nhỏ, mỗi lượt thu không quá 15s.`);
      if (line.text) {
        const est = estimateSeconds(line.text);
        if (span > 0 && est > span * 2.2) {
          warn(at, `Câu có ${tokenize(line.text).length} từ nhưng chỉ được ${span.toFixed(1)}s — mốc thời gian có thể sai.`);
        }
      }
    }

    // từ trọng tâm phải thực sự nằm trong câu, nếu không sẽ không bao giờ ăn điểm
    (line.keywords || []).forEach((kw) => {
      if (line.text && !findPhraseSpan(tokenize(line.text), kw)) {
        err(at + ".keywords", `Cụm trọng tâm "${kw}" không có trong câu — học viên sẽ không bao giờ đạt điểm phần này.`);
      }
    });
  });

  // mốc thời gian chồng nhau
  const sorted = [...lines].filter((l) => typeof l.start === "number").sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end - 0.05) {
      warn("lines", `Câu "${sorted[i - 1].id}" và "${sorted[i].id}" có khoảng thời gian chồng nhau.`);
    }
  }

  // từ vựng
  const vocabIds = new Set();
  (lesson.vocab || []).forEach((v, i) => {
    const at = `vocab[${i}]`;
    if (!v.id) err(at + ".id", "Từ vựng thiếu id.");
    else if (vocabIds.has(v.id)) err(at + ".id", `Trùng id từ vựng: "${v.id}".`);
    else vocabIds.add(v.id);
    if (!v.term) err(at + ".term", "Từ vựng thiếu từ.");
    if (!v.meaningVi) warn(at + ".meaningVi", `Từ "${v.term}" chưa có nghĩa tiếng Việt.`);
    if (!v.image) warn(at + ".image", `Từ "${v.term}" chưa có hình minh hoạ.`);
    (v.lineIds || []).forEach((lid) => {
      if (!ids.has(lid)) warn(at + ".lineIds", `Từ "${v.term}" trỏ tới câu không tồn tại: "${lid}".`);
    });
  });

  return { issues, ok: !issues.some((x) => x.level === "error") };
}

/**
 * Bổ sung các giá trị suy ra được, để phần giao diện không phải kiểm tra null.
 * @param {object} lesson
 */
export function normalizeLesson(lesson) {
  const out = structuredClone(lesson);
  out.lines = (out.lines || []).map((l, i) => ({
    speaker: "",
    textVi: "",
    keywords: [],
    vocabIds: [],
    notes: "",
    difficulty: 1,
    ...l,
    index: i,
    durationSec: Number(((l.end ?? 0) - (l.start ?? 0)).toFixed(2)),
  })).sort((a, b) => a.start - b.start);
  out.vocab = (out.vocab || []).map((v) => ({ ipa: "", pos: "", example: "", ...v }));
  out.keyphrases = out.keyphrases || [];
  out.scoring = { profile: "standard", passMark: 70, ...(out.scoring || {}) };
  out.source = { type: "tts", voiceLang: "en-US", ...(out.source || {}) };
  out.roles = out.roles || [...new Set(out.lines.map((l) => l.speaker).filter(Boolean))].map((s) => ({ id: s, label: s }));
  return out;
}

/**
 * Nạp bài học từ tệp JSON, kiểm tra rồi chuẩn hoá.
 * @param {string} url
 * @returns {Promise<{lesson:object, issues:ValidationIssue[]}>}
 */
export async function loadLesson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Không nạp được bài học (${res.status}): ${url}`);
  const raw = await res.json();
  const { issues, ok } = validateLesson(raw);
  if (!ok) {
    const first = issues.find((i) => i.level === "error");
    throw Object.assign(new Error(`Bài học có lỗi: ${first.where} — ${first.message}`), { issues });
  }
  return { lesson: normalizeLesson(raw), issues };
}

/** Nạp danh mục khoá học. */
export async function loadCatalog(url = "data/courses.json") {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Không nạp được danh mục (${res.status}).`);
  return res.json();
}
