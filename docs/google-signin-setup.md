# إعداد دخول جوجل في تطبيق الجوال

أُنشئ 2026-10-16. الحالة اليوم: زر «المتابعة عبر جوجل» ظاهر في التطبيق ويُهيَّأ المكوّن الأصلي تلقائياً، لكنه يقول «غير مفعّل بعد» إلى أن يوضع معرّف الويب في الخادم ومعرّف iOS في التطبيق (`GOOGLE_IOS_CLIENT_ID` في `app-bridge.js`).
الخادم جاهز (`api/otp.js` ← `action: google`)، والناقص ثلاثة أشياء: معرّفات OAuth، ومتغيّر في Vercel، ومكوّن أصلي في التطبيق.

> **لماذا مكوّن أصلي؟** جوجل **يمنع** تسجيل الدخول داخل WebView. فلا يُفتح الدخول من صفحة الموقع؛ يلزم نافذة
> جوجل الأصلية في iOS وAndroid، وتُرجع رمز هوية (ID token) يرسله التطبيق إلى `/api/otp`.

## أ) Google Cloud (مجاني) — يفعله المالك
1. ادخل <https://console.cloud.google.com> ← أنشئ مشروعاً باسم `Business Partner App`.
2. **Google Auth Platform ← Branding / OAuth consent screen:** اسم التطبيق `Business Partner`، بريد الدعم،
   الشعار، النطاق المصرّح `businesspartner.sa`، **رابط سياسة الخصوصية ورابط الشروط**
   (⚠️ صفحة الخصوصية غير موجودة بعد — انظر `docs/mobile-app.md`)، النوع **External**.
3. **Scopes:** `openid` و`email` و`profile` فقط (لا تحتاج مراجعة من جوجل). وانقل حالة التطبيق إلى **In production**
   قبل الإطلاق، وإلا لا يدخل إلا «Test users» الذين تضيفهم يدوياً.
4. **Credentials ← Create credentials ← OAuth client ID** ثلاث مرات:

| النوع | ما تكتبه | ما تأخذه |
|---|---|---|
| **Web application** | الاسم `BP Server`، ولا تحتاج Redirect URIs | **Client ID** ← هو `GOOGLE_CLIENT_ID` في الخادم |
| **iOS** | Bundle ID = `sa.businesspartner.app` | **Client ID (iOS)** |
| **Android** | Package name = `sa.businesspartner.app` + **SHA-1** لمفتاح التوقيع | يكفي إنشاؤه، لا تنسخ منه شيئاً |

5. **لا تحتاج Client Secret** في أي مكان. معرّفات العميل ليست أسراراً، فيمكن إرسالها في المحادثة.

## ب) بصمة SHA-1 لـAndroid
- **مفتاح الإصدار** (تنشئه أنت وتحفظه خارج git — ضياعه يمنع تحديث التطبيق):
  `keytool -genkeypair -v -keystore bp-release.jks -alias bp -keyalg RSA -keysize 2048 -validity 10000`
  ثم `keytool -list -v -keystore bp-release.jks -alias bp` وانسخ سطر **SHA1**.
- للتجربة على جهازك: بصمة مفتاح التصحيح `~/.android/debug.keystore` (كلمة مرورها `android`).
- بعد رفع التطبيق إلى Google Play: أضف أيضاً بصمة **Play App Signing** (Play Console ← App integrity)،
  وإلا يفشل الدخول في النسخة المنزّلة من المتجر.
- يلزم عميل Android واحد لكل بصمة.

## ج) الخادم (Vercel) — قرار نشر يخصك
- أضف متغيّر البيئة `GOOGLE_CLIENT_ID` = **Web Client ID** في المشروع الرئيسي (Production).
  الخادم يقبل رمزاً واحداً فقط: `payload.aud === GOOGLE_CLIENT_ID` (`api/_suppliers.js:202`)،
  لذلك يجب أن يكون الـWeb Client ID نفسه هو **audience** الرموز القادمة من iOS وAndroid
  (المكوّن يضبط ذلك بتمريره `iOSServerClientId` = معرّف الويب).
