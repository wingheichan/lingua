// ============================================================
//  LINGUA QUEST - App Core
//  Handles: navigation, data loading, player name, high scores
// ============================================================

const App = (() => {

  const MAX_SECONDS = 60;   // 1-minute time limit for all games

  // ── State ──────────────────────────────────────────────────
  const state = {
    currentPage: 'home',
    selectedLanguage: null,
    selectedCategory: null,
    selectedSubcategory: null,
    selectedGame: null,       // 'fill' | 'memory' | 'quiz'
    memoryMode: null,
    gameActive: false,
    playerName: '',
  };

  // ── Language registry ──────────────────────────────────────
  const LANGUAGES = [
    { key: 'latin',  file: 'json/latin.json',  label: 'Latin',    flag: '🏛️', desc: 'Classical Roman tongue' },
    { key: 'greek',  file: 'json/greek.json',  label: 'Old Greek', flag: '🏺', desc: 'Ancient Hellenic speech' },
    { key: 'french', file: 'json/french.json', label: 'French',    flag: '🇫🇷', desc: 'La langue de Molière' },
    { key: 'german', file: 'json/german.json', label: 'German',    flag: '🇩🇪', desc: 'Die Sprache Goethes' },
  ];

  const GAMES = [
    { key: 'fill',   icon: '✍️',  name: 'Fill in Letters', desc: 'One letter removed – can you complete 20 words in 60 seconds?' },
    { key: 'memory', icon: '🃏',  name: 'Memory Cards',    desc: 'Match words to their meanings. Three modes, 60 seconds on the clock.' },
    { key: 'quiz',   icon: '⚔️',  name: 'Quest Battle',    desc: 'Answer questions to fight monsters. 3 wrong answers and the humans fall.' },
  ];

  const dataCache = {};

  // ── Player name ────────────────────────────────────────────
  const Player = {
    STORAGE_KEY: 'linguaquest_player',
    load() {
      return localStorage.getItem(this.STORAGE_KEY) || '';
    },
    save(name) {
      localStorage.setItem(this.STORAGE_KEY, name);
    }
  };

  function loadPlayerName() {
    state.playerName = Player.load();
  }

  function updateNavPlayerName() {
    const el = document.getElementById('nav-player-name');
    if (!el) return;
    if (state.playerName) {
      el.textContent = '👤 ' + state.playerName;
      el.title = 'Click to change name';
    } else {
      el.textContent = '👤 Set name';
      el.title = 'Click to set your name';
    }
  }

  function promptPlayerName(isFirstTime) {
    const current = state.playerName;
    const msg = isFirstTime
      ? 'Welcome! Enter your name to track your scores:'
      : 'Change your name:';
    const input = prompt(msg, current);
    if (input === null) return; // cancelled
    const name = input.trim().slice(0, 24);
    if (!name && !current) {
      // First time, force a name
      state.playerName = 'Player';
    } else if (name) {
      state.playerName = name;
    }
    Player.save(state.playerName);
    updateNavPlayerName();
  }

  // ── High Scores ────────────────────────────────────────────
  const Scores = {
    STORAGE_KEY: 'linguaquest_scores',
    load() {
      try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); }
      catch { return []; }
    },
    save(scores) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scores));
    },
    add(entry) {
      const scores = this.load();
      scores.push(entry);
      scores.sort((a, b) => b.score - a.score);
      this.save(scores.slice(0, 200));
    },
    clear() {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  };

  // ── Data loader ────────────────────────────────────────────
  async function loadLanguageData(lang) {
    if (dataCache[lang.key]) return dataCache[lang.key];
    const r = await fetch(lang.file);
    if (!r.ok) throw new Error('Cannot load ' + lang.file);
    const data = await r.json();
    dataCache[lang.key] = data;
    return data;
  }

  // ── Page routing ───────────────────────────────────────────
  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + id);
    if (page) { page.classList.add('active'); state.currentPage = id; }
    document.querySelectorAll('.nav-btn[data-page]').forEach(b => {
      b.classList.toggle('active', b.dataset.page === id);
    });
  }

  // ── Home Page ──────────────────────────────────────────────
  function renderHome() {
    const langGrid = document.getElementById('lang-grid');
    langGrid.innerHTML = '';
    LANGUAGES.forEach(lang => {
      const card = document.createElement('div');
      card.className = 'lang-card' + (state.selectedLanguage?.key === lang.key ? ' selected' : '');
      card.innerHTML = `<div class="lang-flag">${lang.flag}</div>
        <div class="lang-name">${lang.label}</div>
        <div class="lang-desc">${lang.desc}</div>`;
      card.addEventListener('click', () => selectLanguage(lang, card));
      langGrid.appendChild(card);
    });

    const gameGrid = document.getElementById('game-grid');
    gameGrid.innerHTML = '';
    GAMES.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.innerHTML = `<div class="game-icon">${game.icon}</div>
        <div class="game-name">${game.name}</div>
        <div class="game-desc">${game.desc}</div>`;
      card.addEventListener('click', () => startGameFlow(game.key));
      gameGrid.appendChild(card);
    });
  }

  async function selectLanguage(lang, cardEl) {
    document.querySelectorAll('.lang-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    state.selectedLanguage = lang;
    try { lang.data = await loadLanguageData(lang); }
    catch { alert('Could not load language data. Make sure the JSON files are uploaded.'); }
  }

  // ── Game flow ──────────────────────────────────────────────
  async function startGameFlow(gameKey) {
    if (!state.playerName) { promptPlayerName(true); }
    if (!state.selectedLanguage) { alert('Please select a language first!'); return; }
    if (!state.selectedLanguage.data) {
      try { state.selectedLanguage.data = await loadLanguageData(state.selectedLanguage); }
      catch { alert('Could not load language data.'); return; }
    }
    state.selectedGame = gameKey;
    renderCategorySelect();
    showPage('select');
  }

  function renderCategorySelect() {
    const lang = state.selectedLanguage;
    document.getElementById('select-lang-name').textContent = lang.label;
    document.getElementById('select-game-name').textContent =
      GAMES.find(g => g.key === state.selectedGame)?.name || '';

    const catList = document.getElementById('cat-list');
    catList.innerHTML = '';
    lang.data.categories.forEach(cat => {
      const sec = document.createElement('div');
      sec.className = 'cat-section';
      sec.innerHTML = `<div class="cat-title">${cat.name}</div>`;
      const subList = document.createElement('div');
      subList.className = 'subcat-list';
      cat.subcategories.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'subcat-btn';
        btn.textContent = sub.name + ' (' + sub.words.length + ')';
        btn.addEventListener('click', () => chooseSubcategory(cat, sub));
        subList.appendChild(btn);
      });
      sec.appendChild(subList);
      catList.appendChild(sec);
    });

    const memorySection = document.getElementById('memory-mode-select');
    memorySection.style.display = state.selectedGame === 'memory' ? 'block' : 'none';
  }

  function chooseSubcategory(cat, sub) {
    state.selectedCategory = cat;
    state.selectedSubcategory = sub;
    if (state.selectedGame === 'memory') {
      document.getElementById('memory-mode-select').scrollIntoView({ behavior: 'smooth' });
    } else {
      launchGame();
    }
  }

  function launchGame() {
    state.gameActive = true;
    if (state.selectedGame === 'fill')   { FillGame.start();   showPage('fill'); }
    if (state.selectedGame === 'memory') { MemoryGame.start(); showPage('memory'); }
    if (state.selectedGame === 'quiz')   { QuizGame.start();   showPage('quiz'); }
  }

  // ── Quit ───────────────────────────────────────────────────
  function quitGame() {
    FillGame.reset();
    MemoryGame.reset();
    QuizGame.reset();
    state.gameActive = false;
    showPage('home');
  }

  // ── Scores page ────────────────────────────────────────────
  function renderScores(filterGame) {
    const all = Scores.load();
    const games = ['fill', 'memory', 'quiz'];
    const labels = { fill: 'Fill in Letters', memory: 'Memory Cards', quiz: 'Quest Battle' };

    const tabsEl = document.getElementById('score-tabs');
    tabsEl.innerHTML = '';
    ['all', ...games].forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'score-tab' + (filterGame === g ? ' active' : '');
      btn.textContent = g === 'all' ? 'All Games' : labels[g] || g;
      btn.addEventListener('click', () => renderScores(g));
      tabsEl.appendChild(btn);
    });

    const filtered = filterGame === 'all' ? all : all.filter(s => s.game === filterGame);
    const tbody = document.getElementById('scores-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="no-scores">No scores yet. Play a game first!</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered.slice(0, 50).map((s, i) => `
      <tr class="${i < 3 ? 'rank-'+(i+1) : ''}">
        <td>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}</td>
        <td style="color:var(--accent-light);font-weight:600">${s.player || '—'}</td>
        <td class="score-val">${s.score}</td>
        <td>${labels[s.game] || s.game}</td>
        <td>${s.language}</td>
        <td>${s.subcategory}</td>
        <td>${formatTime(s.time)}</td>
        <td>${s.date}</td>
      </tr>
    `).join('');
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return m + ':' + s;
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    loadPlayerName();

    // Ask name on first visit
    if (!state.playerName) promptPlayerName(true);
    updateNavPlayerName();

    // Nav: logo / home
    document.getElementById('btn-home-nav').addEventListener('click', () => {
      if (state.gameActive) quitGame(); else showPage('home');
    });

    // Nav: scores
    document.getElementById('btn-scores-nav').addEventListener('click', () => {
      renderScores('all'); showPage('scores');
    });

    // Nav: player name click to change
    document.getElementById('nav-player-name').addEventListener('click', () => {
      promptPlayerName(false);
    });

    // Select page back
    document.getElementById('btn-back-select').addEventListener('click', () => showPage('home'));

    // Memory mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.memoryMode = parseInt(btn.dataset.mode);
        if (state.selectedSubcategory) launchGame();
        else alert('Please pick a subcategory first.');
      });
    });

    // Clear scores
    document.getElementById('btn-clear-scores').addEventListener('click', () => {
      if (confirm('Clear all high scores?')) { Scores.clear(); renderScores('all'); }
    });

    renderHome();
    showPage('home');
  }

  return { init, state, Scores, Player, MAX_SECONDS, quitGame, renderHome, renderScores, formatTime, launchGame, showPage, updateNavPlayerName };
})();
