# ADR-005: استخدام TypeScript في كامل المشروع

## الحالة
مقبول (Accepted)

## التاريخ
2026-06-20

## السياق
تحتاج منصة الحارس تك إلى لغة برمجة موحدة عبر جميع طبقات المنصة (Frontend + Backend + Shared Packages) تدعم:
- **سلامة الأنواع (Type Safety) عبر الـ Monorepo** — المنصة تستخدم Monorepo مع Turborepo (ADR-012) وتحتوي على 6 حزم مشتركة (`@alharistech/types`، `@alharistech/auth`، `@alharistech/sdk`، `@alharistech/ui`، `@alharistech/utils`، `@alharistech/config`) و4 تطبيقات (web، admin، desktop، mobile). الأنواع المشتركة تمنع عدم تطابق الواجهات بين الخدمات.
- **تعقيد مؤسسي عالٍ** — المنصة تحتوي على 9 نطاقات (DDD) مع Entities، Value Objects، Domain Events، Repository Interfaces، DTOs، Command/Query Objects. إدارة هذه التعقيدات بدون TypeScript تؤدي حتماً إلى أخطاء وقت التشغيل (Runtime Errors) يصعب اكتشافها.
- **فريق متعدد التخصصات** — المطورون يعملون على Frontend (Next.js)، Backend (NestJS)، وMobile (React Native). لغة موحدة تقلل تكلفة التنقل بين السياقات (Context Switching).
- **تكامل مع NestJS** — NestJS مبني أصلاً على TypeScript ويستفيد من Decorators، Generics، و Dependency Injection المدعومة بأنواع قوية.
- **تكامل مع Prisma/Drizzle ORM** — أدوات ORM الحديثة تُنتج أنواع TypeScript تلقائياً من مخطط قاعدة البيانات، مما يوفر سلامة أنواع كاملة من قاعدة البيانات إلى واجهة المستخدم (End-to-End Type Safety).
- **سلامة أمنية** — أنواع صارمة تمنع ثغرات شائعة مثل: undefined access، prototype pollution، injection عبر string concatenation غير الآمنة (NFR-303).

## محركات القرار
1. تعقيد المنصة المؤسسي يتطلب سلامة أنواع لمنع أخطاء Runtime يصعب تتبعها.
2. Monorepo + حزم مشتركة = أنواع مشتركة تمنع عدم تطابق الواجهات (API Contracts).
3. تكامل أصلي مع NestJS (Decorators, DI, Guards, Interceptors) الذي يعتمد على TypeScript.
4. تكامل مع ORM الحديث (Prisma/Drizzle) لتوليد أنواع تلقائية من الـ DB Schema.
5. دعم Full-Stack Type Safety — نوع واحد من قاعدة البيانات حتى React Component Props.
6. إنتاجية فريق متعدد التخصصات عبر لغة واحدة.
7. متطلبات NFR-601 (Test Coverage ≥ 80%) — TypeScript يسهل كتابة اختبارات آمنة نوعياً مع Mocking دقيق.

## الخيارات المدروسة

