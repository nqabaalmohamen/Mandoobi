# Mandoobi - Delivery Platform

تم تحديث المشروع ليعمل بشكل احترافي وكامل على الإنترنت.

### التحديثات الأخيرة:
1. **قاعدة بيانات حقيقية:** تم استبدال الملف المحلي `local_db.json` بـ **Firebase Firestore**، مما يعني أن بياناتك أصبحت محفوظة بشكل دائم وآمن.
2. **الرفع التلقائي:** تم إعداد GitHub Actions ليقوم ببناء ورفع الموقع تلقائياً على GitHub Pages.
3. **التوافق التام:** الموقع الآن يعمل كـ Serverless App، مما يعني أنه لا يحتاج لبيئة Node.js معقدة لتشغيل الـ API.

### إعداد Firebase:
تأكد من إضافة بيانات مشروعك في ملف `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### التشغيل المحلي:
```bash
npm install
npm run dev
```

### النشر:
بمجرد عمل `git push` للمستودع، سيقوم GitHub ببناء الموقع ونشره تلقائياً خلال دقائق.
تأكد من تفعيل "GitHub Actions" في إعدادات المستودع وتعيين الصلاحيات لـ "Read and write permissions".
