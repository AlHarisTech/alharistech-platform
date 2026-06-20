# ADR-001: استخدام Next.js للتطبيق الأمامي

## الحالة
مقبول (Accepted)

## التاريخ
2026-06-16

## السياق

منصة AlharisTech تتطلب واجهات أمامية متعددة: الموقع الرسمي (نظام التسويق والمعلومات)، لوحة تحكم المشرف، متجر الخدمات، بوابة العميل، وصفحات التوثيق. كل واجهة لها متطلبات مختلفة ولكنها تشترك في احتياجات أساسية: دعم اللغة العربية واتجاه RTL، أداء عالي على الأجهزة المحمولة، وتحسين محركات البحث للصفحات العامة.

المتطلبات التفصيلية:
- **SEO:** الموقع الرسمي والمتجر يعتمدان على الزوار العضويين. SSR/SSG ضروري لفهرسة المحتوى بواسطة محركات البحث وزحف وسائل التواصل الاجتماعي (Open Graph).
- **الأداء:** الجمهور المستهدف يشمل مستخدمين على شبكات 3G/4G في المنطقة. First Contentful Paint (FCP) يجب أن يكون أقل من 1.5 ثانية، و Largest Contentful Paint (LCP) أقل من 2.5 ثانية لتحقيق Core Web Vitals.
- **تجربة المطور:** الفريق مكون من 5-8 مطورين Frontend بخلفيات React. نحتاج إطار عمل يقلل وقت الإعداد (onboarding) ويدعم أنماطاً مألوفة.
- **المرونة:** المنصة ستنمو عبر 9 نطاقات (Domains). الواجهات الأمامية تحتاج إلى استهلاك REST APIs و GraphQL endpoints وتحتاج إلى نظام توجيه مرن.
- **النشر:** استراتيجية النشر لم تتحدد بعد (Vercel, self-hosted, Kubernetes). يجب ألا يقفلنا الإطار في بائع واحد.

## محركات القرار

1. **تحسين محركات البحث (SEO):** الصفحات العامة يجب أن تُصيّر من الخادم لتكون قابلة للفهرسة بواسطة Google و Bing. SPA التقليدية غير مقبولة للموقع الرسمي والمتجر.
2. **أداء التحميل الأولي:** FCP < 1.5s و LCP < 2.5s على شبكات 3G. SSR و SSG يحققان ذلك بتقليل JavaScript المرسل للمتصفح.
3. **دعم اللغة العربية و RTL:** الإطار يجب أن يتعامل مع تخطيطات RTL بدون تعقيد إضافي. نظام التوجيه يجب أن يدعم مسارات متعددة اللغات (`/ar`, `/en`).
4. **Server Components:** تقليل JavaScript المرسل للعميل (client) يحسن TTI (Time to Interactive). Server Components تنقل منطق التصيير إلى الخادم دون تكلفة hydration.
5. **النظام البيئي (Ecosystem):** الفريق يستخدم React. اختيار إطار ضمن نظام React البيئي يضمن توفر المكتبات (UI، state management، forms) وتوافقها.
6. **استقلالية النشر:** القدرة على النشر الذاتي (self-host) لتجنب الاعتماد الحصري على Vercel. يجب أن يعمل الإطار عبر `next start` أو Docker container دون خدمات Vercel الاحتكارية.
7. **النضج والاستقرار:** نريد إطار عمل مدعوم طويل الأمد بمجتمع نشط. التزام Vercel طويل الأمد بـ Next.js (منذ 2016) عامل مطمئن.
8. **قيود حجم الحزمة (Bundle Size):** JavaScript الأولي لكل مسار يجب ألا يتجاوز 200KB gzipped. Server Components و code splitting التلقائي يحققان ذلك.

## الخيارات المدروسة

### الخيار أ: Next.js مع App Router (المختار)

