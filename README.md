# منصة الحارس تك (AlharisTech Platform)

منصة رقمية متكاملة لمؤسسة الحارس تك للخدمات — **Digital Business Operating System**

---

## الرؤية

أن تصبح منصة الحارس تك نظاماً رقمياً متكاملاً يدير كافة أعمال المؤسسة، وقابلاً للتوسع ليصبح منصة خدمات رقمية متعددة المستأجرين.

---

## نطاقات المنصة

| النطاق | الوصف |
|:---|:---|
| **الهوية** | المستخدمين، الأدوار، الصلاحيات |
| **العملاء** | CRM، الملفات الشخصية |
| **الخدمات** | الخدمات الإلكترونية، الطلبات |
| **التجارة** | المتجر، المنتجات، المدفوعات |
| **الدعم** | التذاكر، الدردشة، المعرفة |
| **المحتوى** | CMS، المدونة، الوسائط |
| **الإشعارات** | البريد، SMS، Push |
| **التحليلات** | التقارير، لوحات التحكم |
| **الذكاء الاصطناعي** | AI Agents, RAG, Automation |

---

## التقنيات

| الطبقة | التقنية |
|:---|:---|
| Frontend | Next.js, React, TypeScript, TailwindCSS, shadcn/ui |
| Backend | NestJS, TypeScript, GraphQL, REST |
| Database | PostgreSQL, Redis |
| Storage | S3 Compatible |
| Auth | JWT, Refresh Tokens, RBAC |
| DevOps | Docker, GitHub Actions, Turborepo |

---

## الهيكل

```
Alharistech/
├── apps/            ← التطبيقات (web, admin, desktop, mobile, api)
├── packages/        ← الحزم المشتركة (ui, auth, database, sdk, types...)
├── domains/         ← نطاقات الأعمال (identity, customer, service...)
├── infrastructure/  ← البنية التحتية (docker, k8s, terraform)
├── docs/            ← التوثيق الكامل (الرؤية، المتطلبات، المعمارية...)
├── specs/           ← المواصفات التفصيلية
├── tasks/           ← خطط التنفيذ
└── tools/           ← أدوات مساعدة
```

---

## المراحل

| المرحلة | الهدف | الحالة |
|:---|:---|:---|
| **Sprint 0** | أساس المعمارية والتوثيق | ✅ مكتمل (بانتظار المراجعة) |
| **Phase 1** | الموقع الرسمي + الخدمات + الطلبات | ⬜ قادم |
| **Phase 2** | CRM + الفواتير + التذاكر | ⬜ قادم |
| **Phase 3** | المتجر الإلكتروني | ⬜ قادم |
| **Phase 4** | Desktop + Android + iOS | ⬜ قادم |
| **Phase 5** | SaaS + Marketplace + AI | ⬜ قادم |

---

## البدء

### المتطلبات
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- PostgreSQL 16
- Redis 7

### تشغيل التطوير

```bash
# تثبيت التبعيات
pnpm install

# تشغيل الخدمات المساعدة
docker compose up -d

# تشغيل التطوير
pnpm dev
```

---

## التوثيق

كافة وثائق المشروع موجودة في مجلد `docs/`:

| المسار | المحتوى |
|:---|:---|
| `docs/vision/` | الرؤية الاستراتيجية |
| `docs/business/` | نموذج العمل |
| `docs/requirements/` | PRD + متطلبات النظام |
| `docs/architecture/` | المعمارية التقنية |
| `docs/adr/` | سجل القرارات المعمارية |
| `docs/c4/` | C4 Architecture Diagrams |
| `docs/roadmap/` | خارطة الطريق |
| `docs/governance/` | حوكمة التطوير |
| `docs/workflows/` | سير العمل |

---

## الترخيص

جميع الحقوق محفوظة — مؤسسة الحارس تك © 2026
