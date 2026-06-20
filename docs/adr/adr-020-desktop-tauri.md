# ADR-020: إطار عمل تطبيق سطح المكتب — Tauri

## الحالة
مقبول (Accepted)

## السياق
رؤية المنتج تذكر "Electron / Tauri" بشكل غير محسوم. نحتاج إلى قرار نهائي لإطار عمل تطبيق سطح المكتب (Windows, macOS, Linux) المخطط تسليمه في المرحلة الرابعة. المتطلبات الأساسية: مشاركة واجهة الويب الأمامية (Next.js components)، حجم توزيعة صغير، أداء جيد، أمان عالي.

## الخيارات المدروسة

### الخيار أ: Tauri v2
- إيجابيات: حجم binary صغير جداً (<5MB مقارنة بـ 150MB+ لـ Electron)؛ أداء أفضل — يستخدم WebView النظام بدلاً من Chromium كامل؛ أمان أعلى — لا full Chromium runtime، سطح هجوم أصغر؛ Rust backend للعمليات الحساسة وعالية الأداء؛ يشارك واجهة Next.js مباشرة عبر @tauri-apps/api؛ CSP (Content Security Policy) مدمج؛ تحديثات تلقائية مدمجة (Tauri updater)
- سلبيات: Rust learning curve للـ native modules المخصصة؛ WebView النظام يختلف بين المنصات (WebKit2 على macOS/Linux، WebView2 على Windows) مما قد يسبب اختلافات طفيفة؛ macOS code signing معقد ومكلف (يتطلب Apple Developer Account + notarization)؛ لا Node.js في الـ runtime — بعض مكتبات npm التي تعتمد على Node APIs لن تعمل

### الخيار ب: Electron
- إيجابيات: Chromium كامل — توافق 100% بين المنصات؛ Node.js runtime مدمج — يمكن استخدام أي مكتبة npm مباشرة؛ مجتمع ضخم وأدوات كثيرة (electron-builder, electron-forge)؛ توثيق ممتاز
- سلبيات: حجم binary كبير (150MB+) بسبب Chromium المضمن؛ استهلاك RAM عالي (~200MB+ لكل نافذة)؛ سطح هجوم كبير (full Chromium + Node.js)؛ أداء أقل من التطبيقات الأصلية؛ تحديثات Chromium الأمنية تتطلب إعادة بناء التطبيق

### الخيار ج: Neutralinojs
- إيجابيات: حجم أصغر (~2MB binary)؛ أسرع من Electron و Tauri في بعض السيناريوهات
- سلبيات: مجتمع صغير جداً ومشروع غير ناضج؛ واجهة Native API محدودة؛ لا دعم رسمي لـ Next.js؛ توثيق ضعيف؛ غير مناسب لمشروع إنتاجي

## القرار
اخترنا **Tauri v2** للأسباب التالية:
1. حجم توزيعة صغير: <5MB بدلاً من 150MB+ (مهم للمستخدمين في مناطق باتصال إنترنت محدود)
2. أداء أفضل: WebView النظام أخف من Chromium كامل، Rust backend عالي الأداء
3. أمان أعلى: سطح هجوم أصغر، CSP مدمج، صلاحيات محددة لكل نافذة
4. مشاركة الواجهة الأمامية: Next.js components تعمل مباشرة عبر @tauri-apps/api لاستدعاء Rust commands
5. تحديثات تلقائية: Tauri updater مدمج يدعم التحديثات التزايدية (delta updates)
6. تكامل مع monorepo: تطبيق `apps/desktop` في الـ monorepo يستخدم `packages/ui` و `packages/sdk`
7. Tauri v2 مستقر (خرج من alpha/beta) مع دعم mobile أيضاً في المستقبل

## العواقب
- إيجابيات: حجم binary صغير يسهل التوزيع؛ أداء وذاكرة أفضل للمستخدمين؛ أمان أعلى؛ مشاركة مباشرة لواجهة Next.js؛ Rust يمكّن عمليات أصلية عالية الأداء (مثل معالجة الملفات الكبيرة)
- سلبيات: منحنى تعلم Rust للمطورين (للكتابة الـ native modules فقط — معظم العمل JavaScript/TypeScript)؛ WebView اختلافات بين المنصات تحتاج test matrix أوسع؛ macOS code signing عملية معقدة ومكلفة
- مخاطر: WebView system inconsistencies بين المنصات (خصوصاً CSS rendering) — نخففها بـ cross-platform testing مكثف واستخدام `tauri-plugin-webview` لضبط السلوك؛ تعقيد macOS code signing — نخففها بالتخطيط المبكر للحصول على Apple Developer Account وإعداد CI/CD للتوقيع والـ notarization التلقائي؛ Rust compilation time طويل — نخففها باستخدام sccache في CI/CD والاعتماد على الـ Rust crates الموجودة بدلاً من كتابة native modules مخصصة
