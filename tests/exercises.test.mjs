import { describe, it, expect } from "./harness.mjs";
import {
  generateExercises, exerciseCoverage, checkAnswer, summarizeQuiz,
  seededRandom, shuffle, EXERCISE_LABELS,
} from "../assets/js/core/exercises.js";
import { normalizeLesson } from "../assets/js/core/lesson-loader.js";
import fs from "node:fs";

const LESSON = normalizeLesson(JSON.parse(
  fs.readFileSync("data/lessons/demo-doan-thoai-ga-tau.json", "utf8")));

describe("Bộ sinh ngẫu nhiên có hạt giống", () => {
  it("cùng hạt giống cho cùng kết quả", () => {
    const a = seededRandom(42), b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("khác hạt giống cho kết quả khác", () => {
    expect(seededRandom(1)() === seededRandom(2)()).toBeFalsy();
  });
  it("xáo trộn không làm mất phần tử nào", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, seededRandom(3));
    expect(out.length).toBe(5);
    expect([...out].sort().join()).toBe("1,2,3,4,5");
  });
  it("xáo trộn không sửa mảng gốc", () => {
    const src = [1, 2, 3];
    shuffle(src, seededRandom(5));
    expect(src).toEqual([1, 2, 3]);
  });
});

describe("Sinh đề từ kịch bản", () => {
  it("bài mẫu sinh được cả năm dạng", () => {
    const cov = exerciseCoverage(LESSON);
    for (const t of Object.keys(EXERCISE_LABELS)) {
      expect(cov[t]).toBeGreaterThan(0);
    }
  });

  it("cùng hạt giống ra cùng bộ đề", () => {
    const a = generateExercises(LESSON, { seed: 9, limit: 8 });
    const b = generateExercises(LESSON, { seed: 9, limit: 8 });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it("tôn trọng số câu tối đa", () => {
    expect(generateExercises(LESSON, { limit: 5 }).length).toBe(5);
  });

  it("trộn xen kẽ các dạng, không dồn một dạng liền nhau", () => {
    const ex = generateExercises(LESSON, { limit: 10, seed: 4 });
    let maxRun = 1, run = 1;
    for (let i = 1; i < ex.length; i++) {
      run = ex[i].type === ex[i - 1].type ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it("mọi câu đều có đáp án nằm trong các phương án", () => {
    for (const ex of generateExercises(LESSON, { limit: 30, seed: 11 })) {
      if (ex.options) expect(ex.options).toContain(ex.answer);
    }
  });

  it("mỗi câu trắc nghiệm có đúng bốn phương án khác nhau", () => {
    for (const ex of generateExercises(LESSON, { limit: 30, seed: 12 })) {
      if (!ex.options) continue;
      expect(ex.options.length).toBe(4);
      expect(new Set(ex.options).size).toBe(4);
    }
  });

  it("bài sắp xếp chỉ dùng câu đơn, không ghép hai câu", () => {
    // Gộp "That is fine." với "I am not in a hurry anymore." sẽ ra đáp án sai
    // ngữ pháp và dạy nhầm học viên.
    for (const ex of generateExercises(LESSON, { limit: 40, seed: 7, types: ["order"] })) {
      expect(/[.!?]\s+\S/.test(ex.answer)).toBeFalsy();
    }
  });

  it("bài sắp xếp có đủ các mảnh để ghép lại thành đáp án", () => {
    for (const ex of generateExercises(LESSON, { limit: 40, seed: 8, types: ["order"] })) {
      expect([...ex.tiles].sort().join(" ")).toBe([...ex.answer.split(" ")].sort().join(" "));
    }
  });

  it("bài điền chỗ trống thật sự có chỗ trống", () => {
    for (const ex of generateExercises(LESSON, { limit: 40, seed: 2, types: ["gap"] })) {
      expect(ex.prompt).toContain("______");
    }
  });

  it("lọc được theo câu đang học", () => {
    const ids = ["l1", "l2", "l3"];
    const ex = generateExercises(LESSON, { limit: 20, seed: 5, lineIds: ids, types: ["listen"] });
    ex.forEach((e) => expect(ids).toContain(e.lineId));
  });

  it("bài rỗng không làm vỡ, trả mảng rỗng", () => {
    expect(generateExercises({ lines: [], vocab: [] })).toEqual([]);
    expect(generateExercises({})).toEqual([]);
  });

  it("bài chỉ có một câu vẫn không ném lỗi", () => {
    const tiny = normalizeLesson({
      id: "t", source: { type: "tts" }, scoring: {},
      lines: [{ id: "a", text: "Hold on please", textVi: "Chờ chút", start: 0, end: 2, keywords: ["hold on"] }],
    });
    expect(generateExercises(tiny).length).toBeGreaterThanOrEqual(0);
  });

  it("mọi câu đều có câu hỏi bằng tiếng Việt", () => {
    for (const ex of generateExercises(LESSON, { limit: 20, seed: 6 })) {
      expect(ex.question.length).toBeGreaterThan(5);
    }
  });
});

describe("Chấm bài tập", () => {
  const ex = { answer: "hold on" };
  it("đúng y nguyên thì tính đúng", () => { expect(checkAnswer(ex, "hold on")).toBeTruthy(); });
  it("khác hoa thường vẫn tính đúng", () => { expect(checkAnswer(ex, "Hold On")).toBeTruthy(); });
  it("thừa dấu câu vẫn tính đúng", () => { expect(checkAnswer(ex, "Hold on,")).toBeTruthy(); });
  it("sai thì tính sai", () => { expect(checkAnswer(ex, "hang on")).toBeFalsy(); });
  it("bỏ trống tính sai, không ném lỗi", () => {
    expect(checkAnswer(ex, null)).toBeFalsy();
    expect(checkAnswer(ex, "")).toBeFalsy();
  });
});

describe("Tổng kết lượt làm bài", () => {
  const results = [
    { type: "match", correct: true }, { type: "match", correct: true },
    { type: "listen", correct: false }, { type: "listen", correct: false },
    { type: "gap", correct: true },
  ];
  it("đếm đúng số câu đúng và phần trăm", () => {
    const s = summarizeQuiz(results);
    expect(s.right).toBe(3);
    expect(s.total).toBe(5);
    expect(s.percent).toBe(60);
  });
  it("chỉ ra dạng yếu nhất", () => {
    expect(summarizeQuiz(results).weakestType).toBe("listen");
  });
  it("làm tốt hết thì không chỉ ra dạng yếu nào", () => {
    expect(summarizeQuiz([{ type: "match", correct: true }, { type: "match", correct: true }]).weakestType).toBeNull();
  });
  it("chưa làm câu nào thì không chia cho 0", () => {
    expect(summarizeQuiz([]).percent).toBe(0);
  });
});
