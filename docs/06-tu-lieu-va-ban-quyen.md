# 06 — Tư liệu phim và bản quyền

> **Tôi không phải luật sư và tài liệu này không phải tư vấn pháp lý.** Đây là các ràng buộc kỹ thuật và chính sách nền tảng mà tôi kiểm chứng được, cùng với mức rủi ro tương ứng. Trước khi bán gói có dùng tư liệu của bên thứ ba, hãy hỏi luật sư.

---

## 1. Vấn đề, nói thẳng

Ý tưởng "cho học viên lồng tiếng một chuỗi phim" chạm vào quyền của chủ sở hữu tác phẩm ở ba chỗ:

1. **Video** — phát lại tác phẩm của người khác.
2. **Lời thoại** — chép lại kịch bản vào tệp bài học cũng là sao chép một phần tác phẩm.
3. **Bản thu của học viên** — nếu trung tâm đăng công khai bản lồng tiếng chồng lên hình phim, đó là tác phẩm phái sinh.

Rủi ro tăng dần theo ba mức: **dùng trong lớp miễn phí < dùng trong gói thu phí < đăng công khai ra mạng**.

## 2. Ba con đường, chọn theo mức rủi ro

### Con đường A — Trung tâm tự sản xuất (khuyến nghị)

Quay chuỗi phim ngắn của riêng trung tâm: 3–5 phút mỗi tập, giáo viên và trợ giảng đóng, quay bằng điện thoại cũng đủ.

| | |
|---|---|
| Rủi ro bản quyền | **Không có.** Trung tâm sở hữu toàn bộ. |
| Chi phí | Công sản xuất; không tốn phí bản quyền |
| Lợi thế thêm | Viết được đúng ngữ pháp và từ vựng cần dạy, đúng độ dài câu cho từng trình độ; không đối thủ nào có nội dung này |
| Nhược | Chất lượng hình ảnh không bằng phim thật — nhưng học viên lồng tiếng thì quan tâm lời thoại hơn hình |

**Đây là con đường nên đi.** Nó biến khâu khó nhất (bản quyền) thành tài sản riêng.

### Con đường B — Video có giấy phép rõ ràng

Video Creative Commons, hoặc video mà chủ kênh cho phép bằng văn bản.

- Phải **lưu bằng chứng**: ảnh chụp giấy phép, thư trả lời của chủ kênh, kèm ngày tháng.
- Ghi vào trường `source.rightsNote` của tệp bài học. Bộ kiểm tra sẽ **cảnh báo** nếu bài nguồn YouTube bỏ trống trường này, và bài kiểm thử `lesson-data.test.mjs` sẽ **báo lỗi** nếu ghi chú quá sơ sài.

### Con đường C — Video thương mại / video của người khác trên YouTube

