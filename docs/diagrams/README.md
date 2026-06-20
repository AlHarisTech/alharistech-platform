# الرسوم البيانية — منصة الحارس تك

هذا المجلد مخصص للرسوم البيانية والتصورية للمنصة.

## أنواع الرسوم المطلوبة

1. **System Context Diagram** — نظرة عامة على النظام والمستخدمين والأنظمة الخارجية
2. **Container Diagram** — الحاويات الرئيسية (Web, API, Database, Cache, Storage)
3. **Component Diagram** — المكونات داخل كل حاوية
4. **Deployment Diagram** — كيفية نشر النظام على البنية التحتية
5. **Data Flow Diagram** — تدفق البيانات بين المكونات
6. **Sequence Diagrams** — تسلسل العمليات للسيناريوهات الرئيسية
7. **ERD (Entity Relationship Diagram)** — مخطط قواعد البيانات
8. **State Diagrams** — حالات الكائنات (طلب، تذكرة، فاتورة)

## أدوات الرسم المقترحة

- **PlantUML** — للرسوم البرمجية (موصى به)
- **Mermaid** — للرسوم داخل Markdown
- **Draw.io** — للرسوم التفاعلية
- **D2** — لغة وصف رسومية حديثة

## ملفات الرسوم

| الملف | الوصف | الأداة |
|:---|:---|:---|
| `context.puml` | C4 Level 1 — Context | PlantUML |
| `containers.puml` | C4 Level 2 — Containers | PlantUML |
| `components.puml` | C4 Level 3 — Components | PlantUML |
| `deployment.puml` | Deployment Diagram | PlantUML |
| `erd.puml` | Entity Relationship Diagram | PlantUML |
| `auth-flow.puml` | Authentication Sequence | PlantUML |
| `order-flow.puml` | Order Processing Sequence | PlantUML |
| `ticket-flow.puml` | Support Ticket Sequence | PlantUML |

## مثال: Context Diagram (PlantUML)

```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

Person(customer, "العميل", "يستخدم المنصة للحصول على الخدمات")
Person(employee, "الموظف", "يدير الخدمات والطلبات")
Person(admin, "المدير", "يشرف على العمليات")
Person(partner, "الشريك", "يتكامل مع المنصة")

System(aht, "منصة الحارس تك", "منصة رقمية متكاملة")

System_Ext(payment, "بوابة الدفع", "معالجة المدفوعات")
System_Ext(email, "البريد الإلكتروني", "إرسال الإشعارات")
System_Ext(sms, "SMS", "إرسال الرسائل النصية")
System_Ext(ai, "AI Providers", "خدمات الذكاء الاصطناعي")

Rel(customer, aht, "تصفح وتقديم طلبات")
Rel(employee, aht, "إدارة الخدمات والعملاء")
Rel(admin, aht, "إدارة المنصة والتقارير")
Rel(partner, aht, "API Integration")

Rel(aht, payment, "معالجة المدفوعات")
Rel(aht, email, "إرسال إشعارات")
Rel(aht, sms, "إرسال رسائل")
Rel(aht, ai, "استدعاء AI")

@enduml
```
