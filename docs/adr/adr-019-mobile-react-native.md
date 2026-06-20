# ADR-019: إطار عمل تطبيق الموبايل — React Native

## الحالة
مقبول (Accepted)

## السياق
رؤية المنتج تذكر "React Native / Flutter" بشكل غير محسوم. نحتاج إلى قرار نهائي لإطار عمل تطبيق الموبايل (iOS + Android) المخطط تسليمه في المرحلة الرابعة. المتطلبات الأساسية: مشاركة الكود مع تطبيق الويب (TypeScript, API client, auth logic)، واجهة متسقة عبر المنصات، فريق تطوير واحد للـ web و mobile.

## الخيارات المدروسة

### الخيار أ: React Native مع Expo
- إيجابيات: لغة واحدة (TypeScript) عبر web + mobile بالكامل؛ مشاركة مباشرة للـ packages: `packages/types` (types المشتركة)، `packages/auth` (منطق المصادقة)، `packages/sdk` (API client)؛ Expo يوفر tooling ممتاز (build, OTA updates, EAS)؛ مجتمع ضخم؛ React knowledge ينتقل مباشرة؛ تطوير أسرع مع فريق web موجود
- سلبيات: أداء أقل من Flutter/Swift/Kotlin في الرسوميات المعقدة والـ animations الثقيلة؛ JavaScript bridge overhead (لكن JSI/New Architecture يقلل هذا)؛ تجربة تصحيح أخطاء (debugging) قد تكون أصعب

### الخيار ب: Flutter (Dart)
- إيجابيات: أداء ممتاز — rendering engine خاص (Skia/Impeller)؛ رسوميات و animations سلسة؛ توثيق ممتاز من Google
- سلبيات: لغة منفصلة (Dart) — لا مشاركة كود مع web إطلاقاً؛ فريق منفصل مطلوب؛ إعادة كتابة كل منطق المصادقة والـ API client؛ مجتمع أصغر من React Native؛ توافق محدود مع مكتبات الويب

### الخيار ج: Native (Swift/Kotlin منفصلين)
- إيجابيات: أفضل أداء ممكن؛ وصول كامل لجميع ميزات المنصة؛ تجربة مستخدم أصلية 100%
- سلبيات: فريقان منفصلان (iOS + Android)؛ لا مشاركة كود بين المنصتين ولا مع الويب؛ تكلفة تطوير مضاعفة (2-3x)؛ وقت أطول للتسليم

## القرار
اخترنا **React Native مع Expo** للأسباب التالية:
1. لغة واحدة (TypeScript) عبر كامل المشروع: web + mobile + backend (shared types)
2. مشاركة `packages/types` مباشرة — أنواع API واحدة للـ web و mobile
3. مشاركة `packages/auth` — منطق المصادقة (JWT handling, token refresh) يستخدم في web و mobile
4. مشاركة `packages/sdk` — API client واحد يخدم web و mobile
5. Expo managed workflow: EAS Build للـ builds، EAS Submit للنشر، OTA updates للتحديثات الفورية
6. فريق React/Next.js الموجود يمكنه تطوير mobile بتكلفة تدريب منخفضة
7. React Native New Architecture (JSI, Fabric, TurboModules) يحسن الأداء مقارنة بالإصدارات القديمة

## العواقب
- إيجابيات: مشاركة كود كبيرة (types, auth, sdk) توفر 30-40% من وقت التطوير؛ فريق واحد للـ web + mobile؛ TypeScript end-to-end؛ OTA updates تسمح بتحديثات فورية دون المرور بمتاجر التطبيقات
- سلبيات: أداء أقل في الرسوميات المعقدة والـ animations (لكن تطبيق الأعمال المستهدف لا يحتوي على رسوميات ثقيلة)؛ debugging أصعب من الـ web؛ بعض المكتبات الأصلية قد تحتاج native modules مخصصة
- مخاطر: Expo managed workflow قد يقيد بعض الميزات الأصلية المتقدمة — نخففها باستخدام Expo Dev Client و EAS Build مع custom native modules عند الحاجة (expo prebuild)؛ React Native breaking changes بين الإصدارات — نخففها بتثبيت الإصدارات واستخدام Expo's automated upgrade tools
