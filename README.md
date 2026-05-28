# Lingua Quest 🏛️

A browser-based language learning game for Latin, Old Greek, French and German — with Dutch translations.

## File Structure

```
/
├── index.html            ← Main app (all pages)
├── css/
│   └── style.css
├── js/
│   ├── app.js            ← Core: navigation, data loading, high scores
│   ├── fill.js           ← Fill-in-letters game
│   ├── memory.js         ← Memory card game
│   └── quiz.js           ← Quest battle quiz
└── json/
    ├── latin.json
    ├── greek.json
    ├── french.json
    └── german.json
```

## How to Upload to GitHub (browser only)

1. Go to [github.com](https://github.com) and sign in
2. Click **+** → **New repository**
3. Name it e.g. `lingua-quest`, set to **Public**, click **Create repository**
4. Click **Add file** → **Upload files**
5. Upload `index.html` first
6. Create the `css/` folder: click **Add file** → **Create new file**, type `css/style.css`, paste the content, commit
7. Repeat for `js/app.js`, `js/fill.js`, `js/memory.js`, `js/quiz.js`
8. Repeat for `json/latin.json`, `json/greek.json`, `json/french.json`, `json/german.json`
9. Enable GitHub Pages: **Settings** → **Pages** → Source: `main` branch → `/root` → **Save**
10. Your site will be live at `https://yourusername.github.io/lingua-quest/`

> **Tip for folders in GitHub browser upload:** When creating a new file, type the folder name followed by `/` in the filename field — GitHub will automatically create the folder.

## Games

### ✍️ Fill in Letters
One random letter is removed from a word. The Dutch meaning is shown as a hint. Type the missing letter and press Enter. Incorrect input shakes and repeats — no skipping! Score: +10 per correct word.

### 🃏 Memory Cards
Questions on the left, Dutch answers on the right. Three modes:
- **Mode 1** — All cards closed, flip to reveal
- **Mode 2** — Cards shown for 10 seconds, then hidden
- **Mode 3** — All cards open, just click to match

Score: +20 per match, −5 per mistake.

### ⚔️ Quest Battle
Multiple choice quiz. A monster spawns each question. Answer correctly — a human warrior defeats the monster. Three wrong answers = the village falls. Win by defeating all monsters.

Score: +20 per correct answer.

## High Scores
Stored in browser `localStorage`. Filter by game type. Clears with the "Clear All Scores" button.

## Adding New Languages
Create a new JSON file in `/json/` following the same structure as `latin.json`, then register it in `js/app.js` in the `LANGUAGES` array.

## Adding New Games (future)
1. Create `js/yourgame.js` with `start()` and `reset()` methods
2. Add a page `<div class="page" id="page-yourgame">` in `index.html`
3. Register it in the `GAMES` array in `js/app.js`
4. Add a case in `launchGame()` in `js/app.js`
