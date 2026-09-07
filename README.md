# הסל שלנו 🧺

רשימת קניות משפחתית משותפת. עברית, RTL, מובייל-פירסט, PWA.
בלי הרשמה, בלי סיסמאות, בלי אימייל — **קישור סודי אחד** שמשותף למשפחה.

- מוסיפים פריט וכולם רואים אותו תוך פחות משנייה.
- הרשימה מסודרת לפי מדפי הסופר, בסדר שאתם קובעים.
- «חלב» פעמיים לא יוצר שתי שורות — הכמות מתעדכנת ל-2.
- עובד באוף-ליין: מה שסימנתם בין המקררים נשלח לבד כשהחיבור חוזר.

---

## סטאק

| שכבה | בחירה |
|---|---|
| Framework | Next.js 16, App Router, React 19, TypeScript strict |
| עיצוב | Tailwind v4 (CSS-first), shadcn/ui, Motion, Vaul, Sonner |
| נתונים | Supabase Postgres + Realtime (broadcast בלבד) |
| זהות | cookie חתום ב-HMAC, בלי Supabase Auth |
| אוף-ליין | Serwist (`@serwist/turbopack`) + לוג mutations ב-IndexedDB |
| Rate limit | Upstash Redis, עם מונה בזיכרון בפיתוח |
| בדיקות | Vitest, Playwright |

---

## הרצה מקומית

```bash
pnpm install
cp .env.example .env.local   # ואז למלא את המפתחות
pnpm dev
```

### משתני סביבה

| מפתח | צד | למה |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | לקוח | מנוי Realtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | לקוח | מנוי Realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | **שרת** | כל גישה לנתונים, עוקפת RLS |
| `APP_SECRET` | **שרת** | חתימת ה-cookie (`openssl rand -base64 32`) |
| `UPSTASH_REDIS_REST_URL` | **שרת** | rate limit |
| `UPSTASH_REDIS_REST_TOKEN` | **שרת** | rate limit |
| `APP_URL` | סקריפט | בסיס הקישור שמודפס ב-`pnpm create-household` |
| `SUPABASE_DB_URL` | סקריפט | `pnpm seed` ובדיקת השקילות JS↔SQL |
| `E2E_JOIN_PATH` | בדיקות | קישור הצטרפות של משק בית לבדיקות |

המפתחות בעמודת «שרת» לא מקבלים תחילית `NEXT_PUBLIC_` בשום מצב.

### מסד הנתונים

```bash
supabase link --project-ref <ref>
supabase db push          # מריץ את supabase/migrations בסדר
pnpm gen:types            # types/database.ts — לא לערוך ביד
```

בלי ה-CLI (הבינארי שלו הוא הורדה של 59MB שלא תמיד עוברת), `pnpm db:push` עושה את
אותה עבודה מול `SUPABASE_DB_URL`: מריץ כל מיגרציה שלא הוחלה, בטרנזקציה, ורושם
אותה ב-`supabase_migrations.schema_migrations` — אותה טבלה שה-CLI קורא, כך שאין
דריפט בין שתי הדרכים.

`supabase db push` **לא** מריץ `seed.sql`. הקטלוג הגלובלי הוא מיגרציה ממוספרת
(`0002_seed_catalog.sql`), ולכן הוא נוצר יחד עם הסכימה.

### יצירת הקישור הסודי

```bash
pnpm create-household "הבית של כהן"
```

הפקודה מדפיסה `Join link: https://…/j/<22 תווים>`. זה הפרטי היחיד שקיים במערכת:
מי שיש לו את הקישור — בפנים. משתפים אותו רק במשפחה. אם הוא דלף, «צור קישור חדש»
במסך ההגדרות מייצר סוד חדש ומעיף מיד את כל המכשירים הישנים (`cookie_generation`).

---

## סקריפטים

| פקודה | מה היא עושה |
|---|---|
| `pnpm dev` | פיתוח (Turbopack) |
| `pnpm build` / `pnpm start` | בנייה והרצה |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint flat config — **לא** `next lint`, הוא הוסר ב-Next 16 |
| `pnpm check:rtl` | נכשל על מחלקות כיווניות פיזיות (`ml-`, `left-`, `text-right`) |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright (3 הזרימות המרכזיות) |
| `pnpm verify` | typecheck + lint + rtl + test — להריץ לפני כל commit |
| `pnpm db:push` | מריץ את המיגרציות מול `SUPABASE_DB_URL` בלי ה-CLI |
| `pnpm seed` | seed מקומי מול `SUPABASE_DB_URL` |
| `pnpm create-household` | יוצר משק בית ומדפיס את הקישור |
| `pnpm icons` | מייצר מחדש את אייקוני ה-PWA |

