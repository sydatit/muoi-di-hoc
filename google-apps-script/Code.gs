/**
 * Muối Đi Học — Google Apps Script Web App
 *
 * Nhận POST JSON từ landing (Content-Type: text/plain) và phân nhánh theo eventType:
 *   - eventType === "visit"                     → ghi sheet "Visits" (khách vào, kể cả không đăng ký)
 *   - eventType === "registration" (mặc định)   → ghi sheet đăng ký + gửi Telegram (logic cũ)
 *
 * === Deploy (cập nhật app cũ) ===
 * 1. Mở Google Sheet đăng ký → Extensions → Apps Script
 * 2. Dán toàn bộ file này (thay code cũ), Save
 * 3. Deploy → Manage deployments → Edit → Version: New version → Deploy
 * 4. Giữ quyền "Anyone". URL Web App không đổi → không cần sửa app.js
 *
 * Cả 2 sheet đều ghi thêm 8 cột thiết bị ở cuối (loại thiết bị mobile/tablet/desktop,
 * hệ điều hành, trình duyệt, màn hình, viewport, hướng, ngôn ngữ, user agent).
 * Sheet đang có dữ liệu sẽ được bổ sung tiêu đề cho các cột mới ngay lần ghi kế tiếp.
 *
 * === Công thức gợi ý (tab Stats) — cột B của cả 2 sheet là VisitorId ===
 *   Tổng session visit:   =COUNTA(Visits!B:B)-1
 *   Unique visitor:       =COUNTA(UNIQUE(Visits!B2:B))
 *   Số đăng ký:           =COUNTA(Registrations!K:K)-1   // cột "Visitor ID" ở sheet đăng ký
 *   Unique chưa đăng ký:  =COUNTA(UNIQUE(FILTER(Visits!B2:B, COUNTIF(Registrations!K:K, Visits!B2:B)=0)))
 *   Visit theo thiết bị:  =QUERY(Visits!G2:G, "select Col1, count(Col1) where Col1 is not null group by Col1 label count(Col1) 'Số visit'")
 */

// =========================================================================
// CẤU HÌNH TELEGRAM BOT (Thay thế bằng thông tin thật của bạn khi sẵn sàng)
// =========================================================================
const TELEGRAM_BOT_TOKEN = "";
const TELEGRAM_CHAT_ID = "";

// Tên sheet ghi lượt truy cập landing (khách vào mà chưa đăng ký).
// Sheet đăng ký vẫn dùng getActiveSheet() như code cũ để không phá cấu hình hiện tại.
const VISITS_SHEET_NAME = "Visits";

// Cột thiết bị dùng chung cho cả 2 sheet (luôn nằm ở cuối để không phá thứ tự cột cũ).
const DEVICE_HEADERS = [
  "Loại thiết bị",
  "Hệ điều hành",
  "Trình duyệt",
  "Màn hình (Screen)",
  "Viewport",
  "Hướng màn hình",
  "Ngôn ngữ",
  "User Agent"
];

const VISITS_HEADERS = [
  "Thời gian ghi nhận",
  "Visitor ID",
  "Campaign CD",
  "Nguồn giới thiệu (Referrer)",
  "Đường dẫn (Path)",
  "Thời gian vào trang"
].concat(DEVICE_HEADERS);

