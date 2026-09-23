# 07 — Kiểm thử, kiểm định chất lượng và duyệt

---

## 1. Ba tầng kiểm thử

| Tầng | Chạy bằng | Kiểm cái gì | Số phép kiểm |
|---|---|---|---|
| **Lõi** | `npm test` (Node, không cần trình duyệt) | Chuẩn hoá văn bản, chấm điểm, phân tích âm thanh, lưu tiến độ, tính hợp lệ của dữ liệu bài học, phân tích lớp | 171 |
| **Trình duyệt** | `node tests/e2e/smoke.mjs` (Chromium thật) | Trang dựng được, bấm được, thu âm được, bảng lớp chạy đúng, không có lỗi JavaScript, không tràn ngang trên điện thoại | 37 |
| **Tay** | Người thật, danh mục ở mục 3 | Chất lượng âm thanh, cảm nhận sư phạm, thiết bị thật | — |

### Chạy thế nào

```bash
npm test                              # tầng lõi

python3 -m http.server 4173 &         # tầng trình duyệt cần máy chủ
node tests/e2e/smoke.mjs              # ảnh chụp lưu ở tests/e2e/screenshots/
```

*Tầng trình duyệt cần gói `playwright`. Nếu máy đã cài toàn cục: `ln -s $(npm root -g)/playwright node_modules/playwright`.*

## 2. Những lỗi thật mà kiểm thử đã bắt được

Ghi lại đây vì chúng cho thấy các phép kiểm này không phải hình thức — mỗi lỗi dưới đây đều từng có trong bản dựng và đều sẽ làm hỏng trải nghiệm học viên:

| Lỗi | Hậu quả nếu lọt | Phép kiểm khoá lại |
|---|---|---|
| Khoảng lặng **trước** khi học viên bắt đầu nói bị đếm thành "ngắt giữa câu" | Học viên bấm thu sớm 1 giây là mất điểm nhịp, không hiểu vì sao | `recorder.test.mjs` — "lặng đầu và cuối không bị tính là ngắt giữa câu" |
| Lượt thu **im lặng hoàn toàn** vẫn được 100 điểm nhịp, tổng 22 | Học viên không nói gì vẫn có điểm | `scoring.test.mjs` — "im lặng thì 0 điểm và không ăn điểm nhịp" |
| Đọc 2/10 từ vẫn ăn trọn điểm nhịp | Điểm tổng nói dối học viên | `scoring.test.mjs` — "đọc được vài từ thì không ăn điểm nhịp" |
| Cụm "call you back" **rơi mất "you"** vẫn tính là đạt | Cụm trọng tâm mất ý nghĩa | `scoring.test.mjs` — "mất một từ trong cụm thì cụm bị đánh trượt" |
| "in" và "on" cho cùng khoá ngữ âm → 0,82 điểm giống | Lỗi giới từ không bao giờ bị bắt | `text.test.mjs` — "không hào phóng với từ ngắn khác nhau" |
| `mute()` chưa tồn tại trên trình phát | Vòng Lồng tiếng vẫn phát tiếng gốc — hỏng chính tính năng cốt lõi | kiểm tay, mục 3 |
| Hướng tiến bộ so điểm theo trình tự thời gian, mà câu về sau trong bài vốn khó hơn | **5/6 học viên bị gắn cờ "đang đi xuống", kể cả em đạt 92%** — cảnh báo mất hết ý nghĩa | `analytics.test.mjs` — "câu về sau khó hơn KHÔNG bị hiểu nhầm thành đi xuống" |
| Nút "Xoá lớp" dùng hộp thoại `confirm` của trình duyệt | Trên bản web xuất bản, hộp thoại không hiện được nên nút im lặng không làm gì | thay bằng xác nhận hai bước ngay trên trang |

## 3. Danh mục kiểm tay — chạy trước mỗi lần phát hành

Máy không kiểm được những thứ dưới đây. Đánh dấu từng dòng, không bỏ qua.