### الخيار أ: TypeScript في الوضع الصارم (Strict Mode)
- **الوصف:** استخدام TypeScript مع تفعيل جميع إعدادات `strict: true` في `tsconfig.json` عبر جميع الحزم والتطبيقات.
- **إيجابيات:**
  - **أقصى درجات سلامة الأنواع** — `strict: true` يُفعّل: `strictNullChecks` (يمنع `null`/`undefined` غير المتوقع)، `strictFunctionTypes` (يمنع استدعاء دوال بمعاملات غير متطابقة)، `noImplicitAny` (لا يسمح بأنواع `any` الضمنية)، `useUnknownInCatchVariables` (يمنع افتراض `any` في catch blocks)، `strictPropertyInitialization` (يضمن تهيئة الخصائص في المُنشئ).
  - **اكتشاف الأخطاء في وقت التطوير** — مترجم TypeScript (tsc) يكتشف 60–80% من الأخطاء التي كانت ستظهر كـ Runtime Errors في JavaScript. مثلاً: استدعاء دالة بمعاملات ناقصة، الوصول لخاصية غير موجودة، مقارنة أنواع غير متوافقة.
  - **أنواع مشتركة عبر الـ Monorepo** — حزمة `@alharistech/types` تُعرِّف واجهات (Interfaces) لجميع الكيانات (User، Order، Ticket، Product) والـ DTOs والـ Domain Events. أي تغيير في الواجهة يُظهر أخطاء فورية في جميع الحزم المستهلكة.
  - **تكامل مثالي مع NestJS** — NestJS CLI، Decorators، Guards، Interceptors، Pipes كلها مصممة لـ TypeScript مع Generics قوية. مثلاً: `@Body() createUserDto: CreateUserDto` يتحقق تلقائياً من صحة DTO.
  - **تكامل مثالي مع ORM** — Prisma و Drizzle يولدان أنواع TypeScript كاملة من مخطط قاعدة البيانات. `prisma.user.findUnique()` يُرجع `User | null` مما يُجبر المطور على معالجة حالة `null`.
  - **IntelliSense فائق** — الإكمال التلقائي (Autocomplete) في VSCode يظهر فقط الخيارات الصالحة. إعادة تسمية رمز (Refactor → Rename) تُغير جميع الاستخدامات بدقة 100%.
  - **توثيق ذاتي (Self-Documenting)** — الأنواع والواجهات تعمل كتوثيق حي للـ API والبيانات، مما يقلل الحاجة للرجوع إلى OpenAPI/GraphQL Schema في التطوير اليومي.
  - **جاهزية للـ AOT Compilation** — TypeScript Strict Mode يضمن توافق الكود مع AOT (Angular Ivy-style) إذا احتجنا في المستقبل.
- **سلبيات:**
  - **منحنى تعلم أعلى** — المطورون القادمون من JavaScript يحتاجون لتعلم: Generics (`Record<K, V>`، `Partial<T>`، `Omit<T, K>`)، Conditional Types (`T extends U ? X : Y`)، Mapped Types، Template Literal Types. هذا يضيف 2–4 أسابيع للإعداد.
  - **وقت تطوير أطول في البداية** — كتابة أنواع لجميع الدوال والكائنات والـ API Responses تستهلك وقتاً إضافياً (~20% وقت إضافي) مقارنة بـ JavaScript الحر.
  - **تعقيد في أنواع متقدمة جداً** — بعض الأنماط في NestJS (مثل Dynamic Modules، Custom Decorators مع Metadata Reflection) تتطلب أنواعاً معقدة (`ClassProvider`، `FactoryProvider`) قد تربك المطورين الجدد.
  - **رسائل أخطاء طويلة** — TypeScript في الوضع الصارم قد يُنتج رسائل خطأ طويلة ومعقدة (خاصة مع الأنواع المتداخلة)، مما يصعب فهم المشكلة أحياناً.

### الخيار ب: TypeScript في الوضع المرن (Loose Mode)
- **الوصف:** استخدام TypeScript مع `strict: false` أو تعطيل بعض الإعدادات الصارمة لتسهيل التطوير.
- **إيجابيات:**
  - أسهل للمطورين الجدد — لا يُجبر على معالجة `null`/`undefined` أو كتابة أنواع كاملة لكل شيء.
  - تطوير أسرع في البداية — يمكن استخدام `any` لتجاوز التعقيدات النوعية المؤقتة.
  - مرونة أكبر في النماذج الأولية (Prototyping) ومراحل الاستكشاف.
- **سلبيات:**
  - **سلامة أنواع وهمية** — `strict: false` يسمح بـ `null` و `undefined` بالمرور دون اكتشاف، مما يخلق إحساساً زائفاً بالأمان. الأخطاء التي كان يجب أن يكتشفها المترجم تظهر كـ Runtime Errors ("Cannot read property 'x' of undefined").
  - **تدهور تدريجي للكود** — بدون رقابة صارمة، تتراكم استخدامات `any` و `@ts-ignore` تدريجياً ويفقد TypeScript قيمته الأساسية.
  - **عدم توافق مع فلسفة NestJS** — NestJS صُمم للاستفادة من الأنواع الصارمة (Dependency Injection، Validation، Guards). الوضع المرن يُضعف هذه التكاملات.
  - **صعوبة إعادة التفعيل لاحقاً** — الانتقال من `strict: false` إلى `strict: true` على مشروع كبير (50,000+ LOC) يكاد يكون مستحيلاً بدون إعادة كتابة واسعة. من الأفضل البدء بـ Strict من اليوم الأول.

