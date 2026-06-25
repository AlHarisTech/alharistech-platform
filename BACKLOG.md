# AlHarisTech Platform — Backlog

## OPEN

### Runtime E2E Flakiness Validation
**الحالة:** لم يبدأ
**الوصف:** 10–20 run محلياً قبل promotion. محجوب حالياً: لا PG/Redis على البيئة المحلية.
**الأولوية:** P3

---

## CLOSED

### CRBL-002: Deep Recursive Validation (AJV-native $ref)
**أُغلق في:** v0.9.9-rc2 (`e3d1b14`)
**الثغرة:** schemas ذات self-reference (Category children, MenuItem modifiers) تُحوّل إلى `{ type: 'object' }` → لا تحقق للـ nested properties.
**الحل الجذري:** حفظ `$ref` الأصلي وإمراره إلى AJV الذي يحل circular references عبر الـ registry الداخلي (`addSchema`). الآن كل مستويات الـ recursion تُتحقّق بالكامل.
**Ref:** ADR-026 — Option A

### JwtAuthGuard — التحقق من توقيع JWT
**أُغلق في:** v0.9.9-rc2
**الثغرة:** PolicyGuard يفك JWT بـ base64 decode فقط (لا تحقق توقيع). أي token مزور يمر.
**الحل:** إنشاء `JwtAuthGuard` يستخدم `jwtVerify` مع `jwtSecret` من AuthService، وتسجيله كأول global guard.

### @Public() على DashboardController
**أُغلق في:** v0.9.9-rc2
**الثغرة:** جميع EventRuntime routes كانت public بدون تمييز بين read/mutation.
**الحل:** إزالة `@Public()` من مستوى controller وإضافته فقط على read-only routes (health, dashboard, schema/stats).

### AJV Duplicate Schema Registration Guard
**أُغلق في:** v0.9.9-rc2
**الوصف:** رسائل `already exists` من AJV تلوّث stderr بـ ERROR logs.
**الحل:** `try/catch` مع فحص `includes('already exists')` → debug log بدلاً من error.

### ADR-025: Lightweight Runtime Harness
**أُغلق في:** v0.9.9-rc2
**القرار:** لا Docker Compose في CI. خدمات Postgres/Redis عبر GitHub Actions services. API و Dashboard كـ Node processes.

### ADR-026: Recursive Schema Validation Strategy
**أُغلق في:** v0.9.9-rc2
**القرار:** Option C — Hybrid: تكتيكي (Option B) أولاً، ثم جذري (Option A) في نفس الـ Sprint.