- **الوصف:** إطار عمل React كامل مع SSR/SSG/ISR عبر App Router. Server Components افتراضياً مع إمكانية Client Components عند الحاجة. نظام توجيه مبني على نظام الملفات مع layouts متداخلة و loading/error states.
- **إيجابيات:**
  - SSR/SSG/ISR مدمج بدون إعدادات إضافية. صفحات التسويق تُصيّر كـ static، لوحة التحكم كـ SSR.
  - Server Components تقلل JavaScript المرسل للمتصفح بنسبة 40-60% مقارنة بـ Pages Router. المكونات التي لا تحتاج تفاعلية تُصيّر على الخادم.
  - نظام التوجيه (App Router) حديث وقوي: layouts متداخلة، parallel routes، intercepting routes، route groups.
  - Next.js Image component يحسن الصور تلقائياً (WebP/AVIF، lazy loading، responsive sizes).
  - Middleware layer لاعتراض الطلبات (auth redirects، i18n routing، A/B testing).
  - Turbopack للتطوير المحلي: بناء أسرع بـ 10x من webpack في التطوير.
  - نظام إضافات (plugins) غني: next-intl للترجمة، next-auth للمصادقة، @next/bundle-analyzer.
  - دعم TypeScript أصلي مع أنواع محسنة لـ Server Components و Client Components.
  - إمكانية النشر الذاتي: `next build && next start` يعمل على أي Node.js server أو Docker container.
- **سلبيات:**
  - منحنى تعلم App Router: الفصل بين Server Components و Client Components (`'use client'`) وأنماط الـ data fetching الجديدة مختلفة جذرياً عن Pages Router.
  - Vercel vendor lock-in: بعض الميزات المتقدمة (ISR on-demand، analytics، edge functions) مرتبطة بمنصة Vercel.
  - تعقيد debugging: Server Components تُنفذ على الخادم، Client Components في المتصفح. الـ hydration errors قد تكون صعبة التشخيص.
  - Caching معقد: Next.js 14+ لديه طبقات caching متعددة (router cache، full route cache، data cache). السلوك الافتراضي قد يفاجئ المطورين.
  - حجم البناء (build size): مشاريع Next.js الكبيرة قد تستغرق دقائق للبناء. Turbopack يحل مشكلة التطوير فقط.

### الخيار ب: React + Vite (SPA)

- **الوصف:** تطبيق Single Page Application باستخدام React و Vite كأداة بناء. كل التصيير يحدث في المتصفح.
- **إيجابيات:**
  - بسيط ومباشر: لا SSR، لا Server Components، لا تعقيد في الـ hydration.
  - Vite سريع جداً في التطوير (HMR فوري) والبناء (Rollup-based).
  - مرونة كاملة في هيكلة المشروع: لا قيود من الإطار.
  - مجتمع React ضخم: مكتبات لا تحصى، حلول لكل مشكلة.
  - تكلفة نشر منخفضة: static files على CDN.
- **سلبيات:**
  - لا SSR: محركات البحث ترى صفحة فارغة أو محتوى محدود. SEO ضعيف بدون حلول إضافية (prerendering، SSR خارجي).
  - FCP بطيء: المتصفح يحمل JavaScript كاملاً قبل عرض أي محتوى. على 3G، FCP يتجاوز 3 ثوانٍ.
  - JavaScript ثقيل: كل المنطق في المتصفح. بدون code splitting دقيق، الحزمة قد تتجاوز 500KB.
  - SEO يحتاج حلولاً منفصلة: prerender.io أو puppeteer rendering تضيف تعقيداً تشغيلياً وتكلفة.
  - hydration غير موجود: أول render يكون بعد تحميل وتنفيذ JavaScript. تجربة مستخدم أقل سلاسة.

### الخيار ج: Remix

- **الوصف:** إطار عمل React من Shopify يركز على معايير الويب (Web Fetch API). كل مسار يُصيّر من الخادم.
- **إيجابيات:**
  - SSR ممتاز: كل مسار هو server-rendered بشكل طبيعي. nested routes تسمح بتحميل بيانات متوازي.
  - Web standards: يستخدم `Request`/`Response` Web APIs الأصلية. لا abstractions غير ضرورية.
  - Error boundaries مدمجة: كل مسار له error boundary مستقل. خطأ في مسار لا يكسر التطبيق كاملاً.
  - Form handling: دعم HTML forms أصلي مع progressive enhancement. لا حاجة لـ JavaScript للنماذج الأساسية.
  - بسيط مقارنة بـ Next.js App Router: ذهنية واحدة (loader + action + component) بدل RSC + Client Components.
