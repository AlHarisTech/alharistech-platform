# ADR-007: استخدام JWT + Refresh Tokens للمصادقة

## الحالة
مقبول (Accepted)

## التاريخ
2026-06-20

## السياق
تحتاج منصة الحارس تك إلى نظام مصادقة وتفويض (Authentication & Authorization) يدعم:
- **API عديم الحالة (Stateless)** — المنصة تستخدم REST API (و GraphQL لاحقاً) ويجب ألا تعتمد على جلسات خادم (Server Sessions) لتوسع أفقي سهل. كل طلب يجب أن يحمل بيانات المصادقة كاملة.
- **قنوات متعددة (Multi-Channel)** — المنصة تُستخدم عبر: (أ) متصفح الويب (Next.js)، (ب) لوحة تحكم المسؤول (Admin Dashboard)، (ج) تطبيق سطح المكتب (Electron/Tauri — مرحلة 4)، (د) تطبيقات الجوال (React Native — مرحلة 4)، (هـ) API للشركاء (API Keys — مرحلة 3). النظام يجب أن يعمل عبر كل هذه القنوات.
- **نظام RBAC متكامل** — 5 أدوار (Admin، Manager، Employee، Customer، Partner) مع صلاحيات دقيقة الحبيبات (Granular Permissions) بصيغة `{domain}:{resource}:{action}`. كل طلب API يجب أن يُفوض بناءً على دور المستخدم وصلاحياته.
- **أمان عالٍ** — (أ) تشفير TLS 1.3 لكل الاتصالات (NFR-301). (ب) حماية من OWASP Top 10 (NFR-303) خاصة: Broken Authentication (A07)، Cross-Site Scripting (A03)، Cross-Site Request Forgery (A01 سابقاً)، Sensitive Data Exposure (A02 سابقاً). (ج) قفل الحساب بعد 5 محاولات فاشلة (NFR-305). (د) تدوير الرموز (Token Rotation) لمنع إعادة استخدام الرموز المسروقة.
- **جلسات متعددة الأجهزة** — المستخدم يمكنه تسجيل الدخول من عدة أجهزة (FR-109). يجب أن يتمكن من عرض جميع جلساته وإلغاء أي منها.
- **أداء** — التحقق من JWT يجب أن يكون سريعاً (< 5ms) لتحقيق NFR-101 (API Response < 200ms p95).
- **جاهزية للمستقبل** — إضافة MFA (TOTP/WebAuthn — مرحلة 3) وتسجيل دخول اجتماعي (OAuth2 Google/Apple/GitHub — مرحلة 3) دون إعادة هيكلة نظام المصادقة.

## محركات القرار
1. الحاجة إلى API عديم الحالة (Stateless) لدعم التوسع الأفقي (نسختان أو أكثر من NestJS API).
2. دعم قنوات متعددة (Web، Mobile، Desktop، API Partners).
3. تكامل مع RBAC دقيق الحبيبات (`identity:user:create`، `service:order:assign`).
4. أمان عالٍ — تدوير الرموز، كشف إعادة الاستخدام، حظر الرموز.
5. أداء — التحقق من JWT يجب ألا يضيف أكثر من 5ms لكل طلب.
6. متطلبات NFR-301 (TLS 1.3)، NFR-303 (OWASP)، NFR-305 (Account Lockout).

## الخيارات المدروسة

