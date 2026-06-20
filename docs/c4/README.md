# C4 Architecture Diagrams — منصة الحارس تك

---

## المستوى 1: مخطط السياق (Context Diagram)

```
                      ┌──────────────────────┐
                      │      الزائر / العميل    │
                      └──────────┬───────────┘
                                 │
                      ┌──────────┴───────────┐
                      │      الموظف / المدير    │
                      └──────────┬───────────┘
                                 │
                      ┌──────────┴───────────┐
                      │        الشريك          │
                      └──────────┬───────────┘
                                 │
                      ┌──────────┴───────────┐
                      │       المطور           │
                      └──────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │                                      │
              │        منصة الحارس تك                 │
              │     (AlharisTech Platform)            │
              │                                      │
              └──┬───────┬───────┬───────┬───────┬──┘
                 │       │       │       │       │
                 ▼       ▼       ▼       ▼       ▼
           ┌─────────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌──────────┐
           │  بوابة   │ │ SMS │ │بريد │ │  AI  │ │  خارجية   │
           │  الدفع   │ │مزود │ │إلكتروني│ │مزود │ │   APIs   │
           └─────────┘ └─────┘ └─────┘ └─────┘ └──────────┘
```

---

## المستوى 2: مخطط الحاويات (Container Diagram)

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Browser  │  │  Desktop │  │  Mobile   │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
                     ▼
     ┌───────────────────────────────┐
     │    Next.js Frontend (Web)      │
     │    Next.js Admin Dashboard     │
     └───────────────┬───────────────┘
                     │
                     ▼
     ┌───────────────────────────────┐
     │         API Gateway            │
     │     (NestJS + GraphQL)         │
     └───────────────┬───────────────┘
                     │
     ┌───────────────┼───────────────────┐
     │               │                   │
     ▼               ▼                   ▼
┌─────────┐  ┌──────────────┐  ┌──────────────┐
│PostgreSQL│  │    Redis      │  │ S3 Storage   │
│(Primary) │  │ (Cache/Queue) │  │  (Files)     │
└─────────┘  └──────────────┘  └──────────────┘
```

---

## المستوى 3: مخطط المكونات (Component Diagram)

```
                        API Gateway
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Auth Module  │    │  User Module  │    │ Customer     │
│  - Login      │    │  - Profile    │    │  Module      │
│  - Register   │    │  - Settings   │    │  - CRUD      │
│  - JWT        │    │  - Sessions   │    │  - Tags      │
│  - RBAC       │    │               │    │  - History   │
└──────────────┘    └──────────────┘    └──────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Service      │    │  Commerce     │    │  Payment     │
│  Module       │    │  Module       │    │  Module      │
│  - Services   │    │  - Products   │    │  - Invoices  │
│  - Orders     │    │  - Categories │    │  - Gateways  │
│  - Workflow   │    │  - Cart       │    │  - Receipts  │
│  - Documents  │    │  - Inventory  │    │              │
└──────────────┘    └──────────────┘    └──────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Support      │    │  CMS          │    │  Notification│
│  Module       │    │  Module       │    │  Module      │
│  - Tickets    │    │  - Pages      │    │  - Email     │
│  - Knowledge  │    │  - Blog       │    │  - SMS       │
│  - Chat       │    │  - Media      │    │  - Push      │
└──────────────┘    └──────────────┘    └──────────────┘

┌──────────────┐    ┌──────────────┐
│  Analytics    │    │  AI           │
│  Module       │    │  Module       │
│  - Reports    │    │  - Agents     │
│  - Dashboards │    │  - Embeddings │
│  - KPIs       │    │  - RAG        │
└──────────────┘    └──────────────┘
```

---

## المستوى 4: مخطط الكود (Code Diagram)

```
Alharistech/
│
├── apps/
│   ├── web/          ← Next.js الموقع الرسمي
│   ├── admin/        ← Next.js لوحة التحكم
│   ├── desktop/      ← Electron/Tauri تطبيق سطح المكتب
│   ├── mobile/       ← React Native تطبيق الجوال
│   └── api/          ← NestJS API Gateway
│
├── packages/
│   ├── ui/           ← مكونات واجهة مشتركة (React + shadcn/ui)
│   ├── auth/         ← منطق المصادقة المشترك
│   ├── database/     ← مخططات واتصالات قواعد البيانات
│   ├── sdk/          ← JavaScript SDK للتكاملات
│   ├── config/       ← إعدادات مشتركة (ESLint, TS, Tailwind)
│   ├── logger/       ← نظام تسجيل الأحداث
│   ├── types/        ← TypeScript types مشتركة
│   └── utils/        ← دوال مساعدة مشتركة
│
├── domains/
│   ├── identity/     ← المصادقة والصلاحيات
│   ├── customer/     ← إدارة العملاء
│   ├── service/      ← الخدمات والطلبات
│   ├── commerce/     ← المتجر الإلكتروني
│   ├── support/      ← الدعم الفني
│   ├── content/      ← إدارة المحتوى
│   ├── notification/ ← الإشعارات
│   ├── analytics/    ← التقارير والتحليلات
│   └── ai/           ← الذكاء الاصطناعي
│
├── infrastructure/
│   ├── docker/       ← Docker compose للتطوير والنشر
│   ├── k8s/          ← Kubernetes manifests (لاحقاً)
│   └── terraform/    ← Infrastructure as Code (لاحقاً)
│
├── docs/             ← التوثيق
├── specs/            ← المواصفات
├── tasks/            ← خطط التنفيذ
└── tools/            ← أدوات مساعدة
```