### الخيار ج: JavaScript (بدون TypeScript)
- **الوصف:** استخدام JavaScript النقي مع JSDoc للتوثيق النوعي الاختياري.
- **إيجابيات:**
  - لا منحنى تعلم — كل مطور JavaScript يمكنه العمل فوراً.
  - تطوير أسرع في المراحل المبكرة — لا وقت يُصرف على كتابة الأنواع.
  - لا Build Step — الكود يعمل مباشرة (Node.js يدعم JavaScript أصلاً).
- **سلبيات:**
  - **كارثة في Monorepo** — 6 حزم مشتركة + 4 تطبيقات. بدون أنواع مشتركة، أي تغيير في `@alharistech/types` لن يُظهر الأخطاء في الحزم المستهلكة إلا في Runtime. مع 100+ API endpoint (Full)، هذا يؤدي إلى انهيارات متسلسلة.
  - **فقدان ميزات NestJS الأساسية** — NestJS بدون TypeScript يفقد: (أ) Dependency Injection الآمن نوعياً، (ب) Validation التلقائي لـ DTOs عبر class-validator، (ج) OpenAPI/Swagger التلقائي، (د) Guards و Interceptors المعتمدة على Metadata Reflection.
  - **Refactoring خطر** — إعادة تسمية حقل في Entity (مثلاً `email` → `emailAddress`) في JavaScript تتطلب بحثاً يدوياً في كل استخداماته (50+ ملف). خطأ واحد = خطأ Runtime.
  - **IntelliSense ضعيف** — VSCode لا يعرف أنواع المتغيرات، مما يقلل الإنتاجية ويجبر المطور على فتح ملفات متعددة لتتبع أنواع البيانات.
  - **لا تكامل مع ORM** — Prisma و Drizzle يولدان أنواع TypeScript حصراً. استخدام JavaScript يجعل المطور يتجاهل هذه الأنواع ويعمل بشكل أعمى مع كائنات غير محددة.
  - **مخالف لمتطلبات الأمان** — بدون أنواع صارمة، يسهل كتابة كود به ثغرات (SQL Injection، XSS، undefined access) يصعب اكتشافها قبل الإنتاج (NFR-303).

## القرار
اخترنا **TypeScript في الوضع الصارم (Strict Mode)** للأسباب التالية:

1. **سلامة أنواع شاملة عبر الـ Monorepo** — مع 6 حزم مشتركة و4 تطبيقات، حزمة `@alharistech/types` المركزية تضمن أن أي تغيير في واجهة API (مثلاً إضافة حقل إلزامي `phoneNumber: string` إلى `CreateUserDto`) يُظهر أخطاء فورية في Frontend (Next.js)، Backend (NestJS)، و Mobile (React Native) قبل أن يصل الكود إلى بيئة الإنتاج.

2. **تكامل أصلي مع NestJS** — NestJS صُمم حول TypeScript. ميزات أساسية مثل `@Body(ValidationPipe) dto: CreateOrderDto` تعتمد على Metadata Reflection و Generics للتحقق من صحة البيانات تلقائياً. الوضع المرن أو JavaScript يفقد هذه القيمة بالكامل.

3. **End-to-End Type Safety** مع ORM — Prisma/Drizzle يولدان أنواعاً من قاعدة البيانات → تُمرر عبر DTOs → تصل إلى Frontend Components. مثال: `prisma.user.findUnique()` → `User` → `NestJS Controller` → `fetch('/api/v1/me')` → `Next.js Component` — النوع `User` متناسق عبر كل الطبقات. هذا يمنع فئة كاملة من الأخطاء ("API returned field `full_name` but frontend expected `fullName`").

4. **اكتشاف مبكر للأخطاء** — TypeScript Strict Mode يكتشف في وقت التطوير: (أ) استدعاء `order.customer.email` بينما `customer` قد يكون `null` → خطأ: "Object is possibly 'null'". (ب) `parseInt(user.age)` بينما `age` من النوع `string` → لا خطأ لكن `@typescript-eslint` يحذر. (ج) `if (user.isActive)` بينما `isActive` قد يكون `undefined` → خطأ مع `strictNullChecks`.

5. **توثيق حي للـ API** — الأنواع والواجهات تعمل كتوثيق فوري: `interface CreateOrderDto { serviceId: UUID; customerNotes?: string; documents: File[]; }` أبلغ وأوضح من أي تعليق أو مستند خارجي.

