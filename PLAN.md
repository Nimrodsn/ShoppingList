# תוכנית ביצוע — «הסל שלנו»

אפליקציית ווב (PWA) בעברית, רשימת קניות משפחתית משותפת, מסודרת לפי קטגוריות, מסונכרנת בזמן אמת — בלי הרשמה, בלי סיסמאות, רק קישור סודי אחד.

הפרויקט מבוצע שלב-שלב לפי הטבלה בסוף המסמך, עם `git commit` בסוף כל שלב.

---

## סטיות מהמסמך המקורי

| # | מה במסמך | מה נעשה בפועל | למה |
|---|---|---|---|
| 1 | Serwist כתוסף webpack, `next dev --webpack` + `SERWIST_SUPPRESS_TURBOPACK_WARNING=1` | `@serwist/turbopack` (v9.5.x, יציב), בנייה ב-Turbopack, בלי דגל `--webpack` | המסמך עצמו מבקש לעדכן אם `@serwist/turbopack` יציב. הוא יציב: הוא לא נכנס ל-bundler אלא מקמפל את ה-Service Worker דרך Route Handler (`app/serwist/[path]/route.ts`) עם esbuild בזמן build. ה-SW מוגש מ-`/serwist/sw.js` והרישום נעשה ב-`SerwistProvider`. |
| 2 | Cookie בשם `__Host-hh` תמיד | `__Host-hh` בפרודקשן; `hh` בפיתוח מקומי | דפדפנים דוחים את התחילית `__Host-` על `http://localhost`. אותם דגלים ואותה לוגיקת HMAC + `generation` בשני המקרים — רק השם משתנה. |
| 3 | `create_household()` מוזכר בטקסט, חסר ב-SQL | נכתב כפונקציית SQL במיגרציה `0001_init.sql` | יוצרת משק בית + 17 קטגוריות + רשימות ברירת מחדל בטרנזקציה אחת. |
| 4 | — | קטגוריות ברירת המחדל ב-`0002_seed_catalog.sql` הן טבלת רפרנס גלובלית שממנה `create_household()` משכפל | `categories` מפתחה `household_id not null`, ולכן אי אפשר לשמור אותן כשורות גלובליות כמו הקטלוג. |

APIs של Supabase / Next.js 16 / Tailwind v4 מאומתים בתיעוד הרשמי לפני כתיבה. לא ממציאים.

---

## הנחות

- משק בית אחד ב-UX; הסכימה תומכת בכמה.
- אין תיקיית `src/`. המבנה הוא `app/`, `actions/`, `components/`, `lib/`, `types/` בשורש.
- שלוש רשימות ברירת מחדל למשק בית חדש: סופר, פארם, כלבו.
- 17 קטגוריות + 300+ פריטי קטלוג ישראליים.
- אין Supabase Auth, אין הרשמה, אין סיסמאות.
- Upstash חובה בפרודקשן ל-rate limit. בפיתוח, כשמשתני הסביבה חסרים — מונה בזיכרון, עם הודעה ברמת `warn` (לא `console.log`).
- `pnpm` כמנהל חבילות, Node 22.
- עבודה בענפי `feat/*`, בלי push ישיר ל-`main`.

---

## ארכיטקטורה

```
Server Component (app/page.tsx)
  └─ actions/queries.ts → supabaseAdmin (service_role) → Postgres
  └─ מעביר realtimeKey כ-prop ללקוח

Client
  ├─ IndexedDB mutation log   ← מקור האמת המקומי, מוחל מעל נתוני השרת
  ├─ useOptimistic            ← המסלול המקוון של 0ms בלבד
  └─ Server Action
        ├─ requireHousehold()  (cookie חתום + בדיקת cookie_generation)
        ├─ Zod parse
        ├─ supabaseAdmin → Postgres
        │     └─ trigger → realtime.send('hh:<realtime_key>', {op, table})
        └─ revalidatePath('/')

כל המכשירים
  └─ supabase.channel('hh:<realtimeKey>').on('broadcast', {event:'change'})
        └─ router.refresh()  (debounce 150ms)
```

