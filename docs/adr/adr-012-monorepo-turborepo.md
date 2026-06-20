# ADR-012: تبني Monorepo مع Turborepo

## الحالة
مقبول (Accepted)

## التاريخ
2026-06-17

## السياق

منصة AlharisTech تتكون من عدة تطبيقات وحزم مشتركة. مع نمو المنصة عبر 9 نطاقات (Domains)، أصبح من الواضح أن إدارة كل تطبيق في مستودع منفصل (Polyrepo) ستؤدي إلى تكرار الكود، تعقيد في إدارة الإصدارات، وصعوبة في مزامنة التغييرات بين التطبيقات.

التطبيقات الحالية والمخطط لها:
- **apps/web:** الواجهة الأمامية الرئيسية (Next.js)
- **apps/admin:** لوحة تحكم المشرف (Next.js)
- **apps/api:** الخادم الخلفي الرئيسي (NestJS)
- **apps/worker:** معالج المهام الخلفية (BullMQ workers)
- **apps/desktop:** تطبيق سطح المكتب (Tauri)
- **apps/mobile:** تطبيق الجوال (React Native)

الحزم المشتركة:
- **packages/ui:** مكتبة مكونات UI مشتركة (shadcn/ui + Tailwind)
- **packages/auth:** منطق المصادقة والتفويض المشترك
- **packages/database:** Drizzle ORM schemas + client + migrations
- **packages/sdk:** TypeScript SDK للـ frontend clients
- **packages/config:** إعدادات مشتركة (ESLint, Prettier, TypeScript, Tailwind)
- **packages/types:** أنواع TypeScript مشتركة (مولدة من OpenAPI specs)
- **packages/contracts:** مواصفات العقود (OpenAPI, JSON Schema, RBAC policies)
- **packages/i18n:** نصوص الترجمة المشتركة (العربية، الإنجليزية)

بدون Monorepo، كل تغيير في حزمة مشتركة (مثل `packages/types` بعد تحديث OpenAPI spec) يتطلب: (1) نشر الحزمة، (2) تحديث التبعية في كل تطبيق، (3) اختبار كل تطبيق. هذا يبطئ دورة التطوير ويزيد احتمالية نسيان تحديث تطبيق ما.

## محركات القرار

1. **مشاركة الكود بين التطبيقات:** 6 تطبيقات تستهلك 8+ حزم مشتركة. نحتاج آلية تجعل التغييرات في الحزم المشتركة تنعكس فوراً على التطبيقات المستهلكة بدون نشر وسيط.
2. **سرعة البناء (Build Performance):** Monorepo يمكن أن يكون بطيئاً في البناء. نحتاج caching ذكي يمنع إعادة بناء الحزم التي لم تتغير.
3. **سرعة CI/CD:** CI pipeline يجب أن يبني ويختبر فقط ما تغير (وليس المستودع بأكمله في كل PR). Turborepo `--filter` و `turbo prune` يحققان ذلك.
4. **إدارة التبعيات المركزية:** pnpm يوفر `pnpm-workspace.yaml` لإدارة تبعيات متسقة عبر كل الحزم. `pnpm-lock.yaml` واحد يضمن reproducibility.
5. **فرض حدود الاستيراد (Import Boundaries):** الحزم يجب ألا تستورد من تطبيقات أو من حزم غير معلنة. نحتاج أدوات تمنع الـ "import spaghetti".
6. **سهولة انضمام المطورين الجدد:** `pnpm install` واحد يثبت كل التبعيات. `turbo dev` يشغل كل التطبيقات. زمن الإعداد (setup) دقائق بدل ساعات.
7. **إدارة الإصدارات المنسقة:** عندما تتغير حزمة مشتركة، نحتاج آلية لإصدار نسخ جديدة من الحزم تلقائياً (Changesets أو semantic-release).
8. **بساطة الأدوات:** نحتاج أداة monorepo بسيطة وخفيفة. Turborepo يركز على build orchestration فقط ويترك package management لـ pnpm. مقارنة بـ Nx الأكثر تعقيداً.

## الخيارات المدروسة

### الخيار أ: Monorepo مع Turborepo + pnpm Workspaces (المختار)

