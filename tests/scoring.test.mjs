import { describe, it, expect } from "./harness.mjs";
import {
  alignTokens, verdictOf, scoreAccuracy, scoreCompleteness, scoreKeywords,
  scorePacing, band, diagnosePair, gradeAttempt, estimateSeconds, PROFILES, SIM_GOOD,
} from "../assets/js/core/scoring.js";
import { tokenize } from "../assets/js/core/text.js";

const REF = "I will call you back in two minutes";

describe("Gióng hàng hai chuỗi từ", () => {
  it("câu trùng khớp cho toàn bộ là match", () => {
    const ops = alignTokens(tokenize(REF), tokenize(REF));
    expect(ops.every((o) => o.type === "match")).toBeTruthy();
    expect(ops.length).toBe(8);
  });
  it("từ bị bỏ thành phép xoá", () => {
    const ops = alignTokens(tokenize("call you back"), tokenize("call back"));
    expect(ops.filter((o) => o.type === "del").map((o) => o.ref)).toEqual(["you"]);
  });
  it("từ nói thêm thành phép chèn", () => {
    const ops = alignTokens(tokenize("call back"), tokenize("call me back"));
    expect(ops.filter((o) => o.type === "ins").map((o) => o.hyp)).toEqual(["me"]);
  });
  it("lệch âm nhẹ thành phép thay, không phải xoá", () => {
    const ops = alignTokens(tokenize("two minutes"), tokenize("two minute"));
    expect(ops.filter((o) => o.type === "del").length).toBe(0);
    expect(ops.filter((o) => o.type === "sub").length).toBe(1);
  });
  it("chuỗi rỗng bên nghe được cho toàn bộ là xoá", () => {
    const ops = alignTokens(tokenize("call me"), []);
    expect(ops.every((o) => o.type === "del")).toBeTruthy();
  });
  it("giữ đúng thứ tự câu mẫu", () => {
    const ops = alignTokens(tokenize("a b c"), tokenize("a x c"));
    expect(ops.map((o) => o.ref ?? o.hyp)).toEqual(["a", "b", "c"]);
  });
});

describe("Nhãn từng từ", () => {
  it("trùng khớp là đúng", () => {
    expect(verdictOf({ type: "match", sim: 1 })).toBe("good");
  });
  it("gần đúng là cảnh báo", () => {
    expect(verdictOf({ type: "sub", sim: 0.75 })).toBe("warn");
  });
  it("lệch nhiều là chưa nghe ra", () => {
    expect(verdictOf({ type: "sub", sim: 0.2 })).toBe("miss");
  });
  it("từ bỏ là chưa nghe ra", () => {
    expect(verdictOf({ type: "del", sim: 0 })).toBe("miss");
  });
  it("từ thêm là nói thêm", () => {
    expect(verdictOf({ type: "ins", sim: 0 })).toBe("extra");
  });
});

describe("Điểm chính xác và đầy đủ", () => {
  const ref = tokenize(REF);
  it("đọc đúng cả câu được 100", () => {
    const ops = alignTokens(ref, tokenize(REF));
    expect(scoreAccuracy(ops, ref.length)).toBe(100);
    expect(scoreCompleteness(ops, ref.length)).toBe(100);
  });
  it("bỏ một từ thì đầy đủ giảm đúng tỉ lệ", () => {
    const ops = alignTokens(ref, tokenize("I will call you back in two"));
    expect(scoreCompleteness(ops, ref.length)).toBeCloseTo(87.5, 0.1);
  });
  it("không nói gì thì cả hai bằng 0", () => {
    const ops = alignTokens(ref, []);
    expect(scoreAccuracy(ops, ref.length)).toBe(0);
    expect(scoreCompleteness(ops, ref.length)).toBe(0);
  });
  it("câu mẫu rỗng không làm vỡ phép chia", () => {
    expect(scoreAccuracy([], 0)).toBe(0);
    expect(scoreCompleteness([], 0)).toBe(0);
  });
  it("nói thêm nhiều từ bị trừ điểm chính xác", () => {
    const ops = alignTokens(ref, tokenize(REF + " and also please hurry up now"));
    expect(scoreAccuracy(ops, ref.length)).toBeLessThan(100);
  });
});

