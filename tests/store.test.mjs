import { describe, it, expect, stubLocalStorage } from "./harness.mjs";

const clear = stubLocalStorage();
const { store } = await import("../assets/js/core/store.js");
const srs = await import("../assets/js/core/srs.js");

describe("Lưu tiến độ học", () => {
  it("chỉ giữ điểm cao nhất của một câu", () => {
    store.reset();
    store.saveAttempt("bai1", "l1", { overall: 64, parts: {}, heardText: "", mode: "asr", durationSec: 2 });
    store.saveAttempt("bai1", "l1", { overall: 88, parts: {}, heardText: "", mode: "asr", durationSec: 2 });
    store.saveAttempt("bai1", "l1", { overall: 71, parts: {}, heardText: "", mode: "asr", durationSec: 2 });
    expect(store.lesson("bai1").lines.l1.best).toBe(88);
  });

  it("giữ lại lịch sử các lượt thu", () => {
    expect(store.lesson("bai1").lines.l1.attempts.length).toBe(3);
  });

  it("không giữ quá 8 lượt cho một câu", () => {
    store.reset();
    for (let i = 0; i < 14; i++) {
      store.saveAttempt("bai1", "l1", { overall: 50 + i, parts: {}, heardText: "", mode: "asr", durationSec: 1 });
    }
    expect(store.lesson("bai1").lines.l1.attempts.length).toBe(8);
    expect(store.lesson("bai1").lines.l1.best).toBe(63);
  });

  it("tổng kết đúng số câu đạt và phần trăm", () => {
    store.reset();
    store.saveAttempt("bai1", "l1", { overall: 85, parts: {}, heardText: "", mode: "asr", durationSec: 2 });
    store.saveAttempt("bai1", "l2", { overall: 40, parts: {}, heardText: "", mode: "asr", durationSec: 2 });
    const s = store.summary("bai1", ["l1", "l2", "l3", "l4"], 70);
    expect(s.done).toBe(1);
    expect(s.attempted).toBe(2);
    expect(s.percent).toBe(25);
    expect(s.completed).toBeFalsy();
  });

  it("bài chưa thu câu nào cho tổng kết bằng 0, không vỡ", () => {
    store.reset();
    const s = store.summary("chua-hoc", ["l1", "l2"], 70);
    expect(s.avg).toBe(0);
    expect(s.percent).toBe(0);
  });

  it("đánh dấu hoàn thành khi mọi câu đều đạt", () => {
    store.reset();
    ["l1", "l2"].forEach((id) =>
      store.saveAttempt("bai2", id, { overall: 90, parts: {}, heardText: "", mode: "asr", durationSec: 2 }));
    expect(store.summary("bai2", ["l1", "l2"], 70).completed).toBeTruthy();
  });

  it("đếm chuỗi ngày học", () => {
    store.reset();
    store.saveAttempt("bai1", "l1", { overall: 80, parts: {}, heardText: "", mode: "asr", durationSec: 2 });
    expect(store.streak().count).toBe(1);
  });

  it("cộng dồn tổng số lượt và số giây đã nói", () => {
    store.reset();
    store.saveAttempt("bai1", "l1", { overall: 80, parts: {}, heardText: "", mode: "asr", durationSec: 2.5 });
    store.saveAttempt("bai1", "l2", { overall: 80, parts: {}, heardText: "", mode: "asr", durationSec: 1.5 });
    expect(store.totals().attempts).toBe(2);
    expect(store.totals().recordedSec).toBeCloseTo(4, 0.01);
  });

  it("xuất rồi nhập lại giữ nguyên dữ liệu", () => {
    store.reset();
    store.saveAttempt("bai1", "l1", { overall: 77, parts: {}, heardText: "hi", mode: "asr", durationSec: 2 });
    const dump = store.exportJson();
    store.reset();
    expect(store.lesson("bai1").lines.l1).toBe(undefined);
    expect(store.importJson(dump)).toBeTruthy();
    expect(store.lesson("bai1").lines.l1.best).toBe(77);
  });

  it("từ chối tệp nhập không đúng định dạng", () => {
    expect(store.importJson("{{ hỏng")).toBeFalsy();
    expect(store.importJson('{"khong":"dung"}')).toBeFalsy();
  });

  it("dữ liệu hỏng trong localStorage không làm vỡ ứng dụng", () => {
    localStorage.setItem("film-shadowing:v1", "{ hỏng");
    expect(store.all().lessons).toEqual({});
  });

  it("ghi nhớ thiết lập của học viên", () => {
    store.reset();
    store.setSettings({ rate: 0.75, asrEnabled: true });
    expect(store.getSettings().rate).toBe(0.75);
    expect(store.getSettings().asrEnabled).toBeTruthy();
  });
});

describe("Lịch ôn từ vựng", () => {
  it("thẻ mới luôn đến hạn ngay", () => {
    srs.resetSrs();
    expect(srs.dueCards(["a", "b"])).toEqual(["a", "b"]);
  });
  it("trả lời đúng thì thẻ được đẩy sang ngày sau", () => {
    srs.resetSrs();
    srs.review("a", "good");
    expect(srs.dueCards(["a"])).toEqual([]);
  });
  it("trả lời sai thì thẻ quay lại ngay hôm nay", () => {
    srs.resetSrs();
    srs.review("a", "good");
    srs.review("a", "again");
    expect(srs.dueCards(["a"])).toEqual(["a"]);
  });
  it("biết rồi thì giãn nhanh hơn đã hiểu", () => {
    srs.resetSrs();
    srs.review("x", "good");
    srs.review("y", "easy");
    expect(srs.cardState("y").step).toBeGreaterThan(srs.cardState("x").step);
  });
  it("thống kê đếm đúng thẻ đã vững và thẻ chưa học", () => {
    srs.resetSrs();
    ["a", "b", "c"].forEach(() => {});
    for (let i = 0; i < 4; i++) srs.review("a", "good");
    const s = srs.srsStats(["a", "b", "c"]);
    expect(s.total).toBe(3);
    expect(s.learned).toBe(1);
    expect(s.fresh).toBe(2);
  });
});

clear();
