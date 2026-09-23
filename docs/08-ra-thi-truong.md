# 08 — Kế hoạch đưa sản phẩm ra thị trường

---

## 1. Thứ tự mở bán

Không mở bán cho người lạ trước. Đi từ trong ra ngoài:

```
Vòng 1  Học viên đang học tại trung tâm           → dùng kèm khoá, miễn phí
            ↓  (có bằng chứng: bản thu trước/sau, điểm tiến bộ)
Vòng 2  Học viên cũ đã nghỉ                        → gói "Luyện tại nhà"
            ↓  (có lời chứng thật, có clip công chiếu)
Vòng 3  Người theo dõi trang của cô                → học thử 1 tập miễn phí
            ↓
Vòng 4  Quảng cáo trả phí                          → chỉ khi ba vòng trên đã chạy được
```

**Lý do đi thứ tự này:** mỗi vòng tạo ra nguyên liệu bán hàng cho vòng sau. Vòng 1 tạo bằng chứng, vòng 2 tạo lời chứng, vòng 3 tạo nội dung lan truyền. Nhảy thẳng tới vòng 4 là đốt tiền quảng cáo để bán một thứ chưa có bằng chứng nào.

## 2. Thông điệp cho từng nhóm

Cùng một sản phẩm, ba cách nói khác nhau.

**Người đi làm (nhóm A)**
> *Bạn hiểu hết những gì họ nói trong cuộc họp. Nhưng tới lượt mình thì đứng hình. Vấn đề không phải vốn từ — mà là bạn chưa bao giờ phải nói trong 2 giây. Lồng tiếng ép bạn làm đúng việc đó, mỗi ngày 15 phút.*

**Phụ huynh (nhóm B)**
> *Con chị học tiếng Anh 5 năm, điểm luôn cao. Gặp người nước ngoài thì im. Mỗi tuần chị sẽ nhận một bản thu giọng con nói tiếng Anh — nghe được, so được với tuần trước.*

Với nhóm này, **bản thu gửi phụ huynh hằng tuần chính là sản phẩm**, không phải tính năng phụ.

**Học viên cũ (nhóm C)**
> *Giữa hai buổi học, em không nói tiếng Anh câu nào. Tới buổi sau quên sạch. 15 phút mỗi tối lồng tiếng một cảnh — buổi tới em vào lớp là nói được ngay.*

## 3. Bốn loại nội dung marketing sinh ra từ chính sản phẩm

Sản phẩm này tự tạo nội dung quảng cáo, không phải nghĩ thêm:

1. **Video trước/sau.** Cùng một câu thoại, bản thu ngày 1 và ngày 30 của cùng học viên. Đây là nội dung thuyết phục nhất và gần như không tốn công dựng.
2. **Clip công chiếu của lớp.** Cả lớp lồng tiếng một cảnh, ghép lại. Học viên tự chia sẻ — không cần trả tiền quảng cáo.
3. **Loạt bài "một câu, một lỗi".** Mỗi bài lấy một câu thoại, chỉ ra lỗi người Việt hay mắc, kèm cách sửa. Nguyên liệu lấy từ chính dữ liệu lỗi của học viên.
4. **Buổi học thử phát trực tiếp.** Cô lồng tiếng một cảnh, người xem bình luận, cô chấm ngay trên sóng.

**Nguyên tắc:** mọi nội dung marketing phải là **bằng chứng**, không phải lời hứa. Thị trường tiếng Anh ở Việt Nam đã bão hoà lời hứa.

## 4. Con đường từ người lạ đến học viên trả tiền

```
Thấy clip trước/sau          →  Học thử 1 tập miễn phí, không cần tài khoản
        ↓                         (chỉ cần mở trình duyệt là học được)
Lồng tiếng xong 1 cảnh       →  Nhận điểm + góp ý ngay
        ↓                         Đây là "khoảnh khắc vỡ lẽ" — phải xảy ra trong 10 phút đầu
Nhận kết quả qua email/Zalo  →  Kèm lời mời: gửi bản thu, cô nghe và nhận xét miễn phí 1 lần
        ↓
Nhận nhận xét của cô         →  Đây là lúc bán, không phải trước đó
        ↓
Mua gói Luyện tại nhà / 1-1
```