describe("Điểm cụm trọng tâm", () => {
  const ref = tokenize(REF);
  it("đọc đúng cụm được điểm tối đa", () => {
    const ops = alignTokens(ref, tokenize(REF));
    expect(scoreKeywords(ref, ops, ["call you back"]).score).toBe(100);
  });
  it("mất một từ trong cụm thì cụm bị đánh trượt", () => {
    const ops = alignTokens(ref, tokenize("I will call back in two minutes"));
    const r = scoreKeywords(ref, ops, ["call you back"]);
    expect(r.score).toBeLessThan(70);
    expect(r.details[0].hit).toBeFalsy();
  });
  it("không khai báo cụm nào thì trả null để không tính vào điểm tổng", () => {
    const ops = alignTokens(ref, tokenize(REF));
    expect(scoreKeywords(ref, ops, []).score).toBeNull();
  });
  it("cụm không có trong kịch bản bị đánh dấu riêng", () => {
    const ops = alignTokens(ref, tokenize(REF));
    const r = scoreKeywords(ref, ops, ["see you later"]);
    expect(r.details[0].missingInScript).toBeTruthy();
    expect(r.score).toBeNull();
  });
});

describe("Điểm nhịp và tốc độ", () => {
  it("đúng nhịp bản mẫu được điểm cao", () => {
    expect(scorePacing({ userSec: 3, refSec: 3, longPauses: 0, speechRatio: 0.8 })).toBe(100);
  });
  it("nói nhanh gấp đôi bị trừ nặng", () => {
    expect(scorePacing({ userSec: 1.5, refSec: 3 })).toBeLessThan(60);
  });
  it("nói chậm gấp đôi bị trừ", () => {
    expect(scorePacing({ userSec: 6, refSec: 3 })).toBeLessThan(90);
  });
  it("lệch trong khoảng chấp nhận được thì không trừ", () => {
    expect(scorePacing({ userSec: 3.6, refSec: 3 })).toBe(100);
  });
  it("mỗi lần ngắt dài đều bị trừ", () => {
    const a = scorePacing({ userSec: 3, refSec: 3, longPauses: 0 });
    const b = scorePacing({ userSec: 3, refSec: 3, longPauses: 2 });
    expect(b).toBeLessThan(a);
  });
  it("thiếu dữ liệu thì trả 0 thay vì NaN", () => {
    expect(scorePacing({ userSec: 0, refSec: 3 })).toBe(0);
    expect(scorePacing({ userSec: 3, refSec: 0 })).toBe(0);
  });
  it("không bao giờ vượt khoảng 0–100", () => {
    expect(scorePacing({ userSec: 0.1, refSec: 10, longPauses: 9 })).toBeGreaterThanOrEqual(0);
    expect(scorePacing({ userSec: 3, refSec: 3, speechRatio: 1 })).toBeLessThanOrEqual(100);
  });
});

describe("Xếp hạng", () => {
  it("phủ hết dải điểm", () => {
    expect(band(95).key).toBe("excellent");
    expect(band(80).key).toBe("good");
    expect(band(65).key).toBe("fair");
    expect(band(45).key).toBe("weak");
    expect(band(10).key).toBe("retry");
  });
  it("mọi hạng đều có nhãn tiếng Việt", () => {
    [95, 80, 65, 45, 10].forEach((s) => expect(band(s).label.length).toBeGreaterThan(0));
  });
});

describe("Chẩn đoán lỗi âm", () => {
  it("nhận ra rơi âm cuối s", () => {
    expect(diagnosePair("minutes", "minute").key).toBe("final-s");
  });
  it("nhận ra rơi âm cuối ed", () => {
    expect(diagnosePair("delayed", "delay").key).toBe("final-ed");
  });
  it("nhận ra lỗi th thành s", () => {
    expect(diagnosePair("think", "sink").key).toBe("th");
  });
  it("không báo lỗi khi hai từ giống nhau", () => {
    expect(diagnosePair("call", "call")).toBeNull();
  });
  it("chịu được đầu vào rỗng", () => {
    expect(diagnosePair("", "call")).toBeNull();
  });
});