- بعدها يُنشر الموقع بالعلامة المتفق عليها. وعندئذ يعيد `action: methods` القيمة `google: true`.

## د) التطبيق — أنفّذه أنا حين تُرسل المعرّفين
أرسل لي في المحادثة: **Web Client ID** و**iOS Client ID**. أنا:
1. أضيف `@capgo/capacitor-social-login` (v8.5.x، متوافق مع Capacitor 8).
2. (أُنجز الكود؛ يبقى وضع المعرّفين) أستدعي `SocialLogin.initialize({ google: { webClientId, iOSClientId, iOSServerClientId: webClientId, mode: "online" } })`
   من `app-bridge.js` قبل أول ضغطة على الزر.
3. أضيف إلى `Info.plist` مخطط الرابط المعكوس (`com.googleusercontent.apps.<iOS-ID>`).
4. أجرّب على جهاز Android حقيقي (لا أستطيع على iOS من هنا — يحتاج Mac).

## هـ) Sign in with Apple — **بُني** (قرارك: جوجل + Apple على iOS، وجوجل فقط على Android)
آبل تشترط (إرشاد 4.8) أن يقدّم أي تطبيق iOS بجوجل خياراً مقابلاً هو Sign in with Apple. نُفِّذ كاملاً:
- **الخادم:** `action: "apple"` في `api/otp.js` والتحقق في `verifyAppleIdToken` (`api/_suppliers.js`): توقيع RS256 من مفاتيح آبل،
  والمُصدِر، والجمهور، والانتهاء، ووجود بريد. 11 اختباراً بلا شبكة في `tests/apple-signin.test.mjs`.
  بلا دالة Vercel جديدة (الحارس 10/12).
- **التطبيق:** زر «المتابعة عبر Apple» **على iOS فقط**؛ Android يعرض جوجل فقط (`platform === "ios"` في `app-bridge.js`).
- **المشروع الأصلي:** المكوّن `@capgo/capacitor-social-login` مُضاف للمنصتين، وملف الصلاحية `ios/App/App/App.entitlements`
  (`com.apple.developer.applesignin`) مربوط بإعدادات البناء. بُني APK بعد الإضافة بنجاح.

**ما يلزمك لتفعيل Apple (يحتاج الحساب المدفوع):**
1. حساب آبل المطوّر (99$/سنة).
2. App ID لـ `sa.businesspartner.app` مع تفعيل **Sign in with Apple**.
3. متغيّر Vercel: `APPLE_CLIENT_ID=sa.businesspartner.app` (معرّف الحزمة، وهو الجمهور في رمز آبل).
4. في Xcode: Signing & Capabilities ← تأكد من ظهور **Sign in with Apple** (الملف مضاف مسبقاً).
بدون الخطوة 3 يرفض الخادم رمز آبل (`bad_token`).

> **ملاحظة:** Apple يرسل الاسم **مرة واحدة** فقط عند أول تفويض؛ التطبيق يمرّره للخادم في الطلب نفسه.
> وقد يرسل بريداً مستعاراً (`…@privaterelay.appleid.com`)، يُقبل كبريد موثّق عادي.

## و) أخطاء شائعة
- **`USER_CANCELLED` أو فشل صامت على Android:** غالباً الحزمة أو SHA-1 أو `webClientId` لا تطابق ما في الكونسول.
  و`webClientId` يجب أن يكون معرّف **Web** لا معرّف Android.
- **مستخدم حقيقي مرفوض:** التطبيق ما زال بحالة Testing ولم تُضف حسابه كـTest user.
- **`bad_token` من الخادم:** `GOOGLE_CLIENT_ID` في Vercel ليس معرّف الويب نفسه.
