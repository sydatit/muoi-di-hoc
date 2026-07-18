// =========================================================================
// CẤU HÌNH TELEGRAM BOT (Thay thế bằng thông tin thật của bạn khi sẵn sàng)
// =========================================================================
const TELEGRAM_BOT_TOKEN = "MÃ_BOT_TOKEN_CỦA_BẠN";
const TELEGRAM_CHAT_ID = "MÃ_CHAT_ID_CỦA_NHÓM";

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
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ status: "error", message: "Thiếu dữ liệu POST." });
    }

    const data = JSON.parse(e.postData.contents);
    const row = normalizeRow_(data);

    // -------------------------------------------------------------
    // STEP 1: LUÔN ƯU TIÊN LƯU VÀO GOOGLE SHEETS
    // -------------------------------------------------------------
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    ensureHeaders_(sheet);
    sheet.appendRow(row);

    // -------------------------------------------------------------
    // STEP 2: GỬI TELEGRAM AN TOÀN (KHÔNG LÀM HỎNG LUỒNG CHÍNH)
    // -------------------------------------------------------------
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

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() > 0) {
    return;
  }
  sheet.appendRow(SHEET_HEADERS);
  sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setFontWeight("bold");
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
  ];
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
    entryPoint: "test"
  };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  ensureHeaders_(sheet);
  sheet.appendRow(normalizeRow_(sample));
}