const SHEET_HEADERS = [
  "Thời gian gửi",
  "Họ tên",
  "Tuổi",
  "Điện thoại",
  "Kinh nghiệm YouTube",
  "Điểm tiềm năng thu nhập",
  "Câu hỏi chuyên gia",
  "Đã xác nhận",
  "Email (tương thích)",
  "Ghi chú (tương thích)",
  "Visitor ID",
  "Campaign CD",
  "Thời gian xem",
  "Số lượt click",
  "Vị trí đăng ký"
].concat(DEVICE_HEADERS);

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ status: "error", message: "Thiếu dữ liệu POST." });
    }

    const data = JSON.parse(e.postData.contents);

    // -------------------------------------------------------------
    // NHÁNH VISIT: chỉ ghi log truy cập, không gửi Telegram
    // -------------------------------------------------------------
    if (data.eventType === "visit") {
      appendVisit_(data);
      return jsonResponse_({ status: "success" });
    }

    // -------------------------------------------------------------
    // NHÁNH REGISTRATION (mặc định) — GIỮ NGUYÊN LUỒNG CŨ
    // -------------------------------------------------------------
    const row = normalizeRow_(data);

    // STEP 1: LUÔN ƯU TIÊN LƯU VÀO GOOGLE SHEETS
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    ensureHeaders_(sheet);
    sheet.appendRow(row);

    // STEP 2: GỬI TELEGRAM AN TOÀN (KHÔNG LÀM HỎNG LUỒNG CHÍNH)
    try {
      if (
        TELEGRAM_BOT_TOKEN &&
        TELEGRAM_BOT_TOKEN !== "MÃ_BOT_TOKEN_CỦA_BẠN" &&
        TELEGRAM_CHAT_ID &&
        TELEGRAM_CHAT_ID !== "MÃ_CHAT_ID_CỦA_NHÓM"
      ) {
        sendTelegramNotification(data);
      } else {
        console.warn("Chưa cấu hình mã Telegram thật. Hệ thống đã lưu Google Sheet thành công.");
      }
    } catch (telegramError) {
      console.error("Lỗi gửi Telegram (đã bỏ qua để ưu tiên lưu Sheet): " + telegramError.toString());
    }

    return jsonResponse_({ status: "success" });
  } catch (error) {
    return jsonResponse_({ status: "error", message: error.toString() });
  }
}

function doGet() {
  return jsonResponse_({
    status: "ok",
    message: "Muối Đi Học endpoint. POST với eventType visit|registration."
  });
}

// -------------------------------------------------------------
// GHI LƯỢT TRUY CẬP (VISIT)
// -------------------------------------------------------------
function appendVisit_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(VISITS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(VISITS_SHEET_NAME);
  }
  ensureSheetHeaders_(sheet, VISITS_HEADERS);

  sheet.appendRow([
    new Date().toLocaleString("vi-VN"),
    data.visitorId || "",
    data.campaignCd || "",
    data.referrer || "",
    data.path || "",
    data.landedAt || ""
  ].concat(deviceColumns_(data)));
}

/** Giá trị 8 cột thiết bị, đúng thứ tự DEVICE_HEADERS. */
function deviceColumns_(data) {
  return [
    data.deviceType || "Không rõ",
    data.deviceOs || "",
    data.deviceBrowser || "",
    data.screenSize || "",
    data.viewportSize || "",
    data.orientation || "",
    data.language || "",
    data.userAgent || ""
  ];
}

function ensureHeaders_(sheet) {
  ensureSheetHeaders_(sheet, SHEET_HEADERS);
}

/**
 * Đảm bảo hàng tiêu đề đủ rộng cho bộ cột hiện tại.
 * Sheet đã có dữ liệu chỉ được bổ sung tiêu đề cho các cột mới ở cuối,
 * tiêu đề cũ giữ nguyên để không phá công thức / bộ lọc đang dùng.
 */
function ensureSheetHeaders_(sheet, headers) {
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns < headers.length) {
    sheet.insertColumnsAfter(maxColumns, headers.length - maxColumns);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    return;
  }

  const filledColumns = sheet.getLastColumn();
  if (filledColumns >= headers.length) {
    return;
  }

  const missing = headers.slice(filledColumns);
  sheet.getRange(1, filledColumns + 1, 1, missing.length)
    .setValues([missing])
    .setFontWeight("bold");
}

function normalizeRow_(data) {
  const value = function (key, fallback) {
    if (data[key] === undefined || data[key] === null || data[key] === "") {
      return fallback !== undefined ? fallback : "";
    }
    return data[key];
  };

  const acknowledgement = data.acknowledgement === true || data.acknowledgement === "true" || data.acknowledgement === "Đã hiểu"
    ? "Đã hiểu"
    : value("acknowledgement", "");

  return [
    value("submittedAt"),
    value("fullName"),
    value("age"),
    value("phone"),
    value("youtubeExperience"),
    value("incomePotential"),
    value("expertQuestion", value("message", "")),
    acknowledgement,
    value("email", "Không thu thập"),
    value("message", value("expertQuestion", "")),
    value("visitorId"),
    value("campaignCd"),
    value("timeSpent"),
    value("clicks"),
    value("entryPoint")
  ].concat(deviceColumns_(data));
}