Chỉ **nhúng** qua trình phát chính thức. Những ràng buộc dưới đây đến từ [Developer Policies](https://developers.google.com/youtube/terms/developer-policies) và [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) của YouTube:

| Được | Không được |
|---|---|
| Nhúng qua IFrame Player API chính thức | Tải video về máy chủ của mình |
| Tua, tạm dừng, lặp đoạn bằng API | Cắt, ghép, chỉnh sửa video |
| Đặt nút điều khiển phát bên ngoài khung phát | **Phủ bất kỳ phần tử nào lên phía trước trình phát**, kể cả lên phần điều khiển |
| Đặt kịch bản, từ vựng **bên cạnh** khung phát | Thay đổi trình phát theo cách không có trong tài liệu API |

Ứng dụng này tuân thủ: bảng kịch bản và khung nhắc cụm trọng tâm đều nằm **bên cạnh**, và có một phép kiểm thử tự động đo toạ độ để bảo đảm không bao giờ chồng lên (xem `tests/e2e/smoke.mjs`).

**Ngoại lệ được nêu rõ:** lớp phủ để **xin phép người dùng** hoặc **nút điều khiển phát** (tắt tiếng, toàn màn hình, phát, dừng) là chấp nhận được, miễn không xung đột với giao diện của trình phát.

**Vẫn còn rủi ro dù đã nhúng đúng cách:**
- Chủ sở hữu có thể tắt tính năng nhúng bất cứ lúc nào → bài học chết giữa khoá học đã bán.
- Chép lời thoại vào tệp bài học vẫn là sao chép một phần tác phẩm, không được chính sách nhúng bảo vệ.
- Dùng trong sản phẩm **thu phí** là tình tiết bất lợi khi xét "sử dụng hợp lý".

> **Khuyến nghị:** con đường C chỉ dùng cho **lớp miễn phí, buổi học thử, lớp trong trung tâm**. Không đưa vào gói bán riêng cho tới khi có ý kiến luật sư.

## 3. Về việc chép lời thoại

Đây là chỗ hay bị bỏ qua.

- Chép **toàn bộ** lời thoại của một tập phim vào tệp bài học là sao chép một phần đáng kể tác phẩm.
- Rủi ro giảm đi khi: chỉ lấy một cảnh ngắn, có thêm phần bình giảng và bài tập của trung tâm, không thay thế việc xem phim gốc, và dùng phi thương mại.
- **Cách an toàn hơn:** với con đường C, đừng lưu lời thoại gốc. Thay vào đó viết **lời thoại mới** cho cùng tình huống, cùng chức năng giao tiếp, cùng độ dài — rồi cho học viên lồng tiếng theo kịch bản mới. Giữ được giá trị sư phạm, bỏ được rủi ro.

Bài học mẫu đi kèm (`demo-doan-thoai-ga-tau.json`) làm đúng theo cách này: kịch bản viết mới hoàn toàn, đọc bằng giọng máy của trình duyệt. Hình minh hoạ từ vựng cũng là hình vẽ mới bằng SVG, không lấy từ bộ icon nào.

## 4. Bản thu của học viên

- Bản thu nằm trong trình duyệt của học viên, không gửi đi đâu, trừ khi chính học viên xuất tệp gửi cho cô.
- Khi bật chấm điểm tự động, **âm thanh được trình duyệt gửi tới dịch vụ nhận dạng của nhà cung cấp trình duyệt** (Google với Chrome, Apple với Safari). Ứng dụng hỏi ý kiến học viên rõ ràng trước khi bật, và luôn có nút "Tôi tự đánh giá".
- **Với học viên dưới 16 tuổi:** phải có đồng ý của phụ huynh bằng văn bản trước khi thu âm, và trước khi dùng bản thu vào bất cứ việc gì ngoài lớp học.
- Muốn đăng bản lồng tiếng lên mạng: cần cả (a) quyền với video gốc và (b) đồng ý của học viên/phụ huynh. Thiếu một trong hai thì không đăng.

## 5. Danh mục kiểm tra trước khi phát hành một bài học

- [ ] Nguồn video thuộc con đường A, B hay C? Ghi rõ.
- [ ] Trường `source.rightsNote` đã điền, nêu cụ thể cơ sở sử dụng?
- [ ] Nếu là B: đã lưu bằng chứng giấy phép kèm ngày tháng?
- [ ] Nếu là C: bài này chỉ dùng trong lớp miễn phí, không nằm trong gói thu phí?
- [ ] Lời thoại là chép nguyên từ tác phẩm hay viết mới?
- [ ] Hình minh hoạ từ vựng: dùng bộ hình có sẵn của ứng dụng, hay ảnh trung tâm tự chụp? (Không dán ảnh tìm trên mạng.)
- [ ] Học viên dưới 16 tuổi: đã có đồng ý của phụ huynh về việc thu âm?
- [ ] `npm test` chạy qua, bao gồm phép kiểm tra ghi chú quyền sử dụng?

## Nguồn

- [YouTube API Services — Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [YouTube API Services — Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [YouTube Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters)