### 3.1 Âm thanh và thu âm
- [ ] Thu bằng **micro tai nghe** — có ra tiếng, mức hiển thị trên cột VU nhảy đúng.
- [ ] Thu bằng **micro sẵn trong máy tính** — cảnh báo "micro quá nhỏ" có xuất hiện khi nói xa 1 mét không.
- [ ] Nói **quá to sát micro** — có cảnh báo "tiếng bị vỡ" không.
- [ ] Thu trong **phòng có tiếng ồn** (quạt, xe ngoài đường) — điểm có tụt bất thường không.
- [ ] Nút **Nghe so sánh** — nghe mẫu rồi nghe mình, liền mạch, không chồng tiếng.

### 3.2 Chấm điểm
- [ ] Đọc **đúng hoàn toàn** một câu → điểm ≥ 90.
- [ ] Đọc **rơi âm cuối** có chủ ý ("minute" thay "minutes") → có góp ý về âm cuối /s/.
- [ ] Đọc **thiếu hẳn một từ trong cụm trọng tâm** → cụm bị đánh trượt.
- [ ] **Nói câu khác hẳn** → điểm dưới 45.
- [ ] **Không nói gì** → 0 điểm, kèm nhắc kiểm tra micro.
- [ ] Đọc **rất nhanh** → có nhắc về tốc độ.

### 3.3 Trình duyệt và thiết bị
- [ ] Chrome trên máy tính — chấm tự động chạy.
- [ ] Edge trên máy tính — chấm tự động chạy.
- [ ] Safari trên máy Mac/iPhone — chấm hoặc tự chuyển sang tự đánh giá, không vỡ giao diện.
- [ ] Firefox — báo rõ "trình duyệt này không chấm tự động được", vẫn thu và nghe lại được.
- [ ] Điện thoại Android, màn hình hẹp — không tràn ngang, nút bấm đủ to.
- [ ] Chế độ nền tối — mọi chữ còn đọc được, không có ô trắng chói.

### 3.4 Bài học dùng YouTube
- [ ] Video nhúng phát được, tua đúng câu.
- [ ] Đổi tốc độ 0,75x hoạt động.
- [ ] **Vòng Lồng tiếng: tiếng gốc thực sự tắt**, hình vẫn chạy.
- [ ] Không có phần tử nào của ứng dụng phủ lên khung phát ở bất kỳ kích thước màn hình nào.
- [ ] Video bị chủ sở hữu tắt nhúng → có báo lỗi dễ hiểu, không phải màn hình trắng.

### 3.5 Bảng theo dõi lớp
- [ ] Nạp tệp của 3 học viên thật → cả ba xuất hiện, không bị trùng.
- [ ] Nạp lại tệp mới của cùng một em → ghi đè, không tạo dòng thứ hai.
- [ ] Nạp tệp hỏng hoặc tệp không phải tiến độ → báo rõ lý do, không vỡ bảng.
- [ ] Số em bị gắn cờ "cần chú ý" **không quá nửa lớp** — quá nửa là cảnh báo mất ý nghĩa.
- [ ] Mỗi thẻ cần chú ý đều nêu được lý do cụ thể và việc nên làm.
- [ ] Bảng điểm nghẽn chỉ ra câu mà giáo viên đồng ý là khó thật.
- [ ] Báo cáo buổi tới dán được vào giáo án mà không phải sửa.

### 3.6 Dữ liệu học viên
- [ ] Học xong, đóng trình duyệt, mở lại → tiến độ còn nguyên.
- [ ] Xuất tiến độ → nhập lại ở máy khác → đúng dữ liệu.
- [ ] Bấm "Xoá hết" → có hỏi lại trước khi xoá.

### 3.7 Chưa làm được (nợ kỹ thuật, ghi ra để không quên)
- [ ] Chưa kiểm với trình đọc màn hình thật (NVDA, VoiceOver).
- [ ] Chưa kiểm trên iOS Safari bản thật (mới chỉ Chromium trên máy chủ).
- [ ] Chưa đo được mức tiêu thụ pin khi học 30 phút trên điện thoại.

## 4. Tiêu chí duyệt một bài học trước khi đưa cho học viên

Mỗi bài học phải qua **cả ba** cổng sau.