- **الوصف:** Turborepo كـ build orchestrator عالي الأداء، pnpm كـ package manager مع workspace protocol. Turborepo يوازي المهام (parallel execution)، يخزن نتائج البناء (caching)، ويدير الرسم البياني للتبعيات (dependency graph). pnpm يوفر workspace protocol للربط بين الحزم المحلية.
- **إيجابيات:**
  - **بناء متوازي (Parallel Builds):** Turborepo يشغل المهام المستقلة بالتوازي. مثلاً: `packages/ui`, `packages/types`, `packages/config` تُبنى معاً لأنه لا تبعيات بينها.
  - **Caching ذكي:** إذا لم يتغير كود الحزمة أو تبعياتها، Turborepo يعيد استخدام cache من البناء السابق. البناء الثاني لمستودع بدون تغييرات: ثوانٍ بدل دقائق.
  - **Remote Caching:** Vercel Remote Cache (أو self-hosted cache server) يشارك cache بين أعضاء الفريق و CI. بناء `main` branch يُخزن cache الذي يستخدمه المطورون و CI لاحقاً.
  - **تصفية دقيقة (Filtering):** `turbo build --filter=@alharistech/api` يبني `apps/api` وكل تبعياته فقط. `turbo build --filter=...[origin/main]` يبني فقط ما تغير مقارنة بـ main.
  - **بسيط وخفيف:** Turborepo يدير الـ task graph فقط. package management لـ pnpm، testing لـ Jest، linting لـ ESLint. لا يحاول استبدال أدوات أخرى.
  - **Go-based binary:** Turborepo مكتوب بـ Go (ليس Node.js). سريع في تحليل الرسم البياني وتنفيذ المهام.
  - **pnpm Workspaces:** pnpm يوفر `workspace:*` protocol للربط بين الحزم المحلية. `pnpm-lock.yaml` واحد يضمن reproducibility. صارم في حل التبعيات (لا يمكن استخدام تبعيات غير معلنة — وهو ميزة أمنية لفرض الحدود).
  - **مجتمع متكامل:** Vercel (شركة Next.js) تدعم Turborepo. تكامل طبيعي مع Next.js و Vercel deployments.
- **سلبيات:**
  - **إعداد CI/CD أكثر تعقيداً:** نحتاج لـ `turbo prune` لإنشاء subset للمستودع قبل `pnpm install` و `turbo build`. الـ CI pipeline أطول خطوات من polyrepo.
  - **Remote caching يحتاج إعداداً إضافياً:** Vercel Remote Cache يتطلب Vercel account و token. Self-hosted cache server يتطلب صيانة.
  - **حجم المستودع ينمو:** Monorepo واحد يحتوي 6 تطبيقات + 8 حزم + 24 ADR + 9 domain specs + 9 OpenAPI specs. حجم المستودع قد يتجاوز 500MB مع مرور الوقت.
  - **تعارضات Git:** فرق متعددة تعمل على حزم مختلفة في نفس المستودع. احتمالية merge conflicts أعلى من polyrepo (وإن كانت conflicts سطحية — ملفات `pnpm-lock.yaml` و `turbo.json`).
  - **تبعيات غير مرئية:** Turborepo يعتمد على `dependsOn` في `turbo.json`. إذا نسينا إضافة تبعية، المهمة قد تفشل في CI (ordering غير صحيح) أو تنجح ببيانات قديمة (cache غير invalidated).

### الخيار ب: Nx

- **الوصف:** أداة monorepo أكثر شمولاً من Turborepo. توفر dependency graph visualization، code generation، affected commands، distributed task execution.
- **إيجابيات:**
  - **Dependency graph visualization:** `nx graph` يعرض الرسم البياني للتبعيات بصرياً. مفيد لفهم بنية المشروع.
  - **Code generation:** `nx generate @nx/nest:module identity` يولد NestJS module بهيكل قياسي. يقلل الـ boilerplate.
  - **Affected commands:** `nx affected:test --base=main` يختبر فقط ما تأثر بالتغييرات. أكثر دقة من `turbo --filter=...[origin/main]`.
  - **Distributed task execution:** Nx Cloud يوزع المهام عبر أجهزة متعددة. مفيد للمشاريع الكبيرة جداً (100+ apps/packages).
  - **ميزات متقدمة:** incremental builds, computation hashing, dependency graph.
