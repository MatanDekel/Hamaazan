# המאזן — ניהול השקעות והוצאות משפחתי

React + Vite, Firebase (Auth + Firestore), פריסה ל-Vercel.

## הקמה
1. **Firebase Console** → פרויקט חדש → Authentication → Sign-in method → להפעיל **Google**.
2. Authentication → Settings → **Authorized domains** → להוסיף את הדומיין של Vercel (למשל `hamaazan.vercel.app`).
3. Firestore Database → Create → Rules → להדביק את התוכן של `firestore.rules` ולפרסם.
4. Project settings → Your apps → Web app → להעתיק את ה-config.
5. ב-Vercel → Settings → Environment Variables → להוסיף את כל המשתנים מ-`.env.example` (מקומית: קובץ `.env`).
6. **RiseUp** — באותו מסך ב-Vercel להוסיף גם:
   - `RISEUP_PAT` — הטוקן מ-input.riseup.co.il/developer/tokens (הרשאת `budget:read`)
   - `ALLOWED_EMAILS` — המיילים שמורשים לראות הוצאות, מופרדים בפסיק
   - בלי קידומת `VITE_`! אחרת הטוקן ייחשף בדפדפן.
7. מקומית: `npm install && npx vercel dev` (עם `npm run dev` לשונית ההוצאות לא תעבוד כי אין שרת `/api`).

## איך זה עובד
- **כניסה עם Google** — בכניסה הראשונה נפתחת משפחה חדשה. בלשונית "משפחה" מוסיפים מייל של חשבון Google נוסף, וכשהוא נכנס הוא רואה את אותם נתונים.
- **קוד 123** במסך הכניסה → אתר הדגמה עם נתונים לדוגמה, בלי Firebase ובלי שמירה.
- **תשואת מסלול** לכל תקופה בין שני עדכוני יתרה: מנכה את ההפקדות ומחזירה את דמי הניהול (מהפקדה ומצבירה), לפי שיטת Modified Dietz. החישוב ב-`src/calc.js`.

## הוצאות
- `api/riseup.js` רץ כפונקציה ב-Vercel: מאמת את משתמש ה-Firebase, בודק שהמייל ב-`ALLOWED_EMAILS`, ומושך עסקאות מ-RiseUp לפי חודש.
- הקטגוריות נקראות מ-`categoryLabel` של כל עסקה — כלומר הקטגוריות שהגדרת ב-RiseUp.
- קטגוריות עיליות נשמרות במסמך המשפחה (`expenseGroups`), כך שכל המשפחה רואה אותה חלוקה.
- עסקאות שסומנו ב-RiseUp כ"לא נכללות בתזרים" לא נספרות.

## מבנה הנתונים
```
families/{familyId}            name, memberEmails[], owners[], expenseGroups[{id, name, categories[]}]
families/{familyId}/funds/{id} name, kind, company, owner, investedSoFar, startDate,
                               monthlyDeposit, feeDeposit, feeBalance,
                               allocation[{track, pct}], snapshots[{id, date, balance, deposits}]
```
