# ADR-002: استخدام NestJS للخدمات الخلفية

## الحالة
مقبول (Accepted)

## التاريخ
2026-06-16

## السياق

منصة AlharisTech تحتاج إلى إطار عمل للخادم (Backend) قادر على استضافة 9 نطاقات (Domains) ضمن بنية DDD (Domain-Driven Design). كل نطاق يمثل Bounded Context مع نماذج بيانات، خدمات، و APIs مستقلة. حجم المنصة (149 endpoint موثقاً في OpenAPI، 94 event schema، 162 RBAC policy rule) يتطلب إطار عمل مؤسسي يدعم النمطية والانضباط الهيكلي منذ البداية.

المتطلبات التفصيلية:
- **المعمارية المؤسسية:** نحتاج Guards, Interceptors, Pipes, Filters كطبقات عرضية (cross-cutting concerns). هذه هي نقاط التمديد التي سيبني عليها CRBL (Contract Runtime Bridge Layer) لاحقاً.
- **النمطية (Modularity):** 9 نطاقات = 9 وحدات NestJS Modules. كل وحدة تغلف controllers, services, providers الخاصة بها. لا تسرب بين الوحدات.
- **API First:** استراتيجية API First (ADR-014, ADR-015) تتطلب توليد OpenAPI specs تلقائياً من الكود. توليد يدوي = تآكل بين الكود والمواصفات.
- **حقن التبعيات (DI):** تطبيقات مؤسسية مع مئات الخدمات تحتاج DI container لإدارة دورة حياة الخدمات وتسهيل الاختبار (mocking).
- **GraphQL + REST + WebSockets:** المنصة تستخدم REST للـ CRUD، GraphQL للاستعلامات المعقدة (ADR-018)، WebSockets للإشعارات الفورية.
- **Queues:** BullMQ (ADR-009) لمعالجة المهام الخلفية (email, SMS, AI inference, report generation).
- **الأمان:** Guards للمصادقة والتفويض. Interceptors للتحقق من العقود. Pipes للتحقق من المدخلات. Filters لمعالجة الأخطاء بشكل موحد.
- **الاختبار:** Testing module لاختبار الوحدات (unit) والتكامل (integration) بسهولة.

## محركات القرار

1. **النمطية على مستوى المؤسسة:** نحتاج فصل صارم بين النطاقات (Bounded Contexts). إطار العمل يجب أن يفرض حدوداً معمارية ويمنع التسرب بين الوحدات.
2. **OpenAPI auto-generation:** توليد OpenAPI specs من الكود مباشرة (وليس العكس في مرحلة التطوير). يضمن أن المواصفات تعكس الكود الفعلي دائماً.
3. **جاهزية CRBL:** ADR-021 يتطلب Guards, Interceptors, Pipes كطبقة تنفيذ للعقود. إطار العمل يجب أن يدعم هذه الأنماط بشكل أصلي وليس عبر monkey-patching.
4. **تكامل GraphQL + WebSocket + BullMQ:** نحتاج هذه التقنيات الثلاثة مدعومة بشكل مباشر بدون حلول ملتفة.
5. **حقن التبعيات (DI):** DI container يسهل إدارة دورة حياة الخدمات، تبديل التطبيقات (implementations)، والاختبار الوهمي (mocking).
6. **TypeScript أصلي:** المنصة بالكامل TypeScript (ADR-005). إطار العمل يجب أن يكون TypeScript-first، ليس مجرد types مُضافة.
7. **أداء مقبول:** الـ p95 latency budget هو < 200ms (كما ورد في enterprise-architecture.md). إطار العمل يجب ألا يستهلك جزءاً كبيراً من هذه الميزانية.
8. **منحنى تعلم معقول:** الفريق خلفيته Angular و Spring Boot. إطار العمل يجب أن يبدو مألوفاً من ناحية الأنماط (decorators, modules, DI).

## الخيارات المدروسة

### الخيار أ: NestJS مع Fastify Adapter (المختار)

