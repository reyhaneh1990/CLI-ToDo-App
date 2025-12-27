// گرفتن المان ul که لیست تسک‌ها داخلش رندر می‌شود
const listEl = document.getElementById("list");

// گرفتن فرم افزودن تسک جدید
const addForm = document.getElementById("addForm");

// گرفتن input عنوان تسک
const titleInput = document.getElementById("titleInput");

// گرفتن المان نمایش حالت "لیست خالی است"
const emptyEl = document.getElementById("empty");

// گرفتن المان نمایش خطاها
const errorEl = document.getElementById("error");

// دکمه فیلتر نمایش همه تسک‌ها
const filterAll = document.getElementById("filterAll");

// دکمه فیلتر نمایش تسک‌های انجام‌نشده
const filterOpen = document.getElementById("filterOpen");

// دکمه فیلتر نمایش تسک‌های انجام‌شده
const filterDone = document.getElementById("filterDone");

// آرایه اصلی نگهداری تسک‌ها در سمت فرانت
let tasks = [];

// وضعیت فیلتر فعلی: all = همه، open = انجام‌نشده، done = انجام‌شده
let filter = "all"; // all | open | done

// تابع نمایش/پنهان‌سازی خطا در UI
function setError(msg) {
    // اگر msg خالی بود یعنی خطا نداریم
    if (!msg) {
        // کلاس hidden را اضافه کن تا با CSS مخفی شود
        errorEl.classList.add("hidden");
        // متن خطا را خالی کن
        errorEl.textContent = "";
    } else {
        // اگر خطا داریم، hidden را بردار تا نمایش داده شود
        errorEl.classList.remove("hidden");
        // متن خطا را ست کن
        errorEl.textContent = msg;
    }
}

// تابعی که ظاهر دکمه‌های فیلتر را تنظیم می‌کند (active)
function setActiveFilter(btn) {
    // اول active را از هر سه دکمه بردار
    [filterAll, filterOpen, filterDone].forEach(b => b.classList.remove("active"));
    // سپس فقط روی دکمه انتخاب‌شده active بگذار
    btn.classList.add("active");
}

// گرفتن لیست تسک‌ها از بک‌اند (GET /api/tasks)
async function apiGetTasks() {
    // ارسال درخواست به سرور
    const res = await fetch("/api/tasks");
    // اگر پاسخ ok نبود یعنی خطا
    if (!res.ok) throw new Error("Failed to load tasks");
    // تبدیل پاسخ به JSON و برگرداندن آن
    return await res.json();
}

// افزودن تسک جدید به بک‌اند (POST /api/tasks)
async function apiAddTask(title) {
    // ارسال درخواست POST با بدنه JSON
    const res = await fetch("/api/tasks", {
        method: "POST", // نوع درخواست
        headers: {"Content-Type": "application/json"}, // اعلام اینکه JSON می‌فرستیم
        body: JSON.stringify({ title }) // تبدیل آبجکت به JSON (فیلد title)
    });

    // خواندن بدنه پاسخ (معمولاً یک Task یا یک خطا)
    const data = await res.json();

    // اگر ok نبود، خطا را از data.error بگیر یا متن پیش‌فرض بده
    if (!res.ok) throw new Error(data?.error || "Failed to add task");

// اگر موفق بود، تسک ساخ