function sendTelegramNotification(data) {
  const acknowledgement = data.acknowledgement === true || data.acknowledgement === "true" || data.acknowledgement === "Đã hiểu"
    ? "Đã hiểu"
    : escapeMarkdown_(String(data.acknowledgement || ""));

  const message =
    "🔔 *CÓ HỌC VIÊN ĐĂNG KÝ MỚI!*\n\n" +
    "👤 *Họ tên:* " + escapeMarkdown_(data.fullName) + "\n" +
    "🎂 *Tuổi:* " + escapeMarkdown_(data.age) + "\n" +
    "📞 *Điện thoại:* " + escapeMarkdown_(data.phone) + "\n" +
    "🎬 *Kinh nghiệm YouTube:* " + escapeMarkdown_(data.youtubeExperience) + "\n" +
    "📈 *Điểm tiềm năng thu nhập:* " + escapeMarkdown_(data.incomePotential) + "/10\n" +
    "✍️ *Câu hỏi chuyên gia:* " + escapeMarkdown_(data.expertQuestion || data.message) + "\n" +
    "✅ *Xác nhận:* " + acknowledgement + "\n\n" +
    "📊 *Dữ liệu chiến dịch (Tracking):*\n" +
    "▫️ *Nguồn (cd):* `" + escapeMarkdown_(data.campaignCd) + "`\n" +
    "▫️ *Thời gian xem:* " + escapeMarkdown_(data.timeSpent) + "\n" +
    "▫️ *Số lượt click:* " + escapeMarkdown_(data.clicks) + "\n" +
    "▫️ *Vị trí bấm đăng ký:* " + escapeMarkdown_(data.entryPoint) + "\n" +
    "▫️ *Thiết bị:* " + escapeMarkdown_(data.deviceType || "Không rõ") +
      " (" + escapeMarkdown_(data.deviceOs) + " · " + escapeMarkdown_(data.deviceBrowser) + ")\n" +
    "▫️ *Màn hình:* " + escapeMarkdown_(data.screenSize) +
      " | viewport " + escapeMarkdown_(data.viewportSize) + " | " + escapeMarkdown_(data.orientation) + "\n" +
    "▫️ *Mã khách (Visitor ID):* `" + escapeMarkdown_(data.visitorId) + "`\n" +
    "▫️ *Thời gian gửi:* " + escapeMarkdown_(data.submittedAt);

  const url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "Markdown"
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    console.error("Telegram API lỗi HTTP " + code + ": " + response.getContentText());
  }
}

function escapeMarkdown_(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/\[/g, "\\[")
    .replace(/`/g, "\\`");
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * (Tuỳ chọn) Chạy một lần trong editor để kiểm tra quyền / cấu hình.
 * Không dùng cho Web App production.
 */
function testAppendSampleRow() {
  const sample = {
    submittedAt: new Date().toLocaleString("vi-VN"),
    fullName: "Nguyễn Văn A",
    age: "24",
    phone: "0901234567",
    youtubeExperience: "Mới tìm hiểu",
    incomePotential: "8",
    expertQuestion: "Làm sao bắt đầu kênh YouTube?",
    acknowledgement: true,
    email: "Không thu thập",
    message: "Làm sao bắt đầu kênh YouTube?",
    visitorId: "VISITOR-TEST123",
    campaignCd: "test",
    timeSpent: "120 giây",
    clicks: "5 lần",
    entryPoint: "test",
    deviceType: "Mobile",
    deviceOs: "iOS",
    deviceBrowser: "Facebook (in-app)",
    screenSize: "390x844",
    viewportSize: "390x664",
    orientation: "Portrait",
    language: "vi-VN",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) FBAN/FBIOS"
  };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  ensureHeaders_(sheet);
  sheet.appendRow(normalizeRow_(sample));
}

/**
 * (Tuỳ chọn) Test ghi 1 dòng visit.
 */
function testAppendSampleVisit() {
  appendVisit_({
    eventType: "visit",
    visitorId: "VISITOR-TEST123",
    campaignCd: "test",
    referrer: "https://facebook.com",
    path: "/?cd=test",
    landedAt: new Date().toLocaleString("vi-VN"),
    deviceType: "Tablet",
    deviceOs: "iPadOS",
    deviceBrowser: "Safari",
    screenSize: "1024x1366",
    viewportSize: "1024x1180",
    orientation: "Portrait",
    language: "vi-VN",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15"
  });
}
