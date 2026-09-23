# 03 — Thiết kế sư phạm

*Vì sao bài học có hình dạng như hiện tại, và vì sao không nên đổi thứ tự.*

---

## 1. Vòng lặp bốn bước

Mỗi câu thoại đi qua đúng bốn vòng. Thứ tự này không tuỳ tiện.

```
   ┌─ Vòng 0 ── TỪ MỚI ─────────────────────────────┐
   │  5–8 từ của cảnh, mỗi từ một hình + một câu     │
   │  ví dụ nghe được. TRƯỚC khi thấy phim.          │
   └────────────────────┬───────────────────────────┘
                        ▼
   ┌─ Vòng 1 ── NGHE ───────────────────────────────┐
   │  Nghe câu mẫu. Lặp vô hạn. Chưa nói gì cả.      │
   │  Mục tiêu: nhớ được NHỊP, chưa cần nhớ chữ.     │
   └────────────────────┬───────────────────────────┘
                        ▼
   ┌─ Vòng 2 ── ĐỌC CHỒNG ──────────────────────────┐
   │  Đọc CÙNG LÚC với bản mẫu. Có phao đỡ.          │
   │  Mục tiêu: bắt nhịp và ngữ điệu, chưa lo đúng   │
   │  từng âm.                                       │
   └────────────────────┬───────────────────────────┘
                        ▼
   ┌─ Vòng 3 ── LỒNG TIẾNG ─────────────────────────┐
   │  Hình chạy, TIẾNG GỐC TẮT. Học viên thay giọng. │
   │  Mục tiêu: tự đứng được, đúng nhịp thật.        │
   └────────────────────┬───────────────────────────┘
                        ▼
   ┌─ Vòng 4 ── KIỂM TRA ───────────────────────────┐
   │  Ẩn chữ. Một lượt. Điểm này vào tiến độ.        │
   │  Mục tiêu: chứng minh đã thuộc, không phải đọc. │
   └────────────────────────────────────────────────┘
```

### Vì sao từ mới đứng trước

Học viên gặp từ lạ **giữa lúc thu** sẽ dừng lại tra từ. Nhịp vỡ, tự tin mất, và lượt thu đó thành vô nghĩa. Xử lý xong từ mới trước thì lúc vào phim, thứ duy nhất còn khó là **nói cho kịp** — đúng thứ mình muốn luyện.

Mỗi từ có **hình minh hoạ** vì lý do cụ thể, không phải cho đẹp: nếu học viên phải dịch qua tiếng Việt rồi mới hiểu, thì trong lúc lồng tiếng họ cũng sẽ dịch — và không kịp. Hình nối thẳng âm với nghĩa, bỏ qua bước dịch.

### Vì sao có vòng "đọc chồng" ở giữa

Nhảy thẳng từ Nghe sang Lồng tiếng là bước hụt. Đọc chồng là cái phao: bản mẫu vẫn chạy, học viên bám theo được, và **cơ miệng học được nhịp trước khi trí nhớ phải làm việc**. Bỏ vòng này thì tỉ lệ bỏ cuộc ở vòng 3 tăng vọt — đây là chỗ học viên yếu bỏ ngang.

### Vì sao vòng 3 mới là sản phẩm thật

Ở vòng 3, tiếng gốc tắt nhưng **hình vẫn chạy**. Khuôn miệng diễn viên vẫn mấp máy, cảnh vẫn trôi. Học viên buộc phải nói **vừa đúng vừa kịp**. Đó chính là áp lực của hội thoại thật, và đó là thứ đọc to một câu trong sách không bao giờ tạo ra được.

## 2. Một câu thoại nên dài bao nhiêu

| Trình độ | Độ dài câu | Số từ | Vì sao |
|---|---|---|---|
| A1–A2 | 1,5–3 giây | 4–8 từ | Đủ ngắn để giữ trong đầu mà không cần đọc chữ |
| B1 | 3–5 giây | 8–14 từ | Bắt đầu phải nối âm và rút gọn |
| B2+ | 5–8 giây | 14–22 từ | Có mệnh đề phụ, phải chọn chỗ ngắt hơi |

**Không bao giờ quá 15 giây một lượt thu.** Quá mức đó, học viên sai một chỗ là phải thu lại cả câu, và sẽ nản. Bộ kiểm tra bài học tự cảnh báo khi câu dài quá 20 giây.

## 3. Chọn từ trọng tâm — chỗ dễ làm sai nhất

Mỗi câu khai báo `keywords`: những từ/cụm **tính điểm nặng**. Chọn sai thì cả hệ thống chấm mất ý nghĩa.

