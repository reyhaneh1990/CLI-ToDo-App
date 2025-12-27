package main

// تعیین پکیج اصلی برنامه
// هر برنامه‌ای که فایل اجرایی می‌سازد باید package main داشته باشد

import (
	"encoding/json"
	// برای تبدیل struct ↔ JSON (خواندن/نوشتن فایل و پاسخ API)

	"errors"
	// برای ساخت خطاهای سفارشی (errors.New)

	"io"
	// برای خواندن body درخواست HTTP

	"net/http"
	// برای ساخت سرور HTTP و API

	"os"
	// برای کار با فایل‌ها و سیستم عامل

	"path/filepath"
	// برای امن‌سازی و پردازش مسیر فایل‌ها

	"strconv"
	// برای تبدیل string به int (مثلاً id)

	"strings"
	// برای کار با رشته‌ها (trim، split، prefix و ...)

	"sync"
	// برای مدیریت هم‌زمانی (Mutex)

	"time"
	// برای ثبت زمان ایجاد تسک
)

// =======================
// مدل داده Task
// =======================

type Task struct {
	ID int `json:"id"`
	// شناسه یکتای هر تسک (برای شناسایی)

	Title string `json:"title"`
	// عنوان تسک که کاربر وارد می‌کند

	Done bool `json:"done"`
	// وضعیت انجام‌شدن تسک (true/false)

	CreatedAt time.Time `json:"created_at"`
	// زمان ایجاد تسک
}

// =======================
// Store: مدیریت ذخیره‌سازی
// =======================

type Store struct {
	mu sync.Mutex
	// Mutex برای جلوگیری از تداخل هم‌زمان چند درخواست

	filePath string
	// مسیر فایل JSON که تسک‌ها در آن ذخیره می‌شوند

	tasks []Task
	// لیست تسک‌ها در حافظه
}

// =======================
// ساخت Store جدید
// =======================

func NewStore(filePath string) *Store {
	// ساخت یک Store جدید با مسیر فایل مشخص
	return &Store{
		filePath: filePath,
		tasks:    []Task{},
	}
}

// =======================
// Load: خواندن تسک‌ها از فایل
// =======================

func (s *Store) Load() error {
	// قفل کردن برای جلوگیری از دسترسی هم‌زمان
	s.mu.Lock()
	defer s.mu.Unlock()

	// اگر فایل وجود نداشت
	if _, err := os.Stat(s.filePath); errors.Is(err, os.ErrNotExist) {
		// یک فایل جدید با محتوای [] بساز
		if err := os.WriteFile(s.filePath, []byte("[]"), 0644); err != nil {
			return err
		}
	}

	// خواندن کل فایل
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var tasks []Task

	// اگر فایل خالی بود
	if len(strings.TrimSpace(string(data))) == 0 {
		tasks = []Task{}
	} else {
		// تبدیل JSON به slice از Task
		if err := json.Unmarshal(data, &tasks); err != nil {
			return err
		}
	}

	// ذخیره در حافظه
	s.tasks = tasks
	return nil
}

// =======================
// Save: ذخیره تسک‌ها در فایل
// =======================

func (s *Store) Save() error {
	// تبدیل تسک‌ها به JSON با فرمت خوانا
	data, err := json.MarshalIndent(s.tasks, "", "  ")
	if err != nil {
		return err
	}

	// نوشتن در فایل
	return os.WriteFile(s.filePath, data, 0644)
}

// =======================
// List: گرفتن لیست تسک‌ها
// =======================

func (s *Store) List() []Task {
	s.mu.Lock()
	defer s.mu.Unlock()

	// ساخت یک کپی از داده‌ها
	// تا بیرون نتوانند مستقیم s.tasks را تغییر دهند
	out := make([]Task, len(s.tasks))
	copy(out, s.tasks)

	return out
}

// =======================
// تولید ID جدید
// =======================

func (s *Store) nextID() int {
	maxID := 0

	// پیدا کردن بیشترین ID موجود
	for _, t := range s.tasks {
		if t.ID > maxID {
			maxID = t.ID
		}
	}

	// ID جدید = بیشترین + 1
	return maxID + 1
}

// =======================
// Add: افزودن تسک جدید
// =======================

