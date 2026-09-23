import { describe, it, expect } from "./harness.mjs";
import {
  parseScript, layoutTimings, suggestKeyphrases, suggestVocab, buildLinesFromScript,
} from "../assets/js/core/suggest.js";

describe("Tách kịch bản dán vào", () => {
  it("nhận dạng TÊN: lời thoại", () => {
    const r = parseScript("MAI: Hold on.\nSAM: Okay.");
    expect(r).toEqual([{ speaker: "MAI", text: "Hold on." }, { speaker: "SAM", text: "Okay." }]);
  });
  it("không có tên vai thì để trống", () => {
    expect(parseScript("Hold on.")[0].speaker).toBe("");
  });
  it("bỏ dòng trống và dòng kẻ ngang", () => {
    expect(parseScript("A: Hi\n\n-----\n\nB: Bye").length).toBe(2);
  });
  it("đọc được phụ đề .srt, bỏ số thứ tự và mốc thời gian", () => {
    const srt = "1\n00:00:12,000 --> 00:00:15,500\nExcuse me.\n\n2\n00:00:15,800 --> 00:00:18,000\nIt is delayed.";
    expect(parseScript(srt).map((l) => l.text)).toEqual(["Excuse me.", "It is delayed."]);
  });
  it("không cắt nhầm câu có dấu hai chấm giữa câu dài", () => {
    const r = parseScript("He said something very long and detailed here: really");
    expect(r[0].speaker).toBe("");
  });
  it("đầu vào rỗng trả mảng rỗng", () => {
    expect(parseScript("")).toEqual([]);
    expect(parseScript(null)).toEqual([]);
  });
});

describe("Ước lượng mốc thời gian", () => {
  it("các câu nối tiếp nhau, không chồng nhau", () => {
    const t = layoutTimings([{ text: "Hold on" }, { text: "Let me check the app" }], { startSec: 5 });
    expect(t[0].start).toBe(5);
    expect(t[1].start).toBeGreaterThanOrEqual(t[0].end);
  });
  it("câu dài hơn thì chiếm nhiều giây hơn", () => {
    const t = layoutTimings([{ text: "Hi" }, { text: "I will call you back in two minutes" }]);
    expect(t[1].end - t[1].start).toBeGreaterThan(t[0].end - t[0].start);
  });
  it("bắt đầu đúng ở giây được chỉ định", () => {
    expect(layoutTimings([{ text: "Hi" }], { startSec: 12.5 })[0].start).toBe(12.5);
  });
});

describe("Gợi ý cụm trọng tâm", () => {
  it("nhận ra cụm động từ", () => {
    expect(suggestKeyphrases("Hold on, let me check the app")).toContain("hold on");
  });
  it("nhận ra thành ngữ", () => {
    expect(suggestKeyphrases("I am not in a hurry anymore")).toContain("in a hurry");
  });
  it("không gợi ý gì khi câu không có cụm nào", () => {
    expect(suggestKeyphrases("The sky is blue today")).toEqual([]);
  });
  it("không nhồi quá hai cụm vào một câu", () => {
    expect(suggestKeyphrases("Hold on, of course I will call back right away").length).toBeLessThanOrEqual(2);
  });
  it("bỏ cụm nằm lọt trong cụm dài hơn", () => {
    const r = suggestKeyphrases("We can give you a ride");
    expect(r).toContain("give you a ride");
    expect(r.includes("a couple of")).toBeFalsy();
  });
});

describe("Gợi ý từ mới", () => {
  const lines = [
    { id: "l1", text: "The board says it is delayed again" },
    { id: "l2", text: "Every sign on this platform is delayed" },
    { id: "l3", text: "I go to the shop" },
  ];
  it("bỏ qua từ quá thông dụng", () => {
    const terms = suggestVocab(lines).map((v) => v.term);
    ["the", "is", "it", "i", "go", "to"].forEach((w) => expect(terms.includes(w)).toBeFalsy());
  });
  it("ưu tiên từ lặp lại nhiều lần", () => {
    expect(suggestVocab(lines)[0].term).toBe("delayed");
  });
  it("ghi lại câu chứa từ đó", () => {
    const v = suggestVocab(lines).find((x) => x.term === "delayed");
    expect(v.lineIds.length).toBe(2);
  });
  it("tôn trọng số lượng tối đa", () => {
    expect(suggestVocab(lines, 2).length).toBeLessThanOrEqual(2);
  });
});

describe("Dựng câu thoại từ kịch bản", () => {
  const script = "MAI: Hold on, let me check the app.\nSAM: Is there a bus I can take instead?\nMAI: I am in a hurry.";

  it("tạo đủ số dòng", () => {
    expect(buildLinesFromScript(script).lines.length).toBe(3);
  });
  it("mã câu không trùng nhau", () => {
    const ids = buildLinesFromScript(script).lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(3);
  });
  it("giữ đúng tên vai trong kịch bản", () => {
    expect(buildLinesFromScript(script).lines.map((l) => l.speaker)).toEqual(["MAI", "SAM", "MAI"]);
  });
  it("không có tên vai thì tự đặt A và B xen kẽ", () => {
    const r = buildLinesFromScript("One line here\nAnother line here");
    expect(r.lines.map((l) => l.speaker)).toEqual(["A", "B"]);
  });
  it("gắn sẵn cụm trọng tâm nhận ra được", () => {
    const r = buildLinesFromScript(script);
    expect(r.lines[0].keywords).toContain("hold on");
  });
  it("mốc thời gian hợp lệ, kết thúc sau bắt đầu", () => {
    buildLinesFromScript(script).lines.forEach((l) => expect(l.end).toBeGreaterThan(l.start));
  });
  it("luôn nhắc rằng mốc thời gian mới là ước lượng", () => {
    expect(buildLinesFromScript(script).warnings.join(" ")).toContain("ước lượng");
  });
  it("kịch bản rỗng báo lỗi thay vì tạo bài rỗng", () => {
    const r = buildLinesFromScript("   ");
    expect(r.lines).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("kết quả dựng được vượt qua bộ kiểm tra bài học", async () => {
    const { validateLesson } = await import("../assets/js/core/lesson-loader.js");
    const r = buildLinesFromScript(script);
    const lesson = { id: "x", title: "T", source: { type: "tts" }, lines: r.lines, vocab: [] };
    const errs = validateLesson(lesson).issues.filter((i) => i.level === "error");
    expect(errs.map((e) => e.message)).toEqual([]);
  });
});
