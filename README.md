# TestFlow

HTML, CSS va Vanilla JavaScript asosidagi online test platformasi. Backend kerak emas.

## Ishga tushirish

1. `testflow` papkasini oching.
2. `index.html` faylini brauzerda oching (Chrome, Edge, Firefox, Safari).
3. Test faylini yuklang va testni boshlang.

Kutubxonalar CDN orqali ulanadi, shuning uchun birinchi ochilishda internet kerak.

Mahalliy server bilan ishga tushirish ixtiyoriy:

```
python3 -m http.server 8000
```

So'ng `http://localhost:8000` manzilini oching.

## Dependency'lar (CDN)

| Kutubxona | Vazifasi |
|---|---|
| SheetJS (xlsx 0.18.5) | `.xlsx`, `.xls` fayllarini o'qish |
| Mammoth.js 1.8.0 | `.docx` fayllarini o'qish |
| Lucide 0.469.0 | Ikonlar |
| Inter (Google Fonts) | Shrift |

`.csv` va `.txt` fayllari ichki parser bilan o'qiladi.

## Fayl formati

Har bir qator — bitta savol.

| 1-ustun | 2-ustun | 3-ustun | 4-ustun | 5-ustun |
|---|---|---|---|---|
| Savol | To'g'ri javob | Xato javob | Xato javob | Xato javob |

- Bo'sh kataklar javob sifatida olinmaydi.
- Savoli yoki to'g'ri javobi bo'sh qatorlar o'tkazib yuboriladi.
- Kamida bitta xato javobi bo'lmagan savollar o'tkazib yuboriladi.
- Takroriy savollar va bir xil javoblar olib tashlanadi.
- Sarlavha qatori (`Savol`, `To'g'ri javob` kabi) avtomatik aniqlanadi.
- CSV/TXT: ajratuvchi (tab, `;`, `|`, `,`) avtomatik aniqlanadi.
- DOCX: savollar jadval ko'rinishida bo'lishi kerak.
- Maksimal fayl hajmi: 10 MB.

`sample.csv` — namunaviy fayl.

## Qoidalar

- Savollar soni: 25, 30 yoki 50. Faylda yetarli savol bo'lmasa, mos variant o'chiriladi. 25 tadan kam bo'lsa, "Barcha savollar" varianti chiqadi.
- Savollar va variantlar test boshlanganda bir marta aralashtiriladi (Fisher-Yates). Savollar almashganda qayta aralashmaydi.
- Birinchi tanlov yakuniy: javobni o'zgartirib bo'lmaydi.
- Progress javob berilgan savollar soniga asoslanadi.
- Foiz = to'g'ri / jami × 100, eng yaqin butun songa yaxlitlanadi. Har bir savol — 1 ball.
- Timer va vaqt statistikasi yo'q.
- "Qayta boshlash" original savollardan yangi aralashtirilgan test yaratadi, faylni qayta yuklash shart emas.

## Struktura

```
testflow/
├── index.html
├── style.css
├── sample.csv
├── README.md
└── js/
    ├── parser.js
    ├── quiz.js
    └── app.js
```

- `parser.js` — fayllarni o'qish va savollarga ajratish.
- `quiz.js` — aralashtirish, javob holati, ball hisoblash.
- `app.js` — interfeys, sahifalar, toast va modal oynalar.

Foydalanuvchi matni faqat `textContent` orqali joylanadi.
