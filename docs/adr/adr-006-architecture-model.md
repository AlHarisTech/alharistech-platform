# ADR-006: اعتماد Modular Layered + DDD + Hexagonal Architecture

## الحالة
مقبول (Accepted)

## التاريخ
2026-06-20

## السياق
تحتاج منصة الحارس تك إلى نموذج معماري (Architecture Model) يحدد هيكلة الكود وتنظيمه عبر جميع طبقات المنصة. المتطلبات الأساسية:
- **9 نطاقات أعمال (Bounded Contexts)** — Identity، Customer، Service، Commerce، Support، Content، Notification، Analytics، AI. كل نطاق يحتاج إلى استقلالية عالية مع إمكانية التواصل مع النطاقات الأخرى.
- **فريق متعدد التخصصات** — مطورو Frontend و Backend و Mobile يعملون بالتوازي. الهيكلة يجب أن تسهل العمل المتوازي دون تعارضات.
- **تطور تدريجي عبر 5 مراحل** — من Monolith Modular (المرحلة 1) إلى Microservices (المرحلة 5). الهيكلة يجب أن تدعم هذا التطور دون إعادة كتابة كاملة في كل مرحلة.
- **قابلية الاختبار (Testability)** — تغطية اختبارات ≥ 80% (NFR-601). الهيكلة يجب أن تسمح باختبار كل طبقة بمعزل عن الأخرى.
- **فصل الاهتمامات (Separation of Concerns)** — فصل واضح بين: منطق الأعمال (Domain Logic)، حالات الاستخدام (Use Cases)، البنية التحتية (Infrastructure)، والتقديم (Presentation).
- **حماية من اقتران البنية التحتية** — منطق الأعمال يجب ألا يعتمد على أطر العمل (Frameworks) أو قواعد البيانات أو خدمات خارجية. هذا يسهل استبدال أي مكون تحتي دون المساس بمنطق الأعمال.
- **Monorepo مع Turborepo** — الهيكلة يجب أن تتوافق مع بنية Monorepo حيث كل نطاق هو مجلد مستقل داخل `apps/api/src/domains/`.
- **أمان متعدد الطبقات** — الهيكلة يجب أن تعزل نطاق Identity (المصادقة) عن باقي النطاقات، مما يدعم تطبيق NFR-301 (TLS 1.3)، NFR-303 (OWASP Top 10)، و NFR-305 (قفل الحساب) عبر Guards و Middleware مركزية.

## محركات القرار
1. تعقيد الأعمال (Business Complexity) — 9 نطاقات مع كيانات وأحداث وسير عمل معقدة.
2. التطور التدريجي من Monolith إلى Microservices (5 مراحل على مدى 2.5–3 سنوات).
3. Monorepo مع Turborepo (ADR-012) يفرض تنظيماً واضحاً للحزم والمجلدات.
4. قابلية الاختبار — الحاجة إلى اختبار كل طبقة بمعزل (Unit Testing لوحدات النطاق، Integration Testing للمحولات).
5. فصل الاهتمامات — منع تسرب منطق الأعمال إلى وحدات التحكم (Controllers) أو العكس.
6. قابلية الاستبدال — القدرة على استبدال PostgreSQL بـ MySQL أو Redis بـ Memcached دون تغيير منطق الأعمال.
7. أمان — عزل النطاقات يحد من تأثير الاختراق (إذا اختُرقت خدمة المحتوى، لا تتأثر خدمة المدفوعات مباشرة).

## الخيارات المدروسة