- **سلبيات:**
  - **تعقيد أعلى:** Nx أكثر تعقيداً من Turborepo. `nx.json`, `project.json`, `workspace.json` — إعدادات أكثر. منحنى تعلم أطول.
  - **رأي أكثر (Opinionated):** Nx يملي هيكلة معينة للمشروع. أقل مرونة من Turborepo الذي يترك الهيكلة للفريق.
  - **Plugin dependency:** Nx plugins ضرورية للتكامل مع NestJS, Next.js, إلخ. Turborepo لا يحتاج plugins — فقط يشغل npm scripts.
  - **Vendor lock-in:** Nx Cloud للـ distributed execution و remote caching. الانتقال من Nx أصعب من Turborepo.
  - **حجم أكبر:** Nx workspace مع plugins يضيف 20-30MB من التبعيات. Turborepo < 10MB.

### الخيار ج: Lerna + pnpm Workspaces

- **الوصف:** Lerna (أداة monorepo الكلاسيكية) مع pnpm workspaces. Lerna يدير الـ task orchestration و versioning. pnpm يدير الـ dependencies.
- **إيجابيات:**
  - معروف وناضج: Lerna موجود منذ 2015. مجتمع كبير، توثيق جيد.
  - Versioning مدمج: `lerna version` و `lerna publish` لإدارة إصدارات الحزم. أقدم وأكثر نضجاً من Turborepo + Changesets.
  - بسيط نسبياً: Lerna أبسط من Nx. `lerna run build` يشغل build في كل الحزم.
- **سلبيات:**
  - **لا caching:** Lerna لا يخزن cache. كل build يعيد بناء كل الحزم حتى لو لم تتغير. أبطأ بكثير من Turborepo.
  - **لا parallel scheduling ذكي:** Lerna يشغل المهام بـ `--parallel` لكن بدون وعي بالـ dependency graph. قد يشغل مهمة قبل اكتمال تبعياتها.
  - **أداء أقل:** بدون caching و dependency graph-aware scheduling، البناء الكامل يستغرق دقائق أطول.
  - **توقف التطوير الفعلي:** Lerna انتقل لإدارة Nrwl (فريق Nx). التركيز الحالي على Nx. Lerna في وضع صيانة.

### الخيار د: Polyrepo (مستودعات منفصلة)

- **الوصف:** كل تطبيق وكل حزمة في مستودع Git مستقل. النشر عبر npm registry (خاص أو عام).
- **إيجابيات:**
  - استقلالية كاملة: كل فريق يتحكم في مستودعه. CI/CD مستقل، إصدارات مستقلة.
  - مستودعات أصغر: `git clone` أسرع. بحث أسرع. أقل merge conflicts.
  - حدود صارمة: لا يمكن استيراد كود من مستودع آخر بدون نشره أولاً. الحدود مفروضة بالبنية.
  - CI/CD أبسط: كل مستودع له pipeline مستقل. لا تعقيد `turbo prune` أو filtering.
- **سلبيات:**
  - **تكرار الكود:** الكود المشترك يجب نسخه أو استخراجه في حزمة منفصلة. الـ shared packages تعاني من: "نشر → انتظار → تحديث → اختبار" في كل تغيير.
  - **تنسيق الإصدارات صعب:** تحديث `packages/types` يعني: (1) نشر الحزمة، (2) فتح PR في كل تطبيق لتحديث التبعية، (3) اختبار كل تطبيق. 6 تطبيقات = 6 PRs.
  - **عدم اتساق:** كل مستودع قد يستخدم إصدارات مختلفة من الـ shared packages. "يعمل على جهازي" بسبب اختلاف الإصدارات.
  - **تأخر اكتشاف الأخطاء:** تغيير في `packages/types` قد يكسر `apps/web` لكن الخطأ يُكتشف فقط عندما يحاول فريق web تحديث التبعية (بعد أيام أو أسابيع).
  - **إعداد مطورين جدد:** يحتاج `git clone` لـ 6+ مستودعات. `npm install` في كل واحد. ربطها معاً للعمل محلياً. ساعات بدل دقائق.

