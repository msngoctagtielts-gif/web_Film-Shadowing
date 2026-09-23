# 09 — Lộ trình và chỉ số

---

## 1. Bản hiện tại làm được gì

| Đã xong | Ghi chú |
|---|---|
| Bốn vòng luyện: Nghe → Đọc chồng → Lồng tiếng → Kiểm tra | `pages/lesson.js` |
| Bảng kịch bản bên cạnh, bấm câu nào nghe câu đó, lặp, đổi tốc độ | `ui/script-panel.js` |
| Thẻ từ mới có hình minh hoạ, bật tự động trước khi học | `ui/vocab-preview.js` |
| Cụm trọng tâm tô sáng trong kịch bản + khung nhắc bên cạnh + dòng điểm riêng | `ui/components.js` |
| Thu âm, nghe lại, nghe so sánh với bản mẫu | `core/recorder.js` |
| Chấm tự động 4 chỉ số + bản đồ từng từ + góp ý tiếng Việt | `core/scoring.js` |
| Chế độ tự đánh giá khi không dùng nhận dạng giọng nói | `pages/lesson.js` |
| Ba nguồn video: YouTube nhúng, tệp riêng, giọng đọc máy | `core/player.js` |
| Studio soạn bài: bắt mốc thời gian, kiểm lỗi, xuất JSON | `pages/studio.js` |
| Tiến độ, chuỗi ngày, câu cần luyện lại, xuất/nhập dữ liệu | `pages/progress.js` |
| Bảng theo dõi lớp: ai cần gọi, điểm nghẽn của lớp, từng em, báo cáo buổi tới | `pages/teacher.js`, `core/analytics.js` |
| Ôn từ vựng theo lặp giãn cách | `core/srs.js` |
| 171 kiểm thử lõi + 37 kiểm thử trình duyệt thật | `tests/` |

## 2. Lộ trình

### Giai đoạn 1 — Chạy thử (bây giờ → 6 tuần)
**Mục tiêu: biết sản phẩm có giữ được học viên không. Không thêm tính năng.**

- [ ] Quay **4 tập đầu** của chuỗi phim riêng của trung tâm.
- [ ] Soạn 4 tập bằng Studio, qua đủ ba cổng duyệt ở `07`.
- [ ] Chạy thử với 5 rồi 15 học viên theo lịch ở `07` mục 6.
- [ ] **Hiệu chuẩn máy chấm** với 30 bản thu thật.
- [ ] Ghi lại: tỉ lệ quay lại, chỗ học viên bỏ cuộc, câu hỏi hay gặp.

*Không làm trong giai đoạn này: tài khoản, máy chủ, ứng dụng điện thoại, bảng xếp hạng.*

### Giai đoạn 2 — Cho giáo viên nhìn thấy (6 → 12 tuần)
**Mục tiêu: cô xem được học viên đang làm gì mà không cần học viên gửi tệp.**

- [x] ~~Bảng của giáo viên: ai đang học, ai chững lại, câu nào cả lớp cùng sai.~~ **Đã có** (`teacher.html`) — chạy bằng tệp học viên gửi cô, chưa cần máy chủ.
- [ ] Máy chủ tối thiểu: tài khoản + đồng bộ tiến độ, để cô không phải xin tệp từng em.
- [ ] Giáo viên nghe được bản thu và gửi nhận xét bằng giọng nói.
- [ ] Báo cáo hằng tuần tự động gửi phụ huynh.

*Đây là giai đoạn biến sản phẩm từ "app luyện nói" thành "thứ Cake không làm được". Thứ tự này quan trọng: chỉ làm sau khi giai đoạn 1 chứng minh được học viên chịu quay lại.*

### Giai đoạn 3 — Mở rộng (12 tuần trở đi)
- [ ] Chấm âm vị qua API, chỉ ở vòng Kiểm tra.
- [ ] Chế độ hai người: hai học viên lồng hai vai trong cùng một cảnh.
- [ ] Xuất video có tiếng của học viên để khoe (cần quyền với video gốc).
- [ ] Thư viện tình huống theo nghề cho nhóm đi làm.
- [ ] Bảng xếp hạng lớp theo **số phút đã nói**, không theo điểm.

### Việc còn nợ (làm khi có dịp, không chặn giai đoạn nào)
- [ ] Kiểm với trình đọc màn hình thật (NVDA, VoiceOver).
- [ ] Kiểm trên iOS Safari máy thật.
- [ ] Học viên đổi được giọng đọc máy (nam/nữ, Anh/Mỹ).
- [ ] Bản thu lưu được trong IndexedDB để nghe lại sau nhiều ngày (hiện chỉ giữ trong phiên).