- **سلبيات:**
  - مجتمع أصغر: عدد المكتبات والإضافات أقل بكثير من Next.js. حلول جاهزة أقل.
  - نظام بيئي أقل نضجاً: Remix أحدث من Next.js (2021 vs 2016). بعض المكتبات لا تختبر ضد Remix.
  - لا SSG/ISR مدمج: Remix يركز على SSR الديناميكي. الصفحات الثابتة تحتاج CDN caching يدوي.
  - Shopify acquisition: مستقبل Remix مرتبط باستراتيجية Shopify. أقل استقلالية من Next.js (Vercel) أو React (Meta).
  - دعم RTL/Arabic أقل نضجاً: مكتبات i18n لـ Remix أقل من next-intl لـ Next.js.

### الخيار د: Astro مع React Islands

- **الوصف:** إطار عمل static-first مع دعم "islands" تفاعلية. المحتوى static افتراضياً، التفاعلية تُضاف عند الحاجة.
- **إيجابيات:**
  - Zero JavaScript افتراضياً: صفحات static بدون JavaScript. مثالي للموقع الرسمي وصفحات التوثيق.
  - Islands architecture: مكونات React التفاعلية تُحمل فقط عند الحاجة. بقية الصفحة static HTML.
  - أداء ممتاز: LCP < 1s على الصفحات الثابتة. Lighthouse scores مثالية.
  - Content collections: نظام content collections مدمج لصفحات التوثيق والمدونة.
  - دعم multi-framework: يمكن استخدام React و Vue و Svelte في نفس المشروع.
- **سلبيات:**
  - ليس SPA: التنقل بين الصفحات full page reload (أو View Transitions API). تجربة أقل سلاسة من SPA/SSR.
  - Islands محدودة: المكونات التفاعلية لا تشارك state بسهولة. تطبيقات معقدة مثل لوحة التحكم تواجه صعوبة.
  - مجتمع أصغر: مكتبات أقل، حلول جاهزة أقل. الفريق يحتاج لبناء بعض الحلول يدوياً.
  - لا SSR ديناميكي: Astro ممتاز لـ static/SSG. للصفحات الديناميكية (لوحة التحكم)، نضطر لاستخدام SSR adapter أو تطبيق منفصل.
  - تعقيد إضافي: استخدام Astro للموقع الرسمي و Next.js للوحة التحكم يعني إطارين مختلفين للفريق.

## القرار

اخترنا **Next.js مع App Router** للأسباب التالية:

1. **SEO + SSR + SSG في إطار واحد:** Next.js يوفر الثلاثة. App Router يتيح SSR للوحة التحكم، SSG للموقع الرسمي والمتجر، ISR للمنتجات المتغيرة. لا حاجة لإطارين منفصلين.

2. **Server Components تقلل JavaScript:** المكونات التي لا تحتاج تفاعلية (headers, footers, product cards, documentation content) تُصيّر على الخادم ولا تُرسل JavaScript للمتصفح. هذا يحسن TTI بشكل كبير لمستخدمي الأجهزة المحمولة.

3. **نظام التوجيه (App Router) حديث ومرن:** Route groups تسمح بتنظيم المسارات حسب النطاق (`(public)`, `(dashboard)`, `(admin)`) مع layouts مستقلة لكل مجموعة. Parallel routes و intercepting routes تغطي حالات متقدمة.

4. **صفحات التسويق Static:** `generateStaticParams` + Full Route Cache يضمنان أن صفحات الموقع الرسمي والمتجر تُصيّر static في وقت البناء. CDN caching إضافي للسرعة.

5. **لوحة التحكم SSR:** صفحات dashboard تُصيّر من الخادم مع جلب البيانات عبر Server Components. المصادقة عبر Middleware layer. تجربة سريعة للمشرفين.

6. **النشر الذاتي ممكن:** `next build && next start` يعمل على أي Node.js 20+ server. يمكن وضعه في Docker container أو تشغيله مباشرة. لا اعتماد على Vercel APIs في المسار الأساسي. ميزات Vercel (ISR on-demand, analytics) اختيارية.