**Chỗ quan trọng nhất là bước 2.** Nếu người dùng thử không lồng tiếng xong được một cảnh trong 10 phút đầu, mọi thứ phía sau vô nghĩa. Bản dựng hiện tại phục vụ đúng điều này: **không cần đăng ký, không cần cài đặt**, mở trình duyệt là học.

## 5. Chi phí vận hành

| Khoản | Bản hiện tại | Khi có 500 học viên |
|---|---|---|
| Máy chủ | ~0 (trang tĩnh, đặt được trên dịch vụ miễn phí) | vẫn rất thấp — không có máy chủ xử lý |
| Chấm điểm | 0 (chạy trên máy học viên) | 0, hoặc phí API nếu chuyển sang chấm âm vị |
| Lưu trữ bản thu | 0 (nằm trên máy học viên) | tăng lên nếu muốn giáo viên nghe được từ xa |
| Sản xuất nội dung | công quay + soạn bài | **đây là khoản lớn nhất** |
| Giờ giáo viên nghe và nhận xét | — | khoản lớn thứ hai, và là thứ quyết định biên lợi nhuận |

**Điều này có nghĩa gì:** chi phí biên gần bằng không cho phần phần mềm. Toàn bộ chi phí nằm ở **nội dung** và **giờ giáo viên**. Vì vậy gói bán rời (không có giờ giáo viên) có biên rất cao, còn gói 1-1 bị giới hạn bởi số giờ cô có.

**Hệ quả cho chiến lược giá:** đừng bán gói 1-1 rẻ để thu hút. Bán gói tự học rẻ, dùng nó làm phễu, và giữ giá gói 1-1 ở mức phản ánh đúng giờ giáo viên.

## 6. Cột mốc và ngưỡng dừng

| Mốc | Chỉ số đo | Ngưỡng đi tiếp |
|---|---|---|
| Chạy thử xong | Học viên hoàn thành được 1 tập không cần hỗ trợ | 5/5 |
| Hiệu chuẩn máy chấm | Lệch so với giáo viên | ≤ ±12 điểm ở 80% mẫu |
| Có bằng chứng | Số cặp video trước/sau dùng được | ≥ 10 |
| Có sức giữ chân | Tỉ lệ học viên quay lại ≥3 buổi/tuần | ≥ 60% |
| Có người trả tiền | Học viên cũ mua gói Luyện tại nhà | ≥ 10 người |
| Mở quảng cáo | Chi phí có một học viên < 1/3 doanh thu trọn đời ước tính | — |

**Ngưỡng dừng thật sự:** nếu tỉ lệ quay lại dưới 40% sau 4 tuần chạy thử, **dừng việc thêm tính năng lại**. Nguyên nhân gần như chắc chắn nằm ở nội dung (phim không cuốn, câu quá khó) hoặc ở việc không có người theo sát — chứ không nằm ở phần mềm.

## 7. Ba rủi ro lớn nhất và cách đối phó

| Rủi ro | Dấu hiệu sớm | Đối phó |
|---|---|---|
| **Không đủ nội dung.** Học viên học hết 4 tập trong 2 tuần rồi hết bài. | Tỉ lệ hoàn thành bài cao bất thường ở tuần 2 | Trước khi mở bán phải có sẵn **ít nhất 12 tập**. Quay theo lô, không quay lẻ. |
| **Bản quyền.** Bài học dùng video của người khác bị gỡ giữa khoá đã bán. | Video báo lỗi nhúng | Ưu tiên tuyệt đối con đường tự sản xuất (`06-tu-lieu-va-ban-quyen.md`) |
| **Máy chấm sai làm học viên mất niềm tin.** Học viên đọc đúng mà bị điểm thấp. | Học viên phàn nàn, hoặc bỏ giữa chừng sau lượt thu điểm thấp | Hiệu chuẩn (mục 5, `07`); luôn cho nghe lại bản thu để học viên tự phán xét; luôn có nút tự đánh giá |