- **الوصف:** إطار عمل TypeScript كامل يستخدم أنماط Angular (Modules, Decorators, Providers). الطبقة التحتية HTTP قابلة للتبديل: Express (افتراضي) أو Fastify. نختار Fastify للأداء.
- **إيجابيات:**
  - **معمارية مؤسسية كاملة:** Modules, Controllers, Providers, Guards, Interceptors, Pipes, Filters, Middleware. كل نمط له مكانه ودوره المحدد في دورة حياة الطلب.
  - **OpenAPI تلقائي:** `@nestjs/swagger` يولّد OpenAPI 3.0 specs من decorators على controllers و DTOs. المواصفات تعكس الكود دائماً.
  - **Fastify adapter:** أداء أعلى من Express بنسبة 30-50% (حسب benchmarks). Fastify أسرع في JSON serialization و request parsing. متوافق مع معظم NestJS packages.
  - **GraphQL جاهز:** `@nestjs/graphql` يوفر code-first و schema-first approaches. تكامل مع Apollo Federation للمستقبل (Phase 5).
  - **BullMQ جاهز:** `@nestjs/bullmq` يوفر decorators لتعريف queues و processors. تكامل طبيعي مع DI container.
  - **WebSocket جاهز:** `@nestjs/websockets` يوفر `@WebSocketGateway()` decorator. Socket.IO و WS مدعومان.
  - **TypeScript أصلي:** مبني من الصفر بـ TypeScript. أنواع محسنة، decorators type-safe، generics متقدمة.
  - **Testing Module:** `Test.createTestingModule()` يوفر بيئة اختبار معزولة. DI container يعمل في الاختبارات. Mocking بسيط عبر `overrideProvider`.
  - **مجتمع كبير:** 67K+ GitHub stars، 2M+ weekly npm downloads. توثيق ممتاز، دورات، مجتمع نشط.
  - **أنماط مألوفة:** يشبه Angular في الهيكلة. مطورو Angular و Spring Boot يجدونه مألوفاً.
