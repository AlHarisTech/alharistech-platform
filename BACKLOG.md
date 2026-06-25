# AlHarisTech Platform — Backlog

## OPEN

### CRBL-002: Deep Recursive Validation (AJV $ref + $id)
**الحالة:** لم يبدأ
**الوصف:** schemas ذات self-reference (Category, MenuItem) تمر بـ AJV دون تحقق فعلي.
**الحل المطلوب:** تسجيل كل schema بـ $id في AJV registry واستخدام $ref native.
**الـ specs المعنية:** 9 specs (تحديدها عند البدء)
**الأولوية:** P2

### Ajv Duplicate Schema Registration
**الحالة:** تم (v0.9.9-rc2)
**الوصف:** `already exists` errors تُسجّل كـ ERROR في stderr.
**الحل:** تحويل duplicate إلى debug log (تم).

### Runtime E2E Flakiness Validation
**الحالة:** لم يبدأ
**الوصف:** 10–20 run محلياً قبل promotion. محجوب حالياً: لا PG/Redis على البيئة المحلية.
**الأولوية:** P3

---

## CLOSED

### @Public() على DashboardController
**أُغلق في:** v0.9.9-rc2
**الثغرة:** جميع EventRuntime routes كانت public بدون تمييز بين read/mutation.
**الحل:** إزالة `@Public()` من مستوى controller وإضافته فقط على read-only routes (health, dashboard, schema/stats).

### JwtAuthGuard — التحقق من توقيع JWT
**أُغلق في:** v0.9.9-rc2
**الثغرة:** PolicyGuard يفك JWT بـ base64 decode فقط (لا تحقق توقيع). أي token مزور يمر.
**الحل:** إنشاء `JwtAuthGuard` يستخدم `jwtVerify` مع `jwtSecret` من AuthService، وتسجيله كأول global guard.

### CRBL-002: Silent Validation Bypass — Tactical Fix
**أُغلق في:** v0.9.9-rc2
**الثغرة:** `resolveRefsRecursive` يُعيد `true` عند اكتشاف circular $ref → أي payload يمر دون تحقق.
**الحل المؤقت:** استبدال `true` بـ `{ type: 'object' }` — يمنع primitive injection.
**ملاحظة:** الحل الجذري (CRBL-002 Deep Recursive Validation) لا يزال OPEN أعلاه.

### AJV Duplicate Schema Registration Guard
**أُغلق في:** v0.9.9-rc2
**الوصف:** رسائل `already exists` من AJV تلوّث stderr بـ ERROR logs.
**الحل:** `try/catch` مع فحص `includes('already exists')` → debug log بدلاً من error.

### ADR-025: Lightweight Runtime Harness
**أُغلق في:** v0.9.9-rc2
**القرار:** لا Docker Compose في CI. خدمات Postgres/Redis عبر GitHub Actions services. API و Dashboard كـ Node processes.

### ADR-026: Recursive Schema Validation Strategy
**أُغلق في:** v0.9.9-rc2
**القرار:** Option C — Hybrid: تكتيكي (Option B) الآن، جذري (Option A) لاحقاً.
