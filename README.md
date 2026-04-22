# Mandoobi - Delivery Platform (Next.js + Firebase + Tailwind)

This repository is a starter scaffold for the Mandoobi delivery platform described in the task.
2. Add Firebase config to `.env.local`:

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

3. Run dev server
# Mandoobi - Delivery Platform (Next.js + Firebase + Tailwind)

This repository is a starter scaffold for the Mandoobi delivery platform described in the task.

Quick setup:

1. Install dependencies

```powershell
npm install
```

2. Add Firebase config to `.env.local`:

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

3. Run dev server

```powershell
npm run dev
```

Notes:
- Add your site logo at `public/logo.png` (recommended 128x128 PNG). The NavBar will load it automatically.
- Auth uses Firebase Email/Password but maps phone to an email like `PHONE@mandoobi.local` (demo choice). Replace with proper phone auth if desired.
- Implementations are minimal and focused on core flows: login, register, create order, view order, client dashboard.
- Next steps: add courier/admin dashboards, image uploads, role-based protection, notifications, and maps.

## الميزات الجديدة
تم إضافة ميزة جديدة تسمح للعملاء بطلب من مطاعم أو صيدليات أو أي خدمات دون الحاجة لإدخال رقم هاتف، فقط الاسم والعنوان والمبلغ المطلوب.

### أنواع الطلبات المدعومة:
1. **شخص فردي**: طلب من شخص معين (يتطلب رقم هاتف)
2. **مطعم**: طلب من مطعم (لا يتطلب رقم هاتف، فقط الاسم والعنوان والمبلغ)
3. **صيدلية**: طلب من صيدلية (لا يتطلب رقم هاتف، فقط الاسم والعنوان والمبلغ)
4. **سوبر ماركت**: طلب من سوبر ماركت (لا يتطلب رقم هاتف، فقط الاسم والعنوان والمبلغ)
5. **خدمة أخرى**: طلب من أي مكان آخر (لا يتطلب رقم هاتف، فقط الاسم والعنوان والمبلغ)

### كيفية الاستخدام:
1. اختر نوع الطلب من القائمة المتاحة
2. أدخل تفاصيل الطلب
3. إذا كان الطلب من شخص فردي، أدخل رقم هاتفه
4. إذا كان الطلب من مطعم/صيدلية/خدمة، أدخل المبلغ المطلوب
5. اختر طريقة الدفع
6. أرسل الطلب

شعار الموقع (Logo)
-------------------
- لحفظ الشعار الذي أرسلتَه، ضع الملف داخل المشروع في المسار: `public/logo-source.png`.
- أضفت سكربت بسيط لإزالة الخلفية السوداء القريبة من الأسود باستخدام مكتبة `sharp`. السكربت يحول `public/logo-source.png` إلى صورة شفافة `public/logo.png`.

خطوات الاستخدام:

1) ثبّت مكتبة sharp (مرة واحدة):

```powershell
npm install sharp
```

2) ثم شغل السكربت لحذف الخلفية:

```powershell
npm run remove-bg
```

3) إذا احتجت تحكمًا أدقًا في حساسية إزالة الخلفية استخدم قيمة العتبة (threshold):

```powershell
node scripts/remove-bg.js 24
```

بعد التشغيل ستجد `public/logo.png` جاهزًا للاستخدام في الشريط العلوي والصفحات.

