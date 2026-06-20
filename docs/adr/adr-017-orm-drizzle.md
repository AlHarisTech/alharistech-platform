# ADR-017: اختيار ORM — Drizzle ORM

## الحالة
مقبول (Accepted)

## السياق
توثيق المشروع الحالي يذكر كلاً من "Prisma/Drizzle" بشكل غير محسوم في عدة مواضع. نحتاج إلى قرار نهائي بشأن ORM المستخدم للوصول إلى PostgreSQL قبل بدء التنفيذ الفعلي. المتطلبات تشمل: TypeScript type safety، دعم ميزات PostgreSQL المتقدمة (JSONB, full-text search, pgvector)، سهولة ترحيل المطورين من SQL الخام.

## الخيارات المدروسة

### الخيار أ: Drizzle ORM
- إيجابيات: SQL-like DX سهل لمطوري SQL؛ لا code generation step (لا حاجة لـ drizzle-kit generate قبل كل تغيير نموذج)؛ TypeScript type inference قوي جداً؛ خفيف الوزن في runtime؛ دعم ممتاز لميزات PostgreSQL (JSONB operators, full-text search vectors, pgvector, geometric types)؛ schema migrations عبر drizzle-kit migrate؛ يعمل مع أي Postgres driver (pg, postgres.js, neon)
- سلبيات: مجتمع أصغر من Prisma؛ لا أداة GUI مثل Prisma Studio؛ توثيق أقل؛ بعض الميزات لا تزال في early stage

### الخيار ب: Prisma
- إيجابيات: مجتمع كبير وناضج؛ Prisma Studio GUI للتصفح والتعديل؛ توثيق ممتاز؛ code generation ينتج أنواع TypeScript دقيقة؛ migration system ناضج
- سلبيات: code generation step إضافي في سير العمل؛ runtime أثقل (Prisma Client binary engine)؛ migration lock-in (صعوبة الخروج)؛ نموذج بيانات خاص (schema.prisma) يختلف عن SQL؛ دعم أقل لـ PostgreSQL-specific features؛ Rust engine يضيف تعقيداً في debugging

### الخيار ج: TypeORM
- إيجابيات: ناضج ومستقر؛ ديكوراتورز (decorators) يتناسب مع أسلوب NestJS؛ Active Record و Data Mapper patterns
- سلبيات: صيانة بطيئة (المشروع شبه متوقف)؛ TypeScript types ضعيفة؛ أداء أقل في الاستعلامات المعقدة؛ migration system أقل تطوراً؛ دعم محدود لميزات PostgreSQL المتقدمة

## القرار
اخترنا **Drizzle ORM** للأسباب التالية:
1. SQL-like Developer Experience: المطورون القادمون من SQL يجدون الانتقال سهلاً (`db.select().from(users).where(eq(users.id, 1))`)
2. لا خطوة code generation: إضافة نموذج = إضافة جدول TypeScript مباشرة، لا حاجة لتشغيل `generate`
3. TypeScript type inference أقوى: الأنواع تستنتج تلقائياً من الـ schema دون ملفات مولدة
4. وزن خفيف في runtime: لا engine binary، فقط SQL queries
5. دعم PostgreSQL المتقدم: JSONB operators, full-text search (tsvector/tsquery), pgvector, window functions
6. حزمة `packages/database` واحدة تحتوي schemas + client + migrations
7. تكامل سهل مع NestJS عبر custom provider (لا حاجة لـ `@nestjs/typeorm`)

## العواقب
- إيجابيات: DX قريب من SQL الخام؛ Types استنتاجية دقيقة؛ خفيف وسريع؛ دعم PostgreSQL حقيقي؛ لا code generation overhead
- سلبيات: مجتمع أصغر (لكنه ينمو بسرعة — 22K+ GitHub stars)؛ لا Prisma Studio (نستخدم pgAdmin أو DBeaver أو TablePlus كبديل)؛ بعض الميزات المتقدمة (مثل relation joins) لا تزال في مرحلة التحسين
- مخاطر: استقرار المشروع طويل الأمد (مشروع مفتوح المصدر صغير نسبياً) — نخففها بالاعتماد على SQL standard والاحتفاظ بملفات migration خام يمكن تشغيلها بأي أداة؛ تغيير API مع upgrades رئيسية — نخففها بتثبيت الإصدار في package.json واستخدام Renovate للمراقبة
