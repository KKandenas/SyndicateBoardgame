# The Noir Syndicate 🎩🔫

En webbaserad kompanjonapp för ett fysiskt brädspel om rivaliserande brottssyndikat i 1920-talets Chicago. Spelplanen byggs upp på bordet med en vanlig kortlek — appen sköter ekonomin, tärningsslag, händelsekort, slagsmål och arresteringar, så att spelarna kan fokusera på spelet istället för huvudräkning.

Byggd för att köras på en iPad (liggande, delat bräde) eller flera iPhones (stående, en flik per spelare).

## Innehåll
- [Om spelet](#om-spelet)
- [Funktioner](#funktioner)
- [Kom igång](#kom-igång)
- [Filstruktur](#filstruktur)
- [Arkitektur](#arkitektur)
- [Kända begränsningar](#kända-begränsningar)
- [Möjliga vidareutvecklingar](#möjliga-vidareutvecklingar)

## Om spelet

Du leder ett av upp till fyra brottssyndikat: **Nightspades** (♠), **Crimson** (♥), **Iron Clovers** (♣) och **Diamond** (♦). Målet är att hämta skattkistor värda $1000 hos din Kung, smuggla dem i fickan genom stadens farliga gator, och säkra dem i din kista hemma vid ditt Ess. Först till **tre säkrade kistor ($3000)** vinner och tar över staden.

Fullständiga regler finns inbyggda i appen (knappen "📜 Regler", tillgänglig redan från startskärmen).

## Funktioner

- 📱 **Två lägen**: iPad (liggande bräde, alla fyra spelarpaneler synliga) och iPhone (stående, en flik per spelare)
- 🌐 **Tvåspråkigt**: svenska och engelska, växlas live utan att spelet avbryts
- 🎲 **Digital tärning** med animation och en deterministisk 5:a/6:a-regel (polisval eller händelsekort)
- 💰 **Fullständig ekonomi**: fickpengar, skattkistor, och en tyst stadskassa i bakgrunden
- 🚨 **Automatisk arrestering** när en spelares polis (Knekt) landar på en motståndare
- 💥 **Gatuslagsmål** med egen tärningsanimation och tydligt resultat
- 🎴 **Händelsekort**, inklusive ett interaktivt Ficktjuv-kort där man väljer offer
- 🔁 **Turordning** som följer bordets layout, med tydlig "vems tur"-banner
- 🛠️ **Admin-verktyg** för att manuellt rätta till spelarvärden om något går snett

## Kom igång

Appen är byggd med rena ES-moduler (`import`/`export`), vilket innebär att den **måste köras via en webbserver** — den fungerar inte om man bara dubbelklickar på `index.html` lokalt.

### Alternativ 1: GitHub Pages (rekommenderas)
1. Ladda upp hela mappens innehåll till ett GitHub-repo.
2. Gå till **Settings → Pages**, välj rätt gren/mapp som källa.
3. Besök den genererade adressen (`https://<användarnamn>.github.io/<repo>/`).

### Alternativ 2: Lokal server
```bash
# Med Python (finns oftast förinstallerat på Mac):
python3 -m http.server

# Eller med Node.js:
npx serve
```
Besök sedan `http://localhost:8000` (eller den port verktyget anger).

### Bilder som behövs
Lägg dessa tre filer direkt i samma mapp som `index.html` (skiftläge spelar roll — GitHub Pages är skiftlägeskänsligt):
- `bakgrund.PNG` — bakgrundsbild för spelvyn
- `gangsters.PNG` — bakgrundsbild för startskärmen
- `setup.PNG` — bild som visar hur korten ska läggas upp på det fysiska brädet

## Filstruktur

```
noir-syndicate/
├── index.html          Markup för alla vyer och modaler
├── style.css            All styling
├── README.md              Den här filen
├── bakgrund.PNG            (bild, ej inkluderad i repot av dig)
├── gangsters.PNG            (bild, ej inkluderad i repot av dig)
├── setup.PNG                (bild, ej inkluderad i repot av dig)
└── js/
    ├── state.js             Enda källan till sanning för spelets data + pub/sub
    ├── i18n.js               All UI-text på svenska/engelska
    ├── players.js             Spelaruppsättning (2-4 spelare), ägarskap per färg
    ├── turnOrder.js            Vems tur det är, manuellt turbyte
    ├── dice.js                 Ren tärningsmekanik (slumptal, prickmönster)
    ├── movement.js              Tolkar tärningsslag (1-4 / 5 / 6-regeln)
    ├── events.js                 Händelsekortspoolen
    ├── economy.js                 Last/kista, betalningar, stadskassa
    ├── combat.js                   Gatuslagsmålslogik
    ├── arrest.js                    Arresteringslogik
    ├── ui.js                        All DOM-rendering och modalhantering
    └── main.js                      Startpunkt, kopplar ihop allt
```

## Arkitektur

Projektet är byggt enligt en enkel men strikt regel: **`ui.js` är den enda filen som rör DOM.** Alla andra moduler är ren logik som tar emot indata och returnerar resultat, utan att veta något om skärmen.

- **`state.js`** äger all speldata och notifierar lyssnare (`ui.js`) när något ändras via ett litet pub/sub-system.
- **`economy.js`**, **`combat.js`**, **`arrest.js`**, **`turnOrder.js`** och **`movement.js`** innehåller spelreglerna. Varje publik funktion börjar med en kontroll av att rätt spelare får agera (`assertCanAct`), vilket skyddar mot att fel spelare råkar utföra en handling.
- **`ui.js`** prenumererar på state-ändringar och renderar om skärmen automatiskt — ingen manuell synk krävs.

Den här uppdelningen gör det möjligt att i framtiden koppla på delad, molnbaserad synkronisering (t.ex. Firebase) utan att röra spellogiken: skriv till `state.js`, låt `ui.js` rendera om.

## Kända begränsningar

- Appen håller **inte** reda på var pjäserna fysiskt står på brädet — bara vilken riktning en spelare är på väg (mot Kung eller mot Ess). Kollisioner, tullbetalning och polisrörelser bekräftas manuellt av spelarna vid bordet.
- Ingen datapersistens — laddar man om sidan nollställs spelet. Perfekt för en enda spelkväll, mindre bra om man vill pausa och återuppta senare.
- Endast en enhet styr åt gången (ingen delad realtidssynk mellan flera telefoner).

## Möjliga vidareutvecklingar

- Digitalisera hela spelplanen så appen vet exakt var varje pjäs står.
- Delad state mellan flera enheter (en telefon per spelare, synkat i realtid).
- Fler/roterande händelsekort.
- Spara pågående spel (t.ex. i `localStorage` eller en molntjänst).

---

*Ett fysiskt brädspel med digital kompanjonapp. God jakt, boss.* 🕵️‍♂️
