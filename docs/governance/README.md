# حوكمة التطوير — منصة الحارس تك

## المبادئ الأساسية

1. **Documentation First** — لا كود بدون توثيق
2. **Specification Before Implementation** — مواصفات قبل التنفيذ
3. **Review Before Merge** — مراجعة قبل الدمج
4. **Test Before Release** — اختبار قبل الإطلاق
5. **ADR for Decisions** — توثيق القرارات المعمارية

---

## سير العمل (Development Workflow)

### Git Strategy: Trunk-Based Development

```
main (production)
  │
  ├── develop (staging)
  │     │
  │     ├── feature/xxx
  │     ├── fix/xxx
  │     ├── chore/xxx
  │     └── docs/xxx
  │
  └── hotfix/xxx (من main مباشرة)
```

### تسمية الفروع (Branch Naming)

| النوع | الصيغة | مثال |
|:---|:---|:---|
| ميزة جديدة | `feature/<وصف-مختصر>` | `feature/user-auth` |
| إصلاح خطأ | `fix/<وصف-مختصر>` | `fix/login-redirect` |
| مهمة غير وظيفية | `chore/<وصف-مختصر>` | `chore/update-deps` |
| توثيق | `docs/<وصف-مختصر>` | `docs/api-endpoints` |
| إصلاح عاجل | `hotfix/<وصف-مختصر>` | `hotfix/payment-error` |

---

## تسمية الـ Commits: Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

| النوع | الاستخدام |
|:---|:---|
| `feat` | ميزة جديدة |
| `fix` | إصلاح خطأ |
| `docs` | توثيق |
| `style` | تنسيق (مسافات، فواصل...) |
| `refactor` | إعادة هيكلة |
| `perf` | تحسين أداء |
| `test` | إضافة/تعديل اختبارات |
| `chore` | مهام روتينية |
| `ci` | CI/CD |
| `build` | نظام البناء |

### أمثلة:
```
feat(auth): add JWT refresh token rotation
fix(orders): prevent duplicate order submission
docs(api): document customer endpoints
refactor(crm): extract customer search to separate service
```

---

## استراتيجية الفروع (Branching Strategy)

```
1. إنشاء فرع من develop
   git checkout -b feature/xxx develop

2. العمل على الفرع + commits
   git commit -m "feat(scope): description"

3. رفع الفرع
   git push origin feature/xxx

4. فتح Pull Request → develop

5. المراجعة + CI checks تمر

6. الدمج (Squash & Merge)

7. حذف الفرع
```

---

## قواعد المراجعة (Code Review Rules)

### قبل فتح PR:
- [ ] جميع الاختبارات تمر محلياً
- [ ] الكود يتبع معايير التنسيق (ESLint, Prettier)
- [ ] لا توجد تحذيرات TypeScript
- [ ] تمت إضافة اختبارات للميزة/الإصلاح

### أثناء المراجعة:
- [ ] مراجع واحد على الأقل (2 للميزات الكبيرة)
- [ ] التحقق من الأمان (لا مفاتيح، لا secrets)
- [ ] التحقق من الأداء (لا استعلامات N+1)
- [ ] التحقق من التوثيق (API docs محدثة)

---

## إدارة الإصدارات (Versioning)

نتبع **Semantic Versioning (SemVer)**:

```
MAJOR.MINOR.PATCH
```

| الجزء | متى يزيد |
|:---|:---|
| MAJOR | تغييرات غير متوافقة مع الإصدار السابق |
| MINOR | ميزات جديدة متوافقة مع الإصدار السابق |
| PATCH | إصلاحات متوافقة مع الإصدار السابق |

### أمثلة:
- `0.1.0` — أول إصدار قابل للتجربة
- `0.2.0` — إضافة نظام الطلبات
- `0.2.1` — إصلاح خطأ في الطلبات
- `1.0.0` — أول إصدار إنتاجي

---

## هيكل الـ Pull Request

```markdown
## الوصف
[وصف مختصر للتغييرات]

## نوع التغيير
- [ ] ميزة جديدة
- [ ] إصلاح خطأ
- [ ] إعادة هيكلة
- [ ] توثيق

## الاختبارات
- [ ] Unit tests تمر
- [ ] Integration tests تمر
- [ ] تم اختبارها يدوياً

## قائمة المراجعة
- [ ] الكود يتبع معايير التنسيق
- [ ] تم تحديث التوثيق
- [ ] لا توجد أسرار أو مفاتيح في الكود
- [ ] تم اختبار الأداء

## Related Issues
Closes #XXX
```

---

## سياسة التوثيق (Documentation Policy)

| نوع التوثيق | الموقع | متى يكتب |
|:---|:---|:---|
| الرؤية والاستراتيجية | `docs/vision/` | Sprint 0 |
| نموذج العمل | `docs/business/` | Sprint 0 |
| متطلبات المنتج | `docs/requirements/` | Sprint 0 + تحديث مستمر |
| قرارات معمارية | `docs/adr/` | عند كل قرار |
| C4 Diagrams | `docs/c4/` | Sprint 0 + تحديث عند التغيير |
| API Documentation | OpenAPI (تلقائي) | مع كل endpoint |
| README | كل مجلد رئيسي | مع كل مكون |
| Changelog | `CHANGELOG.md` | مع كل إصدار |

---

## معايير الجودة (Quality Gates)

### المستوى 1: التنسيق (Linting)
- ESLint يمر بدون أخطاء
- Prettier يمر
- TypeScript strict mode بدون أخطاء

### المستوى 2: الاختبارات (Testing)
- Unit tests: تغطية ≥ 80%
- Integration tests: تغطية ≥ 70%
- جميع الاختبارات تمر

### المستوى 3: الأمان (Security)
- لا توجد مفاتيح أو أسرار في الكود
- تدقيق التبعيات (npm audit / Dependabot)
- فحص SAST (CodeQL)

### المستوى 4: الأداء (Performance)
- زمن استجابة API < 200ms (p95)
- حجم الحزمة الأمامية < 200KB (gzipped)
- Lighthouse score ≥ 90
