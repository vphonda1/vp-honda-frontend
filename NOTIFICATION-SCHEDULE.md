# VP Honda — Notification का समय

> ⚠️ यह जानकारी पहले `vercel.json` के अंदर comment में थी — पर Vercel अपनी
> schema में कोई अनजान property नहीं मानता और JSON में comment होते ही नहीं.
> इसलिए वह जानकारी यहाँ रखी गई है. **`vercel.json` में कभी comment मत जोड़ें,
> build fail हो जाएगा।**

## घंटे-वार schedule

Vercel UTC समय पर चलता है. **IST = UTC + 5:30**

| IST | UTC (cron में यही लिखा है) | किसका reminder |
|-----|---------------------------|----------------|
| 10:00 | `30 4 * * *` | 🔧 Service |
| 11:00 | `30 5 * * *` | 💳 Payment |
| 12:00 | `30 6 * * *` | 🛡️ Insurance |
| 14:00 | `30 8 * * *` | 💳 Payment |
| 15:00 | `30 9 * * *` | 🔧 Service |
| 16:00 | `30 10 * * *` | 🛡️ Insurance |
| 17:00 | `30 11 * * *` | 🚗 RTO |

## समय बदलना हो तो

`vercel.json` में सिर्फ़ `schedule` का UTC समय बदलें. हिसाब:

```
UTC = IST − 5:30

जैसे  IST 13:00  →  UTC 07:30  →  "30 7 * * *"
      IST 18:00  →  UTC 12:30  →  "30 12 * * *"
      IST 09:00  →  UTC 03:30  →  "30 3 * * *"
```

cron का रूप: `मिनट घंटा * * *`

## `type` के मान

| type | क्या भेजता है |
|------|--------------|
| `payment` | बकाया payment |
| `service` | 1st से 7th तक की सर्विस |
| `insurance` | Insurance renewal (RTO नहीं) |
| `rto` | सिर्फ़ RTO बाक़ी |
| `followup` | Lead की अगली call |
| `all` | सब कुछ एक साथ |

`slot=1..7` का कोई काम नहीं है — बस हर cron की path अलग रखने के लिए है
(Vercel दो एक जैसी path स्वीकार नहीं करता).

## notification की सीढ़ी

हर reminder पर इन पड़ावों पर एक-एक notification जाती है:

```
due से 7 दिन पहले → 3 दिन → 1 दिन → due के दिन → overdue
```

हर पड़ाव की notification **सिर्फ़ एक बार** जाती है.

बदलना हो तो दो जगह — **दोनों एक जैसी रखें**:
- `api/send-reminders.js` → `NOTIFY_LADDER`
- `src/utils/reminderEngine.js` → `NOTIFY_LADDER`

## ⚠️ ध्यान देने वाली बातें

1. **`vercel.json` में comment न डालें** — `_comment` जैसी कोई भी key
   डालते ही build fail: *"should NOT have additional property"*

2. **cron की गिनती** — अभी 7 हैं. Vercel के plan पर सीमा हो सकती है;
   सीमा पार होते ही पूरा deployment fail होगा और सारी notification बंद.

3. **Preview deployment** — Vercel हर push पर एक preview URL भी बनाता है
   (`vp-honda-frontend-xxxxx-vphonda.vercel.app`). अगर आपने उस पर कभी
   notification allow की है तो दोहरी notification आएँगी. Chrome →
   Settings → Site settings → Notifications → उस URL को **Block** करें.

4. **"कुछ नहीं है" वाली notification नहीं जाती** — अगर किसी slot पर कोई
   reminder due न हो तो चुपचाप कुछ नहीं भेजा जाता.

## जाँचने के तरीक़े

| URL | क्या बताता है |
|-----|--------------|
| `/api/send-reminders?type=payment&debug=1` | कितने device, कितने reminder — कुछ भेजता नहीं |
| `/api/send-reminders?type=payment&force=1` | आज का log ignore करके अभी भेजो (test) |
| `https://vp-honda-backend.onrender.com/api/push/health` | कितने phone registered, किस user के |

Vercel dashboard → Project → **Settings → Cron Jobs** — यहाँ देखें कि सातों
जॉब registered और Enabled हैं या नहीं.
