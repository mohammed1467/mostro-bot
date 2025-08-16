# Project Structure - Mostro Bot

هذا المستند يوضح هيكل ملفات ومجلدات بوت ديسكورد الاحترافي (مثل برو بوت).

---

## 📁 الجذر (Root)

- **index.js**  
  الملف الرئيسي لتشغيل البوت، يحتوي على تسجيل الدخول، Web Server لتشغيل 24/7، وأوامر السلاش والأوامر النصية.

- **.env**  
  لتخزين التوكن، CLIENT_ID، PREFIX، وغيرها من المتغيرات السرية.

- **package.json**  
  يحتوي على معلومات المشروع والاعتمادات (dependencies) مثل discord.js وexpress.

- **package-lock.json**  
  إدارة النسخ الدقيقة للحزم.

- **.gitignore**  
  لتجاهل ملفات معينة عند رفع المشروع على GitHub (مثل node_modules و.env).

---

## 📁 مجلد commands

يحتوي على جميع أوامر البوت النصية والسلاش.

- **moderation/**  
  - ban.js  
  - kick.js  
  - timeout.js  
  - untimeout.js  
  - unban.js  
  - role.js  

- **fun/**  
  - say.js  
  - joke.js  
  - meme.js  

- **utility/**  
  - help.js  
  - info.js  
  - ping.js  

---

## 📁 مجلد events

يحتوي على أحداث البوت:

- ready.js → تشغيل عند جاهزية البوت
- messageCreate.js → التعامل مع الرسائل النصية
- interactionCreate.js → التعامل مع أوامر السلاش
- guildMemberAdd.js → الترحيب بالاعضاء الجدد
- guildMemberRemove.js → رسائل عند خروج الأعضاء

---

## 📁 مجلد utils

ملفات مساعدة ووظائف عامة:

- parseDuration.js → تحويل الوقت من نص إلى ميلي ثانية
- permissions.js → فحص صلاحيات المستخدم والرتب
- logger.js → تسجيل الأخطاء والعمليات في ملف لوج

---

## 📁 مجلد dashboard (اختياري)

إذا أردت لوحة تحكم (Dashboard) للبوت:

- index.js → تشغيل سيرفر الويب للوحة
- routes/ → ملفات تعريف الروابط (routes) للوحة
- views/ → صفحات HTML / EJS للعرض
- public/ → ملفات CSS و JS الخاصة بالواجهة

---

## 📁 مجلد data

لتخزين بيانات البوت بشكل محلي:

- guildSettings.json → إعدادات كل سيرفر (قنوات، رتب، أوضاع)
- suggestions.json → تخزين الاقتراحات
- logs.json → سجل الأحداث المهمة

---

## ⚙️ ملاحظات

- يُفضل استخدام **.env** لكل المتغيرات السرية وعدم رفعها على GitHub.
- قسم `commands` مفصل حسب نوع الأوامر لتسهيل الصيانة.
- `events` يحتوي على كل أحداث البوت لتجنب ازدواجية الرسائل أو الأخطاء.
- `utils` لتجميع الدوال المشتركة لتقليل التكرار.
- `dashboard` اختياري ويمكن توصيله مع OAuth2 لتسجيل الدخول وعرض البيانات.

---

## 📌 مثال تشغيل البوت

```bash
npm install
node index.js