6. **جاهزية للمستقبل** — أي انتقال مستقبلي (مثلاً إلى Deno أو Bun) يتطلب TypeScript. البدء بـ JavaScript يعني إعادة كتابة المشروع لاحقاً.

7. **توافق مع NFR-601 (≥80% Test Coverage)** — TypeScript يجعل كتابة الاختبارات أكثر أماناً: Mocking دقيق، اكتشاف أخطاء في توقيعات الدوال أثناء الاختبار، وضمان أن الاختبارات تغطي جميع مسارات الأنواع (مثلاً Union Types: `status: 'active' | 'inactive' | 'suspended'`).

## العواقب

### إيجابيات
- **80%+ من أخطاء Runtime تُكتشف في وقت التطوير** — TypeScript مع ESLint + Strict Mode يمنع undefined access، type mismatches، missing properties، و incorrect function calls قبل أن يصل الكود إلى مرحلة الاختبار.
- **إنتاجية أعلى على المدى الطويل** — IntelliSense، Autocomplete، و Refactoring الآمن في VSCode يوفرون ساعات من البحث اليدوي والتتبع. إعادة تسمية رمز (مثلاً `customerId` → `clientId`) تتم بدقة 100% عبر 200+ ملف بضغطة زر.
- **تكامل كامل مع NestJS Ecosystem** — `class-validator` + `class-transformer` تتحقق من صحة DTOs تلقائياً. `@nestjs/swagger` يولد OpenAPI spec من الأنواع مباشرة. `@nestjs/bullmq` يستفيد من Generics لضمان أنواع آمنة في معالجات الطوابير.
- **حزمة `@alharistech/types` كعقد مركزي** — أي تغيير في العقد (Contract) بين Frontend و Backend يُكتشف فوراً في جميع التطبيقات. هذا هو أساس API First Design (ADR-014).
- **سلامة أمنية إضافية** — أنواع صارمة تمنع: (أ) إدخال `undefined` في استعلامات SQL (يمنع سلوكاً غير متوقع). (ب) تمرير String خام إلى Response (يمنع XSS). (ج) نسيان `await` على Promise (يكتشفه `@typescript-eslint/no-floating-promises`). هذه تتماشى مع NFR-303 (OWASP) و NFR-301 (TLS).

### سلبيات
- **منحنى تعلم للمطورين الجدد** — المطورون القادمون من JavaScript يحتاجون 2–4 أسابيع لتعلم TypeScript Generics، Utility Types (`Partial<T>`، `Pick<T, K>`، `Record<K, V>`)، و Conditional Types. هذا قد يبطئ الإنتاجية في الأسابيع الأولى للفريق.
- **وقت تطوير أطول (~20%)** — كتابة أنواع لجميع الدوال والكائنات والـ API Responses و DTOs تستهلك وقتاً إضافياً في البداية. لكن هذا الوقت يُسترد أضعافاً في مرحلة تصحيح الأخطاء (Debugging).
- **Build Step** — TypeScript يحتاج إلى ترجمة (tsc) قبل التشغيل. لكن Turborepo + `tsconfig` الموحد يقللان وقت الترجمة عبر Caching و Incremental Builds، و Next.js و NestJS يدعمان `tsx` و `ts-node` للتطوير السريع.
- **تعقيد في الأنواع المتقدمة** — بعض الأنماط المتقدمة (مثل GADTs، Template Literal Types للمسارات) قد تربك المطورين. لكن سياسة الرقابة على الكود (Code Review) تمنع إساءة استخدام الأنواع المعقدة بدون داعٍ.

