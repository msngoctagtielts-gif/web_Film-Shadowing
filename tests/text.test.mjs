import { describe, it, expect } from "./harness.mjs";
import {
  normalizeText, tokenize, phoneticKey, wordSimilarity,
  findPhraseSpan, syllableCount, countFillers, charSimilarity,
} from "../assets/js/core/text.js";

describe("Chuẩn hoá văn bản", () => {
  it("bỏ dấu câu và hạ chữ thường", () => {
    expect(normalizeText("Hello, World!")).toBe("hello world");
  });
  it("giữ dấu nháy trong từ", () => {
    expect(normalizeText("I don't know")).toBe("i don't know");
  });
  it("đổi dấu nháy cong thành nháy thẳng", () => {
    expect(normalizeText("don’t")).toBe("don't");
  });
  it("trả chuỗi rỗng khi đầu vào rỗng hoặc null", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText(null)).toBe("");
  });
});

describe("Tách từ", () => {
  it("bung dạng nói tắt thành nhiều từ", () => {
    expect(tokenize("I'm gonna go")).toEqual(["i'm", "going", "to", "go"]);
  });
  it("chuẩn hoá biến thể chính tả", () => {
    expect(tokenize("OK, alright")).toEqual(["okay", "all", "right"]);
  });
  it("đổi chữ số thành chữ để khớp kịch bản", () => {
    expect(tokenize("in 2 minutes")).toEqual(["in", "two", "minutes"]);
  });
  it("bỏ tiếng đệm khi chấm điểm", () => {
    expect(tokenize("um I uh think")).toEqual(["i", "think"]);
  });
  it("giữ tiếng đệm khi được yêu cầu", () => {
    expect(tokenize("um I think", { keepFillers: true })).toEqual(["um", "i", "think"]);
  });
  it("đếm được tiếng đệm", () => {
    expect(countFillers("um so uh yes")).toBe(2);
  });
});

describe("Khoá ngữ âm", () => {
  it("cho cùng khoá với cặp nguyên âm dài/ngắn", () => {
    expect(phoneticKey("ship")).toBe(phoneticKey("sheep"));
  });
  it("gộp ph thành f", () => {
    expect(phoneticKey("phone")).toContain("f");
  });
  it("không sinh khoá rỗng cho từ có chữ", () => {
    expect(phoneticKey("a").length).toBeGreaterThan(0);
  });
  it("chịu được đầu vào không phải chữ", () => {
    expect(phoneticKey("123")).toBe("");
    expect(phoneticKey(null)).toBe("");
  });
});

describe("Độ giống giữa hai từ", () => {
  it("từ trùng nhau được điểm tối đa", () => {
    expect(wordSimilarity("call", "call")).toBe(1);
  });
  it("lệch nguyên âm là gần đúng, không phải sai hẳn", () => {
    const s = wordSimilarity("sheep", "ship");
    expect(s).toBeGreaterThanOrEqual(0.7);
    expect(s).toBeLessThan(1);
  });
  it("lỗi th thành s bị hạ điểm nhưng vẫn trên mức nghe ra được", () => {
    const s = wordSimilarity("think", "sink");
    expect(s).toBeGreaterThanOrEqual(0.6);
    expect(s).toBeLessThan(0.88);
  });
  it("hai từ khác nghĩa hẳn thì điểm rất thấp", () => {
    expect(wordSimilarity("cat", "dog")).toBeLessThan(0.3);
  });
  it("không hào phóng với từ ngắn khác nhau", () => {
    expect(wordSimilarity("in", "on")).toBeLessThanOrEqual(0.6);
  });
  it("trả 0 khi một bên rỗng", () => {
    expect(wordSimilarity("", "call")).toBe(0);
  });
});

describe("Tìm cụm từ trong câu", () => {
  const toks = tokenize("Hold on, I will call you back in two minutes");
  it("tìm được cụm nhiều từ", () => {
    expect(findPhraseSpan(toks, "call you back")).toEqual({ start: 4, end: 7 });
  });
  it("tìm được cụm ở đầu câu", () => {
    expect(findPhraseSpan(toks, "hold on")).toEqual({ start: 0, end: 2 });
  });
  it("trả null khi không có cụm đó", () => {
    expect(findPhraseSpan(toks, "see you later")).toBeNull();
  });
  it("bỏ qua khác biệt hoa thường và dấu câu", () => {
    expect(findPhraseSpan(toks, "Hold on!")).toEqual({ start: 0, end: 2 });
  });
});

describe("Đếm âm tiết", () => {
  it("từ một âm tiết", () => { expect(syllableCount("call")).toBe(1); });
  it("từ nhiều âm tiết", () => { expect(syllableCount("tomorrow")).toBe(3); });
  it("bỏ đuôi e không đọc", () => { expect(syllableCount("make")).toBe(1); });
  it("từ rỗng cho 0", () => { expect(syllableCount("")).toBe(0); });
});

describe("Độ giống ký tự", () => {
  it("chuỗi rỗng coi như giống nhau", () => { expect(charSimilarity("", "")).toBe(1); });
  it("khác hoàn toàn cho 0", () => { expect(charSimilarity("abc", "xyz")).toBe(0); });
});