## 3. Chỉ số theo dõi

### Chỉ số quan trọng nhất

> **Số phút học viên thực sự nói ra tiếng mỗi tuần.**

Không phải số buổi đăng nhập, không phải số bài hoàn thành. Học viên mở ứng dụng 7 ngày liền mà chỉ nghe, không thu, thì sản phẩm đang thất bại. Chỉ số này đã được đếm sẵn trong `core/store.js` (`totals.recordedSec`).

### Các chỉ số còn lại

| Nhóm | Chỉ số | Vì sao theo dõi |
|---|---|---|
| Vào cửa | % người thử hoàn thành được câu đầu tiên | Nếu thấp: lỗi kỹ thuật hoặc micro, không phải lỗi động lực |
| Vào cửa | Thời gian từ lúc mở tới lượt thu đầu tiên | Mục tiêu dưới 3 phút |
| Giữ chân | % học viên quay lại ≥3 buổi trong tuần | Chỉ số sống còn của sản phẩm học tại nhà |
| Giữ chân | Số buổi trước khi bỏ | Cho biết nội dung hết cuốn ở tập thứ mấy |
| Học tập | Điểm vòng Kiểm tra lần 1 so với lần 2 cùng một câu | Đo tiến bộ thật, không đo điểm tuyệt đối |
| Học tập | % câu đạt ≥70 sau 3 lượt thu | Nếu thấp: bài quá khó hoặc máy chấm quá nghiêm |
| Chất lượng | Độ lệch giữa điểm máy và điểm giáo viên | Ngưỡng ±12 (xem `07` mục 5) |
| Kinh doanh | % học viên dùng thử chuyển thành trả phí | — |

### Chỉ số cần cảnh giác

**Đừng tối ưu chuỗi ngày.** Chuỗi ngày dài có thể đến từ việc học viên mở ứng dụng 2 phút mỗi tối cho đủ chỉ tiêu. Nó trông đẹp trên báo cáo mà không dạy được ai. Luôn đặt chuỗi ngày cạnh **số phút đã nói**.

## 4. Nợ kỹ thuật đã biết

Ghi ra để người sửa sau không mất thời gian tìm hiểu:

| Chỗ | Vấn đề | Khi nào phải xử lý |
|---|---|---|
| `core/store.js` | Toàn bộ tiến độ nằm trong localStorage. Xoá dữ liệu trình duyệt là mất sạch. | Giai đoạn 2, khi có máy chủ |
| `pages/teacher.js` | Dữ liệu vào bảng bằng cách học viên gửi tệp — phụ thuộc việc các em nhớ xuất và gửi | Giai đoạn 2; phần phân tích và hiển thị giữ nguyên, chỉ thay chỗ nạp tệp bằng gọi API |
| `core/player.js` (TTS) | Trình duyệt không cho biết thời lượng thật của giọng máy, nên con trỏ thời gian là ước lượng | Chỉ ảnh hưởng bài mẫu; bỏ qua được |
| `core/asr.js` | Phụ thuộc Web Speech API — Firefox không có, và âm thanh đi qua máy chủ của nhà cung cấp trình duyệt | Giai đoạn 3, khi chuyển sang API chấm riêng |
| Bản thu | Giữ trong bộ nhớ phiên, đóng tab là mất | Khi học viên cần nghe lại bản thu tuần trước |
| `pages/lesson.js` | Là một tệp lớn điều phối nhiều việc | Khi thêm vòng luyện thứ năm thì nên tách |

## 5. Nguyên tắc khi phát triển tiếp

1. **Mỗi tính năng mới phải trả lời được: nó làm học viên nói nhiều hơn hay ít hơn?** Nếu không tăng số phút nói, đừng làm.
2. **Đừng thêm tính năng khi chỉ số giữ chân còn thấp.** Giữ chân thấp gần như luôn là vấn đề nội dung, thêm tính năng không chữa được.
3. **Giữ được tính chất "mở trình duyệt là học".** Không cần đăng ký, không cần cài. Đây là lợi thế thật ở bước dùng thử — đừng đánh đổi nó lấy việc thu thập email sớm.
4. **Mọi thay đổi công thức chấm đều phải hiệu chuẩn lại.** Sửa trọng số rồi đo lại với 30 bản thu, đừng sửa theo cảm tính.
5. **Không bao giờ nói quá về khả năng máy chấm.** Xem `05-may-cham-diem.md` mục 1.