### الخيار أ: JWT + Refresh Tokens مع تدوير وكشف إعادة الاستخدام
- **الوصف:** نظام مصادقة قائم على زوج من الرموز: (1) **Access Token:** JWT بتوقيع RS256، صلاحية 15 دقيقة، يُرسل في `Authorization: Bearer` header ويُخزن في ذاكرة المتصفح (غير accessible عبر JavaScript من `httpOnly` cookie مختلف). (2) **Refresh Token:** سلسلة عشوائية مشفرة (Opaque Token)، صلاحية 7 أيام، يُخزن في `httpOnly` `Secure` `SameSite=Strict` cookie. عند استخدام Refresh Token، يُصدر زوج جديد (Access + Refresh جديدين) ويُبطل القديم (Token Rotation). إذا قُدِّم Refresh Token قديم (مُستخدَم سابقاً)، يُفترض أنه سُرق ويتم إبطال جميع جلسات المستخدم (Reuse Detection).
- **إيجابيات:**
  - **Stateless تماماً** — Access Token يحتوي على جميع معلومات المستخدم (userId، roles، permissions) في Payload. أي نسخة من NestJS API يمكنها التحقق من JWT دون استشارة قاعدة بيانات أو Redis (باستثناء Blacklist).
  - **أمان عالٍ مع تدوير الرموز** — حتى إذا سُرق Refresh Token: (أ) المهاجم والمستخدم الشرعي كلاهما سيحاول استخدام Refresh Token. (ب) أول من يستخدمه سيحصل على زوج جديد، والثاني سيُرفض (لأن الرمز القديم أُبطل). (ج) النظام يكتشف أن Refresh Token قُدِّم مرتين = سرقة = يُبطل جميع جلسات المستخدم وينبهه.
  - **Access Token قصير العمر (15 دقيقة)** — يحد من نطاق الضرر إذا سُرق Access Token. المهاجم لديه 15 دقيقة فقط. ولا يمكنه الحصول على Refresh Token (لأنه في httpOnly Cookie محمي من XSS).
  - **دعم ممتاز للقنوات المتعددة** — (أ) **Web:** Access Token في الذاكرة، Refresh Token في httpOnly Cookie. (ب) **Mobile:** Access Token في Keychain (iOS) / KeyStore (Android)، Refresh Token أيضاً في مخزن آمن. (ج) **API Partners:** API Key دائم (بدلاً من JWT) مع صلاحيات محددة.
  - **أداء فائق** — التحقق من JWT هو عملية توقيع رقمي فقط (RS256 verification) تستغرق < 1ms. لا حاجة لاستعلام قاعدة بيانات (إلا في حالة Token Blacklist، والتي يمكن تخزينها في Redis).
  - **تكامل طبيعي مع RBAC** — يمكن تضمين `roles` و `permissions` مباشرة في JWT Payload: `{ sub: "user-uuid", roles: ["customer"], permissions: ["service:order:create", "service:order:read"] }`. أي تغيير في الصلاحيات يتطلب إصدار Access Token جديد (والذي يحدث كل 15 دقيقة تلقائياً أو عند Refresh).
  - **إلغاء فوري عبر Token Blacklist** — إذا احتاج المسؤول لإلغاء وصول مستخدم فوراً (قبل انتهاء صلاحية Access Token الـ 15 دقيقة)، يُضاف `jti` (JWT ID) إلى Blacklist في Redis مع TTL = المدة المتبقية.
  - **جاهزية لـ MFA** — عند إضافة MFA (مرحلة 3)، الخطوة الإضافية تكون بعد التحقق من كلمة المرور وقبل إصدار الرموز. الهيكلة الحالية لا تحتاج لتغيير.
- **سلبيات:**
  - **حجم JWT قد يكبر** — إذا ضُمِّنت جميع الصلاحيات (Permissions) في Payload، قد يصل حجم JWT إلى 2–3KB (خاصة للأدوار العليا مثل Admin التي تملك 100+ Permission). هذا يُضاف إلى كل طلب API. **لكن:** 2KB إضافية في Header لا تؤثر على الأداء بشكل ملحوظ (خاصة مع HTTP/2 و Compression).
  - **لا يمكن إبطال Access Token بعد إصداره (بدون Blacklist)** — إذا سُرق Access Token، المهاجم يمكنه استخدامه حتى انتهاء صلاحيته (15 دقيقة). Blacklist يخفف هذا لكنه يضيف استعلام Redis لكل طلب. **الحل:** يمكن تخزين Blacklist في ذاكرة التطبيق (In-Memory Set) مع تحديث دوري من Redis (كل 30 ثانية) لتجنب استعلام Redis في كل طلب.
  - **تعقيد تنفيذ تدوير الرموز** — Token Rotation يتطلب: (أ) تخزين Refresh Token الحالي (hashed) في قاعدة البيانات. (ب) عند Refresh: التحقق من صحة الرمز، إصدار زوج جديد، إبطال القديم. (ج) إذا قُدِّم رمز قديم = Reuse Detection. هذا أكثر تعقيداً من الجلسات التقليدية.
  - **انتهاء صلاحية الرموز يتطلب تعامل خاص في الـ Frontend** — قبل 5 دقائق من انتهاء Access Token، يجب على Frontend طلب Refresh Token بصمت (Silent Refresh) للحصول على Access Token جديد دون إزعاج المستخدم.