### مخاطر
- **خطر: هروب إلى `any`** — المطورون قد يلجأون إلى `any` أو `@ts-ignore` لتجاوز صعوبات مؤقتة، مما يضعف سلامة الأنواع تدريجياً. **التخفيف:** (1) قاعدة ESLint: `@typescript-eslint/no-explicit-any: 'error'` و `@typescript-eslint/ban-ts-comment: 'error'`. (2) GitHub Actions يرفض أي PR يحتوي على `any` (إلا باستثناءات محددة ومبررة في Code Review). (3) توفير Utility Types جاهزة في `@alharistech/types` لتقليل الحاجة لـ `any`. (4) تدريب للمطورين على TypeScript Patterns الآمنة.
- **خطر: بطء الترجمة في Monorepo كبير** — مع نمو المشروع (200,000+ LOC)، قد يصبح `tsc --noEmit` بطيئاً في CI. **التخفيف:** (1) Turborepo Caching — معظم الحزم لا تُترجم إذا لم تتغير. (2) استخدام `tsc --incremental` مع `tsBuildInfoFile`. (3) الانتقال إلى `esbuild` أو `swc` للترجمة السريعة في التطوير، مع `tsc --noEmit` للتحقق من الأنواع فقط في CI. (4) عدم ترجمة الحزم التي لم تتأثر بالتغيير (Turborepo `--filter`).
- **خطر: إحباط المطورين الجدد** — Strict Mode مع ESLint صارم قد يُشعر المطورين الجدد بأنهم "يحاربون المترجم" بدلاً من كتابة ميزات. **التخفيف:** (1) وثائق داخلية "TypeScript Best Practices" مع أمثلة عملية. (2) اجتماعات Code Review تعليمية (وليست عقابية). (3) توفير Snippets و Templates للمهام الشائعة (مثلاً: إنشاء NestJS Module جديد، إنشاء DTO جديد). (4) فترة سماح 4 أسابيع للمطورين الجدد حيث لا تُحتسب أخطاء TypeScript ضدهم في تقييم الأداء.

## الامتثال
- **فحص تلقائي:** GitHub Actions يُشغّل `tsc --noEmit` (أو `turbo typecheck`) على كل PR. أي خطأ TypeScript = فشل CI (لا يمكن دمج PR).
- **قواعد ESLint صارمة:** (1) `@typescript-eslint/no-explicit-any: 'error'` — لا استخدام لـ `any` بدون مبرر. (2) `@typescript-eslint/strict-boolean-expressions: 'error'` — لا اختصارات مثل `if (value)` بدلاً من `if (value !== undefined)`. (3) `@typescript-eslint/no-floating-promises: 'error'` — كل Promise يجب أن يُنتظر (`await`) أو يُرجع.
- **مراجعة بشرية:** Code Reviewer يتحقق من عدم وجود `@ts-ignore` أو `as any` بدون تعليق يشرح السبب وتاريخ الإزالة المخطط.
- **إعدادات `tsconfig.json` موحدة:** حزمة `@alharistech/config` تحتوي على `tsconfig.base.json` بجميع الإعدادات الصارمة. جميع الحزم والتطبيقات تمد (extends) هذا الملف. أي تغيير في الإعدادات الأساسية يتطلب ADR منفصل.

## القرارات ذات الصلة
- ADR-001: Next.js للتطبيق الأمامي — Next.js يدعم TypeScript أصلاً مع `next dev` و `next build`.
- ADR-002: NestJS للخدمات الخلفية — NestJS مبني على TypeScript ويستفيد من Decorators و Metadata Reflection.
- ADR-003: PostgreSQL — Prisma/Drizzle يولدان أنواع TypeScript من مخطط قاعدة البيانات.
- ADR-006: Architecture Model — جميع الطبقات (Domain، Application، Infrastructure، Presentation) تستخدم TypeScript.
- ADR-012: Monorepo مع Turborepo — حزمة `@alharistech/types` تُشارك الأنواع عبر جميع التطبيقات.
- ADR-014: API First Design — الأنواع تُعرِّف العقود (Contracts) بين Frontend و Backend.
- ADR-015: OpenAPI/Swagger — توليد تلقائي لمواصفات OpenAPI من Decorators و Types.

## المراجع
- [TypeScript 5.x Documentation](https://www.typescriptlang.org/docs/)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [typescript-eslint Rules](https://typescript-eslint.io/rules/)
- [NestJS + TypeScript Integration](https://docs.nestjs.com/)
- [Prisma + TypeScript Types](https://www.prisma.io/docs/orm/prisma-client/type-safety)
- [NFR-303: OWASP Top 10 Protection](docs/requirements/system-requirements.md)
- [NFR-601: Test Coverage ≥ 80%](docs/requirements/system-requirements.md)
- [Enterprise Architecture — Section 3.1: Frontend Architecture](docs/architecture/enterprise-architecture.md)
- [Enterprise Architecture — Section 3.2: Backend Architecture](docs/architecture/enterprise-architecture.md)
