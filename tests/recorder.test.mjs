import { describe, it, expect } from "./harness.mjs";
import { analyzeEnvelope, effectiveDuration } from "../assets/js/core/recorder.js";

/** Dựng đường bao mức tín hiệu giả: mảng các mức, mỗi mẫu 50ms. */
const env = (levels) => levels.map((rms, i) => ({ t: i * 0.05, rms }));
const rep = (n, v) => Array(n).fill(v);

describe("Phân tích đường bao âm thanh", () => {
  it("lặng đầu và cuối không bị tính là ngắt giữa câu", () => {
    const m = analyzeEnvelope(env([...rep(20, 0.01), ...rep(40, 0.3), ...rep(20, 0.01)]), 4);
    expect(m.longPauses).toBe(0);
  });

  it("đếm đúng một lần ngắt dài giữa câu", () => {
    const m = analyzeEnvelope(env([...rep(20, 0.3), ...rep(20, 0.01), ...rep(20, 0.3)]), 3);
    expect(m.longPauses).toBe(1);
  });

  it("đếm đúng hai lần ngắt dài", () => {
    const m = analyzeEnvelope(env([
      ...rep(10, 0.3), ...rep(14, 0.01), ...rep(10, 0.3), ...rep(14, 0.01), ...rep(10, 0.3),
    ]), 2.9);
    expect(m.longPauses).toBe(2);
  });

  it("ngắt ngắn hơn 0,55 giây không bị tính", () => {
    const m = analyzeEnvelope(env([...rep(20, 0.3), ...rep(5, 0.01), ...rep(20, 0.3)]), 2.25);
    expect(m.longPauses).toBe(0);
  });

  it("đo được tỉ lệ thời gian có tiếng", () => {
    const m = analyzeEnvelope(env([...rep(20, 0.01), ...rep(40, 0.3), ...rep(20, 0.01)]), 4);
    expect(m.speechRatio).toBeCloseTo(0.5, 0.06);
  });

  it("đo được lặng đầu và lặng cuối", () => {
    const m = analyzeEnvelope(env([...rep(20, 0.01), ...rep(40, 0.3), ...rep(20, 0.01)]), 4);
    expect(m.leadingSilence).toBeCloseTo(1, 0.1);
    expect(m.trailingSilence).toBeCloseTo(1, 0.1);
  });

  it("phát hiện micro quá nhỏ", () => {
    expect(analyzeEnvelope(env(rep(40, 0.02)), 2).tooQuiet).toBeTruthy();
    expect(analyzeEnvelope(env([...rep(20, 0.01), ...rep(20, 0.4)]), 2).tooQuiet).toBeFalsy();
  });

  it("phát hiện tiếng bị vỡ do quá to", () => {
    expect(analyzeEnvelope(env([...rep(20, 0.2), ...rep(20, 0.99)]), 2).clipping).toBeTruthy();
  });

  it("đường bao quá ngắn trả về giá trị an toàn, không vỡ", () => {
    const m = analyzeEnvelope([], 0);
    expect(m.speechRatio).toBe(0);
    expect(m.longPauses).toBe(0);
    expect(analyzeEnvelope(null, 2).tooQuiet).toBeTruthy();
  });

  it("ngưỡng thích ứng theo từng bản thu, micro to nhỏ vẫn so được", () => {
    const quiet = analyzeEnvelope(env([...rep(20, 0.004), ...rep(40, 0.06), ...rep(20, 0.004)]), 4);
    const loud = analyzeEnvelope(env([...rep(20, 0.05), ...rep(40, 0.7), ...rep(20, 0.05)]), 4);
    expect(Math.abs(quiet.speechRatio - loud.speechRatio)).toBeLessThan(0.12);
  });
});

describe("Thời lượng nói thật", () => {
  it("cắt bỏ lặng đầu và lặng cuối", () => {
    const m = analyzeEnvelope(env([...rep(20, 0.01), ...rep(40, 0.3), ...rep(20, 0.01)]), 4);
    expect(effectiveDuration(4, m)).toBeCloseTo(2, 0.12);
  });
  it("không cắt khi kết quả còn lại quá ngắn", () => {
    const m = { leadingSilence: 1.9, trailingSilence: 1.9 };
    expect(effectiveDuration(4, m)).toBe(4);
  });
  it("không có số đo thì trả nguyên thời lượng", () => {
    expect(effectiveDuration(3.5, null)).toBe(3.5);
  });
});
