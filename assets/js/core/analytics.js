/**
 * analytics.js — biến các tệp tiến độ rời rạc của học viên thành thứ giáo viên
 * dùng được: ai đang chững lại, câu nào cả lớp cùng sai, nên gọi ai trước.
 *
 * Toàn bộ là hàm thuần (không chạm DOM, không gọi mạng), nên kiểm thử được
 * bằng Node. Đầu vào là dữ liệu do `core/store.js` xuất ra.
 */

const DAY = 86400000;
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);

/**
 * @typedef {object} StudentFile
 * @property {string} name        Tên hiển thị (lấy từ profile.name hoặc tên tệp)
 * @property {object} data        Nội dung tệp tiến độ đã xuất
 */

/**
 * Ngày hoạt động gần nhất của một học viên, lấy từ lượt thu mới nhất.
 * Dùng lượt thu chứ không dùng `streak.lastDay`, vì mở ứng dụng mà không thu
 * thì không tính là có học.
 * @param {object} data
 * @returns {string|null} dạng YYYY-MM-DD
 */
export function lastActiveDay(data) {
  let latest = null;
  for (const lesson of Object.values(data?.lessons || {})) {
    for (const line of Object.values(lesson.lines || {})) {
      for (const a of line.attempts || []) {
        if (!latest || a.at > latest) latest = a.at;
      }
    }
  }
  return latest ? dayKey(latest) : null;
}

/**
 * Mọi lượt thu của một học viên, xếp theo thời gian tăng dần.
 * @param {object} data
 * @param {string} [lessonId] Lọc theo một bài, bỏ trống thì lấy tất cả
 */
export function allAttempts(data, lessonId = null) {
  const out = [];
  for (const [lid, lesson] of Object.entries(data?.lessons || {})) {
    if (lessonId && lid !== lessonId) continue;
    for (const [lineId, line] of Object.entries(lesson.lines || {})) {
      for (const a of line.attempts || []) {
        out.push({ ...a, lessonId: lid, lineId });
      }
    }
  }
  return out.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
}

/**
 * Hướng tiến bộ của một học viên.
 *
 * ĐO TRÊN CÙNG MỘT CÂU, không so điểm theo trình tự thời gian. Lý do: câu về
 * sau trong bài vốn khó hơn câu đầu, nên so "nửa đầu với nửa sau" sẽ khiến
 * học viên nào cũng thành "đang đi xuống" — kể cả em đang học rất tốt. Đây là
 * lỗi đã từng có trong bản dựng.
 *
 * Cách đo đúng: với mỗi câu có từ 2 lượt thu trở lên, lấy hiệu giữa lượt cuối
 * và lượt đầu. Trung bình các hiệu đó trả lời đúng câu hỏi cần trả lời —
 * "khi em thu lại, em có tốt lên không?" — và không bị nhiễu bởi độ khó.
 *
 * Trả về null khi chưa đủ dữ liệu (dưới `minLines` câu có thu lại). Thà không
 * kết luận còn hơn kết luận sai về một học viên.
 *
 * @returns {{direction:'up'|'flat'|'down', delta:number, lines:number}|null}
 */
export function progressTrend(data, minLines = 3) {
  const deltas = [];
  for (const lesson of Object.values(data?.lessons || {})) {
    for (const line of Object.values(lesson.lines || {})) {
      const takes = (line.attempts || []).filter((a) => typeof a.overall === "number");
      if (takes.length < 2) continue;
      deltas.push(takes[takes.length - 1].overall - takes[0].overall);
    }
  }
  if (deltas.length < minLines) return null;
  const delta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  return {
    direction: delta >= 4 ? "up" : delta <= -4 ? "down" : "flat",
    delta: Math.round(delta),
    lines: deltas.length,
  };
}

/**
 * Đánh giá mức cần chú ý của một học viên.
 *
 * Quy tắc cố ý đặt theo thứ tự "im lặng" trước "điểm thấp": học viên biến mất
 * là nguy cơ nghỉ thật, còn điểm thấp mà vẫn học đều thì chỉ cần đổi cách dạy.
 *
 * @param {object} row Kết quả của summarizeStudent (chưa có trường risk)
 * @returns {{level:'critical'|'warning'|'ok', reasons:string[]}}
 */