### الخيار ب: المصادقة المبنية على الجلسات (Session-Based / Cookie)
- **الوصف:** نظام مصادقة تقليدي: (1) المستخدم يسجل الدخول. (2) الخادم يُنشئ جلسة (Session) ويُخزن sessionId في Redis/DB. (3) Session ID يُرسل للمتصفح في `httpOnly` Cookie. (4) كل طلب يُرسل Cookie تلقائياً، والخادم يستعلم Redis للحصول على بيانات الجلسة.
- **إيجابيات:**
  - بسيط ومفهوم — نموذج مألوف لجميع المطورين. لا تعقيد تدوير الرموز أو كشف إعادة الاستخدام.
  - إبطال فوري — حذف الجلسة من Redis = إبطال فوري (لا حاجة لـ Blacklist).
  - حجم Cookie صغير — sessionId فقط (UUID = 36 حرفاً).
  - لا حاجة لـ Silent Refresh في Frontend — Cookie يُرسل تلقائياً مع كل طلب.
- **سلبيات:**
  - **Stateful — مخالف لمبدأ Stateless API** — كل طلب يحتاج استعلام Redis لاسترداد بيانات الجلسة. هذا يضيف 1–2ms لكل طلب (Redis Query) ويجعل الـ API معتمداً على Redis. إذا تعطل Redis، جميع المستخدمين يُطرَدون (حتى لو Redis Sentinel يخفف هذا).
  - **لا يعمل مع Mobile/Desktop بدون تعديلات** — تطبيقات الجوال وسطح المكتب لا تتعامل مع Cookies تلقائياً مثل المتصفحات. تحتاج إلى: (أ) إدارة يدوية للـ Cookies (مكتبة منفصلة). (ب) أو حل هجين: Cookies للـ Web + Tokens للـ Mobile = نظامان للمصادقة.
  - **CSRF Vulnerability** — Cookie-based systems عرضة لهجمات CSRF (Cross-Site Request Forgery). تحتاج إلى CSRF Tokens أو SameSite Cookies للحماية. SameSite=Strict ممتاز لكنه يمنع بعض السيناريوهات المشروعة (فتح رابط من بريد إلكتروني).
  - **أداء أقل مع زيادة عدد المستخدمين** — مع 10,000+ مستخدم نشط، استعلام Redis لكل طلب (500 req/s) يُضيف حملاً ملحوظاً على Redis. مقارنة بـ JWT الذي لا يحتاج استعلاماً إلا للـ Blacklist (نادر).
  - **لا يدعم API Partners بشكل طبيعي** — الشركاء (API Keys) يحتاجون نظاماً مختلفاً تماماً. JWT يمكن توقيعه لـ API Partners أيضاً (مع صلاحية أطول).

### الخيار ج: OAuth2 / OIDC فقط (بدون نظام مصادقة محلي)
- **الوصف:** الاعتماد حصراً على مزود هوية خارجي (Google Identity، Apple Sign-In، GitHub OAuth) لتسجيل الدخول. لا يوجد تسجيل محلي (بريد + كلمة مرور).
- **إيجابيات:**
  - لا حاجة لإدارة كلمات المرور — لا تخزين، لا hashing، لا استعادة كلمة مرور. مسؤولية الأمان على عاتق Google/Apple.
  - تجربة مستخدم ممتازة — "تسجيل الدخول بـ Google" أسرع من ملء نموذج بريد + كلمة مرور.
  - أمان عالٍ — Google و Apple يستثمرون مليارات في أمان حساباتهم (MFA، كشف احتيال، إلخ).
- **سلبيات:**
  - **لا يمكن الاعتماد عليه حصراً** — فئة كبيرة من العملاء (خاصة في السوق السعودي) لا يمتلكون حسابات Google أو Apple أو يفضلون عدم ربطها. أيضاً: بعض المؤسسات الحكومية وشبه الحكومية تمنع استخدام حسابات شخصية للخدمات الرسمية.
  - **تبعية كاملة لمزود خارجي** — إذا تعطل Google OAuth (حدث نادر لكنه يحدث)، لا يمكن لأي مستخدم تسجيل الدخول. لا يوجد مخرج.
  - **متطلب FR-101 (تسجيل بالبريد + كلمة المرور) هو P0** — وهو مطلب أساسي لا يمكن تجاهله.
  - **لا يوفر صلاحيات دقيقة (RBAC)** — OAuth2 يوفر معلومات أساسية (اسم، بريد، صورة). لا يوفر: أدوار (Admin، Employee)، صلاحيات (`service:order:assign`)، أو بيانات إضافية (مثل company_name للعملاء B2B). يجب بناء نظام صلاحيات محلي على أي حال.
  - **OAuth2/ OIDC هو طبقة إضافية وليس بديلاً** — المنصة ستدعم OAuth2 كخيار إضافي للمستخدمين (FR-108، المرحلة 3)، لكن لا يمكن أن يكون الخيار الوحيد.

