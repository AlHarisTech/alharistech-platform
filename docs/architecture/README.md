# المعمارية التقنية — منصة الحارس تك

## نظرة عامة

تعتمد منصة الحارس تك على **المعمارية الطبقية النمطية** (Modular Layered Architecture) مع فصل واضح بين طبقات النظام، مما يسمح بالتوسع الأفقي والرأسي.

---

## الطبقات المعمارية (Architecture Layers)

### الطبقة 1: طبقة العرض (Presentation Layer)
- **Next.js Frontend** (الموقع الرسمي)
- **Next.js Admin Dashboard** (لوحة التحكم)
- **Electron/Tauri Desktop App** (تطبيق سطح المكتب)
- **React Native Mobile App** (تطبيق الجوال)

### الطبقة 2: طبقة API (API Layer)
- **NestJS API Gateway**: نقطة الدخول الموحدة
- **REST API**: للعمليات التقليدية
- **GraphQL**: للاستعلامات المعقدة
- **OpenAPI/Swagger**: للتوثيق التلقائي
- **Webhooks**: للإشعارات الخارجية

### الطبقة 3: طبقة التطبيق (Application Layer)
- **Domain Modules**: كل نطاق أعمال (auth, customer, service, commerce, ...)
- **Application Services**: تنسيق بين النطاقات
- **Use Cases**: منطق الأعمال
- **DTOs**: كائنات نقل البيانات

### الطبقة 4: طبقة البنية التحتية (Infrastructure Layer)
- **PostgreSQL**: قاعدة البيانات الأساسية
- **Redis**: التخزين المؤقت، الجلسات، الطوابير
- **S3/MinIO**: تخزين الملفات
- **BullMQ**: طوابير المهام
- **Email Provider**: إرسال البريد
- **SMS Provider**: إرسال الرسائل
- **Payment Gateway**: معالجة المدفوعات

---

## الأنماط المعمارية المستخدمة

| النمط | الاستخدام |
|:---|:---|
| **Domain-Driven Design (DDD)** | تنظيم الكود حول نطاقات الأعمال |
| **Hexagonal Architecture** | فصل منطق الأعمال عن البنية التحتية |
| **CQRS** (لاحقاً) | فصل القراءة عن الكتابة للعمليات المعقدة |
| **Event-Driven** (لاحقاً) | التواصل بين النطاقات عبر الأحداث |
| **Microservices** (لاحقاً) | فصل النطاقات إلى خدمات مستقلة عند الحاجة |
| **API Gateway** | نقطة دخول موحدة لجميع القنوات |

---

## هيكل النطاق الواحد (Domain Structure)

```
domains/identity/
├── application/
│   ├── commands/
│   ├── queries/
│   ├── handlers/
│   └── services/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/
│   └── events/
├── infrastructure/
│   ├── persistence/
│   ├── messaging/
│   └── external/
└── presentation/
    ├── controllers/
    ├── resolvers/
    └── dtos/
```

---

## تدفق البيانات (Data Flow)

```
User Action
  → React Component (Frontend)
    → API Call (TanStack Query / fetch)
      → API Gateway (NestJS)
        → Controller (Validate Input)
          → Application Service (Use Case)
            → Domain Service (Business Logic)
              → Repository (Data Access)
                → PostgreSQL / Redis / S3
              ← Data
            ← Result
          ← DTO
        ← Response
      ← JSON
    ← State Update
  ← UI Update
```

---

## استراتيجية التخزين المؤقت (Caching Strategy)

| المستوى | التقنية | TTL |
|:---|:---|:---|
| CDN Cache | Vercel/CloudFront | ساعة واحدة |
| HTTP Cache | ETag/Last-Modified | حسب المورد |
| Application Cache | Redis | 5-15 دقيقة |
| Database Cache | PostgreSQL Shared Buffers | تلقائي |
| Query Cache | TanStack Query | 5 دقائق |

---

## استراتيجية الأمان (Security Strategy)

| الطبقة | الإجراء |
|:---|:---|
| النقل | TLS 1.3 |
| المصادقة | JWT + Refresh Tokens |
| الصلاحيات | RBAC مع أذونات دقيقة |
| البيانات المخزنة | AES-256 |
| المدخلات | Validation + Sanitization |
| الحماية | Rate Limiting, CORS, Helmet |
| المراقبة | Audit Logging |
| الاختبار | Penetration Testing دوري |

---

## استراتيجية الاختبار (Testing Strategy)

| المستوى | الأداة | التغطية المستهدفة |
|:---|:---|:---|
| Unit Tests | Jest/Vitest | ≥ 80% |
| Integration Tests | Jest + Supertest | ≥ 70% |
| E2E Tests | Playwright | Core flows 100% |
| API Tests | Jest + Supertest | All endpoints |
| Performance Tests | k6 | Critical paths |
| Security Tests | OWASP ZAP | دوري |