### الخيار أ: Modular Layered + DDD + Hexagonal Architecture (Ports & Adapters)
- **الوصف:** نموذج معماري يجمع بين ثلاث فلسفات: (1) **Modular Monolith** — كل نطاق هو NestJS Module مستقل داخل Monolith واحد في المراحل 1–4. (2) **Domain-Driven Design (DDD)** — كل نطاق يُنمذج حول Aggregate Roots، Entities، Value Objects، Domain Events. (3) **Hexagonal Architecture (Ports & Adapters)** — كل نطاق يحتوي على: Domain (Core)، Application (Use Cases)، Infrastructure (Adapters)، Presentation (Controllers). الاعتماد يكون دائماً نحو الداخل (Domain ← Application ← Infrastructure/Presentation).
- **إيجابيات:**
  - **فصل تام لمنطق الأعمال عن البنية التحتية** — Domain Layer لا يحتوي على أي `import` من NestJS أو Prisma أو Redis. Entities و Value Objects هي TypeScript نقية. هذا يجعل اختبارها فورياً وسريعاً (لا حاجة لـ TestBed في Jest).
  - **تطور تدريجي طبيعي إلى Microservices** — حدود النطاقات (Bounded Contexts) محددة بوضوح من اليوم الأول. عندما يحين وقت الانتقال إلى Microservices (المرحلة 5)، كل نطاق يُستخرج كخدمة مستقلة مع تغيير طبقة Infrastructure فقط (من استدعاء مباشر إلى HTTP/gRPC).
  - **استقلالية عالية بين الفرق** — كل نطاق هو Module منعزل. فريق Service Domain يمكنه العمل على `domains/service/` دون التعارض مع فريق Commerce Domain على `domains/commerce/`. التعارضات تحدث فقط في الحزم المشتركة (`@alharistech/types`، `common/`).
  - **قابلية اختبار قصوى** — (أ) Domain Layer يُختبر كـ Unit Tests نقية (لا اعتماديات خارجية). (ب) Application Layer يُختبر مع Mocked Repositories. (ج) Infrastructure Layer يُختبر كـ Integration Tests (قاعدة بيانات حقيقية، Redis حقيقي). (د) Presentation Layer يُختبر كـ E2E Tests (Supertest).
  - **استبدال المكونات بسهولة** — Repository Interface (Port) يُعرِّف `findById(id: UUID): Promise<Order>` — تطبيق Prisma (Adapter) يمكن استبداله بـ Drizzle ORM أو حتى API خارجي دون تغيير Domain Layer.
  - **حماية من Vendor Lock-in** — منطق الأعمال لا يعتمد على NestJS. إذا قررنا الانتقال إلى Fastify أو Express.js في المستقبل، Logic يبقى كما هو وتتغير طبقة Presentation فقط.
  - **جاهزية لـ CQRS و Event Sourcing** — مجلدات `commands/` و `queries/` و `events/` موجودة من البداية (ولو استُخدمت كـ CRUD بسيط في البداية). عند الحاجة لـ CQRS الحقيقي (المرحلة 3+)، الهيكلة جاهزة.
- **سلبيات:**
  - **Boilerplate أكثر في البداية** — كل نطاق يحتاج إلى 4 مجلدات فرعية (domain، application، infrastructure، presentation) + Interfaces + Implementations. هذا يزيد عدد الملفات مقارنة بهيكلة MVC بسيطة (Controller → Service → Model).
  - **منحنى تعلم أعلى** — المطورون الجدد (خاصة القادمين من خلفية MVC أو Express.js) يحتاجون لفهم: Ports vs Adapters، Dependency Inversion، Domain Events، Aggregate Roots. هذا يضيف 2–4 أسابيع للإعداد.
  - **تضخم محتمل في المراحل المبكرة** — في المرحلة 1 (MVP)، بعض النطاقات (مثل Content أو Notification) قد لا تحتاج كل هذا التعقيد. خطر Over-Engineering.
  - **تحديد حدود النطاقات (Bounded Contexts) مبكراً** — قرارات تحديد حدود النطاقات تُتخذ في بداية المشروع بناءً على فهم حالي للأعمال. إذا تغير الفهم لاحقاً، قد تحتاج الحدود إلى إعادة تعريف.

### الخيار ب: Clean Architecture (Uncle Bob)
- **الوصف:** نموذج معماري مركزي حول Cases (Use Cases) مع دوائر متحدة المركز: Entities (Inner)، Use Cases، Interface Adapters، Frameworks & Drivers (Outer).
- **إيجابيات:**
  - فصل صارم جداً للاعتماديات (Dependency Rule) — الاعتماد يكون دائماً نحو الداخل فقط.
  - نظرية متكاملة ومشهورة مع مجتمع كبير وكتب وموارد تعليمية.
  - Entities مستقلة تماماً عن كل شيء (حتى عن Use Cases الأخرى).
- **سلبيات:**
  - **لا يتكامل طبيعياً مع NestJS** — Clean Architecture تفترض أن Controllers و Presenters و Gateways هي تفاصيل (Details) في الطبقة الخارجية. NestJS بتصميمه المعياري (Modules، Decorators، DI) يتعارض جزئياً مع هذا الفصل الصارم. سنحتاج إلى "محاربة الإطار" بدلاً من الاستفادة منه.
  - **تعقيد أعلى من اللازم** — استدعاء Use Case بسيط (`createOrder`) في Clean Architecture يتطلب: Controller → Input Boundary (Interface) → Interactor (Implementation) → Output Boundary (Interface) → Presenter → ViewModel. هذا Over-Engineering للمشروع في المراحل 1–3.
  - **لا يدعم مفهوم الـ Module كنطاق** — NestJS Module هو وحدة تنظيمية طبيعية. Clean Architecture لا تتكامل مع مفهوم الـ Module، مما يخلق احتكاكاً بين تنظيف الكود (Clean Code) وتنظيم NestJS.

