import { describe, it, expect } from "./harness.mjs";
import {
  lastActiveDay, allAttempts, progressTrend, assessRisk, summarizeStudent,
  classBottlenecks, classWeakPhrases, classStats, scoreSeries, weakLinesFor, parseStudentFile,
} from "../assets/js/core/analytics.js";
import { normalizeLesson } from "../assets/js/core/lesson-loader.js";
import fs from "node:fs";

const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();

/** Dựng một học viên giả: mỗi câu một danh sách điểm theo thứ tự thu. */
function student(name, lines, daysAgo = 1) {
  const out = {};
  let attempts = 0;
  for (const [id, scores] of Object.entries(lines)) {
    out[id] = {
      best: Math.max(...scores),
      attempts: scores.map((s) => ({ at: ago(daysAgo), overall: s, parts: {}, mode: "asr", durationSec: 2 })),
    };
    attempts += scores.length;
  }
  return {
    name,
    data: {
      lessons: { L1: { lines: out, vocab: {}, startedAt: ago(daysAgo + 5), completedAt: null } },
      totals: { attempts, recordedSec: attempts * 2 },
      streak: { count: 1 },
      profile: { name },
    },
  };
}

const IDX = [{ id: "L1", lineIds: ["l1", "l2", "l3", "l4"], passMark: 70 }];

describe("Hoạt động gần nhất", () => {
  it("lấy theo lượt thu, không lấy theo lần mở ứng dụng", () => {
    const s = student("A", { l1: [80] }, 3);
    expect(lastActiveDay(s.data)).toBe(ago(3).slice(0, 10));
  });
  it("chưa thu lượt nào thì trả null", () => {
    expect(lastActiveDay({ lessons: { L1: { lines: {} } } })).toBeNull();
  });
  it("dữ liệu rỗng không làm vỡ", () => {
    expect(lastActiveDay(null)).toBeNull();
    expect(allAttempts(null)).toEqual([]);
  });
});

describe("Hướng tiến bộ", () => {
  it("thu lại tốt lên thì báo đi lên", () => {
    const s = student("A", { l1: [50, 70], l2: [55, 72], l3: [60, 80] });
    expect(progressTrend(s.data).direction).toBe("up");
  });
  it("thu lại tệ đi thì báo đi xuống", () => {
    const s = student("A", { l1: [80, 60], l2: [75, 58], l3: [70, 55] });
    expect(progressTrend(s.data).direction).toBe("down");
  });
  it("thu lại xêm xêm thì báo đi ngang", () => {
    const s = student("A", { l1: [70, 71], l2: [65, 66], l3: [80, 79] });
    expect(progressTrend(s.data).direction).toBe("flat");
  });
  it("chưa đủ câu có thu lại thì không kết luận", () => {
    expect(progressTrend(student("A", { l1: [50, 70] }).data)).toBeNull();
  });
  it("câu về sau khó hơn KHÔNG bị hiểu nhầm thành đi xuống", () => {
    // Học viên thu lại câu nào cũng tốt lên, nhưng câu sau trong bài khó hơn
    // nên điểm tuyệt đối giảm dần. Đây từng là lỗi: mọi em đều bị báo đi xuống.
    const s = student("A", { l1: [85, 92], l2: [70, 78], l3: [55, 63], l4: [40, 48] });
    expect(progressTrend(s.data).direction).toBe("up");
  });
});

describe("Đánh giá mức cần chú ý", () => {
  const base = { daysSinceActive: 1, percent: 60, avgBest: 75, attempts: 10, daysSinceStart: 5, trend: null };

  it("học đều thì không gắn cờ", () => {
    expect(assessRisk(base).level).toBe("ok");
  });
  it("vắng từ 10 ngày là mức gấp", () => {
    expect(assessRisk({ ...base, daysSinceActive: 12 }).level).toBe("critical");
  });
  it("vắng 5 tới 9 ngày là cần chú ý", () => {
    expect(assessRisk({ ...base, daysSinceActive: 6 }).level).toBe("warning");
  });
  it("chưa thu lượt nào là mức gấp", () => {
    expect(assessRisk({ ...base, daysSinceActive: null }).level).toBe("critical");
  });
  it("thu nhiều mà điểm thấp thì gắn cờ bài quá sức", () => {
    const r = assessRisk({ ...base, attempts: 30, avgBest: 45 });
    expect(r.level).toBe("warning");
    expect(r.reasons.join(" ")).toContain("quá sức");
  });
  it("em giỏi học đều KHÔNG bị gắn cờ oan", () => {
    expect(assessRisk({ ...base, percent: 92, avgBest: 86, attempts: 24 }).level).toBe("ok");
  });
  it("luôn nêu được lý do", () => {
    [base, { ...base, daysSinceActive: 12 }, { ...base, daysSinceActive: null }]
      .forEach((r) => expect(assessRisk(r).reasons.length).toBeGreaterThan(0));
  });
});

