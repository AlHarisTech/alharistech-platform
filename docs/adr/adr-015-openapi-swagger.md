# ADR-015: استخدام OpenAPI/Swagger لتوثيق API

## الحالة
مقبول (Accepted)

## السياق
نحتاج إلى توثيق API يتجدد تلقائياً مع تغيرات الكود ولا يصبح قديماً (stale). التوثيق يجب أن يكون تفاعلياً (interactive) وقابلاً للاستخدام من قبل مطوري الواجهات الأمامية والأجهزة المحمولة وشركاء خارجيين.

## الخيارات المدروسة

### الخيار أ: OpenAPI مع NestJS Swagger (توليد تلقائي)
- إيجابيات: التوثيق يتولد تلقائياً من @nestjs/swagger decorators؛ دائماً متزامن مع الكود؛ Swagger UI تفاعلي للتجربة المباشرة؛ ReDoc للعرض النظيف؛ OpenAPI 3.1 spec متوافق مع أدوات كثيرة
- سلبيات: الـ decorators تضيف verbosity للـ controllers؛ تخصيص مظهر Swagger UI محدود

### الخيار ب: كتابة Swagger يدوياً (YAML/JSON منفصل)
- إيجابيات: تحكم كامل في المحتوى والمظهر؛ فصل كامل بين التوثيق والكود
- سلبيات: انجراف حتمي بين التوثيق والتنفيذ؛ جهد مضاعف لصيانة ملفات YAML منفصلة؛ لا تزامن تلقائي

### الخيار ج: Readme.io (منصة خارجية)
- إيجابيات: واجهة جميلة واحترافية؛ دعم إصدارات متعددة؛ إدارة مستخدمين وصلاحيات
- سلبيات: تكلفة إضافية؛ ليس auto-generated بالكامل؛ خطوة نشر إضافية؛ قد لا يكون متاحاً في بيئات air-gapped

## القرار
اخترنا **OpenAPI مع NestJS Swagger (توليد تلقائي)** للأسباب التالية:
1. استخدام @nestjs/swagger decorators على الـ controllers و DTOs لتوليد OpenAPI 3.1 spec تلقائياً
2. عرض Swagger UI على `/api/docs` للتجربة التفاعلية (try-out)
3. عرض ReDoc على `/api/docs/redoc` للعرض المرجعي النظيف
4. تصدير ملف openapi.json من `/api/docs-json` للاستخدام في أدوات خارجية
5. إضافة وصف API عام (title, description, version) في main.ts باستخدام SwaggerModule.setup

## العواقب
- إيجابيات: توثيق حي لا يصبح قديماً أبداً؛ Swagger UI تفاعلي يسهل الاختبار اليدوي؛ ReDoc يوفر مرجعاً نظيفاً؛ OpenAPI spec قابل للتصدير للـ SDK generation
- سلبيات: الـ decorators تضيف أسطراً إضافية للـ controllers (مثل @ApiTags, @ApiOperation, @ApiResponse)؛ تخصيص محدود للمظهر
- مخاطر: الاعتماد على حزمة @nestjs/swagger وصيانتها المستمرة — نخففها بأنها حزمة رسمية من NestJS core team ومدعومة تجارياً