- **سلبيات:**
  - **منحنى تعلم:** decorators, modules, providers, custom providers, dynamic modules, module references — مفاهيم متعددة للمطورين الجدد.
  - **Boilerplate أكثر:** مقارنة بـ Express، NestJS يتطلب ملفات أكثر: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.spec.ts`.
  - **Fastify adapter ليس متطابقاً مع Express:** بعض الحزم في النظام البيئي (مثل `@nestjs/platform-express`-specific middleware) لا تعمل مع Fastify. نحتاج لتقييم كل حزمة قبل اعتمادها.
  - **سحر مخفي (Hidden magic):** DI container و module resolution قد يخفيان أخطاء. "Why is this provider undefined?" سؤال شائع في بداية التعلم.
  - **حجم التطبيق:** NestJS مع Fastify + GraphQL + BullMQ + Swagger يضيف ~20MB من dependencies. مقارنة بـ Express (~2MB)، لكنه مبرر بحجم المنصة.

### الخيار ب: Express.js

- **الوصف:** إطار عمل HTTP بسيط ومرن. "De facto standard" لـ Node.js. بدون هيكلة مفروضة.
- **إيجابيات:**
  - بسيط: `app.get('/', (req, res) => res.send('Hello'))` — كود كافٍ لبدء الخادم.
  - مجتمع ضخم: ملايين المستخدمين، آلاف الحزم، توثيق وأمثلة لا تحصى.
  - مرونة كاملة: لا هيكلة مفروضة. يمكن تنظيم الكود بأي شكل.
  - خفيف: Express نفسه < 2MB. مناسب للـ serverless functions.
  - أداء جيد: Express مع Node.js 20+ يؤدي جيداً لمعظم الاستخدامات.
- **سلبيات:**
  - لا هيكلة مفروضة: مع 9 نطاقات و 149 endpoint، بدون هيكلة يصبح الكود spaghetti بسرعة.
  - لا OpenAPI تلقائي: نحتاج `swagger-jsdoc` أو `express-oas-generator` — أقل نضجاً وتكاملاً من `@nestjs/swagger`.
  - لا DI مدمج: نحتاج مكتبة منفصلة (`tsyringe`, `inversify`, `awilix`) وتكوين يدوي.
  - لا Guards/Interceptors/Pipes: نحتاج middleware chain يدوي. أقل تنظيم وأكثر عرضة للأخطاء.
  - لا Testing Module: نحتاج `supertest` + إعداد يدوي للـ DI والـ mocks.
  - لا GraphQL/WebSocket/BullMQ جاهز: كل تقنية تحتاج تكامل يدوي. وقت إضافي في الإعداد.

### الخيار ج: Fastify (مستقل)

- **الوصف:** إطار عمل HTTP عالي الأداء. تركيز على السرعة وتجربة المطور. TypeScript دعم جيد.
- **إيجابيات:**
  - أداء عالي جداً: أسرع إطار Node.js HTTP (حسب TechEmpower benchmarks). أقل latency، أعلى throughput.
  - TypeScript جيد: types definitions ممتازة. schema-based validation مدمج (AJV).
  - نظام إضافات غني: plugins تعزل المنطق وتسهل إعادة الاستخدام.
  - JSON Schema validation مدمج: request/response validation عبر schemas (تكامل طبيعي مع CRBL).
  - خفيف: أقل من Express في الحجم وأسرع منه.
- **سلبيات:**
  - لا هيكلة مفروضة: مثل Express، لا Modules/Controllers/Providers. التنظيم يقع على عاتق الفريق.
  - لا DI مدمج: نحتاج مكتبة منفصلة وتكوين يدوي.
  - لا GraphQL/WebSocket/BullMQ جاهز: كل تقنية تحتاج تكامل منفصل.
  - لا OpenAPI تلقائي: `fastify-swagger` يولّد من schemas لكنه أقل نضجاً من `@nestjs/swagger`.
  - نظام إضافات أصغر: مقارنة بـ Express middleware ecosystem و NestJS package ecosystem.
  - إعدادات أكثر: plugins registration, schema definitions, decorators (عبر `@fastify/decorators`). NestJS يجمع كل هذا بشكل متكامل.

### الخيار د: Koa.js

- **الوصف:** إطار عمل HTTP من فريق Express. تصميم جديد مع async/await و middleware cascade.
- **إيجابيات:**
  - حديث: async/await أصلي منذ البداية (ليس مضافاً لاحقاً مثل Express).
  - بسيط وأنيق: middleware cascade بنمط onion. معالجة أخطاء أفضل من Express.
  - خفيف: core صغير، الباقي عبر community modules.
- **سلبيات:**
  - مجتمع أصغر من Express: حزم أقل، دعم أقل، نشاط أقل.
  - لا هيكلة: مثل Express، بدون modules/controllers/DI مدمجة.
  - لا OpenAPI/GraphQL/WebSocket/BullMQ جاهز: كل شيء يحتاج بناء يدوي.
  - صيانة بطيئة: Koa أقل نشاطاً من Express و Fastify و NestJS.

## القرار

اخترنا **NestJS مع Fastify HTTP Adapter** للأسباب التالية:

1. **المعمارية المؤسسية تناسب حجم المنصة:** 9 نطاقات × 149 endpoint × 162 RBAC rule. NestJS Modules, Controllers, Providers توفر هيكلة واضحة منذ اليوم الأول. كل نطاق = NestJS Module مستقل.

2. **تكامل مع CRBL (ADR-021):** Guards, Interceptors, Pipes هي نقاط التمديد التي يحتاجها CRBL لفرض العقود في runtime. ContractGuard كـ NestJS Guard، ContractInterceptor كـ NestJS Interceptor، ContractPipe كـ NestJS Pipe — تكامل طبيعي وليس monkey-patching.

3. **OpenAPI auto-generation:** `@nestjs/swagger` يولّد OpenAPI specs من decorators على controllers و DTOs. المواصفات دقيقة وتعكس الكود الفعلي. لا فجوة بين الكود والمواصفات.

4. **Fastify للأداء:** Express هو الافتراضي في NestJS لكن Fastify أسرع بنسبة 30-50%. نختار Fastify adapter للحصول على أداء أفضل مع الاحتفاظ بكل ميزات NestJS.

5. **النمطية تحقق DDD:** كل Bounded Context = NestJS Module. الـ module يغلف controllers, services, repositories, DTOs. `@Module()` decorator يصرح بالـ imports و exports — حدود صريحة بين النطاقات.

6. **DI container يسهل الاختبار:** `Test.createTestingModule()` يوفر بيئة اختبار معزولة لكل وحدة. الخدمات الوهمية (mock services) تُحقن بسهولة. اختبارات الوحدة سريعة وموثوقة.

7. **GraphQL + WebSocket + BullMQ جاهزون:** `@nestjs/graphql` (code-first per ADR-018)، `@nestjs/websockets` (Socket.IO)، `@nestjs/bullmq` (BullMQ queues). كلها تتكامل مع DI container.

8. **أنماط مألوفة:** الفريق خلفيته Angular و Spring Boot. Decorators, Modules, Providers — أنماط مألوفة تقلل وقت التدريب.

9. **تفاصيل التنفيذ:**
   - `FastifyAdapter` كـ HTTP adapter: `const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());`
   - Module-per-Domain: `IdentityModule`, `CommerceModule`, `SupportModule`, etc. كل Module في مجلد منفصل.
   - Global Guards: `ContractGuard`, `PolicyGuard` تُسجل كـ global guards (`APP_GUARD` provider).
   - Global Interceptors: `ContractInterceptor`, `LoggingInterceptor`, `MetricsInterceptor`.
   - Global Pipes: `ContractPipe` (AJV validation)، `ZodValidationPipe` (business rules).
   - Global Filters: `ContractViolationFilter`, `HttpExceptionFilter`.

## العواقب

### إيجابية

- **هيكلة واضحة ومستدامة:** Modules, Controllers, Services, DTOs — كل ملف له دور محدد. المطورون الجدد يعرفون أين يضعون الكود. النمو المستقبلي (150+ endpoint) لا يؤدي إلى فوضى هيكلية.
- **OpenAPI specs دقيقة وتلقائية:** `@nestjs/swagger` يولّد specs تتطابق مع الكود. API First بدون جهد إضافي. العقود موثوقة.
- **تكامل CRBL طبيعي:** Guards, Interceptors, Pipes هي extension points مصممة لهذا الغرض. ContractGuard يتحقق من كل طلب، ContractInterceptor من كل استجابة، ContractPipe من كل payload.
- **فصل النطاقات (Bounded Contexts):** كل Domain في Module مستقل. يمكن تطوير Identity دون لمس Commerce. ESLint يمنع imports بين النطاقات.
- **اختبار سهل:** Testing Module يعزل كل وحدة. Mocking بسيط. اختبارات سريعة وموثوقة.
- **أداء جيد:** Fastify أسرع من Express. Latency أقل، throughput أعلى. CRBL overhead يبقى ضمن ميزانية < 5ms.
- **جاهزية للمستقبل:** GraphQL Federation (Phase 5)، WebSocket scaling، BullMQ advanced patterns — كلها مدعومة في النظام البيئي.

### سلبية

- **منحنى تعلم أعلى:** Developers الجدد يحتاجون أسبوعاً إلى أسبوعين لفهم: Modules, Providers, Custom Providers, Dynamic Modules, Module References, Injection Scopes, Guards vs Interceptors vs Pipes vs Filters, Circular Dependency Resolution.
- **Boilerplate أكثر:** مقارنة بـ Express، كل Domain يحتاج: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.spec.ts`, `*.interface.ts`, `*.repository.ts`. 9 Domains × 7 files = 63 ملف حد أدنى (غير الـ shared code).
- **Fastify adapter ليس بديلاً كاملاً لـ Express:** بعض الحزم في المجتمع مبينة لـ Express فقط. نحتاج لتقييم التوافق قبل اعتماد أي حزمة. مثال: `nestjs-pino` يدعم Fastify، لكن بعض middleware packages لا تدعمه.
- **سحر مخفي:** DI container يحل التبعيات تلقائياً. عندما لا يعمل، رسائل الخطأ قد تكون غامضة: `"Nest can't resolve dependencies of the XService"` بدون سياق كافٍ.