## القرار

اخترنا **Monorepo مع Turborepo + pnpm Workspaces** للأسباب التالية:

1. **مشاركة الكود فورية:** أي تغيير في `packages/types` ينعكس فوراً على `apps/web` و `apps/api` — بدون نشر وسيط. `pnpm workspace:*` protocol يربط الحزم المحلية مباشرة.

2. **بناء سريع مع caching:**
   - **Local cache:** `turbo build` الثاني بدون تغييرات = ثوانٍ (cache hit).
   - **Remote cache:** Vercel Remote Cache يشارك cache بين المطورين و CI. البناء الذي اكتمل في CI يُستخدم من قبل المطورين.
   - **Parallel builds:** الحزم المستقلة تُبنى معاً (ui + types + config في نفس الوقت).
   - **Incremental builds:** `turbo build --filter=...[origin/main]` يبني فقط ما تغير.

3. **CI/CD فعال:**
   - `turbo prune @alharistech/api --docker` ينشئ subset من المستودع يحوي `apps/api` وتبعياتها فقط.
   - `pnpm install --filter=@alharistech/api` يثبت فقط ما تحتاجه `apps/api`.
   - `turbo build --filter=@alharistech/api` يبني فقط `apps/api` وتبعياتها.
   - Pipeline: `turbo prune → pnpm install → turbo build → turbo test → turbo lint`

4. **أبسط من Nx:** Turborepo يدير الـ task graph فقط. لا plugins، لا code generation mandatory، لا هيكلة مفروضة. `turbo.json` واحد يحتوي pipeline definition.

5. **pnpm لمتانة التبعيات:**
   - `workspace:*` protocol: `"@alharistech/types": "workspace:*"` — دائماً أحدث نسخة محلية.
   - `pnpm-lock.yaml` واحد يضمن أن كل المطورين و CI يستخدمون نفس التبعيات بالضبط.
   - Strict mode: pnpm يمنع استيراد تبعيات غير معلنة في `package.json`. هذا يفرض حدوداً بين الحزم.