## القرار
اخترنا **JWT + Refresh Tokens مع تدوير الرموز وكشف إعادة الاستخدام** للأسباب التالية:

1. **API عديم الحالة (Stateless) يدعم التوسع الأفقي** — أي نسخة من NestJS API يمكنها التحقق من JWT دون استعلام مركزي. هذا ضروري مع 2+ نسخ في الإنتاج. Session-based يتطلب Redis لكل طلب (Stateful) وهو عنق زجاجة محتمل.

2. **دعم جميع القنوات الحالية والمستقبلية** — (أ) **Web:** Authorization Header + httpOnly Cookie. (ب) **Mobile:** Keychain/KeyStore تخزين آمن للرموز. (ج) **Desktop:** Electron/ Tauri Secure Storage. (د) **API Partners:** API Keys (مع صلاحيات محددة). نظام واحد يخدم الجميع (مع تكيفات طفيفة لكل قناة).

3. **أمان متقدم** — (أ) Access Token قصير العمر (15 دقيقة) يحد من ضرر السرقة. (ب) Refresh Token في httpOnly Secure SameSite=Strict Cookie — محمي من XSS و CSRF. (ج) تدوير الرموز (Rotation): كل Refresh يُصدر زوجاً جديداً ويُبطل القديم. (د) كشف إعادة الاستخدام (Reuse Detection): إذا قُدِّم Refresh Token مستخدم سابقاً، يُفترض سرقة وتُبطل جميع جلسات المستخدم. (هـ) Token Blacklist في Redis للإبطال الفوري.

4. **تكامل مثالي مع RBAC** — JWT Payload يحتوي على: `sub` (userId)، `roles`، `permissions`، `tenantId` (مرحلة 5). NestJS Guards تقرأ هذه البيانات مباشرة من JWT دون استعلام قاعدة بيانات، مما يحقق أداءً فائقاً ويحقق NFR-101.

5. **أداء فائق** — التحقق من JWT (RS256 signature verification) يستغرق < 1ms. مع تضمين الصلاحيات في الـ Payload، لا حاجة لاستعلام DB أو Redis (إلا للـ Blacklist في حالات نادرة). هذا مقارنة بـ Session-based الذي يحتاج استعلام Redis لكل طلب (1–2ms إضافية).

6. **توافق مع معايير NFR** — (أ) **NFR-301 (TLS 1.3):** الرموز لا تُرسل أبداً بدون TLS. `Secure` flag على Cookie يضمن ذلك. (ب) **NFR-303 (OWASP):** الحماية من XSS (httpOnly Cookie)، CSRF (SameSite=Strict)، Sensitive Data Exposure (Access Token في الذاكرة فقط، غير مخزن في localStorage). (ج) **NFR-305 (Account Lockout):** بعد 5 محاولات فاشلة → قفل 15 دقيقة. Progressive: 5 → 10 → 30 دقيقة.

7. **مرونة للمستقبل** — إضافة MFA (مرحلة 3) أو OAuth2 (مرحلة 3) تتكامل مع هذا النظام: (أ) **MFA:** بعد التحقق من كلمة المرور → تحدي MFA → إصدار JWT. (ب) **OAuth2:** بعد نجاح OAuth2 → إنشاء/ربط حساب محلي → إصدار JWT. النظام الحالي لا يحتاج إعادة هيكلة.

## العواقب

### إيجابيات
- **أداء ممتاز** — التحقق من JWT لا يحتاج استعلام شبكة أو قاعدة بيانات. < 1ms للتحقق. JWT Payload يحتوي كل ما يحتاجه الـ Guard للتفويض.
- **قابلية توسع أفقي ممتازة** — لا حاجة لـ Sticky Sessions أو Session Replication بين نسخ API. أي Load Balancer (Round Robin، Least Connections) يعمل بشكل طبيعي.
- **أمان متعدد الطبقات** — 15 دقيقة Access Token + 7 أيام Refresh Token مع تدوير + httpOnly Cookie + Blacklist + Reuse Detection = دفاع متعدد الطبقات.
- **إدارة جلسات متقدمة** — المستخدم يمكنه: (أ) رؤية جميع أجهزته (كل Refresh Token = جهاز). (ب) إلغاء جلسة جهاز معين. (ج) المسؤول يمكنه إجبار مستخدم على تسجيل الخروج من جميع الأجهزة (سحب جميع Refresh Tokens).
- **جاهزية للمرحلة الخامسة (Multi-Tenant)** — JWT Payload يمكن أن يتضمن `tenantId`. في Multi-Tenant، نفس المستخدم يمكنه الانتماء لـ Tenants متعددة مع أدوار مختلفة في كل Tenant.