**Chọn đúng:**
- Cụm chức năng lặp lại ngoài đời: *hold on*, *in a hurry*, *give you a ride*.
- Chỗ có hiện tượng nối âm đáng dạy: *hold on* → /həʊl‿dɒn/.
- Từ mà sai là đổi nghĩa: *live* / *leave*, *in* / *on*.

**Chọn sai:**
- Từ hiếm, đẹp, chỉ có trong phim này (*serendipitous*). Học viên đọc được cũng không dùng lại bao giờ.
- Toàn bộ câu. Đánh dấu tất cả là trọng tâm thì không còn gì là trọng tâm.
- Từ chức năng đứng một mình (*the*, *a*). Máy nghe được cũng chẳng nói lên điều gì.

**Mỗi câu 1–2 cụm là đủ.** Bộ kiểm tra sẽ **báo lỗi chặn** nếu cụm trọng tâm không thực sự nằm trong câu — vì khi đó học viên vĩnh viễn không đạt điểm phần này, mà không hiểu vì sao.

## 4. Đối chiếu CEFR — nói cho đúng mức

Lồng tiếng chủ yếu rèn hai nhóm năng lực trong khung CEFR: **nghe hiểu** và **nói (độ trôi chảy, phát âm)**. Nó **không** rèn viết, và rèn đọc rất ít. Đừng gọi đây là khoá học toàn diện.

| Mức | Làm được gì sau khi lồng tiếng đạt | Kiểm chứng bằng |
|---|---|---|
| A2 | Đọc lại câu thoại ngắn hằng ngày đúng nhịp, người nghe hiểu được | Vòng 4 đạt ≥70 trên toàn bộ câu của 4 tập |
| B1 | Giữ được nhịp hội thoại tốc độ thật; nối âm cơ bản | Vòng 4 đạt ≥75 và điểm Nhịp ≥70 |
| B2 | Giữ ngữ điệu và cảm xúc, không chỉ đúng chữ | Vòng 4 đạt ≥80 + giáo viên nghe và duyệt bản thu |

**Điều phải nói thẳng:** đạt điểm cao khi lồng tiếng **không** tương đương đạt mức CEFR đó. Lồng tiếng là nói lại lời có sẵn; CEFR đo cả khả năng tự tạo ra lời. Vì vậy mức B2 ở bảng trên bắt buộc có giáo viên duyệt, và mọi tuyên bố về trình độ phải kèm một bài nói tự do.

## 5. Cá nhân hoá — để áp dụng được vào đời thật

Yêu cầu "học để áp dụng thực tế, cá nhân hoá" được đáp ứng ở ba tầng:

**Tầng 1 — Chọn chuỗi phim theo bối cảnh của học viên.** Người làm khách sạn học chuỗi ở sảnh lễ tân; người làm văn phòng học chuỗi trong phòng họp. Cùng một cấu trúc ngữ pháp, khác bối cảnh, khác từ.

**Tầng 2 — Máy tự đẩy câu yếu lên đầu.** Trang Tiến độ xếp câu theo điểm từ thấp lên cao. Học viên mở ra là biết luyện gì, không phải tự nhớ.

**Tầng 3 — Từ vựng ôn theo lịch riêng từng người.** Thẻ từ chạy theo lặp giãn cách (`core/srs.js`): trả lời đúng thì thẻ giãn ra 1 → 3 → 7 → 16 → 35 → 75 ngày; trả lời sai thì thẻ quay lại ngay hôm nay. Hai học viên học cùng một tập sẽ có lịch ôn khác nhau.

**Tầng 4 (cần giáo viên) — Đổi lời thoại theo nghề.** Studio cho phép giữ nguyên nhịp và cấu trúc của cảnh nhưng thay danh từ theo nghề của học viên. Đây là việc của giáo viên, không tự động hoá được, và chính là thứ biện minh cho gói kèm cặp 1-1.

## 6. Một buổi luyện tại nhà nên kéo dài bao lâu

**15 phút, không hơn.** Cụ thể:

| Phút | Việc |
|---|---|
| 0–3 | Từ mới (6 thẻ) |
| 3–6 | Nghe hết cảnh một lượt, không nói |
| 6–11 | Đọc chồng rồi lồng tiếng 4–6 câu |
| 11–14 | Vòng Kiểm tra trên đúng những câu vừa luyện |
| 14–15 | Xem điểm, đọc góp ý, đóng máy |

Một tập 12 câu nên chia **ba buổi**, không ép xong trong một lần. Lý do: luyện phát âm là việc của cơ miệng, và cơ miệng mệt nhanh hơn não. Buổi thứ tư quay lại tập cũ ở vòng Kiểm tra — đây là lúc học viên thấy rõ mình tiến bộ, và là lúc họ quyết định có học tiếp hay không.
