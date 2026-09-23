# 04 — Thiết kế trải nghiệm và giữ chân học viên

---

## 1. Các màn hình và đường đi

```
index.html ─── Danh sách khoá ──► lesson.html ─── Màn luyện (chính)
     │                                  │
     │                                  ├──► thẻ Từ mới (tự bật lần đầu)
     │                                  ├──► bảng Kịch bản bên phải
     │                                  ├──► Phòng thu bên dưới trình phát
     │                                  └──► Bảng điểm sau mỗi lượt thu
     │
     ├──► studio.html ─── Soạn bài (dành cho giáo viên)
     └──► progress.html ─ Tiến độ + câu cần luyện lại + xuất dữ liệu
```

## 2. Ba quyết định bố cục quan trọng

### 2.1 Bảng kịch bản nằm BÊN CẠNH, không nằm dưới video

Có hai lý do, cả hai đều không thể bỏ qua:

1. **Sư phạm.** Phụ đề chạy dưới video biến mất khi câu trôi qua. Bảng bên cạnh đứng yên, học viên thấy được cả cảnh, bấm được vào bất kỳ câu nào để nghe lại — đúng yêu cầu "muốn nghe lại phần nào thì mở phần đấy".
2. **Chính sách nhúng.** [Developer Policies của YouTube](https://developers.google.com/youtube/terms/required-minimum-functionality) cấm hiển thị lớp phủ, khung hay phần tử nào **phía trước** trình phát nhúng, kể cả phần điều khiển — chỉ trừ lớp phủ phục vụ xin phép người dùng hoặc nút điều khiển phát. Đặt kịch bản chồng lên video là vi phạm. Đặt bên cạnh thì không.

Bài kiểm thử đầu-cuối có một phép kiểm tra riêng cho việc này: nó đo toạ độ khung nhắc và khung phát, và **báo lỗi nếu hai vùng chồng nhau**. Xem `tests/e2e/smoke.mjs`.

### 2.2 Cụm trọng tâm xuất hiện trong lúc học, không phải trước hay sau

Yêu cầu "khi các từ khoá/cụm quan trọng nó sẽ xuất hiện" được làm như sau:
- Trong bảng kịch bản, cụm trọng tâm được **tô nền vàng có gạch chân** ngay trong câu.
- Khi chọn một câu, khung **"Cụm trọng tâm của câu này"** hiện bên cạnh trình phát, kèm nghĩa và lưu ý nối âm.
- Sau khi thu, cụm trọng tâm có **dòng điểm riêng** trong bảng điểm — học viên thấy ngay mình có "ra" được cụm đó không.

### 2.3 Bảng điểm nói chuyện với học viên, không chỉ trưng con số

Bảng điểm sau mỗi lượt thu gồm bốn phần, theo đúng thứ tự học viên cần:

1. **Điểm tổng** trong vòng tròn, kèm nhãn tiếng Việt (*Xuất sắc / Tốt / Tạm được / Cần luyện lại / Thu lại nhé*).
2. **Bốn chỉ số thành phần** có thanh đo: Chính xác, Đầy đủ, Cụm trọng tâm, Nhịp & tốc độ.
3. **Bản đồ từng từ**: xanh là đúng, vàng là gần đúng, đỏ là chưa nghe ra, xám là nói thêm. Rê chuột vào từ đỏ sẽ thấy máy nghe thành gì.
4. **Tối đa 5 góp ý bằng tiếng Việt**, xếp theo mức ưu tiên sửa — cụm trọng tâm trước, rồi lỗi âm cụ thể, rồi nhịp.

Giới hạn 5 góp ý là cố ý. Liệt kê 12 lỗi thì học viên không sửa lỗi nào.

## 3. Làm sao để học viên quay lại ngày mai

Vấn đề thật của mọi sản phẩm học tại nhà không phải là buổi đầu — mà là buổi thứ tư. Các cơ chế dưới đây xếp theo **hiệu quả thật**, không theo độ dễ làm:

### Nhóm 1 — Có sức giữ chân thật (làm trước)

**Giáo viên nghe bản thu và nhắn lại.** Không có cơ chế nào mạnh bằng một tin nhắn: *"Câu số 8 tập này em nối âm được rồi, tuần trước còn rời."* Học viên biết có người thật đang nghe. Đây là thứ Cake và ELSA không có. **Đây là ưu tiên số một, và nó không cần code thêm gì** — chỉ cần học viên xuất tệp tiến độ gửi cô (trang Tiến độ đã có nút xuất).

**Cốt truyện chưa kết thúc.** Nếu chuỗi phim có tình tiết nối tập, học viên quay lại vì muốn biết chuyện gì xảy ra — lý do mạnh hơn "để giỏi tiếng Anh". Tập nên kết ở chỗ dở dang.

**Thấy mình khá lên.** Nghe lại bản thu tuần trước của chính mình là bằng chứng không cãi được. Sản phẩm giữ lại tối đa 8 lượt gần nhất cho mỗi câu, chính là để làm việc này.

### Nhóm 2 — Có tác dụng, nhưng chỉ là phụ (làm sau)

**Chuỗi ngày học.** Đã có trong `core/store.js`. Hữu ích, nhưng chuỗi bị đứt thường khiến học viên bỏ luôn — nên **không phạt nặng khi đứt chuỗi**, chỉ đếm lại từ đầu.

**Bảng xếp hạng lớp.** Chỉ dùng cho nhóm học sinh, và chỉ xếp theo **số phút đã nói**, không xếp theo điểm. Xếp theo điểm thì học viên yếu bỏ cuộc ngay tuần đầu.

**Buổi công chiếu.** Cuối mỗi chuỗi, lớp cùng xem bản lồng tiếng của nhau. Việc này gần như không tốn công tổ chức mà tác động rất mạnh — học viên luyện kỹ hơn hẳn khi biết sẽ có người nghe.

### Nhóm 3 — Nên tránh

- **Trừ điểm, mất tim, khoá bài vì học trễ.** Sản phẩm học tiếng Anh cho người lớn dùng cơ chế phạt sẽ mất chính nhóm khách trả tiền cao nhất.
- **Thông báo đẩy hằng ngày.** Tắt thông báo là bước đầu của việc gỡ app.
- **Đua điểm công khai giữa các học viên yếu và khá.** Xem ở trên.

## 4. Những chỗ dễ làm hỏng trải nghiệm

| Rủi ro | Xử lý trong bản hiện tại |
|---|---|
| Học viên bấm thu rồi mới nhớ câu → có 3 giây lặng đầu | Cắt lặng đầu/cuối khi tính nhịp (`effectiveDuration`) |
| Micro quá nhỏ, điểm thấp oan | Cảnh báo *"Micro quá nhỏ"* hiện **trước** điểm |
| Học viên quên bấm dừng thu | Tự dừng sau khi hết câu + khoảng dư |
| Trình duyệt không có nhận dạng giọng nói | Chuyển sang tự đánh giá, không chặn học viên |
| Học viên không muốn gửi giọng đi | Hỏi rõ ràng trước, và luôn có nút "Tôi tự đánh giá" |
| Mạng chập chờn giữa lúc chấm | Báo *"mất mạng, điểm có thể thấp hơn thực tế"* thay vì để học viên tưởng mình dở |
| Máy nghe nhầm từ đồng âm | Chấm trên **phương án nhận dạng khớp nhất**, không chỉ phương án đầu |
| Học viên đọc 2/10 từ mà vẫn được điểm nhịp cao | Chỉ tính điểm nhịp khi đã đọc được ≥40% câu |

## 5. Tiếp cận được cho mọi người

- Toàn bộ thao tác làm được bằng bàn phím: `Space` nghe lại, `R` thu, `←` `→` đổi câu, `L` lặp.
- Bảng kịch bản là các nút thật (`<button>`), đọc được bằng trình đọc màn hình, không phải `div` bắt sự kiện.
- Tương phản màu theo bộ navy/gold trên nền trắng và nền tối, có chế độ tối riêng.
- Tôn trọng `prefers-reduced-motion`: tắt mọi chuyển động cho người nhạy cảm với hiệu ứng.
- Không dùng **chỉ màu sắc** để truyền thông tin: từ sai vừa đỏ vừa gạch ngang, và có chú thích khi rê chuột.
- Điểm chưa làm được: chưa kiểm với trình đọc màn hình thật (NVDA/VoiceOver). Ghi trong `07-kiem-thu-va-duyet.md` như một việc còn nợ.