7. **تخفيف vendor lock-in:**
   - نستخدم `output: 'standalone'` للنشر الذاتي.
   - لا نستخدم Vercel-specific APIs مثل `@vercel/og` أو `@vercel/kv` (نستخدم بدائل: Satori + Redis).
   - ISR يعمل على self-hosted مع تخزين الملفات محلياً.
   - Middleware يستخدم Web APIs القياسية (`NextRequest`, `NextResponse`).

8. **تفاصيل التنفيذ:**
   - `next.config.js`: `output: 'standalone'`، دعم RTL عبر `i18n` أو `next-intl` middleware.
   - Route groups: `(public)/`, `(dashboard)/`, `(admin)/` مع layouts مخصصة.
   - Server Components افتراضياً. `'use client'` فقط للمكونات التفاعلية (forms, charts, real-time updates).
   - Next.js Image component لكل الصور مع `remotePatterns` للمصادر الخارجية.
   - Turbopack للتطوير (`next dev --turbo`).

## العواقب

### إيجابية

- **SEO ممتاز:** SSR + SSG + ISR + Open Graph metadata تولد صفحات قابلة للفهرسة. الموقع الرسمي والمتجر يحققان ترتيباً جيداً في محركات البحث.
- **أداء تحميل أولي عالي:** SSR يرسل HTML جاهزاً. FCP < 1.5s و LCP < 2.5s على 3G (بافتراض Backend < 200ms).
- **JavaScript أقل للعميل:** Server Components تقلل bundle size بنسبة 40-60%. Next.js code splitting التلقائي لكل مسار.
- **تجربة مطور محسنة:** Turbopack + HMR + error overlay. TypeScript type safety عبر `next/types`.
- **نظام توجيه قوي:** layouts متداخلة، error boundaries، loading states. Route groups للفصل بين النطاقات.
- **صيانة مركزية:** إطار واحد لكل الواجهات الأمامية. تحديثات الأمان والاعتماديات مدارة في مكان واحد.

### سلبية

- **منحنى تعلم App Router:** الفريق يحتاج أسبوعين إضافيين لتعلم Server Components، RSC data fetching، والـ caching layers. الانتقال من React التقليدي لـ RSC mindset.
- **تعقيد في debugging:** Server Components لا تعرض console.log في المتصفح. الـ hydration errors تحتاج خبرة في تشخيصها (الفرق بين server و client render).
- **زمن بناء أطول:** مشاريع Next.js الكبيرة تستغرق 3-5 دقائق للبناء (بدون Turbopack). CI/CD pipeline يحتاج عمالاً بموارد كافية.
- **Caching غير بديهي:** Next.js 14+ لديه 4 طبقات caching. السلوك الافتراضي قد يسبب stale data. يحتاج فريق لضبط `revalidate`, `cache()`, و `dynamic` بوعي.

### مخاطر

- **المخاطرة 1: Vercel vendor lock-in.**
  الاعتماد على ميزات Vercel الاحتكارية (Edge Functions، ISR on-demand، Analytics) يزيد تكلفة الخروج.
  - **التخفيف:** نستخدم `output: 'standalone'` وننشر ذاتياً. لا نعتمد على `@vercel/*` packages. ISR عبر file-system cache. Middleware عبر `NextRequest` (Web API قياسي). إذا انتقلنا من Vercel، نستبدل الـ CDN والتحليلات بمزودين بديلين.

- **المخاطرة 2: App Router قد يتغير بشكل جذري.**
  Next.js App Router لا يزال يتطور. تغييرات breaking ممكنة بين الإصدارات الرئيسية.
  - **التخفيف:** تثبيت إصدار Next.js في `package.json` (`"next": "~15.x"`). Renovate يراقب التحديثات. اختبار التحديث في staging قبل الإنتاج. CI يتحقق من نجاح `next build`.

- **المخاطرة 3: Server Components تزيد حمل الخادم.**
  كل طلب SSR يستدعي مكونات الخادم ويجلب البيانات. حمل إضافي على الخادم مقارنة بـ SPA.
  - **التخفيف:** Full Route Cache للصفحات الثابتة. ISR للصفحات شبه الثابتة. CDN caching. `stale-while-revalidate` للبيانات المتغيرة. مراقبة حمل الخادم (CPU, memory) مع النمو.

