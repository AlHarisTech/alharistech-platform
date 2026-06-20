# خطة التنفيذ الرئيسية (Implementation Master Plan)

## المقدمة

هذه الوثيقة تحدد خطة التنفيذ المفصلة لبناء منصة الحارس تك، مقسمة حسب المراحل (Phases) وسباقات العمل (Sprints). كل Sprint يحتوي على مهام محددة مع مخرجات واضحة.

---

## Sprint 0 — Architecture Foundation (الحالي)

**المدة:** 2-4 أسابيع | **الحالة:** قيد التنفيذ

### Sprint 0.1: توثيق الرؤية والاستراتيجية
- [x] إنشاء هيكل المجلدات
- [x] كتابة وثيقة الرؤية
- [x] كتابة نموذج العمل
- [ ] مراجعة واعتماد الرؤية

### Sprint 0.2: توثيق المتطلبات
- [x] كتابة PRD
- [x] كتابة متطلبات النظام (Functional + Non-Functional)
- [ ] مراجعة واعتماد المتطلبات

### Sprint 0.3: التوثيق المعماري
- [x] كتابة ADRs
- [x] رسم C4 Diagrams
- [x] كتابة Architecture Overview
- [ ] مراجعة واعتماد المعمارية

### Sprint 0.4: التخطيط والحوكمة
- [x] كتابة Roadmap
- [x] كتابة Development Governance
- [x] كتابة Workflows
- [x] كتابة Repository Blueprint
- [x] كتابة Master Plan
- [ ] مراجعة واعتماد الخطة

### Sprint 0.5: إعداد بيئة التطوير (قادم)
- [ ] تهيئة Monorepo (Turborepo + pnpm)
- [ ] إعداد Docker Compose
- [ ] إعداد PostgreSQL + Redis
- [ ] إعداد NestJS (مشروع فارغ)
- [ ] إعداد Next.js (مشروع فارغ)
- [ ] إعداد TailwindCSS + shadcn/ui
- [ ] إعداد CI/CD (GitHub Actions)
- [ ] إعداد Linting + Formatting
- [ ] أول Commit

---

## Phase 1 — التواجد الرقمي: الموقع الرسمي

**المدة:** 3-4 أشهر | **الأولوية:** P0

### Sprint 1.1: أساس النظام (2 أسابيع)
**الهدف:** بناء الهيكل الأساسي وتشغيل النظام محلياً

| # | المهمة | المخرجات |
|:---|:---|:---|
| 1.1.1 | إعداد Monorepo مع Turborepo | هيكل المشروع يعمل |
| 1.1.2 | إعداد NestJS مع Hello World | API يعمل على port 4000 |
| 1.1.3 | إعداد Next.js مع TailwindCSS | Web يعمل على port 3000 |
| 1.1.4 | إعداد PostgreSQL مع Docker | قاعدة بيانات متاحة |
| 1.1.5 | إعداد Redis مع Docker | Redis متاح |
| 1.1.6 | إعداد Prisma/Drizzle ORM | اتصال قاعدة البيانات |
| 1.1.7 | إعداد Shared Packages | @aht/ui, @aht/types, @aht/config |
| 1.1.8 | إعداد CI/CD Pipeline | GitHub Actions |

### Sprint 1.2: نظام المصادقة (1 أسبوع)
**الهدف:** تسجيل الدخول، إنشاء الحسابات، إدارة الجلسات

| # | المهمة | المخرجات |
|:---|:---|:---|
| 1.2.1 | إنشاء users table + migration | جدول المستخدمين |
| 1.2.2 | POST /auth/register | واجهة تسجيل |
| 1.2.3 | POST /auth/login | واجهة دخول (JWT + Refresh) |
| 1.2.4 | POST /auth/refresh | تجديد الرمز |
| 1.2.5 | POST /auth/forgot-password | استعادة كلمة المرور |
| 1.2.6 | RBAC Guards (admin, employee, customer) | حماية المسارات |
| 1.2.7 | صفحات الواجهة: تسجيل، دخول، استعادة | واجهة مستخدم |
| 1.2.8 | Middleware لحماية الصفحات | توجيه ذكي |

### Sprint 1.3: الموقع الرسمي (2 أسابيع)
**الهدف:** الصفحات الرئيسية للموقع

| # | المهمة | المخرجات |
|:---|:---|:---|
| 1.3.1 | Layout عام (Header, Footer) | هيكل الموقع |
| 1.3.2 | الصفحة الرئيسية | Hero + خدمات + مميزات |
| 1.3.3 | صفحة "من نحن" | عن المؤسسة |
| 1.3.4 | صفحة "اتصل بنا" | نموذج تواصل |
| 1.3.5 | صفحات الخدمات (عرض + تفاصيل) | عرض الخدمات |
| 1.3.6 | Responsive Design | يعمل على جميع الأحجام |
| 1.3.7 | RTL Support كامل | دعم اللغة العربية |
| 1.3.8 | SEO Optimization | Metadata + OpenGraph |

### Sprint 1.4: إدارة المحتوى (CMS) (2 أسابيع)
**الهدف:** لوحة تحكم لإدارة محتوى الموقع