### مخاطر

- **المخاطرة 1: Over-engineering في المراحل المبكرة.**
  NestJS يشجع أنماطاً معقدة (CQRS، Event Sourcing، Sagas). البدء بهذه الأنماط قبل الحاجة يضيف تعقيداً غير ضروري.
  - **التخفيف:** نبدأ بـ Modules بسيطة: Controller → Service → Repository. نضيف الأنماط المتقدمة فقط عندما يثبت النطاق حاجته. قاعدة: "3 استخدامات متشابهة قبل استخراج abstraction".

- **المخاطرة 2: Fastify adapter توافقية مع الحزم.**
  بعض NestJS packages (مثل `@nestjs/serve-static`، بعض middleware) تفترض Express. استخدامها مع Fastify قد يسبب أخطاء وقت التشغيل.
  - **التخفيف:** نختبر كل حزمة مع Fastify قبل اعتمادها. نستخدم `@nestjs/platform-fastify` كـ peer dependency. نوثق الحزم المتوافقة وغير المتوافقة. إذا كانت حزمة أساسية لا تعمل مع Fastify، نتحول إلى Express (تنازل عن ~30% أداء مقابل التوافقية).

- **المخاطرة 3: نسخ NestJS الرئيسية قد تكسر الكود.**
  NestJS 10 → 11 قد يغير سلوك Guards أو DI resolution. الاعتماد على سلوك غير موثق خطير.
  - **التخفيف:** تثبيت الإصدارات (`"@nestjs/core": "~10.x"`). Renovate يراقب التحديثات. اختبار شامل قبل الترقية. نعتمد على APIs موثقة فقط.