---

## ארכיטקטורה

```
Server Component (app/page.tsx)
  └─ actions/queries.ts → supabaseAdmin (service_role) → Postgres
  └─ realtimeKey עובר ללקוח כ-prop, לא ב-cookie קריא

Client
  ├─ lib/offline/queue.ts   לוג mutations ב-IndexedDB — מקור האמת המקומי
  ├─ useOptimistic          המסלול המקוון של 0ms בלבד
  └─ Server Action
        ├─ requireHousehold()   cookie חתום + בדיקת cookie_generation מול ה-DB
        ├─ Zod parse
        ├─ supabaseAdmin → Postgres
        │     └─ trigger → realtime.send('hh:<realtime_key>', {op, table})
        └─ revalidatePath('/')

כל המכשירים
  └─ channel('hh:<realtimeKey>').on('broadcast') → router.refresh() (debounce 150ms)
```

כללי ברזל שלא משתנים:

1. גישה לנתונים רק מ-Server Actions. הדפדפן נוגע ב-Supabase רק דרך
   `channel().on('broadcast')` — לעולם לא `.from()`.
2. הודעת ה-broadcast מכילה `{op, table}` בלבד. אפס תוכן שורה, כי הסוד הוא הערוץ.
3. RLS מופעל על כל טבלה **בלי אף policy**. הדפדפן לא יכול לקרוא כלום גם אם ינסה.
4. כל שאילתה מסננת `.eq('household_id', householdId)`, בקריאה ובכתיבה. ה-FK
   המורכבים הם רשת ביטחון שנייה, לא הראשונה.
5. אין אינדקס ייחודי על פריטים פתוחים. מניעת כפילויות היא בקוד (`addOne`), כי
   אינדקס כזה מפיל את ה-Undo ואת ההוספה המרובה.
6. `member_name` היא זהות רכה לתצוגה. היא לא-httpOnly, ניתנת לזיוף, ואף פעם לא
   בסיס להרשאה.

### אוף-ליין

`useOptimistic` נותן 0ms אונליין אבל לא שורד רענון. לכן כל mutation נכתבת ללוג
ב-IndexedDB **לפני** השליחה, עם `clientId` שהוא גם מפתח האידמפוטנטיות בשרת:

- הצליח → נמחקת מהלוג.
- כשל רשת → נשארת, מוחלת מעל נתוני השרת בכל רנדור, ונשלחת שוב באירוע `online`.
- השרת דחה → נמחקת, עם טוסט בעברית. שליחה חוזרת תיכשל לנצח.

הוספה מרובה היא statement אחד לא-אידמפוטנטי בשרת, ולכן באוף-ליין היא מתפרקת
לפריט-פריט, כל אחד עם `clientId` משלו.

---

## דיפלוי ל-Vercel

1. `vercel link` ואז להוסיף את משתני הסביבה (Production + Preview).
2. `Referrer-Policy: strict-origin-when-cross-origin` מוגדר ב-`next.config.ts` —
   חובה, כי הסוד יושב בנתיב ה-URL.
3. הבנייה לא צריכה סודות: שום דבר שנוצר סטטית לא נוגע ב-Supabase.
4. אחרי הדיפלוי הראשון: `APP_URL=https://<domain> pnpm create-household`.
5. בטלפון: פתיחת הקישור → «הוספה למסך הבית» → האפליקציה נפתחת במסך מלא.

---

## תרומה לקוד

- ענפים `feat/`, `fix/`, `chore/`. אין push ישיר ל-`main`.
- Conventional Commits.
- לפני commit: `pnpm verify`.
- טקסט שהמשתמש רואה — בעברית. קוד, שמות ומחרוזות פנימיות — באנגלית.
- מרווחים ומיקום בלוגיים בלבד (`ms`, `me`, `ps`, `pe`, `start`, `end`).
  `pnpm check:rtl` נכשל על מחלקה פיזית אחת.

מה שלא נבנה, ולמה — ב-[`ROADMAP.md`](ROADMAP.md).