- **المخاطرة 4: حجم الحزمة (Bundle Size) ينمو بدون رقابة.**
  إضافة مكتبات جديدة (charts, rich text editors, maps) تنفخ حجم الحزمة وتؤثر على LCP.
  - **التخفيف:** `@next/bundle-analyzer` في CI مع gates: JavaScript أولي < 200KB gzipped لكل مسار. Lighthouse CI كـ gate: Performance > 90. Code splitting التلقائي + dynamic imports للمكتبات الثقيلة.

## الامتثال

- **حجم الحزمة (Bundle Size):** JavaScript الأولي لكل مسار يجب أن يكون < 200KB gzipped. يُفحص بواسطة `@next/bundle-analyzer` في CI. أي مسار يتجاوز الحد يمنع الدمج (merge).
- **Lighthouse gates:** كل صفحة يجب أن تحقق Performance > 90، Accessibility > 95، SEO > 95. Lighthouse CI يعمل كـ check على كل PR. الفشل يمنع الدمج.
- **Server Components أولاً:** المكونات يجب أن تكون Server Components افتراضياً. `'use client'` فقط للمكونات التفاعلية. يُفحص بواسطة ESLint rule: `no-useless-client-directive`.
- **Static Generation:** الصفحات العامة (الموقع الرسمي، المتجر، التوثيق) يجب أن تُصيّر static باستخدام `generateStaticParams`. صفحات SSR فقط حيث البيانات متغيرة جداً (لوحة التحكم، الملف الشخصي).
- **Image Optimization:** جميع الصور يجب أن تستخدم `next/image` مع `width`, `height`, `alt`. ESLint rule: `@next/next/no-img-element`.
- **عدم استخدام Vercel APIs:** `@vercel/og`، `@vercel/kv`، `@vercel/blob` غير مسموح بها. الفحص في CI عبر `pnpm why @vercel/` (يجب أن لا يرجع نتائج).
- **Middlewares آمنة:** Middleware يجب ألا ينفذ عمليات ثقيلة (DB queries, API calls). Middleware للتوجيه والمصادقة فقط. يُفحص في code review.

## القرارات ذات الصلة

- [ADR-005: TypeScript عبر المنصة](./adr-005-typescript.md) — Next.js يوفر تكامل TypeScript أصلي. الأنواع المولدة من OpenAPI تصل إلى Client Components عبر `next/types`.
- [ADR-007: JWT Authentication](./adr-007-jwt-auth.md) — Middleware layer في Next.js يتحقق من JWT للصفحات المحمية. `next-auth` أو `jose` للتحقق من الـ token.
- [ADR-008: GraphQL + REST API](./adr-008-graphql-rest.md) — Client Components تستخدم REST (fetch/axios). Server Components تستخدم GraphQL لجلب بيانات معقدة.
- [ADR-013: Tailwind CSS + shadcn/ui](./adr-013-tailwind-shadcn.md) — Tailwind للتصميم، shadcn/ui لمكونات UI الجاهزة المتوافقة مع RSC و RTL.
- [ADR-015: OpenAPI/Swagger](./adr-015-openapi-swagger.md) — الأنواع المولدة من OpenAPI specs تُستهلك في Client Components لضمان تطابق الواجهة الأمامية مع العقود.

## المراجع

- [Next.js Documentation](https://nextjs.org/docs) — الإطار الأمامي الأساسي
- [React Server Components](https://react.dev/reference/rsc/server-components) — معمارية Server Components
- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images) — تحسين الصور
- [Core Web Vitals](https://web.dev/vitals/) — معايير الأداء (FCP, LCP, TBT, CLS)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) — فحص الأداء آلياً
- [next-intl](https://next-intl-docs.vercel.app/) — مكتبة الترجمة لـ Next.js مع دعم RTL
- [Next.js Self-Hosting](https://nextjs.org/docs/app/building-your-application/deploying) — النشر الذاتي باستخدام `output: 'standalone'`