### الخيار ج: Pure Microservices (من البداية)
- **الوصف:** كل نطاق هو خدمة مستقلة (Separate Deployable) مع قاعدة بيانات خاصة و API مستقل منذ اليوم الأول.
- **إيجابيات:**
  - استقلالية قصوى — كل خدمة يمكن تطويرها، نشرها، وتوسيعها بشكل مستقل.
  - قابلية توسع أفقي مثالي — كل خدمة تُوسع حسب حملها الخاص.
  - عزل كامل للأخطاء — خطأ في خدمة المحتوى لا يؤثر على خدمة المدفوعات.
- **سلبيات:**
  - **تعقيد تشغيلي هائل منذ البداية** — 9 خدمات × 2 نسخ (للتوفر) + 9 قواعد بيانات + Service Discovery + API Gateway + Distributed Tracing + Distributed Transactions. فريق صغير (3–5 مطورين) لا يمكنه إدارة هذا التعقيد في المراحل المبكرة.
  - **تكاليف بنية تحتية عالية** — 18 حاوية (9 خدمات × 2 نسخ) + 9 PostgreSQL instances + 9 Redis instances في المرحلة 1. معظم هذه الموارد غير مستغلة.
  - **تطوير أبطأ في البداية** — كل تغيير يتطلب تنسيقاً بين خدمات متعددة، نشراً متعدداً، واختبار تكامل معقد. التطوير المحلي (Docker Compose مع 20+ حاوية) بطيء ومستهلك للموارد.
  - **لا حاجة حقيقية في المراحل المبكرة** — في المرحلة 1–2 (Public Website + Admin Dashboard)، الحمل صغير (1,000 مستخدم). Monolith مع 2–3 نسخ يكفي تماماً.
  - **مخالف لمبدأ "Start Simple"** — الفلسفة الرشيدة (Lean) تقول: لا تبني لاحتياجات مستقبلية غير مؤكدة. Microservices تبني تعقيداً هائلاً لمشكلة غير موجودة بعد.

## القرار
اخترنا **Modular Layered + DDD + Hexagonal Architecture (Ports & Adapters)** للأسباب التالية:

1. **التوازن الأمثل بين الهيكلة والبراغماتية** — هذا النموذج يوفر: (أ) هيكلة واضحة ومنظمة (عبر DDD و Hexagonal) تمنع الفوضى مع نمو المشروع. (ب) بساطة تشغيلية في البداية (Monolith واحد، PostgreSQL واحد، Redis واحد). (ج) مسار تطور طبيعي إلى Microservices (حدود النطاقات جاهزة).

2. **تكامل طبيعي مع NestJS** — NestJS Module = Bounded Context. مجلدات domain/application/infrastructure/presentation تمثل طبقات Hexagonal Architecture بشكل طبيعي. Dependency Injection في NestJS يطبق Dependency Inversion تلقائياً (نوفر `@Injectable()` لـ Repository Interface، ونحقنه كـ Provider).

3. **مسح تطور طبيعي عبر 5 مراحل** — (أ) **المرحلة 1–2:** Modular Monolith — جميع النطاقات في NestJS واحد. التواصل عبر استدعاءات مباشرة (Application Services). (ب) **المرحلة 3:** إضافة Event Bus (Redis Pub/Sub) للتواصل غير المتزامن بين النطاقات. (ج) **المرحلة 4:** استخراج النطاقات عالية الحمل (Commerce، Analytics) كخدمات منفصلة. (د) **المرحلة 5:** استخراج جميع النطاقات كـ Microservices مع API Gateway موحد.

4. **حماية من اقتران البنية التحتية** — Repository Interface في Domain Layer يضمن أن منطق الأعمال لا يعرف شيئاً عن Prisma أو PostgreSQL. إذا قررنا الانتقال من Prisma إلى Drizzle ORM (أو حتى إلى API خارجي)، نكتب Implementation جديد في Infrastructure Layer فقط. منطق الأعمال يبقى دون تغيير.

5. **قابلية اختبار استثنائية** — الهيكلة السداسية تجعل اختبار Domain Logic فورياً (Pure TypeScript بدون اعتماديات). هذا يحقق NFR-601 (≥80% Test Coverage) بجهد معقول ويسمح بـ TDD (Test-Driven Development) للنطاقات الأساسية.