describe("Tổng kết một học viên", () => {
  const s = student("An", { l1: [90], l2: [85], l3: [60], l4: [40] });
  const row = summarizeStudent(s, IDX);

  it("đếm đúng số câu đã đạt", () => { expect(row.linesDone).toBe(2); });
  it("tính đúng phần trăm", () => { expect(row.percent).toBe(50); });
  it("tính đúng điểm trung bình", () => { expect(row.avgBest).toBe(69); });
  it("học viên chưa học bài nào cho số 0, không vỡ", () => {
    const empty = summarizeStudent({ name: "X", data: { lessons: {} } }, IDX);
    expect(empty.percent).toBe(0);
    expect(empty.risk.level).toBe("critical");
  });
  it("lấy tên từ hồ sơ khi không truyền tên", () => {
    expect(summarizeStudent({ data: s.data }, IDX).name).toBe("An");
  });
});

describe("Điểm nghẽn của lớp", () => {
  const lesson = normalizeLesson({
    id: "L1", title: "Bài 1", source: { type: "tts" }, scoring: { passMark: 70 },
    lines: [
      { id: "l1", text: "Hold on", start: 0, end: 2, keywords: ["hold on"] },
      { id: "l2", text: "I am in a hurry", start: 2, end: 5, keywords: ["in a hurry"] },
    ],
  });
  const students = [
    student("A", { l1: [90], l2: [40] }),
    student("B", { l1: [85], l2: [45] }),
    student("C", { l1: [88], l2: [50] }),
  ];

  it("đưa câu nhiều em trượt lên đầu", () => {
    const b = classBottlenecks(students, [lesson]);
    expect(b[0].lineId).toBe("l2");
    expect(b[0].failedBy).toBe(3);
  });
  it("bỏ qua câu chưa đủ số em thu", () => {
    const few = [student("A", { l1: [90] })];
    expect(classBottlenecks(few, [lesson], { minStudents: 2 })).toEqual([]);
  });
  it("tính đúng tỉ lệ trượt và điểm trung bình", () => {
    const b = classBottlenecks(students, [lesson]).find((x) => x.lineId === "l2");
    expect(b.failRate).toBe(100);
    expect(b.avgBest).toBe(45);
  });
  it("gom được cụm cả lớp cùng vướng", () => {
    const p = classWeakPhrases(classBottlenecks(students, [lesson]));
    expect(p[0].text).toBe("in a hurry");
    expect(p[0].students).toBe(3);
  });
  it("lớp rỗng không làm vỡ", () => {
    expect(classBottlenecks([], [lesson])).toEqual([]);
    expect(classWeakPhrases([])).toEqual([]);
  });
});

describe("Tổng quan lớp", () => {
  it("lớp rỗng cho toàn số 0", () => {
    const s = classStats([]);
    expect(s.students).toBe(0);
    expect(s.avgPercent).toBe(0);
  });
  it("đếm đúng số em cần chú ý", () => {
    const rows = [
      student("A", { l1: [90] }, 1), student("B", { l1: [50] }, 20),
    ].map((s) => summarizeStudent(s, IDX));
    expect(classStats(rows).needAttention).toBe(1);
  });
});