describe("Chấm một lượt thu", () => {
  const base = { refText: REF, keywords: ["call you back"], refSec: 3, userSec: 3, profile: "standard" };

  it("đọc đúng, đúng nhịp thì gần như tuyệt đối", () => {
    const r = gradeAttempt({ ...base, hypText: REF });
    expect(r.overall).toBeGreaterThanOrEqual(95);
    expect(r.band.key).toBe("excellent");
  });

  it("im lặng thì 0 điểm và không ăn điểm nhịp", () => {
    const r = gradeAttempt({ ...base, hypText: "" });
    expect(r.overall).toBe(0);
    expect(r.mode).toBe("no-speech");
    expect(r.parts.pacing).toBeNull();
    expect(r.advice[0].key).toBe("no-speech");
  });

  it("đọc được vài từ thì không ăn điểm nhịp", () => {
    const r = gradeAttempt({ ...base, hypText: "call" });
    expect(r.parts.pacing).toBeNull();
    expect(r.overall).toBeLessThan(50);
  });

  it("nói câu hoàn toàn khác thì bị đánh trượt", () => {
    const r = gradeAttempt({ ...base, hypText: "the weather is nice today" });
    expect(r.overall).toBeLessThan(45);
  });

  it("chỉ rơi âm cuối thì vẫn đạt nhưng có góp ý cụ thể", () => {
    const r = gradeAttempt({ ...base, hypText: "I will call you back in two minute" });
    expect(r.overall).toBeGreaterThanOrEqual(70);
    expect(r.advice.some((a) => a.key.includes("final-s"))).toBeTruthy();
  });

  it("mất cụm trọng tâm thì góp ý đầu tiên nói về cụm đó", () => {
    const r = gradeAttempt({ ...base, hypText: "I will ring you later in two minutes" });
    expect(r.advice[0].key).toBe("keywords");
  });

  it("nói quá nhanh bị nhắc về tốc độ", () => {
    const r = gradeAttempt({ ...base, hypText: REF, userSec: 1.2 });
    expect(r.advice.some((a) => a.key === "too-fast")).toBeTruthy();
    expect(r.parts.pacing).toBeLessThan(60);
  });

  it("ngắt vụn giữa câu bị nhắc", () => {
    const r = gradeAttempt({ ...base, hypText: REF, longPauses: 3 });
    expect(r.advice.some((a) => a.key === "pauses")).toBeTruthy();
  });

  it("chấm được cả khi không có dữ liệu thời lượng", () => {
    const r = gradeAttempt({ refText: REF, hypText: REF, refSec: 0, userSec: 0 });
    expect(r.parts.pacing).toBeNull();
    expect(r.overall).toBeGreaterThan(90);
  });

  it("luôn trả về nhãn cho từng từ trong câu mẫu", () => {
    const r = gradeAttempt({ ...base, hypText: "I will call you back" });
    expect(r.words.length).toBeGreaterThanOrEqual(tokenize(REF).length);
    r.words.forEach((w) => expect(["good", "warn", "miss", "extra"]).toContain(w.verdict));
  });

  it("không bao giờ cho điểm ngoài khoảng 0–100", () => {
    const cases = ["", REF, REF + " " + REF, "x", "a b c d e f g h i j k"];
    for (const h of cases) {
      const r = gradeAttempt({ ...base, hypText: h });
      expect(r.overall).toBeGreaterThanOrEqual(0);
      expect(r.overall).toBeLessThanOrEqual(100);
    }
  });

  it("bộ trọng số starter dễ hơn advanced với cùng lượt thu chậm", () => {
    const slow = { ...base, hypText: REF, userSec: 6 };
    const s = gradeAttempt({ ...slow, profile: "starter" }).overall;
    const a = gradeAttempt({ ...slow, profile: "advanced" }).overall;
    expect(s).toBeGreaterThan(a);
  });

  it("mỗi bộ trọng số có tổng bằng 1", () => {
    for (const [name, w] of Object.entries(PROFILES)) {
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1) < 0.001).toBeTruthy();
    }
  });

  it("góp ý không bao giờ rỗng", () => {
    ["", REF, "call you back", "something else entirely"].forEach((h) => {
      expect(gradeAttempt({ ...base, hypText: h }).advice.length).toBeGreaterThan(0);
    });
  });

  it("tối đa 5 góp ý để học viên không bị ngợp", () => {
    const r = gradeAttempt({ ...base, hypText: "um uh I wanna ring ya back in to minute", userSec: 8, longPauses: 4 });
    expect(r.advice.length).toBeLessThanOrEqual(5);
  });
});

describe("Ước lượng thời lượng câu", () => {
  it("câu dài hơn thì thời lượng lớn hơn", () => {
    expect(estimateSeconds("I will call you back in two minutes"))
      .toBeGreaterThan(estimateSeconds("Hold on"));
  });
  it("câu rất ngắn vẫn có thời lượng tối thiểu", () => {
    expect(estimateSeconds("Hi")).toBeGreaterThanOrEqual(0.8);
  });
});