export function assessRisk(row) {
  const reasons = [];
  let level = "ok";

  if (row.daysSinceActive === null) {
    return { level: "critical", reasons: ["Chưa thu lượt nào — chưa thực sự bắt đầu học."] };
  }
  if (row.daysSinceActive >= 10) {
    level = "critical";
    reasons.push(`Đã ${row.daysSinceActive} ngày không thu câu nào.`);
  } else if (row.daysSinceActive >= 5) {
    level = "warning";
    reasons.push(`${row.daysSinceActive} ngày chưa quay lại.`);
  }

  if (row.trend?.direction === "down") {
    if (level === "ok") level = "warning";
    reasons.push(`Thu lại nhưng không tốt lên (trung bình ${row.trend.delta} điểm mỗi câu) — có thể đang nản.`);
  }

  // Thu nhiều mà không qua được: dấu hiệu bài quá khó hoặc đang nản
  if (row.attempts >= 12 && row.avgBest > 0 && row.avgBest < 55) {
    if (level === "ok") level = "warning";
    reasons.push(`Đã thu ${row.attempts} lượt nhưng điểm trung bình mới ${row.avgBest} — bài có thể quá sức.`);
  }

  // Bắt đầu lâu rồi mà gần như chưa đi được đâu
  if (row.daysSinceStart !== null && row.daysSinceStart >= 7 && row.percent < 25) {
    if (level === "ok") level = "warning";
    reasons.push(`Mở bài ${row.daysSinceStart} ngày trước nhưng mới xong ${row.percent}%.`);
  }

  if (!reasons.length) reasons.push("Đang học đều.");
  return { level, reasons };
}

/**
 * Tổng kết một học viên trên toàn bộ các bài đang theo học.
 *
 * @param {StudentFile} student
 * @param {Array<{id:string, lineIds:string[], passMark:number}>} lessonIndex
 * @param {{today?:string}} [opts]
 */
export function summarizeStudent(student, lessonIndex, opts = {}) {
  const today = opts.today || dayKey(Date.now());
  const data = student.data || {};

  let linesTotal = 0, linesDone = 0, bestSum = 0, bestCount = 0;
  let lessonsStarted = 0, lessonsCompleted = 0;
  let earliestStart = null;
  const perLesson = [];

  for (const meta of lessonIndex) {
    const prog = data.lessons?.[meta.id];
    if (!prog) continue;
    lessonsStarted++;
    if (prog.completedAt) lessonsCompleted++;
    if (prog.startedAt && (!earliestStart || prog.startedAt < earliestStart)) earliestStart = prog.startedAt;

    let done = 0, sum = 0, n = 0;
    for (const lineId of meta.lineIds) {
      const best = prog.lines?.[lineId]?.best;
      if (best === undefined || best === null) continue;
      n++; sum += best;
      if (best >= meta.passMark) done++;
    }
    linesTotal += meta.lineIds.length;
    linesDone += done;
    bestSum += sum; bestCount += n;
    perLesson.push({
      lessonId: meta.id,
      total: meta.lineIds.length,
      attempted: n,
      done,
      avg: n ? Math.round(sum / n) : 0,
      percent: meta.lineIds.length ? Math.round((done / meta.lineIds.length) * 100) : 0,
      completed: Boolean(prog.completedAt),
    });
  }

  const last = lastActiveDay(data);
  const row = {
    name: student.name || data.profile?.name || "(chưa đặt tên)",
    lessonsStarted,
    lessonsCompleted,
    linesTotal,
    linesDone,
    percent: linesTotal ? Math.round((linesDone / linesTotal) * 100) : 0,
    avgBest: bestCount ? Math.round(bestSum / bestCount) : 0,
    attempts: data.totals?.attempts || 0,
    minutesSpoken: Math.round((data.totals?.recordedSec || 0) / 60),
    streak: data.streak?.count || 0,
    lastActive: last,
    daysSinceActive: last ? daysBetween(last, today) : null,
    daysSinceStart: earliestStart ? daysBetween(dayKey(earliestStart), today) : null,
    trend: progressTrend(data),
    perLesson,
  };
  row.risk = assessRisk(row);
  return row;
}

/**
 * Câu nào cả lớp cùng sai.
 *
 * Đây là bảng quan trọng nhất với giáo viên: nó biến "lớp nói chưa tốt" thành
 * "câu số 11 có 5/6 em chưa qua, vì cụm 'picking me up' nối âm khó" — một thứ
 * dạy được trong 5 phút đầu buổi sau.
 *
 * Chỉ tính những câu có ít nhất `minStudents` học viên đã thu, để một em yếu
 * không kéo cả bảng thành báo động giả.
 *
 * @param {StudentFile[]} students
 * @param {object[]} lessons Bài học đã chuẩn hoá (có lines, scoring.passMark)
 * @param {{minStudents?:number}} [opts]
 */