6. **منع الفوضى مع نمو الفريق** — مع توسع الفريق (من 3 إلى 10+ مطورين)، حدود النطاقات الواضحة تمنع تداخل المسؤوليات و "Spaghetti Code". كل مطور يعرف أن تعديلات Customer Domain تكون في `domains/customer/` فقط.

## العواقب

### إيجابيات
- **هيكلة واضحة من اليوم الأول** — كل مطور يعرف أين يضع الكود: Entity في `domain/entities/`، Use Case في `application/handlers/`، Repository Implementation في `infrastructure/persistence/`، API Endpoint في `presentation/controllers/`. لا تخمين، لا استثناءات.
- **تطور تدريجي سلس** — عندما يحين وقت الانتقال إلى Microservices (المرحلة 5)، Bounded Contexts محددة بوضوح. العملية: (1) استخراج `domains/commerce/` كخدمة منفصلة. (2) استبدال Repository Implementation (الذي يستدعي Prisma مباشرة) بـ HTTP Client (يستدعي Commerce Service API). (3) منطق الأعمال يبقى كما هو تماماً.
- **منع تسرب منطق الأعمال** — في MVC التقليدية، Service غالباً ما يحتوي على: Business Logic + SQL Queries + HTTP Calls + Validation. هذا يخلق "Big Ball of Mud". في هذه الهيكلة، Domain Layer نقي تماماً و Application Layer يحوي Use Cases فقط.
- **جاهزية CQRS و Event Sourcing** — الهيكلة الحالية (Commands/Queries منفصلة، Domain Events) هي "CQRS Light". في المرحلة 3+، يمكن تفعيل CQRS الكامل (كتابة إلى Write DB، قراءة من Read Replica/Projection) دون تغييرات هيكلية.
- **إعادة استخدام عالية** — Application Services يمكن استدعاؤها من: REST Controller، GraphQL Resolver، WebSocket Gateway، BullMQ Processor. منطق الأعمال يُكتب مرة واحدة ويُعاد استخدامه في كل القنوات.

### سلبيات
- **عدد ملفات أكبر في البداية** — نطاق بسيط (مثلاً: Notification) قد يحتاج 10–15 ملفاً في بنية Hexagonal مقابل 3–5 ملفات في MVC بسيطة. لكن هذا الاستثمار يؤتي ثماره مع نمو النطاق.
- **منحنى تعلم** — المطورون الجدد يحتاجون لفهم: Domain Layer vs Application Layer، Ports vs Adapters، Dependency Inversion. بدون هذا الفهم، قد يضعون الكود في المكان الخطأ (مثلاً: Business Logic في Controller).
- **خطر Over-Engineering للنطاقات البسيطة** — نطاقات مثل Notification (Generic) أو Content (Supporting) قد لا تحتاج كل طبقات Hexagonal. **التخفيف:** تبسيط النطاقات البسيطة (دمج Application + Domain في النطاقات الصغيرة) مع الحفاظ على الهيكلة العامة.

### مخاطر
- **خطر: تحديد حدود نطاقات خاطئة** — إذا اكتشفنا لاحقاً أن نطاقين يجب دمجهما (مثلاً: Customer + Identity) أو نطاق يجب تقسيمه (Commerce → Catalog + Orders + Payments)، إعادة التنظيم ستكون مكلفة. **التخفيف:** (1) الحدود الحالية مبنية على تحليل DDD دقيق (Event Storming، Business Capabilities). (2) Event-Driven Communication بين النطاقات يقلل الاقتران — حتى لو تغيرت الحدود، التأثير محدود لأن التواصل عبر أحداث. (3) مراجعة الحدود كل 6 أشهر في جلسة "Bounded Context Health Check".
- **خطر: تسرب منطق الأعمال إلى Controllers** — بدون إشراف، قد يضع المطورون Business Logic مباشرة في Controller لتوفير الوقت. **التخفيف:** (1) قاعدة ESLint مخصصة: Controller يجب ألا يستدعي Repository مباشرة — فقط Application Service. (2) Code Review إلزامي يتحقق من الالتزام بالهيكلة. (3) اختبارات Unit لـ Application Services (تضمن أن المنطق هناك وليس في Controller). (4) Architecture Unit Tests باستخدام `dependency-cruiser` تتحقق من عدم وجود استيرادات غير مسموحة بين الطبقات.
- **خطر: أداء أقل في التواصل بين النطاقات** — في المرحلة 1–2، النطاقات تتواصل عبر استدعاءات مباشرة (Application Services). مع نمو المنصة، قد يصبح هذا Bottleneck. **التخفيف:** (1) استخدام Event-Driven Communication بمجرد الحاجة (المرحلة 2+ مع Redis Pub/Sub). (2) Circuit Breaker Pattern (باستخدام `@nestjs/bullmq` أو `opossum`) لمنع فشل متسلسل. (3) قياس زمن التواصل بين النطاقات وإطلاق إنذار عند تجاوز 50ms.
- **خطر: فشل في الحفاظ على Dependency Inversion** — المطورون قد يستوردون `PrismaClient` مباشرة في Application Layer بدلاً من استخدام Repository Interface. **التخفيف:** (1) `dependency-cruiser` rule: `domain/` لا يستورد من `infrastructure/` أو `@nestjs/`. (2) `eslint-plugin-boundaries` يُعرِّف حدوداً بين المجلدات ويمنع الاستيرادات المخالفة. (3) فحص CI: أي PR ينتهك Dependency Rule يُرفض تلقائياً.

