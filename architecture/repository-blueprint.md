# مخطط المستودع (Repository Blueprint) — AlharisTech Platform

## نظرة عامة

هذا المخطط يصف الهيكل الدقيق للمستودع البرمجي (Monorepo) لمنصة الحارس تك.

---

## الهيكل الكامل

```
Alharistech/
│
├── .github/
│   ├── workflows/           # GitHub Actions
│   │   ├── ci.yml           # CI: lint, test, build
│   │   ├── deploy-staging.yml
│   │   └── deploy-production.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
│
├── apps/
│   ├── web/                   # Next.js — الموقع الرسمي
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   ├── components/    # React components
│   │   │   ├── hooks/         # Custom hooks
│   │   │   ├── lib/           # Utilities
│   │   │   └── styles/        # Global styles
│   │   ├── public/            # Static assets
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── admin/                 # Next.js — لوحة التحكم
│   │   ├── src/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   ├── desktop/               # Electron/Tauri — سطح المكتب
│   │   ├── src/
│   │   ├── src-tauri/         # Tauri backend (Rust)
│   │   └── package.json
│   │
│   ├── mobile/                # React Native — الجوال
│   │   ├── src/
│   │   ├── ios/
│   │   ├── android/
│   │   └── package.json
│   │
│   └── api/                   # NestJS — API Gateway
│       ├── src/
│       │   ├── modules/       # Domain modules
│       │   ├── common/        # Guards, filters, interceptors
│       │   ├── config/        # Configuration
│       │   └── main.ts        # Entry point
│       ├── test/
│       ├── nest-cli.json
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── ui/                    # مكونات واجهة مشتركة
│   │   ├── src/
│   │   │   ├── components/    # UI components (shadcn/ui based)
│   │   │   ├── layouts/       # Layout components
│   │   │   ├── forms/         # Form components
│   │   │   └── index.ts       # Barrel export
│   │   └── package.json
│   │
│   ├── auth/                  # منطق المصادقة المشترك
│   │   ├── src/
│   │   │   ├── client.ts      # Client-side auth
│   │   │   ├── server.ts      # Server-side auth
│   │   │   ├── middleware.ts   # Auth middleware
│   │   │   └── types.ts       # Auth types
│   │   └── package.json
│   │
│   ├── database/              # طبقة قاعدة البيانات
│   │   ├── src/
│   │   │   ├── schema/        # Drizzle/Prisma schema
│   │   │   ├── migrations/    # Database migrations
│   │   │   ├── seeds/         # Seed data
│   │   │   └── client.ts      # DB client
│   │   └── package.json
│   │
│   ├── sdk/                   # JavaScript SDK
│   │   ├── src/
│   │   │   ├── client.ts      # API client
│   │   │   ├── endpoints/     # Endpoint definitions
│   │   │   └── types.ts       # SDK types
│   │   └── package.json
│   │
│   ├── config/                # إعدادات مشتركة
│   │   ├── eslint/
│   │   │   ├── base.js
│   │   │   ├── next.js
│   │   │   └── nest.js
│   │   ├── typescript/
│   │   │   ├── base.json
│   │   │   ├── next.json
│   │   │   └── nest.json
│   │   └── tailwind/
│   │       └── base.ts
│   │
│   ├── logger/                # نظام تسجيل الأحداث
│   │   ├── src/
│   │   │   ├── logger.ts
│   │   │   ├── transports/
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── types/                 # TypeScript types المشتركة
│   │   ├── src/
│   │   │   ├── user.ts
│   │   │   ├── customer.ts
│   │   │   ├── order.ts
│   │   │   ├── product.ts
│   │   │   ├── ticket.ts
│   │   │   ├── api.ts         # API request/response types
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── utils/                 # دوال مساعدة مشتركة
│       ├── src/
│       │   ├── date.ts
│       │   ├── string.ts
│       │   ├── validation.ts
│       │   ├── formatting.ts  # تنسيق العملات والتواريخ
│       │   └── index.ts
│       └── package.json
│
├── domains/                    # نطاقات الأعمال (Domain Modules)
│   ├── identity/
│   ├── customer/
│   ├── service/
│   ├── commerce/
│   ├── support/
│   ├── content/
│   ├── notification/
│   ├── analytics/
│   └── ai/
│
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.web
│   │   ├── Dockerfile.admin
│   │   ├── docker-compose.yml       # Development
│   │   ├── docker-compose.prod.yml  # Production
│   │   └── postgres/
│   │       └── init.sql
│   │
│   ├── k8s/                         # Kubernetes (للمراحل المتقدمة)
│   │   ├── base/
│   │   ├── overlays/
│   │   │   ├── staging/
│   │   │   └── production/
│   │   └── charts/
│   │
│   └── terraform/                   # IaC (للمراحل المتقدمة)
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── docs/                            # التوثيق (Sprint 0 deliverables)
│   ├── vision/
│   ├── business/
│   ├── requirements/
│   ├── architecture/
│   ├── adr/
│   ├── c4/
│   ├── diagrams/
│   ├── roadmap/
│   ├── workflows/
│   └── governance/
│
├── specs/                           # المواصفات التفصيلية
│   ├── identity/
│   ├── customer/
│   ├── service/
│   ├── commerce/
│   ├── support/
│   ├── content/
│   ├── notification/
│   ├── analytics/
│   └── ai/
│
├── tasks/                           # خطط التنفيذ التفصيلية
│   ├── master-plan.md
│   ├── phase-1/
│   ├── phase-2/
│   └── phase-3/
│
├── scripts/                         # سكريبتات مساعدة
│   ├── setup.sh
│   ├── dev.sh
│   └── db-reset.sh
│
├── tools/                           # أدوات داخلية
│
├── .gitignore
├── .gitattributes
├── .editorconfig
├── .prettierrc
├── .eslintrc.js
├── turbo.json                       # Turborepo config
├── package.json                     # Root package.json (workspaces)
├── pnpm-workspace.yaml              # pnpm workspace config
├── tsconfig.json                    # Root TypeScript config
├── biome.json                       # Linter + Formatter config
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## التبعيات الرئيسية (Root package.json)

```json
{
  "name": "alharistech",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "format": "prettier --write .",
    "db:migrate": "turbo db:migrate",
    "db:seed": "turbo db:seed"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.5.0"
  }
}
```

---

## قواعد البيانات (Database Schema — Core Tables)

### جدول المستخدمين (users)
| العمود | النوع | الوصف |
|:---|:---|:---|
| id | UUID | المعرف |
| email | VARCHAR(255) | البريد الإلكتروني |
| password_hash | VARCHAR(255) | كلمة المرور |
| first_name | VARCHAR(100) | الاسم الأول |
| last_name | VARCHAR(100) | الاسم الأخير |
| phone | VARCHAR(20) | رقم الجوال |
| role | ENUM | admin, employee, customer |
| is_active | BOOLEAN | نشط؟ |
| created_at | TIMESTAMP | تاريخ الإنشاء |
| updated_at | TIMESTAMP | تاريخ التحديث |

### جدول العملاء (customers)
| العمود | النوع | الوصف |
|:---|:---|:---|
| id | UUID | المعرف |
| user_id | UUID (FK) | معرف المستخدم |
| type | ENUM | فرد، شركة |
| company_name | VARCHAR(255) | اسم الشركة |
| tax_number | VARCHAR(50) | الرقم الضريبي |
| notes | TEXT | ملاحظات |
| tags | JSONB | وسوم |
| created_at | TIMESTAMP | تاريخ الإنشاء |

### جدول الخدمات (services)
| العمود | النوع | الوصف |
|:---|:---|:---|
| id | UUID | المعرف |
| name_ar | VARCHAR(255) | الاسم بالعربية |
| name_en | VARCHAR(255) | الاسم بالإنجليزية |
| description_ar | TEXT | الوصف بالعربية |
| description_en | TEXT | الوصف بالإنجليزية |
| price | DECIMAL(10,2) | السعر |
| category_id | UUID (FK) | التصنيف |
| is_active | BOOLEAN | نشطة؟ |
| required_documents | JSONB | المستندات المطلوبة |

### جدول الطلبات (orders)
| العمود | النوع | الوصف |
|:---|:---|:---|
| id | UUID | المعرف |
| customer_id | UUID (FK) | معرف العميل |
| service_id | UUID (FK) | معرف الخدمة |
| status | ENUM | pending, in_progress, completed, cancelled |
| assigned_to | UUID (FK) | الموظف المعين |
| documents | JSONB | المستندات المرفقة |
| notes | TEXT | ملاحظات |
| created_at | TIMESTAMP | تاريخ الإنشاء |
| updated_at | TIMESTAMP | تاريخ التحديث |
