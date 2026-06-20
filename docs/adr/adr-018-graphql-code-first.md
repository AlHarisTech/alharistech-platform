# ADR-018: استراتيجية تنفيذ GraphQL

## الحالة
مقبول (Accepted)

## السياق
ADR-008 قبل GraphQL كتقنية مكملة لـ REST. نحتاج الآن إلى قرار تنفيذي: كيفية بناء GraphQL schema، وأي أدوات NestJS نستخدم، ومتى ننتقل إلى Federation. المرحلة الأولى تتطلب GraphQL بسيط (single endpoint) مع تخطيط للتوسع المستقبلي.

## الخيارات المدروسة

### الخيار أ: @nestjs/graphql Code-First
- إيجابيات: TypeScript classes تعرف الـ schema مباشرة — لا حاجة لكتابة SDL يدوياً؛ auto-generate SDL من الكود؛ single source of truth (الـ TypeScript models)؛ تكامل كامل مع NestJS DI و decorators؛ دعم subscriptions عبر WebSocket جاهز؛ تحقق تلقائي من types (TypeScript validation = GraphQL validation)
- سلبيات: ربط الـ schema بـ NestJS decorators قد يجعل الانتقال إلى non-NestJS GraphQL server صعباً؛ code-first قد لا يناسب فرق تفضل SDL-first

### الخيار ب: Schema-First (كتابة SDL يدوياً)
- إيجابيات: SDL هو المصدر الوحيد للحقيقة؛ يمكن مشاركته مع فرق لا تستخدم TypeScript؛ GraphQL schema محمول بين التقنيات
- سلبيات: جهد مزدوج (كتابة SDL + كتابة TypeScript resolvers)؛ خطر عدم تطابق types الـ SDL مع TypeScript؛ صيانة ملفات .graphql إضافية؛ لا استفادة كاملة من TypeScript type checking

### الخيار ج: Apollo Federation من البداية
- إيجابيات: هيكلة microservices قوية من اليوم الأول؛ كل domain يمتلك subgraph خاص به
- سلبيات: تعقيد زائد للمرحلة الأولى (monolith/modular monolith)؛ يحتاج Apollo Router/Gateway إضافي؛ overhead في التشغيل والصيانة؛ لا مبرر له قبل المرحلة الخامسة (multi-service)

## القرار
اخترنا **@nestjs/graphql Code-First** للأسباب التالية:
1. استخدام @nestjs/graphql code-first approach: TypeScript classes + decorators تعرف الـ GraphQL schema
2. توليد SDL تلقائياً للتوثيق والمراجعة
3. GraphQL endpoint واحد (`/graphql`) للمراحل 1-4
4. GraphQL Playground في development mode على `/graphql`
5. تأجيل Apollo Federation إلى المرحلة الخامسة (multi-service architecture) — عندها سنقسم الـ schema إلى subgraphs حسب bounded contexts
6. استخدام DataLoader pattern لتفادي N+1 queries
7. التعامل مع GraphQL كطبقة إضافية فوق REST (كلا الـ endpoints موجودان) — GraphQL للاستعلامات المرنة، REST للعمليات البسيطة

## العواقب
- إيجابيات: تطوير سريع — الكود هو الـ schema؛ Type safety مضمونة بين الـ resolvers والـ schema؛ single endpoint بسيط للإدارة؛ قابل للتوسع إلى Federation لاحقاً
- سلبيات: Code-first يربط الـ schema بـ NestJS (مخاطرة محسوبة)؛ إعادة الهيكلة إلى Federation في المرحلة الخامسة تتطلب جهداً (لكنها مخططة ومؤجلة بقرار واعٍ)
- مخاطر: تعقيد إضافي لوجود REST + GraphQL معاً — نخففها بتحديد واضح: REST للـ CRUD والإجراءات، GraphQL للوحات المعلومات والصفحات المعقدة؛ مشاكل N+1 queries — نخففها باستخدام DataLoader (من حزمة dataloader) في كل resolver
