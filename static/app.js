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

// =======================
// UI Helpers
// =======================

function setError(msg) {
    if (!errorEl) return;

    if (!msg) {
        errorEl.classList.add("hidden");
        errorEl.textContent = "";
    } else {
        errorEl.classList.remove("hidden");
        errorEl.textContent = msg;
    }
}

function setEmptyVisible(isEmpty) {
    if (!emptyEl) return;

    if (isEmpty) emptyEl.classList.remove("hidden");
    else emptyEl.classList.add("hidden");
}

function setActiveFilter(btn) {
    [filterAll, filterOpen, filterDone].forEach((b) => {
        if (b) b.classList.remove("active");
    });
    if (btn) btn.classList.add("active");
}

// جلوگیری از XSS: متن را فقط به صورت textContent ست می‌کنیم
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// =======================
// API
// =======================

async function apiGetTasks() {
    const res = await fetch("/api/tasks");
    if (!res.ok) throw new Error("Failed to load tasks");
    return await res.json();
}

async function apiAddTask(title) {
    const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to add task");
    return data;
}

async function apiPatchTaskDone(id, done) {
    const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to update task");
    return data;
}

async function apiDeleteTask(id) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Failed to delete task");
    return data;
}

// =======================
// Render
// =======================

function getFilteredTasks() {
    if (filter === "open") return tasks.filter((t) => !t.done);
    if (filter === "done") return tasks.filter((t) => t.done);
    return tasks;
}

function render() {
    if (!listEl) return;

    // پاک کردن لیست قبلی
    listEl.innerHTML = "";

    const filtered = getFilteredTasks();

    // نمایش حالت خالی
    setEmptyVisible(filtered.length === 0);

    filtered.forEach((t) => {
        const li = el("li", "task-item");

        // بخش چپ: checkbox + title
        const left = el("div", "task-left");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!t.done;

        const title = el("span", "task-title", t.title);
        if (t.done) title.classList.add("done");

        // وقتی تیک می‌خورد => PATCH
        checkbox.addEventListener("change", async () => {
            try {
                setError("");
                const updated = await apiPatchTaskDone(t.id, checkbox.checked);

                // آپدیت در آرایه
                const idx = tasks.findIndex((x) => x.id === updated.id);
                if (idx !== -1) tasks[idx] = updated;

                render();
            } catch (err) {
                // برگشت به حالت قبل
                checkbox.checked = !!t.done;
                setError(err?.message || "Update failed");
            }
        });

        left.appendChild(checkbox);
        left.appendChild(title);

        // بخش راست: دکمه حذف
        const right = el("div", "task-right");

        const delBtn = el("button", "btn-delete", "Delete");
        delBtn.addEventListener("click", async () => {
            try {
                setError("");
                await apiDeleteTask(t.id);

                // حذف از آرایه
                tasks = tasks.filter((x) => x.id !== t.id);
                render();
            } catch (err) {
                setError(err?.message || "Delete failed");
            }
        });

        right.appendChild(delBtn);

        li.appendChild(left);
        li.appendChild(right);

        listEl.appendChild(li);
    });
}

// =======================
// Init & Events
// =======================

async function loadAndRender() {
    try {
        setError("");
        tasks = await apiGetTasks();

        // جدیدها بالا (اختیاری)
        tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        render();
    } catch (err) {
        setError(err?.message || "Failed to load tasks");
        setEmptyVisible(true);
    }
}

if (addForm) {
    addForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        try {
            setError("");

            const title = (titleInput?.value || "").trim();
            if (!title) {
                setError("Title is required");
                return;
            }

            const newTask = await apiAddTask(title);

            // افزودن به ابتدای لیست
            tasks.unshift(newTask);

            // خالی کردن input
            if (titleInput) titleInput.value = "";

            render();
        } catch (err) {
            setError(err?.message || "Add failed");
        }
    });
}

// فیلترها
if (filterAll) {
    filterAll.addEventListener("click", () => {
        filter = "all";
        setActiveFilter(filterAll);
        render();
    });
}

if (filterOpen) {
    filterOpen.addEventListener("click", () => {
        filter = "open";
        setActiveFilter(filterOpen);
        render();
    });
}

if (filterDone) {
    filterDone.addEventListener("click", () => {
        filter = "done";
        setActiveFilter(filterDone);
        render();
    });
}

// اجرای اولیه
document.addEventListener("DOMContentLoaded", () => {
    // فیلتر پیش‌فرض
    setActiveFilter(filterAll);
    loadAndRender();
});