export function classBottlenecks(students, lessons, opts = {}) {
  const minStudents = opts.minStudents ?? 2;
  const rows = [];

  for (const lesson of lessons) {
    const passMark = lesson.scoring?.passMark ?? 70;
    for (const line of lesson.lines) {
      let attemptedBy = 0, failedBy = 0, sum = 0, attemptTotal = 0;
      for (const s of students) {
        const rec = s.data?.lessons?.[lesson.id]?.lines?.[line.id];
        const best = rec?.best;
        if (best === undefined || best === null) continue;
        attemptedBy++;
        sum += best;
        attemptTotal += (rec.attempts || []).length;
        if (best < passMark) failedBy++;
      }
      if (attemptedBy < minStudents) continue;
      rows.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lineId: line.id,
        text: line.text,
        speaker: line.speaker,
        start: line.start,
        keywords: line.keywords || [],
        notes: line.notes || "",
        attemptedBy,
        failedBy,
        failRate: Math.round((failedBy / attemptedBy) * 100),
        avgBest: Math.round(sum / attemptedBy),
        avgAttempts: Number((attemptTotal / attemptedBy).toFixed(1)),
      });
    }
  }

  // Xếp theo mức độ đáng dạy lại: nhiều em sai trước, rồi tới điểm thấp
  return rows.sort((a, b) =>
    (b.failedBy - a.failedBy) || (a.avgBest - b.avgBest) || (b.avgAttempts - a.avgAttempts));
}

/**
 * Từ nào cả lớp cùng chưa thuộc — lấy từ các câu đang là điểm nghẽn.
 * @param {ReturnType<typeof classBottlenecks>} bottlenecks
 */
export function classWeakPhrases(bottlenecks, limit = 8) {
  const tally = new Map();
  for (const b of bottlenecks) {
    for (const kw of b.keywords) {
      const cur = tally.get(kw) || { text: kw, students: 0, lines: 0 };
      cur.students += b.failedBy;
      cur.lines += 1;
      tally.set(kw, cur);
    }
  }
  return [...tally.values()].sort((a, b) => b.students - a.students).slice(0, limit);
}

/** Tổng quan cả lớp cho dải chỉ số trên đầu bảng. */
export function classStats(rows) {
  const n = rows.length;
  if (!n) {
    return { students: 0, avgPercent: 0, avgScore: 0, minutesSpoken: 0, attempts: 0, needAttention: 0, activeThisWeek: 0 };
  }
  const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
  return {
    students: n,
    avgPercent: Math.round(sum((r) => r.percent) / n),
    avgScore: Math.round(sum((r) => r.avgBest) / n),
    minutesSpoken: sum((r) => r.minutesSpoken),
    attempts: sum((r) => r.attempts),
    needAttention: rows.filter((r) => r.risk.level !== "ok").length,
    activeThisWeek: rows.filter((r) => r.daysSinceActive !== null && r.daysSinceActive <= 7).length,
  };
}

/**
 * Chuỗi điểm theo thời gian của một học viên, để vẽ đường xu hướng.
 * Gộp theo ngày (lấy điểm cao nhất trong ngày) để đường không bị răng cưa vì
 * những lượt thu nháp.
 */
export function scoreSeries(data, lessonId = null) {
  const byDay = new Map();
  for (const a of allAttempts(data, lessonId)) {
    if (typeof a.overall !== "number") continue;
    const d = dayKey(a.at);
    byDay.set(d, Math.max(byDay.get(d) ?? 0, a.overall));
  }
  return [...byDay.entries()].sort().map(([day, score]) => ({ day, score }));
}

/** Các câu yếu nhất của riêng một học viên. */
export function weakLinesFor(student, lessons, limit = 6) {
  const out = [];
  for (const lesson of lessons) {
    const passMark = lesson.scoring?.passMark ?? 70;
    for (const line of lesson.lines) {
      const best = student.data?.lessons?.[lesson.id]?.lines?.[line.id]?.best;
      if (best === undefined || best === null || best >= passMark) continue;
      out.push({ lessonId: lesson.id, lineId: line.id, text: line.text, best, keywords: line.keywords || [] });
    }
  }
  return out.sort((a, b) => a.best - b.best).slice(0, limit);
}

/**
 * Đọc một tệp tiến độ học viên và kiểm tra sơ bộ.
 * @param {string} text Nội dung tệp JSON
 * @param {string} fallbackName Tên tệp, dùng khi học viên chưa đặt tên
 * @returns {{ok:true, student:StudentFile}|{ok:false, error:string}}
 */
export function parseStudentFile(text, fallbackName = "") {
  let data;
  try { data = JSON.parse(text); }
  catch { return { ok: false, error: "Tệp không phải JSON hợp lệ." }; }
  if (!data || typeof data !== "object" || !data.lessons) {
    return { ok: false, error: "Không phải tệp tiến độ của Film Shadowing (thiếu mục lessons)." };
  }
  const name = (data.profile?.name || "").trim()
    || fallbackName.replace(/\.json$/i, "").replace(/^tien-do-/, "").trim()
    || "(chưa đặt tên)";
  return { ok: true, student: { name, data } };
}
