# WhatsApp Report Templates (bilingual)

## A) Daily summary — free-form (session message, when client replied in last 24h)
```
🛡️ بزنس بارتنر · وكيل الامتثال
تقرير {company} — {date}
درجة الامتثال: {score}/100 ({band_ar})
🔴 {critical}  🟠 {high}  🟡 {medium}

الأهم اليوم:
{top3_lines_ar}

كل إجراء يُجهَّز بموافقتك — ما ننفّذ شي إلا بعد ما توافق.
تفاصيل كاملة على الإيميل ✅
```

## B) Meta-approved template `bp_compliance_alert` (outside 24h window)
Category: UTILITY. Language: `ar` (+ `en` copy). Variables in order:
1. `{{1}}` company name
2. `{{2}}` date
3. `{{3}}` critical count
4. `{{4}}` high count
5. `{{5}}` top item (short)

**Body (AR):**
```
🛡️ {{1}} — تقرير الامتثال {{2}}
لديك {{3}} بند حرج و{{4}} بند عالي الأهمية.
الأبرز: {{5}}
جهّزنا الإجراءات اللازمة — بانتظار موافقتك للتنفيذ. رد "تفاصيل" للمزيد.
```

**Body (EN):**
```
🛡️ {{1}} — Compliance report {{2}}
You have {{3}} critical and {{4}} high-priority items.
Top item: {{5}}
Actions are prepared — pending your approval to execute. Reply "details" for more.
```

**Footer:** Business Partner · لا يُنفَّذ أي إجراء حكومي دون موافقتك.
**Buttons (optional):** Quick reply "تفاصيل / Details", "موافقة / Approve".

> Notes: never include OTP/passwords. Client notification only sent when `Client Notified` is enabled and (for actions) after approval. Status written back to Compliance Reports (`WhatsApp Sent = true`).