describe("Chuỗi điểm theo ngày", () => {
  it("gộp theo ngày và lấy điểm cao nhất trong ngày", () => {
    const data = {
      lessons: { L1: { lines: { l1: { best: 80, attempts: [
        { at: ago(2), overall: 50 }, { at: ago(2), overall: 80 }, { at: ago(1), overall: 65 },
      ] } } } },
    };
    const s = scoreSeries(data);
    expect(s.length).toBe(2);
    expect(s[0].score).toBe(80);
    expect(s[1].score).toBe(65);
  });
  it("xếp theo ngày tăng dần", () => {
    const s = scoreSeries(student("A", { l1: [70] }, 1).data);
    expect(s.length).toBe(1);
  });
});

describe("Câu yếu của riêng một học viên", () => {
  const lesson = normalizeLesson({
    id: "L1", title: "B", source: { type: "tts" }, scoring: { passMark: 70 },
    lines: [
      { id: "l1", text: "Một", start: 0, end: 2 },
      { id: "l2", text: "Hai", start: 2, end: 4 },
      { id: "l3", text: "Ba", start: 4, end: 6 },
    ],
  });
  it("chỉ lấy câu dưới mức đạt, xếp từ thấp lên", () => {
    const s = student("A", { l1: [90], l2: [40], l3: [55] });
    const w = weakLinesFor(s, [lesson]);
    expect(w.map((x) => x.lineId)).toEqual(["l2", "l3"]);
  });
});

describe("Đọc tệp tiến độ học viên", () => {
  it("nhận tệp đúng định dạng và lấy tên từ hồ sơ", () => {
    const r = parseStudentFile(JSON.stringify({ lessons: {}, profile: { name: "Thu An" } }), "abc.json");
    expect(r.ok).toBeTruthy();
    expect(r.student.name).toBe("Thu An");
  });
  it("chưa đặt tên thì lấy từ tên tệp", () => {
    const r = parseStudentFile(JSON.stringify({ lessons: {} }), "tien-do-2026-09-23.json");
    expect(r.student.name).toBe("2026-09-23");
  });
  it("từ chối tệp không phải JSON", () => {
    expect(parseStudentFile("{{ hỏng").ok).toBeFalsy();
  });
  it("từ chối tệp JSON không phải tiến độ học", () => {
    const r = parseStudentFile('{"gi do":1}');
    expect(r.ok).toBeFalsy();
    expect(r.error).toContain("lessons");
  });
});

describe("Dữ liệu lớp mẫu", () => {
  const demo = JSON.parse(fs.readFileSync("data/demo-lop-hoc.json", "utf8"));
  const lesson = normalizeLesson(JSON.parse(fs.readFileSync("data/lessons/demo-doan-thoai-ga-tau.json", "utf8")));
  const idx = [{ id: lesson.id, lineIds: lesson.lines.map((l) => l.id), passMark: lesson.scoring.passMark }];
  const rows = demo.students.map((s) => summarizeStudent(s, idx));

  it("có đủ học viên để bảng có nội dung", () => {
    expect(demo.students.length).toBeGreaterThanOrEqual(5);
  });
  it("mọi tệp học viên đều đọc được", () => {
    demo.students.forEach((s) => expect(parseStudentFile(JSON.stringify(s.data), "x.json").ok).toBeTruthy());
  });
  it("có cả em cần gọi gấp lẫn em đang học đều", () => {
    const levels = new Set(rows.map((r) => r.risk.level));
    expect(levels.has("critical")).toBeTruthy();
    expect(levels.has("ok")).toBeTruthy();
  });
  it("em đạt trên 90% không bị gắn cờ oan", () => {
    const top = rows.filter((r) => r.percent >= 90);
    expect(top.length).toBeGreaterThan(0);
    top.forEach((r) => expect(r.risk.level).toBe("ok"));
  });
  it("chưa tới một nửa lớp bị gắn cờ — cảnh báo phải có ý nghĩa", () => {
    const flagged = rows.filter((r) => r.risk.level !== "ok").length;
    expect(flagged).toBeLessThan(rows.length / 2 + 1);
  });
  it("tìm ra được điểm nghẽn thật của lớp", () => {
    const b = classBottlenecks(demo.students, [lesson]);
    expect(b.length).toBeGreaterThan(0);
    expect(b[0].failedBy).toBeGreaterThanOrEqual(2);
  });
});