6. **تفاصيل التنفيذ:**

   **turbo.json pipeline:**
   ```json
   {
     "pipeline": {
       "build": {
         "dependsOn": ["^build"],
         "outputs": ["dist/**", ".next/**", "build/**"]
       },
       "test": {
         "dependsOn": ["build"],
         "outputs": ["coverage/**"]
       },
       "lint": {
         "dependsOn": ["^build"]
       },
       "dev": {
         "cache": false,
         "persistent": true
       },
       "generate": {
         "dependsOn": ["^generate"],
         "outputs": ["src/generated/**"]
       }
     }
   }
   ```

   **pnpm-workspace.yaml:**
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```

   **Root package.json scripts:**
   ```json
   {
     "dev": "turbo dev",
     "build": "turbo build",
     "test": "turbo test",
     "lint": "turbo lint",
     "generate": "turbo generate",
     "check": "turbo build test lint --filter=...[origin/main]",
     "clean": "turbo clean && rm -rf node_modules"
   }
   ```

## العواقب

### إيجابية

- **مشاركة كود فورية وفعالة:** تغيير في `packages/types` ينعكس على كل التطبيقات فوراً. لا نشر وسيط، لا PRs متعددة. التطوير المتكامل (full-stack changes) في PR واحد.
- **بناء سريع:** Local cache يلغي إعادة البناء غير الضرورية. Remote cache يشارك نتائج البناء عبر الفريق. Parallel builds تستغل الـ multi-core CPUs.
- **تبعيات متسقة:** `pnpm-lock.yaml` واحد للمستودع بأكمله. لا اختلاف في الإصدارات بين التطبيقات. الـ `pnpm strict mode` يمنع استيراد تبعيات غير معلنة.
- **CI/CD فعال:** `turbo prune` يقلص المستودع إلى ما يحتاجه CI فقط. `--filter` يشغل المهام على الحزم المتأثرة فقط. CI سريع ومركز.
- **إعداد مطورين سريع:** `git clone` واحد. `pnpm install` واحد. `turbo dev` يشغل كل التطبيقات. دقائق من الوصول إلى أول build.
- **أدوات موحدة:** ESLint, Prettier, TypeScript config واحدة (في `packages/config`). كل التطبيقات تستخدمها عبر `extends`.
- **مرونة مستقبلية:** إضافة تطبيق جديد = `apps/new-app` + إضافته لـ `pnpm-workspace.yaml`. Turborepo يكتشفه تلقائياً.

### سلبية

- **إعداد CI/CD أكثر تعقيداً:** مقارنة بـ polyrepo، CI pipeline يتطلب خطوات إضافية: `turbo prune`، `pnpm install --filter`، تحديد الـ affected packages. الإعداد الأولي يستغرق وقتاً أطول.
- **حجم المستودع ينمو:** 6 تطبيقات + 8 حزم + اختبارات + ADRs + specs. `git clone` يصبح أبطأ مع الوقت (يمكن تخفيفه بـ shallow clone: `git clone --depth 1`).
- **منحنى تعلم Turborepo:** الفريق يحتاج لفهم: `dependsOn`, `^build` (upstream dependency), `outputs` (cache artifacts), `--filter` syntax, `turbo prune`. أسبوع إضافي في التدريب.
- **pnpm strict mode قد يفاجئ المطورين:** خطأ `"Package X is not in package.json"` عند استيراد تبعية غير معلنة. مفيد للحدود لكنه يفاجئ المطورين القادمين من npm/yarn.
- **Merge conflicts في pnpm-lock.yaml:** تغييرات متزامنة في التبعيات من فرق مختلفة تسبب conflicts في `pnpm-lock.yaml`. حلها: `pnpm install --no-frozen-lockfile` بعد merge.

### مخاطر

- **المخاطرة 1: Cache القديم يسبب builds ناجحة خاطئة.**
  إذا لم نعرّف `dependsOn` و `inputs` بشكل صحيح في `turbo.json`، قد يستخدم Turborepo cache قديم لحزمة تغيرت تبعيتها. البناء "ينجح" لكن النتيجة خاطئة.
  - **التخفيف:** تعريف `dependsOn: ["^build"]` لكل مهمة build. تعريف `inputs` للمهام الحساسة (test, lint). CI يتحقق من الـ cache integrity. إذا شككنا في cache، `turbo build --force` يعيد البناء كاملاً.

- **المخاطرة 2: نمو حجم المستودع يؤثر على CI و developer setup.**
  مع إضافة الوسائط (images, PDFs)، حجم المستودع قد يتجاوز 1GB. `git clone` بطيء. CI workers تستهلك وقتاً في clone.
  - **التخفيف:** Git LFS للوسائط الكبيرة (> 1MB). `git clone --depth 1` في CI (shallow clone). `.gitignore` للملفات المولدة (`.next`, `dist`, `node_modules`). تنظيف دوري للـ Git history (إذا لزم).

- **المخاطرة 3: تبعيات دائرية بين الحزم.**
  مطور يضيف import من `@alharistech/api` إلى `@alharistech/ui` (أو العكس). تبعية دائرية تمنع Turborepo من تحديد ترتيب البناء الصحيح.
  - **التخفيف:** dependency-cruiser يعمل في CI. أي تبعية دائرية = فشل CI. `dpdm` (dependency patrol) يفحص dependencies و devDependencies.

- **المخاطرة 4: استيراد غير مصرح به بين الحزم.**
  `packages/ui` يستورد من `apps/api` (تجاوز لحدود المستودع — الحزم يجب ألا تستورد من التطبيقات). أو `apps/api` يستورد من `apps/web`.
  - **التخفيف:** ESLint rule `import/no-extraneous-dependencies` يمنع استيراد حزم غير معلنة في `package.json`. ESLint rule مخصص `no-app-to-app-import` يمنع imports بين التطبيقات. dependency-cruiser يتحقق من أن التبعيات تحترم الاتجاه: `apps → packages` فقط (وليس العكس).

- **المخاطرة 5: Remote cache غير متاح أو بطيء.**
  إذا كان Vercel Remote Cache غير متاح (outage, token expired, network issue)، البناء يتحول إلى local فقط — أبطأ لكنه يعمل. إذا كان الـ self-hosted cache server متوقفاً، نفس التأثير.
  - **التخفيف:** Turborepo يتحول إلى local cache تلقائياً إذا فشل remote cache. البناء لا يفشل — فقط يتباطأ. مراقبة remote cache availability. `turbo build --force` كخطة طوارئ.

## الامتثال

- **حدود الاستيراد (Import Boundaries):** التبعيات بين الحزم يجب أن تكون مصرحة في `package.json`. أي import من حزمة غير معلنة = خطأ. يُفحص بواسطة pnpm strict mode + ESLint `import/no-extraneous-dependencies`.
- **اتجاه التبعيات:** الحزم (`packages/*`) يجب ألا تستورد من التطبيقات (`apps/*`). التطبيقات يجب ألا تستورد من تطبيقات أخرى. يُفحص بواسطة dependency-cruiser بقاعدة: `packages → no dependency on apps`, `apps → no dependency on other apps`.
- **لا تبعيات دائرية:** أي دورة في الرسم البياني للتبعيات = فشل CI. يُفحص بواسطة `dpdm` أو dependency-cruiser `--no-circular`.
- **البناء يجب أن ينجح قبل الدمج:** `turbo build --filter=...[origin/main]` يجب أن ينجح. أي فشل build = منع الدمج. يُفحص في CI pipeline.
- **اختبارات على المتأثر فقط:** `turbo test --filter=...[origin/main]` يجب أن ينجح. أي فشل test = منع الدمج.
- **Turborepo cache outputs معرّفة:** كل مهمة في `turbo.json` يجب أن تعرّف `outputs` (مجلدات الـ build artifacts). بدونها، الـ cache غير فعال. يُفحص في code review.
- **ملف pnpm-lock.yaml ملتزم:** `pnpm-lock.yaml` يجب أن يكون ملتزماً في Git (وليس في `.gitignore`). يُفحص بواسطة CI: `git diff --exit-code pnpm-lock.yaml` بعد `pnpm install`.

## القرارات ذات الصلة

- [ADR-001: Next.js للتطبيق الأمامي](./adr-001-nextjs-frontend.md) — `apps/web` و `apps/admin` يستخدمان Next.js ضمن الـ monorepo.
- [ADR-002: NestJS للخدمات الخلفية](./adr-002-nestjs-backend.md) — `apps/api` يستخدم NestJS. الـ NestJS module structure يتوافق مع بنية الـ monorepo.
- [ADR-005: TypeScript عبر المنصة](./adr-005-typescript.md) — TypeScript config موحدة في `packages/config` ومستخدمة عبر كل التطبيقات والحزم.
- [ADR-013: Tailwind CSS + shadcn/ui](./adr-013-tailwind-shadcn.md) — `packages/ui` يحتوي مكتبة مكونات مشتركة مبنية بـ shadcn/ui و Tailwind.
- [ADR-017: Drizzle ORM](./adr-017-orm-drizzle.md) — `packages/database` يحتوي Drizzle schemas + migrations مستخدمة من `apps/api` و `apps/worker`.
- [ADR-011: Docker (عدم الاستخدام في التطوير)](./adr-011-docker.md) — Docker لا يُستخدم في التطوير. Turborepo + pnpm يديران الخدمات محلياً بدون حاويات.

## المراجع

- [Turborepo Documentation](https://turbo.build/repo/docs) — build orchestration
- [Turborepo Caching](https://turbo.build/repo/docs/core-concepts/caching) — cache mechanics
- [Turborepo Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching) — Vercel Remote Cache
- [pnpm Workspaces](https://pnpm.io/workspaces) — workspace protocol
- [pnpm Strict Mode](https://pnpm.io/next/npmrc#hoist) — dependency isolation
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) — dependency graph validation
- [dpdm](https://github.com/nicedoc/dpdm) — circular dependency detection
- [Changesets](https://github.com/changesets/changesets) — versioning for monorepos (للإصدارات المستقبلية)
- [Turborepo CI Recipes](https://turbo.build/repo/docs/ci) — CI/CD integration patterns
- [Git LFS](https://git-lfs.com/) — large file storage for media assets