כללי ברזל:

1. גישה ל-DB רק דרך Server Actions. הדפדפן משתמש ב-Supabase רק ל-`channel().on('broadcast')`.
2. הודעת broadcast מכילה `{op, table}` בלבד. אפס תוכן שורה.
3. RLS מופעל על כל טבלה בלי אף policy.
4. כל שאילתה מסננת `.eq('household_id', householdId)` — בקריאה ובכתיבה. ה-FK המורכבים הם רשת ביטחון שנייה.
5. מניעת כפילויות בקוד, לא באינדקס ייחודי (ראה 5.1 בפרומפט המקורי).

---

## שלבי העבודה

| שלב | תוצר | קריטריון קבלה |
|---|---|---|
| 0 | `PLAN.md` — המסמך הזה | אושר |
| 1 | סקאפולד: Next 16, TS strict, Tailwind v4, shadcn/ui, גופנים, RTL, dark mode, ESLint flat config, `proxy.ts`, כותרות אבטחה | `pnpm build` ו-`pnpm exec eslint .` עוברים נקי |
| 2 | Supabase: `normalize_he`, סכימה מלאה, FK מורכבים, טריגרים, RLS, `create_household()`, מיגרציית seed (17 קטגוריות + 300+ פריטי קטלוג), טיפוסים | `db push` עובר, `count(*) from catalog_items >= 300` |
| 3 | קישור סודי: Route Handler `/j/[slug]`, cookie חתום עם generation, `requireHousehold()`, מסך «מי אתה?», rate limit | דפדפן פרטי נכנס; בלי cookie → נחיתה; אחרי rotate → מכשיר ישן נזרק |
| 4 | הרשימה: קיבוץ לקטגוריות, AddBar עם השלמה, מיזוג כמויות, סימון, Bottom Sheet, מחיקה, Undo | «חלב» פעמיים → כמות 2; Undo אחרי סימון עובד |
| 5 | Realtime + Optimistic + Presence | שני דפדפנים, שינוי תוך פחות מ-2 שניות; payload בלי תוכן |
| 6 | פריטים קבועים, הצעות חכמות, מצב קנייה, סגירת קנייה, היסטוריה | סימולציית קנייה מלאה |
| 7 | גרירת קטגוריות, כמה רשימות, חיפוש, קלט קולי, שיתוף, הגדרות, «צור קישור חדש» | הסדר נשמר אחרי רענון |
| 8 | PWA ואוף-ליין: לוג מקומי, תור אידמפוטנטי, מטמון קריאה, באנר | מצב טיסה → פתיחה קרה מציגה רשימה → סימון → חזרה לרשת → הכל שם, בלי כפילויות |
| 9 | ליטוש: אנימציות, מצבים ריקים, skeletons, a11y, המרת `components/ui` ל-logical properties | לפי סעיף 2 בפרומפט |
| 10 | בדיקות: Vitest ל-`hebrew.ts` ול-`matchCatalog` כולל שקילות JS↔SQL, Playwright ל-3 זרימות | `pnpm test` ירוק |
| 11 | CI, דיפלוי, README, ROADMAP, הקישור הסודי | פותח בטלפון, מתקין למסך הבית |

---

## שאלות פתוחות

- האם קיימים כבר פרויקט Supabase, מסד Upstash ופרויקט Vercel, או שניצור אותם בשלבים 2 ו-11?
- שם הריפו ב-GitHub: `family-shopping-list`?
- דומיין מותאם אישית, או כתובת Vercel בלבד?

השאלות האלה לא חוסמות את שלבים 1–10 בפיתוח מקומי.

---

## מחוץ להיקף

מתכונים, תכנון ארוחות, מלאי מזווה, סריקת ברקוד, מעקב מחירים ותקציב, השוואת מחירים בין רשתות. מתועדים ב-`ROADMAP.md` בשלב 11.