| # | المهمة | المخرجات |
|:---|:---|:---|
| 1.4.1 | نظام إدارة الصفحات | CRUD للصفحات |
| 1.4.2 | محرر نصوص غني (TipTap/Slate) | تحرير المحتوى |
| 1.4.3 | رفع وإدارة الوسائط | صور وملفات |
| 1.4.4 | إدارة المدونة (مقالات + تصنيفات) | نظام تدوين |
| 1.4.5 | إدارة SEO Metadata | Meta titles/descriptions |
| 1.4.6 | لوحة تحكم CMS | واجهة المشرف |

### Sprint 1.5: نظام الخدمات والطلبات (3 أسابيع)
**الهدف:** تقديم طلبات الخدمات إلكترونياً

| # | المهمة | المخرجات |
|:---|:---|:---|
| 1.5.1 | API: CRUD Services | إدارة الخدمات |
| 1.5.2 | API: Create/Get/Update Orders | إدارة الطلبات |
| 1.5.3 | API: Upload Documents | رفع المستندات |
| 1.5.4 | API: Order Status Workflow | سير عمل الطلب |
| 1.5.5 | لوحة العميل: تقديم طلب | نموذج التقديم |
| 1.5.6 | لوحة العميل: طلباتي | تتبع الطلبات |
| 1.5.7 | لوحة الموظف: الطلبات الواردة | معالجة الطلبات |
| 1.5.8 | إشعارات البريد: تأكيد، تحديث | Email Notifications |

### Sprint 1.6: الاختبار والإطلاق (2 أسابيع)
**الهدف:** تحسين الجودة وإطلاق النسخة الأولى

| # | المهمة | المخرجات |
|:---|:---|:---|
| 1.6.1 | Unit Tests (≥ 80%) | اختبارات الوحدة |
| 1.6.2 | Integration Tests | اختبارات التكامل |
| 1.6.3 | E2E Tests (Core flows) | اختبارات شاملة |
| 1.6.4 | Performance Optimization | Lighthouse ≥ 90 |
| 1.6.5 | Security Audit | OWASP checks |
| 1.6.6 | Arabic Content Review | مراجعة المحتوى |
| 1.6.7 | Deploy to Staging | إصدار تجريبي |
| 1.6.8 | Launch v0.1.0 | إطلاق رسمي |

---

## Phase 2 — الإدارة الداخلية

**المدة:** 4-6 أشهر | **الأولوية:** P0

### Sprint 2.1: لوحة التحكم (2 أسابيع)
- [ ] Admin Dashboard Layout
- [ ] Overview Statistics
- [ ] Quick Actions
- [ ] Recent Orders/Tickets Widgets

### Sprint 2.2: نظام CRM (3 أسابيع)
- [ ] Customers List + Search + Filter
- [ ] Customer Profile Page
- [ ] Customer Tags & Categories
- [ ] Communication History
- [ ] Import/Export Customers

### Sprint 2.3: الفواتير (2 أسابيع)
- [ ] Create Invoice (Manual/Auto)
- [ ] Invoices List + Filter
- [ ] Payment Gateway Integration
- [ ] Payment History
- [ ] PDF Receipts

### Sprint 2.4: التذاكر (3 أسابيع)
- [ ] Create Ticket
- [ ] Ticket Queue Management
- [ ] Assign Tickets
- [ ] Ticket Workflow
- [ ] Knowledge Base Integration

### Sprint 2.5: الإشعارات (1 أسبوع)
- [ ] Email Templates
- [ ] Notification Settings
- [ ] In-App Notifications
- [ ] Notification History

### Sprint 2.6: قاعدة المعرفة (2 أسابيع)
- [ ] Articles CRUD
- [ ] Categories & Tags
- [ ] Search
- [ ] Related Articles

### Sprint 2.7: التقارير (2 أسابيع)
- [ ] Sales Reports
- [ ] Customer Reports
- [ ] Employee Performance
- [ ] Export (PDF/Excel)

### Sprint 2.8: الاختبار (2 أسابيع)
- [ ] Full test suite
- [ ] Performance optimization
- [ ] Launch v0.2.0

---

## Phase 3 — التجارة الإلكترونية

**المدة:** 4-6 أشهر | **الأولوية:** P1

(تفاصيل لاحقاً في `tasks/phase-3/`)

---

## Phase 4 — تطبيقات سطح المكتب والجوال

**المدة:** 6-8 أشهر | **الأولوية:** P2

(تفاصيل لاحقاً في `tasks/phase-4/`)

---

## Phase 5 — المنصة المتقدمة والذكاء الاصطناعي

**المدة:** 8-12 شهر | **الأولوية:** P3

(تفاصيل لاحقاً في `tasks/phase-5/`)

---

## تتبع التقدم

### Sprint 0 Progress

```
Sprint 0.1 (Vision & Strategy)    ████████████████████ 100%
Sprint 0.2 (Requirements)         ████████████████████ 100%
Sprint 0.3 (Architecture)         ████████████████████ 100%
Sprint 0.4 (Planning & Gov)       ████████████████████ 100%
Sprint 0.5 (Dev Environment)      ░░░░░░░░░░░░░░░░░░░░   0%
─────────────────────────────────────────────────────
Sprint 0 Overall                  ████████████████░░░░  80%
```

### الخطوة التالية

بعد اعتماد كافة وثائق Sprint 0، ننتقل إلى:
1. Sprint 0.5: إعداد بيئة التطوير
2. Phase 1, Sprint 1.1: أساس النظام
