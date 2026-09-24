import { describe, it, expect } from "./harness.mjs";
import {
  buildCaption, activeIndex, syllablesPerSecond, suggestRate, suggestLeadIn,
} from "../assets/js/core/karaoke.js";

const LINE = "I will call you back in two minutes.";

describe("Chia nhịp từng từ", () => {
  it("giữ đủ số từ", () => {
    expect(buildCaption(LINE, 3).words.length).toBe(8);
  });
  it("từ đầu bắt đầu ở giây 0", () => {
    expect(buildCaption(LINE, 3).words[0].start).toBe(0);
  });
  it("từ cuối kết thúc đúng ở mốc cuối câu", () => {
    const w = buildCaption(LINE, 3).words;
    expect(w[w.length - 1].end).toBe(3);
  });
  it("các từ nối tiếp nhau, không chồng lấn", () => {
    const w = buildCaption(LINE, 3).words;
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBeCloseTo(w[i - 1].end, 0.002);
  });
  it("từ nhiều âm tiết chiếm nhiều thời gian hơn từ một âm tiết", () => {
    const w = buildCaption("go tomorrow", 2).words;
    expect(w[1].end - w[1].start).toBeGreaterThan(w[0].end - w[0].start);
  });
  it("từ có dấu chấm câu được cộng thêm nhịp ngắt", () => {
    const a = buildCaption("go go", 2).words;
    const b = buildCaption("go, go", 2).words;
    expect(b[0].end - b[0].start).toBeGreaterThan(a[0].end - a[0].start);
  });
  it("câu rỗng không làm vỡ", () => {
    expect(buildCaption("", 3).words).toEqual([]);
    expect(buildCaption(null, 3).words).toEqual([]);
  });
  it("thời lượng bằng 0 vẫn trả về thời lượng tối thiểu", () => {
    expect(buildCaption("hi", 0).durationSec).toBeGreaterThan(0);
  });
});

describe("Từ nào đang được đọc", () => {
  const w = buildCaption(LINE, 3).words;

  it("trước khi câu bắt đầu thì chưa có từ nào", () => {
    expect(activeIndex(w, -0.5)).toBe(-1);
  });
  it("giữa câu trả đúng từ đang đọc", () => {
    const i = activeIndex(w, 1.5);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(w[i].start).toBeLessThanOrEqual(1.5);
    expect(w[i].end).toBeGreaterThan(1.5);
  });
  it("quá cuối câu thì dừng ở từ cuối, không vượt mảng", () => {
    expect(activeIndex(w, 99)).toBe(w.length - 1);
  });

  it("CHẠY TRƯỚC TIẾNG: có lead thì chữ sáng ở từ xa hơn", () => {
    // Đây là điểm cốt lõi — học viên phải THẤY từ trước khi tới lượt nói nó.
    expect(activeIndex(w, 1.5, 0.4)).toBeGreaterThan(activeIndex(w, 1.5, 0));
  });
  it("lead bằng 0 thì chữ đi đúng nhịp tiếng", () => {
    expect(activeIndex(w, 1.5, 0)).toBe(activeIndex(w, 1.5));
  });
  it("lead lớn vẫn không vượt quá từ cuối", () => {
    expect(activeIndex(w, 2.9, 5)).toBe(w.length - 1);
  });
  it("danh sách từ rỗng trả -1 chứ không ném lỗi", () => {
    expect(activeIndex([], 1)).toBe(-1);
    expect(activeIndex(null, 1)).toBe(-1);
  });
});

describe("Đo tốc độ câu", () => {
  it("cùng câu, thời lượng ngắn hơn thì tốc độ cao hơn", () => {
    expect(syllablesPerSecond(LINE, 1.5)).toBeGreaterThan(syllablesPerSecond(LINE, 3));
  });
  it("không chia cho 0", () => {
    expect(Number.isFinite(syllablesPerSecond(LINE, 0))).toBeTruthy();
  });
});

describe("Gợi ý tốc độ phát", () => {
  it("câu nói vừa phải thì giữ nguyên 1x", () => {
    expect(suggestRate("Hold on", 2, "starter").rate).toBe(1);
  });
  it("câu nhồi quá nhanh thì gợi ý chậm lại", () => {
    expect(suggestRate(LINE, 1.2, "starter").rate).toBeLessThan(1);
  });
  it("người mới được gợi ý chậm hơn người khá", () => {
    const s = suggestRate(LINE, 1.8, "starter").rate;
    const a = suggestRate(LINE, 1.8, "advanced").rate;
    expect(s).toBeLessThanOrEqual(a);
  });
  it("luôn kèm lý do bằng tiếng Việt", () => {
    expect(suggestRate(LINE, 1.2).reason.length).toBeGreaterThan(10);
  });
  it("không bao giờ gợi ý chậm hơn 0.5x", () => {
    expect(suggestRate(LINE, 0.4).rate).toBeGreaterThanOrEqual(0.5);
  });
});

describe("Thời gian chuẩn bị trước khi thu", () => {
  it("câu dài được cho nhiều thời gian hơn câu ngắn", () => {
    expect(suggestLeadIn(LINE)).toBeGreaterThan(suggestLeadIn("Hi"));
  });
  it("không bao giờ dưới mức tối thiểu", () => {
    expect(suggestLeadIn("Hi")).toBeGreaterThanOrEqual(2);
  });
  it("không bao giờ vượt mức tối đa", () => {
    expect(suggestLeadIn("one two three four five six seven eight nine ten eleven twelve")).toBeLessThanOrEqual(6);
  });
});

describe("Nhịp câu trong các bài học có sẵn", () => {
  it("không bài nào có câu nhanh quá sức người học", async () => {
    const fs = await import("node:fs");
    const tooFast = [];
    for (const f of fs.readdirSync("data/lessons").filter((x) => x.endsWith(".json"))) {
      const d = JSON.parse(fs.readFileSync(`data/lessons/${f}`, "utf8"));
      for (const l of d.lines) {
        const sps = syllablesPerSecond(l.text, l.end - l.start);
        if (sps > 6.5) tooFast.push(`${f} ${l.id}: ${sps} âm tiết/giây`);
      }
    }
    expect(tooFast).toEqual([]);
  });
});
