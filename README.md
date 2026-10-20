# HomeMeal

HomeMeal kết nối khách hàng với đầu bếp gia đình, hỗ trợ đặt bữa ăn, đặt tiệc và theo dõi chi phí đi chợ.

## Công nghệ

- React, TypeScript, Vite
- Express API trên Vercel Functions
- PostgreSQL (Neon được hỗ trợ)
- S3-compatible private object storage cho ảnh hóa đơn
- Resend cho xác minh email và đặt lại mật khẩu
- Sentry tùy chọn cho theo dõi lỗi

## Chạy local

1. Cài dependencies bằng `npm install`.
2. Sao chép `.env.example` thành `.env`.
3. Điền `DATABASE_URL` và `APP_ORIGIN=http://localhost:3000`.
4. Chạy migration: `npm run db:migrate`.
5. Trong một terminal chạy `npm run dev:api`; terminal khác chạy `npm run dev`.

`npm run build` tạo bản build giao diện. `npm run lint` chạy TypeScript. `npm test` chạy kiểm thử nghiệp vụ.

## Database và administrator đầu tiên

`npm run db:migrate` áp dụng lần lượt các file có số phiên bản trong `db/migrations/`. Migration đã chạy được lưu ở `schema_migrations`; không sửa migration đã áp dụng, hãy thêm file phiên bản mới.

Để tạo admin đầu tiên, đặt tạm `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` (12–128 ký tự) và `INITIAL_ADMIN_NAME` trong `.env`, rồi chạy:

```bash
npm run db:seed-admin
```

Xóa các giá trị `INITIAL_ADMIN_*` khỏi `.env` sau khi tạo admin. Không đưa mật khẩu admin vào Vercel hoặc Git. Admin đăng nhập website bằng email và mật khẩu đã đặt ở bước này.

Đăng ký công khai chỉ tạo tài khoản Khách hàng. Người dùng cần xác minh email trước khi đăng nhập. Admin có thể cấp quyền Đầu bếp trong `/admin`; đầu bếp nhận đơn bằng thao tác chấp nhận, sau đó chỉ người được giao mới cập nhật đơn.

## Các biến môi trường

### Bắt buộc cho production

- `DATABASE_URL`: chuỗi PostgreSQL production.
- `APP_ORIGIN`: origin production, ví dụ `https://ten-web.vercel.app`, không có đường dẫn.
- `RESEND_API_KEY` và `EMAIL_FROM`: gửi email xác minh và đặt lại mật khẩu. `EMAIL_FROM` cần dùng domain đã xác minh với Resend.
- `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY`: bucket S3-compatible riêng tư.
- `MFA_ENCRYPTION_KEY`: khóa base64 giải mã được thành đúng 32 bytes để mã hóa secret MFA admin.
- `AUTH_RATE_LIMIT_SECRET`: khóa ngẫu nhiên dùng để băm định danh trong bảng rate limit.

Tạo khóa base64 32 bytes bằng Node:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

`OBJECT_STORAGE_ENDPOINT` chỉ cần đặt cho provider dùng endpoint riêng, chẳng hạn R2. Cấu hình bucket ở chế độ private, chặn public access và thêm CORS cho đúng `APP_ORIGIN`, phương thức `PUT`, header `Content-Type`. Ảnh chỉ nhận JPEG/PNG/WebP tối đa 5 MB; API kiểm tra kích thước và chữ ký file rồi chỉ cấp URL đọc tạm thời sau khi xác thực quyền trên đơn.

Đặt `SENTRY_DSN` để gửi lỗi API lên Sentry. Đặt `APP_TIME_ZONE` nếu lịch đặt món dùng múi giờ khác; mặc định `Asia/Ho_Chi_Minh`.

## Triển khai Vercel

Ứng dụng được phục vụ tại `https://www.thomasely.id.vn/HomeMeal`. Vercel chuyển `/` tới đường dẫn này, phục vụ các route giao diện dưới `/HomeMeal/`, chuyển asset đã build về thư mục `/assets/` và chuyển `/HomeMeal/api` tới API function. `APP_BASE_PATH` mặc định là `/HomeMeal`; nếu đổi đường dẫn, cần cập nhật cả `vercel.json`.

1. Trong Project Settings → Environment Variables, thêm `DATABASE_URL`, `APP_ORIGIN=https://www.thomasely.id.vn`, `APP_BASE_PATH=/HomeMeal`, cấu hình email, storage, MFA và Sentry cho môi trường phù hợp. `APP_ORIGIN` chỉ là origin, không thêm `/HomeMeal` hay đường dẫn. Không thêm `INITIAL_ADMIN_*`.
2. Chạy `npm run db:migrate` một lần từ máy tin cậy với `DATABASE_URL` production.
3. Chạy `npm run db:seed-admin` một lần bằng `INITIAL_ADMIN_*` tạm thời trong `.env` local rồi xóa các giá trị đó.
4. Redeploy Production để Vercel nạp biến môi trường.
5. Đăng nhập admin, mở Tài khoản và bật MFA bằng ứng dụng Authenticator. Giữ `MFA_ENCRYPTION_KEY` ổn định; đổi khóa sẽ khiến secret MFA hiện tại không giải mã được.
6. Kiểm tra `https://www.thomasely.id.vn/HomeMeal/api?resource=health`; endpoint chỉ trả tình trạng phụ thuộc, không tiết lộ thông tin kết nối.

Lệnh dọn upload chưa hoàn tất là `npm run storage:cleanup`. Có thể lên lịch chạy định kỳ để xóa metadata và object bị bỏ dở sau hai giờ.

## Lưu trữ, phân quyền và thanh toán

- Đơn hàng, báo giá, hóa đơn, yêu cầu đổi ngân sách, khiếu nại, đánh giá và audit event được lưu trong PostgreSQL. API kiểm tra khách sở hữu đơn, đầu bếp được giao đơn hoặc admin trước khi đọc/ghi.
- Ảnh chứng từ được tải lên bucket riêng tư bằng URL ký số hết hạn sau 5 phút; URL đọc hết hạn sau 2 phút. Dùng CORS giới hạn đúng domain ứng dụng.
- Rate limit đăng nhập, đăng ký và khôi phục mật khẩu được chia sẻ giữa các function qua PostgreSQL, thay vì bộ nhớ riêng từng tiến trình.
- Admin có thể bật TOTP MFA. Email xác minh, khôi phục mật khẩu và thay đổi role được ghi audit.
- Thanh toán thật chưa được tích hợp. Nút thanh toán bị khóa và API không thể đánh dấu đơn đã trả tiền từ yêu cầu trình duyệt.
- Dữ liệu mẫu chỉ còn cho phiên khách chưa đăng nhập; không đồng bộ các đơn `localStorage` cũ sang production.

## Vận hành production

- Bật chính sách lưu giữ backup/PITR của nhà cung cấp PostgreSQL và lên lịch diễn tập khôi phục sang branch/database riêng.
- Cấu hình cảnh báo lỗi trong Sentry; theo dõi `/HomeMeal/api?resource=health`, log JSON có `requestId`, lỗi migration, email và object storage.
- Giới hạn quyền credential của bucket ở đúng bucket cần thiết; không bật public read.
- Trước khi tích hợp cổng thanh toán, xử lý webhook có xác minh chữ ký, idempotency key và audit; chỉ webhook đáng tin cậy mới được ghi trạng thái đã thanh toán.