### سلبيات
- **تعقيد في التنفيذ** — Token Rotation + Reuse Detection + Blacklist + Silent Refresh + Multi-Device Management = نظام مصادقة معقد نسبياً مقارنة بـ Session-based البسيط. لكن هذا التعقيد ضروري للأمان والتوسع.
- **حجم JWT كبير نسبياً للأدوار العليا** — Admin Role قد يملك 100+ Permission. تضمينها كلها في JWT Payload ينتج JWT بحجم 2–3KB (مقارنة بـ Session ID بحجم 36 حرفاً). **التخفيف:** (أ) HTTP/2 Header Compression (HPACK) يضغط الـ Headers المتكررة. (ب) يمكن استخدام Permissions light — تضمين Role فقط في JWT، واستعلام Permissions من Redis عند الحاجة (للصلاحيات الدقيقة فقط).
- **Silent Refresh معقد في Frontend** — يجب على Frontend توقع انتهاء صلاحية Access Token وطلب Refresh Token بصمت (بدون إزعاج المستخدم). إذا فشل (مثلاً: Refresh Token منتهي الصلاحية)، يجب توجيه المستخدم لتسجيل الدخول. هذا يتطلب: Interceptor في HTTP Client (Axios/Fetch)، إعادة محاولة ذكية (Retry with Queue)، وعدم إرسال طلبات Refresh متعددة متزامنة.

### مخاطر
- **خطر: سرقة Refresh Token** — إذا تمكن المهاجم من سرقة httpOnly Cookie (عبر ثغرة XSS متقدمة جداً أو Man-in-the-Middle)، يمكنه انتحال شخصية المستخدم. **التخفيف:** (1) `httpOnly` flag يمنع JavaScript من قراءة Cookie (حماية XSS). (2) `Secure` flag يمنع إرسال Cookie عبر HTTP غير مشفر (NFR-301: TLS 1.3 إلزامي). (3) `SameSite=Strict` يمنع إرسال Cookie في الطلبات عبر المواقع (Cross-Site). (4) Token Rotation + Reuse Detection: إذا استخدم المهاجم Refresh Token المسروق، سيتم إبطاله فوراً وسيحصل المستخدم الشرعي على إنذار. (5) ربط Refresh Token بـ Device Fingerprint (IP، User-Agent) — إذا تغير fingerprint، يُرفض الرمز ويتطلب إعادة مصادقة.
- **خطر: تسريب Permissions قديمة في JWT** — إذا غيّر المسؤول صلاحيات مستخدم (مثلاً: سحب Permission معين)، المستخدم سيظل يمتلك هذا الـ Permission حتى ينتهي Access Token الحالي (حتى 15 دقيقة). **التخفيف:** (1) 15 دقيقة فترة قصيرة نسبياً. (2) للإبطال الفوري (مثلاً: طرد موظف): إضافة `jti` إلى Token Blacklist في Redis مع TTL = المدة المتبقية. (3) صلاحيات JWT تُستخدم للتفويض السريع فقط (Performance). التحقق النهائي (خاصة للعمليات الحرجة: حذف مستخدم، تغيير صلاحيات) يستعلم قاعدة البيانات دائماً (Defense in Depth). (4) Event `PermissionRevoked` يمكن أن يُشغل WebSocket لإجبار Frontend على Refresh فوري.
- **خطر: هجوم القوة الغاشمة على Refresh Token endpoint** — مهاجم يحاول تخمين Refresh Tokens بإرسال طلبات متكررة إلى `/auth/refresh`. **التخفيف:** (1) Rate Limiting صارم على `/auth/refresh`: 10 طلبات/IP/دقيقة. (2) Refresh Token هو سلسلة عشوائية بطول 256-bit (32 بايت، 64 حرف hex) — غير قابل للتخمين عملياً. (3) كل محاولة فاشلة تُسجَّل (Audit Log). (4) بعد 50 محاولة فاشلة من نفس IP، يُحظر IP لمدة ساعة (NFR-303: OWASP A07 — Identification and Authentication Failures).
- **خطر: هجوم توقيت (Timing Attack) على Refresh Token** — مهاجم يحاول استنتاج Refresh Token صحيح عبر قياس زمن استجابة الخادم (إذا كان الخادم يُرجع خطأ أسرع للرموز غير الصالحة). **التخفيف:** (1) Refresh Token يُخزَّن كـ SHA-256 hash في قاعدة البيانات. المقارنة تكون `crypto.timingSafeEqual()` وليس `===` (Constant-Time Comparison). (2) زمن الاستجابة يكون ثابتاً بغض النظر عن صحة الرمز (نضيف `setTimeout` عشوائي للمقارنات الفاشلة). (3) NFR-303: OWASP A02 — Cryptographic Failures.

