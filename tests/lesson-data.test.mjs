import { describe, it, expect } from "./harness.mjs";
import { validateLesson, normalizeLesson } from "../assets/js/core/lesson-loader.js";
import { tokenize, findPhraseSpan } from "../assets/js/core/text.js";
import { estimateSeconds } from "../assets/js/core/scoring.js";
import fs from "node:fs";

const DIR = "data/lessons";
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
const lessons = files.map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")) }));

describe("Tệp bài học trong data/lessons", () => {
  it("có ít nhất một bài", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { file, data } of lessons) {
    it(`${file} — không có lỗi chặn`, () => {
      const r = validateLesson(data);
      const errs = r.issues.filter((i) => i.level === "error");
      expect(errs.map((e) => `${e.where}: ${e.message}`)).toEqual([]);
    });

    it(`${file} — mã bài trùng tên tệp`, () => {
      expect(data.id).toBe(file.replace(/\.json$/, ""));
    });

    it(`${file} — mọi cụm trọng tâm đều nằm trong câu của nó`, () => {
      for (const line of data.lines) {
        for (const kw of line.keywords || []) {
          expect(findPhraseSpan(tokenize(line.text), kw)).toBeTruthy();
        }
      }
    });

    it(`${file} — mốc thời gian tăng dần, không chồng nhau`, () => {
      const sorted = [...data.lines].sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].start).toBeGreaterThanOrEqual(sorted[i - 1].end - 0.001);
      }
    });

    it(`${file} — thời lượng mỗi câu đủ để đọc hết lời`, () => {
      for (const line of data.lines) {
        const span = line.end - line.start;
        expect(span).toBeGreaterThan(estimateSeconds(line.text) * 0.45);
      }
    });

    it(`${file} — từ vựng trỏ tới câu có thật`, () => {
      const ids = new Set(data.lines.map((l) => l.id));
      for (const v of data.vocab || []) {
        for (const lid of v.lineIds || []) expect(ids.has(lid)).toBeTruthy();
      }
    });

    it(`${file} — chuẩn hoá xong vẫn dùng được`, () => {
      const n = normalizeLesson(data);
      expect(n.lines.length).toBe(data.lines.length);
      expect(n.scoring.profile.length).toBeGreaterThan(0);
      n.lines.forEach((l) => expect(l.durationSec).toBeGreaterThan(0));
    });

    it(`${file} — nguồn của bên thứ ba phải có ghi chú quyền sử dụng`, () => {
      if (data.source?.type === "youtube") {
        expect((data.source.rightsNote || "").length).toBeGreaterThan(10);
      }
    });
  }
});

describe("Danh mục khoá học", () => {
  const catalog = JSON.parse(fs.readFileSync("data/courses.json", "utf8"));

  it("mọi bài trong danh mục đều có tệp tương ứng", () => {
    for (const course of catalog.courses) {
      for (const item of course.lessons) {
        expect(files).toContain(`${item.id}.json`);
      }
    }
  });

  it("số câu ghi trong danh mục khớp với tệp bài học", () => {
    for (const course of catalog.courses) {
      for (const item of course.lessons) {
        const found = lessons.find((l) => l.data.id === item.id);
        expect(item.lineCount).toBe(found.data.lines.length);
      }
    }
  });

  it("mọi tệp bài học đều xuất hiện trong danh mục", () => {
    const listed = catalog.courses.flatMap((c) => c.lessons.map((l) => `${l.id}.json`));
    for (const f of files) expect(listed).toContain(f);
  });
});