### Cổng 1 — Máy kiểm (tự động)
- [ ] `npm test` không lỗi.
- [ ] Trang Soạn bài báo **"Không còn lỗi chặn"**.
- [ ] Mọi cụm trọng tâm đều thật sự nằm trong câu của nó.
- [ ] Không có câu nào dài quá 15 giây.
- [ ] Bài dùng nguồn bên thứ ba đã điền ghi chú quyền sử dụng.

### Cổng 2 — Giáo viên duyệt nội dung
- [ ] Lời thoại chép đúng những gì nghe được trong video (nếu dùng video thật).
- [ ] Bản dịch tiếng Việt đúng nghĩa **và đúng giọng nói đời thường**, không dịch word-by-word.
- [ ] Từ mới: 5–8 từ, đúng những từ chặn học viên lại, không phải từ hiếm.
- [ ] Cụm trọng tâm: 1–2 cụm mỗi câu, là cụm dùng lại được ngoài đời.
- [ ] Lưu ý phát âm có nói được điều cụ thể, không phải "chú ý phát âm cho đúng".
- [ ] Độ khó khớp trình độ đã ghi (đối chiếu bảng độ dài câu ở `03-thiet-ke-su-pham.md`).

### Cổng 3 — Thử với người thật
- [ ] Ít nhất **3 học viên** ở đúng trình độ đã học hết bài.
- [ ] Không ai mắc kẹt quá 5 phút ở một câu.
- [ ] Điểm trung bình vòng Kiểm tra nằm trong khoảng **55–85**. Dưới 55 là bài quá khó; trên 85 là quá dễ.
- [ ] Hỏi mỗi người một câu: *"Chỗ nào làm em bực nhất?"* — và sửa chỗ đó.

## 5. Hiệu chuẩn máy chấm — việc bắt buộc trước khi thu phí

Hiện tại chưa ai biết điểm 70 của máy tương ứng với nhận xét gì của giáo viên. Phải đo, không được đoán.

**Cách làm:**
1. Chọn **30 bản thu** của học viên thật, trải đều từ rất kém tới rất tốt.
2. **Hai giáo viên chấm độc lập** theo thang 0–100, không xem điểm máy.
3. Đặt cạnh nhau: điểm máy, điểm cô A, điểm cô B.
4. Tính độ lệch.

**Ngưỡng chấp nhận:** điểm máy lệch so với **trung bình hai giáo viên** không quá **±12 điểm** ở ít nhất **80%** số bản thu.

**Nếu không đạt:** chỉnh trọng số trong `PROFILES` (`core/scoring.js`) rồi đo lại — **đừng chỉnh từng trường hợp riêng lẻ**. Nếu chỉnh trọng số vẫn không đạt, đó là dấu hiệu cần chuyển sang chấm âm vị (xem `05-may-cham-diem.md` mục 5).

**Ghi lại kết quả** vào `docs/hieu-chuan-<ngày>.md` và đo lại mỗi khi sửa công thức chấm.

## 6. Chạy thử có kiểm soát trước khi mở bán

| Tuần | Việc | Điều kiện đi tiếp |
|---|---|---|
| 1 | 5 học viên đang học tại trung tâm, dùng bài mẫu | Cả 5 hoàn thành được ít nhất 1 tập mà không cần hỗ trợ kỹ thuật |
| 2 | Cùng nhóm đó, chuyển sang bài từ video thật | Không lỗi kỹ thuật chặn việc học |
| 3 | Hiệu chuẩn máy chấm (mục 5) | Đạt ngưỡng ±12 điểm |
| 4 | 15 học viên, có nhóm tự học không giáo viên kèm | ≥ 60% quay lại học ít nhất 3 buổi trong tuần |
| 5–6 | Sửa theo phản hồi, chạy lại | Danh mục kiểm tay mục 3 sạch |
| 7 | Mở bán gói "Luyện tại nhà" | — |

**Điều kiện dừng:** nếu tới tuần 4 mà tỉ lệ quay lại dưới 40%, **dừng lại và tìm hiểu lý do** thay vì thêm tính năng. Tỉ lệ quay lại thấp gần như luôn là vấn đề nội dung hoặc động lực, không phải vấn đề tính năng.
