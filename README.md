# Tesco – Produktivita (Web App)

**Funkcie**
- Zadanie kódu palety (manuálne alebo cez offline skener – kamera + ZXing).
- Zadanie mena.
- Ovládanie: **Štart → Pauza/ Pokračovať → Stop** (logika zobrazenia podľa stavu).
- Viditeľný časovač.
- Pri **Pauza**: povinný výber dôvodu; pri **Iné** je povinný popis.
- Pri **Stop**: povinný počet „Zostalo kartónov“.
- Po **Stop** sa zapisuje riadok do `data/productivity_log.csv` (auto vytvorenie a hlavička).

**CSV stĺpce**
`Kód palety, Meno, Začiatok, Koniec, čistý čas vykladania (s), počet pauz, dôvody pauzy, zostalo kartónov`

## Nasadenie
1. Skopírujte celý obsah priečinka na server s **PHP 8+**.
2. Uistite sa, že priečinok `data/` je zapisovateľný (napr. `chmod 775 data`).
3. Otvorte `index.html` v prehliadači cez webserver (nie cez `file://`).

> ZXing knižnica je priložená (`zxing.min.js`, `zxing_reader.wasm`).

## Poznámky
- Aplikácia je responzívna (mobil/tablet/desktop).
- Pri skenovaní povoľte prístup ku kamere.
- CSV si kedykoľvek stiahnete cez FTP priamo zo servera (`data/productivity_log.csv`).

