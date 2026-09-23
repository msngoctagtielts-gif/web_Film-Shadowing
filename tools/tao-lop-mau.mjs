/**
 * tao-lop-mau.mjs — sinh dữ liệu lớp học mẫu cho bảng theo dõi của giáo viên.
 *
 * Dùng để bảng mở ra đã có nội dung thật thay vì một bảng trống, và để kiểm thử
 * phần phân tích. Dữ liệu sinh theo quy tắc cố định (không ngẫu nhiên) nên chạy
 * lại luôn cho cùng kết quả.
 *
 *   node tools/tao-lop-mau.mjs > data/demo-lop-hoc.json
 */

import fs from "node:fs";

const lesson = JSON.parse(fs.readFileSync("data/lessons/demo-doan-thoai-ga-tau.json", "utf8"));
const lineIds = lesson.lines.map((l) => l.id);
const DAY = 86400000;
const iso = (daysAgo, hour = 20) =>
  new Date(Date.now() - daysAgo * DAY - (24 - hour) * 3600000).toISOString();

/**
 * Mỗi học viên là một chân dung có thật trong lớp, không phải số ngẫu nhiên.
 * `shape(i)` trả về điểm cao nhất của câu thứ i, hoặc null nếu chưa thu.
 */
const CLASS = [
  {
    name: "Nguyễn Thu An",
    note: "Học đều, tiến bộ rõ",
    activeDays: [11, 9, 7, 5, 3, 1],
    shape: (i) => [88, 92, 85, 79, 90, 83, 87, 76, 91, 84, 62, 58][i],
    takesPerLine: 2,
  },
  {
    name: "Trần Minh Bình",
    note: "Thu rất nhiều lượt nhưng chưa qua — bài đang quá sức",
    activeDays: [10, 8, 6, 4, 2],
    shape: (i) => [58, 52, 61, 47, 55, 44, 59, 41, 50, 46, 33, 29][i],
    takesPerLine: 4,
  },
  {
    name: "Lê Khánh Chi",
    note: "Biến mất 12 ngày — nguy cơ nghỉ",
    activeDays: [16, 14, 12],
    shape: (i) => (i < 5 ? [74, 71, 68, 72, 66][i] : null),
    takesPerLine: 2,
  },
  {
    name: "Phạm Anh Dũng",
    note: "Thu lại mà điểm tệ đi — đang nản",
    activeDays: [9, 7, 5, 2],
    shape: (i) => [91, 88, 84, 77, 70, 66, 61, 58, 55, 52, 48, 45][i],
    takesPerLine: 2,
    declining: true,
  },
  {
    name: "Vũ Thanh Hà",
    note: "Mới bắt đầu hôm qua",
    activeDays: [1],
    shape: (i) => (i < 3 ? [72, 65, 58][i] : null),
    takesPerLine: 1,
  },
  {
    name: "Đỗ Đăng Khoa",
    note: "Gần xong cả bài",
    activeDays: [8, 6, 4, 3, 1],
    shape: (i) => [94, 90, 88, 92, 86, 89, 91, 85, 87, 90, 71, 69][i],
    takesPerLine: 2,
  },
];

function buildStudent(p) {
  const lines = {};
  let attempts = 0, recordedSec = 0;
  const dayFor = (i) => p.activeDays[Math.min(p.activeDays.length - 1,
    Math.floor((i / lineIds.length) * p.activeDays.length))];

  lineIds.forEach((id, i) => {
    const best = p.shape(i);
    if (best === null || best === undefined) return;
    const takes = [];
    // Các lượt trước lượt tốt nhất thấp hơn dần — giống cách học viên thu thật
    for (let t = 0; t < p.takesPerLine; t++) {
      // Bình thường lượt sau tốt hơn lượt trước. Học viên đang nản thì ngược
      // lại: thu lượt đầu tử tế rồi các lượt sau đọc cho xong.
      const score = p.declining
        ? Math.max(0, best - t * 9)
        : (t === p.takesPerLine - 1 ? best : Math.max(0, best - (p.takesPerLine - t) * 7));
      const dur = Number((lesson.lines[i].end - lesson.lines[i].start + 0.6).toFixed(2));
      takes.push({
        at: iso(dayFor(i), 20 + t % 3),
        overall: score,
        parts: { accuracy: score + 4, completeness: score + 2, keywords: score - 3, pacing: score - 6 },
        heardText: lesson.lines[i].text,
        mode: "asr",
        durationSec: dur,
      });
      attempts++; recordedSec += dur;
    }
    lines[id] = { best, attempts: takes };
  });

  const passed = Object.values(lines).filter((l) => l.best >= lesson.scoring.passMark).length;
  const vocab = {};
  lesson.vocab.slice(0, Math.max(1, Math.round(lesson.vocab.length * (passed / lineIds.length)))).forEach((v) => {
    vocab[v.id] = { seenAt: iso(p.activeDays[0]), known: true };
  });

  return {
    version: 1,
    profile: { name: p.name, level: "starter", createdAt: iso(p.activeDays[0] + 2) },
    settings: { asrEnabled: true, rate: 1, hideText: false, showVi: true, voiceLang: "en-US" },
    lessons: {
      [lesson.id]: {
        lines, vocab,
        startedAt: iso(p.activeDays[0]),
        completedAt: passed === lineIds.length ? iso(p.activeDays[p.activeDays.length - 1]) : null,
      },
    },
    streak: {
      count: p.activeDays.length,
      lastDay: new Date(Date.now() - p.activeDays[p.activeDays.length - 1] * DAY).toISOString().slice(0, 10),
      days: p.activeDays.map((d) => new Date(Date.now() - d * DAY).toISOString().slice(0, 10)),
    },
    totals: { attempts, recordedSec: Number(recordedSec.toFixed(1)) },
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  note: "Lớp học mẫu do tools/tao-lop-mau.mjs sinh ra. Không phải học viên thật.",
  students: CLASS.map((p) => ({ name: p.name, note: p.note, data: buildStudent(p) })),
};

process.stdout.write(JSON.stringify(out, null, 2));