## الامتثال
- **فحص تلقائي (CI):** (1) `dependency-cruiser` يتحقق من أن الـ Domain Layer لا يستورد من أي طبقة أخرى. (2) `eslint-plugin-boundaries` يمنع استيرادات غير مسموحة بين المجلدات (مثلاً: `domain/` لا يستورد من `infrastructure/`). (3) `archguard` أو `ts-arch` للتأكد من أن الدوال في `controllers/` لا تتجاوز 15 سطراً (Business Logic يجب أن يكون في Application Layer).
- **مراجعة بشرية:** كل PR يتضمن تغييرات هيكلية (نقل ملفات، إنشاء مجلدات جديدة) يجب أن يُراجع من قبل Architecture Owner.
- **توثيق:** `docs/adr/README.md` يُحدَث عند أي تغيير في الهيكلة العامة. `CONTRIBUTING.md` يشرح الهيكلة للمطورين الجدد.
- **قياس:** تقرير `dependency-cruiser` يُولد في كل Build ويُقارن مع Build سابق. أي زيادة في عدد مخالفات التبعية تؤدي إلى فشل CI.
- **أمان:** جميع الاتصالات بين الخدمات يجب أن تكون عبر TLS 1.3 (NFR-301). طبقة Presentation (Guards) تفرض حماية OWASP Top 10 (NFR-303). نطاق Identity يعزل منطق قفل الحسابات (NFR-305) عن باقي النطاقات.

## القرارات ذات الصلة
- ADR-001: Next.js للتطبيق الأمامي — الـ Frontend لا يتبع DDD/Hexagonal (يستخدم هيكلة Next.js App Router القياسية). لكن الحزم المشتركة (`@alharistech/types`) تتبع نفس المفاهيم.
- ADR-002: NestJS للخدمات الخلفية — NestJS Module = Bounded Context. Dependency Injection = Dependency Inversion.
- ADR-003: PostgreSQL — Repository Interface في Domain Layer، Prisma Implementation في Infrastructure Layer.
- ADR-004: Redis — CacheService Interface في Domain Layer، Redis Implementation في Infrastructure Layer.
- ADR-005: TypeScript — الأنواع الصارمة تدعم تنفيذ Interfaces (Ports) وضمان توافق Adapters.
- ADR-007: JWT + Refresh Tokens — Auth Guards في Presentation Layer، JWT Strategy في Infrastructure Layer.
- ADR-012: Monorepo مع Turborepo — `domains/` تحت `apps/api/src/`، الحزم المشتركة تحت `packages/`.
- ADR-016: Domain-Driven Design (DDD) — هذا الـ ADR يُعرِّف كيف نُطبِّق DDD تقنياً.

## المراجع
- [Alistair Cockburn — Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Eric Evans — Domain-Driven Design](https://www.domainlanguage.com/ddd/)
- [NestJS + DDD + Hexagonal Architecture](https://docs.nestjs.com/recipes/sql-typeorm#separating-entity-definition)
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
- [NFR-301: TLS 1.3 Encryption](docs/requirements/system-requirements.md)
- [NFR-303: OWASP Top 10 Protection](docs/requirements/system-requirements.md)
- [NFR-305: Account Lockout after Failed Attempts](docs/requirements/system-requirements.md)
- [NFR-601: Test Coverage ≥ 80%](docs/requirements/system-requirements.md)
- [NFR-603: Architecture Documentation (ADR + C4)](docs/requirements/system-requirements.md)
- [Enterprise Architecture — Section 2: Domain Architecture](docs/architecture/enterprise-architecture.md)
- [Enterprise Architecture — Section 3.2.4: Hexagonal Architecture](docs/architecture/enterprise-architecture.md)