## الامتثال
- **فحص تلقائي (CI):** (1) اختبارات Unit لـ `AuthService.verifyJwt()` و `AuthService.refreshToken()`. (2) اختبارات Integration لتدفق المصادقة الكامل: Register → Login → Access Protected Route → Refresh → Logout. (3) اختبار أمان: التحقق من أن Refresh Token لا يُقبل بعد الاستخدام (Rotation). (4) اختبار Reuse Detection: تقديم Refresh Token مستخدم سابقاً → يجب إبطال جميع الجلسات.
- **مراجعة أمنية دورية:** (1) مراجعة كود `AuthService` و `JwtStrategy` و `RefreshTokenStrategy` كل 3 أشهر. (2) OWASP ZAP Scan أسبوعي يتحقق من عدم وجود ثغرات في `/auth/*` (NFR-303). (3) اختبار اختراق سنوي (Penetration Testing) من طرف ثالث.
- **مراقبة في الإنتاج:** (1) إنذار عند: > 10 محاولات فاشلة/دقيقة على `/auth/login` (هجوم قاموس). (2) إنذار عند: > 5 حالات Reuse Detection في الساعة (اختراق محتمل). (3) إنذار عند: > 100 Refresh Token expired في الدقيقة (قد يكون هجوماً). (4) سجل تدقيق كامل: كل Login، Logout، Refresh، Password Reset، Session Revocation (NFR-304).
- **تشفير:** (1) JWT بتوقيع RS256 — Private Key لا يغادر Auth Service أبداً. Public Key يُشارك مع الخدمات الأخرى للتحقق. (2) Refresh Token يُخزَّن كـ SHA-256 hash في قاعدة البيانات. (3) جميع الرموز تُرسل حصراً عبر TLS 1.3 (NFR-301).

## القرارات ذات الصلة
- ADR-002: NestJS للخدمات الخلفية — `@nestjs/jwt` و `@nestjs/passport` مع `JwtStrategy` و `RefreshTokenStrategy`.
- ADR-004: Redis للتخزين المؤقت والجلسات — Redis يُستخدم لـ Token Blacklist (جلسات ملغاة فوراً).
- ADR-005: TypeScript — أنواع صارمة لـ `JwtPayload`، `TokenResponse`، `LoginDto`.
- ADR-006: Architecture Model — `AuthGuard`، `RolesGuard`، `PermissionsGuard` في طبقة Presentation. `AuthService` في طبقة Application. `JwtStrategy` في طبقة Infrastructure.
- ADR-016: DDD — نطاق Identity هو المسؤول الوحيد عن المصادقة والتفويض. جميع النطاقات الأخرى تستهلك `AuthGuard` من `common/guards/`.

## المراجع
- [JWT RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519)
- [JWT Best Practices (IETF)](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [@nestjs/jwt Documentation](https://docs.nestjs.com/security/authentication)
- [@nestjs/passport Documentation](https://docs.nestjs.com/recipes/passport)
- [Refresh Token Rotation Best Practices (Auth0)](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
- [NIST SP 800-63B: Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [NFR-301: TLS 1.3 Encryption](docs/requirements/system-requirements.md)
- [NFR-303: OWASP Top 10 Protection](docs/requirements/system-requirements.md)
- [NFR-305: Account Lockout after Failed Attempts](docs/requirements/system-requirements.md)
- [Enterprise Architecture — Section 3.5: Authentication Architecture](docs/architecture/enterprise-architecture.md)
- [Enterprise Architecture — Section 6: Security Architecture](docs/architecture/enterprise-architecture.md)