func (s *Store) Add(title string) (Task, error) {
	// حذف فاصله‌های ابتدا و انتهای عنوان
	title = strings.TrimSpace(title)

	// اگر عنوان خالی بود
	if title == "" {
		return Task{}, errors.New("title is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// ساخت تسک جدید
	task := Task{
		ID:        s.nextID(),
		Title:     title,
		Done:      false,
		CreatedAt: time.Now(),
	}

	// افزودن به لیست
	s.tasks = append(s.tasks, task)

	// ذخیره در فایل
	if err := s.Save(); err != nil {
		return Task{}, err
	}

	return task, nil
}

// =======================
// ToggleDone: تغییر وضعیت انجام‌شدن
// =======================

func (s *Store) ToggleDone(id int, done bool) (Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// پیدا کردن تسک با id مشخص
	for i := range s.tasks {
		if s.tasks[i].ID == id {
			s.tasks[i].Done = done

			// ذخیره تغییرات
			if err := s.Save(); err != nil {
				return Task{}, err
			}

			return s.tasks[i], nil
		}
	}

	return Task{}, errors.New("task not found")
}

// =======================
// Delete: حذف تسک
// =======================

func (s *Store) Delete(id int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.tasks {
		if s.tasks[i].ID == id {
			// حذف عنصر از slice
			s.tasks = append(s.tasks[:i], s.tasks[i+1:]...)
			return s.Save()
		}
	}

	return errors.New("task not found")
}

// =======================
// توابع کمکی پاسخ JSON
// =======================

func writeJSON(w http.ResponseWriter, status int, v any) {
	// تنظیم هدر پاسخ
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	// تنظیم status code
	w.WriteHeader(status)

	// ارسال JSON
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	// ارسال خطا به صورت JSON
	writeJSON(w, status, map[string]string{
		"error": msg,
	})
}

// =======================
// main: نقطه شروع برنامه
// =======================

func main() {

	// ساخت Store و بارگذاری فایل todo.json
	store := NewStore("todo.json")
	if err := store.Load(); err != nil {
		panic(err)
	}

	// ساخت router
	mux := http.NewServeMux()

	// =======================
	// سرو فایل‌های فرانت‌اند
	// =======================

	staticDir := http.Dir("./static")
	mux.Handle("/", http.FileServer(staticDir))
	// وقتی کاربر / را باز می‌کند، فایل‌های داخل static سرو می‌شوند

	// =======================
	// API: /api/tasks
	// =======================

	mux.HandleFunc("/api/tasks", func(w http.ResponseWriter, r *http.Request) {

		switch r.Method {

		case http.MethodGet:
			// گرفتن لیست تسک‌ها
			tasks := store.List()
			writeJSON(w, 200, tasks)
			return

		case http.MethodPost:
			// خواندن body درخواست
			body, err := io.ReadAll(r.Body)
			if err != nil {
				writeError(w, 400, "invalid body")
				return
			}

			// ساخت struct برای دریافت title
			var req struct {
				Title string `json:"title"`
			}

			// تبدیل JSON به struct
			if err := json.Unmarshal(body, &req); err != nil {
				writeError(w, 400, "invalid json")
				return
			}

			// افزودن تسک
			task, err := store.Add(req.Title)
			if err != nil {
				writeError(w, 400, err.Error())
				return
			}

			writeJSON(w, 201, task)
			return

		default:
			writeError(w, 405, "method not allowed")
			return
		}
	})

	// =======================
	// API: /api/tasks/{id}
	// =======================

	mux.HandleFunc("/api/tasks/", func(w http.ResponseWriter, r *http.Request) {

		// استخراج id از URL
		idStr := strings.TrimPrefix(r.URL.Path, "/api/tasks/")
		idStr = filepath.Clean(idStr)

		if idStr == "." || idStr == "" {
			writeError(w, 400, "missing id")
			return
		}

		// تبدیل id به int
		id, err := strconv.Atoi(idStr)
		if err != nil {
			writeError(w, 400, "invalid id")
			return
		}

		switch r.Method {

		case http.MethodPatch:
			// دریافت مقدار done
			var req struct {
				Done *bool `json:"done"`
			}

			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeError(w, 400, "invalid json")
				return
			}

			if req.Done == nil {
				writeError(w, 400, "done is required")
				return
			}

			task, err := store.ToggleDone(id, *req.Done)
			if err != nil {
				writeError(w, 404, err.Error())
				return
			}

			writeJSON(w, 200, task)
			return

		case http.MethodDelete:
			if err := store.Delete(id); err != nil {
				writeError(w, 404, err.Error())
				return
			}

			writeJSON(w, 200, map[string]any{"ok": true})
			return

		default:
			writeError(w, 405, "method not allowed")
			return
		}
	})

	// =======================
	// اجرای سرور
	// =======================

	addr := "localhost:8080"
	println("Running on http://" + addr)

	if err := http.ListenAndServe(addr, mux); err != nil {
		panic(err)
	}
}