- **المخاطرة 4: تسرب بين النطاقات عبر imports.**
  مطور في Commerce Module يستورد `IdentityService` مباشرة بدلاً من استخدام `ClientProxy` أو REST API. هذا يكسر حدود DDD Bounded Contexts.
  - **التخفيف:** ESLint rule مخصص: `no-cross-domain-import`. أي import من `../identity/` في `commerce/` = خطأ. استثناءات لـ shared packages (`@alharistech/shared`). dependency-cruiser للتحقق من عدم وجود تبعيات دائرية بين الوحدات.

## الامتثال

- **حدود الوحدات (Module Boundaries):** كل NestJS Module يغلف Domain واحد. لا imports مباشرة بين الوحدات (مثلاً `commerce/` لا يستورد من `identity/`). التواصل بين الوحدات عبر REST API أو Message Broker. يُفحص بواسطة ESLint rule `no-cross-domain-import` و dependency-cruiser في CI.
- **OpenAPI Coverage:** كل Controller method يجب أن يكون مزيناً بـ `@ApiOperation()`, `@ApiResponse()`, `@ApiBearerAuth()` (إذا تطلب مصادقة). يُفحص بواسطة `verify-contracts` script — أي endpoint بدون OpenAPI decorators يمنع الدمج.
- **DTO Validation:** كل DTO يجب أن يستخدم `class-validator` أو Zod schemas (حسب coding-standards.md). DTOs بدون validators تسمح ببيانات غير متوقعة. يُفحص بواسطة ESLint.
- **Fastify Adapter:** استخدام `FastifyAdapter` إلزامي في `apps/api/src/main.ts` (إلا إذا وثّقنا سبباً للتحول إلى Express). يُفحص في code review.
- **No Business Logic in Controllers:** Controllers للـ routing والـ validation فقط. المنطق التجاري في Services. يُفحص بواسطة ESLint rule: `max-lines-per-function` (Controllers < 30 lines).
- **Testing Coverage:** كل Service يجب أن يكون له unit test. كل Controller يجب أن يكون له integration test. يُفحص بواسطة `jest --coverage` في CI (threshold: 80%).

## القرارات ذات الصلة

- [ADR-005: TypeScript عبر المنصة](./adr-005-typescript.md) — NestJS مبني بـ TypeScript. التكامل طبيعي.
- [ADR-014: API First Design](./adr-014-api-first.md) — NestJS يدعم API First عبر `@nestjs/swagger` decorators.
- [ADR-015: OpenAPI/Swagger Documentation](./adr-015-openapi-swagger.md) — توليد OpenAPI specs من NestJS decorators.
- [ADR-016: Domain-Driven Design](./adr-016-domain-driven-design.md) — NestJS Modules = DDD Bounded Contexts. حدود الوحدات تحقق الفصل بين النطاقات.
- [ADR-017: Drizzle ORM](./adr-017-orm-drizzle.md) — Drizzle يتكامل مع NestJS عبر Custom Provider (`DRIZZLE_PROVIDER`).
- [ADR-021: Contract Runtime Bridge Layer (CRBL)](./adr-021-contract-runtime-bridge.md) — CRBL يستخدم NestJS Guards, Interceptors, Pipes كطبقة تنفيذ.
- [ADR-022: CRBL Runtime Anchor](./adr-022-crbl-runtime-anchor.md) — NestJS runtime skeleton هو الـ anchor الذي يرتبط به CRBL.
- [ADR-009: BullMQ for Background Jobs](./adr-009-bullmq.md) — `@nestjs/bullmq` يوفر تكامل BullMQ مع NestJS DI.
- [ADR-018: GraphQL Code-First](./adr-018-graphql-code-first.md) — `@nestjs/graphql` يدعم code-first approach.

## المراجع

- [NestJS Documentation](https://docs.nestjs.com/) — الإطار الأساسي
- [NestJS Fastify Platform](https://docs.nestjs.com/techniques/performance) — Fastify adapter setup
- [Fastify Documentation](https://fastify.dev/) — HTTP server عالي الأداء
- [@nestjs/swagger Documentation](https://docs.nestjs.com/openapi/introduction) — OpenAPI generation
- [@nestjs/graphql Documentation](https://docs.nestjs.com/graphql/quick-start) — GraphQL integration
- [@nestjs/bullmq Documentation](https://docs.nestjs.com/techniques/queues) — BullMQ integration
- [NestJS Testing Module](https://docs.nestjs.com/fundamentals/testing) — Testing infrastructure
- [NestJS Request Lifecycle](https://docs.nestjs.com/faq/request-lifecycle) — دورة حياة الطلب (Guards → Interceptors → Pipes → Controller → Interceptors → Filters)
- [Fastify Benchmarks](https://fastify.dev/benchmarks/) — مقارنة أداء Fastify vs Express
