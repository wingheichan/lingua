// ============================================================
//  LINGUA QUEST - App Core
// ============================================================

const App = (() => {

  const MAX_SECONDS = 60;

  const state = {
    currentPage: 'home',
    selectedLanguage: null,
    selectedCategory: null,
    selectedSubcategory: null,
    selectedGame: null,
    memoryMode: null,
    gameActive: false,
    playerName: '',
  };

  const LANGUAGES = [
    { key: 'latin',  file: 'json/latin.json',  sentenceFile: 'json/sentences_latin.json',  label: 'Latin',    flag: '🏛️', desc: 'Classical Roman tongue' },
    { key: 'greek',  file: 'json/greek.json',  sentenceFile: 'json/sentences_greek.json',  label: 'Old Greek', flag: '🏺', desc: 'Ancient Hellenic speech' },
    { key: 'french', file: 'json/french.json', sentenceFile: 'json/sentences_french.json', label: 'French',    flag: '🇫🇷', desc: 'La langue de Molière' },
    { key: 'german', file: 'json/german.json', sentenceFile: 'json/sentences_german.json', label: 'German',    flag: '🇩🇪', desc: 'Die Sprache Goethes' },
  ];

  const GAMES = [
    { key: 'fill',     icon: '✍️',  name: 'Fill in Letters',  desc: 'One letter removed – complete 20 words in 60 seconds.' },
    { key: 'memory',   icon: '🃏',  name: 'Memory Cards',     desc: 'Match words to meanings. Three modes, 60 seconds.' },
    { key: 'quiz',     icon: '⚔️',  name: 'Quest Battle',     desc: 'Answer to fight monsters. 3 wrong answers and the village falls.' },
    { key: 'sentence', icon: '📝',  name: 'Missing Word',     desc: 'A sentence with a gap – type the missing word in 60 seconds!' },
  ];

  const dataCache = {};

  // ── Player name modal ──────────────────────────────────────
  const Player = {
    STORAGE_KEY: 'linguaquest_player',
    load()       { return localStorage.getItem(this.STORAGE_KEY) || ''; },
    save(name)   { localStorage.setItem(this.STORAGE_KEY, name); },
  };

  function updateNavPlayerName() {
    const el = document.getElementById('nav-player-name');
    if (!el) return;
    el.textContent = state.playerName ? '👤 ' + state.playerName : '👤 Set name';
  }

  // Show the styled modal; returns a Promise that resolves when saved/cancelled
  function showNameModal(isFirstTime) {
    return new Promise(resolve => {
      const overlay  = document.getElementById('modal-overlay');
      const title    = document.getElementById('modal-title');
      const subtitle = document.getElementById('modal-subtitle');
      const input    = document.getElementById('modal-name-input');
      const saveBtn  = document.getElementById('modal-save');
      const cancelBtn= document.getElementById('modal-cancel');

      title.textContent    = isFirstTime ? 'Welcome to Lingua Quest' : 'Change Your Name';
      subtitle.textContent = isFirstTime
        ? 'Enter your name to appear on the leaderboard.'
        : 'Update your display name below.';
      input.value          = state.playerName || '';
      cancelBtn.style.display = isFirstTime ? 'none' : '';

      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('visible'), 10);
      input.focus();
      input.select();

      function close(saved) {
        overlay.classList.remove('visible');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
        saveBtn.onclick   = null;
        cancelBtn.onclick = null;
        input.onkeydown   = null;
        resolve(saved);
      }

      saveBtn.onclick = () => {
        const name = input.value.trim().slice(0, 24) || (isFirstTime ? 'Player' : state.playerName || 'Player');
        state.playerName = name;
        Player.save(name);
        updateNavPlayerName();
        close(true);
      };

      cancelBtn.onclick = () => close(false);

      input.onkeydown = e => {
        if (e.key === 'Enter') saveBtn.click();
        if (e.key === 'Escape' && !isFirstTime) cancelBtn.click();
      };
    });
  }

  // ── High Scores ────────────────────────────────────────────
  const Scores = {
    STORAGE_KEY: 'linguaquest_scores',
    load() {
      try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); }
      catch { return []; }
    },
    save(scores) { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scores)); },
    add(entry) {
      const scores = this.load();
      scores.push(entry);
      scores.sort((a, b) => b.score - a.score);
      this.save(scores.slice(0, 200));
    },
    clear() { localStorage.removeItem(this.STORAGE_KEY); },
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

  async function loadSentenceData(lang) {
    const cacheKey = lang.key + '_sentences';
    if (dataCache[cacheKey]) return dataCache[cacheKey];
    const r = await fetch(lang.sentenceFile);
    if (!r.ok) throw new Error('Cannot load ' + lang.sentenceFile);
    const data = await r.json();
    dataCache[cacheKey] = data;
    return data;
  }

  // ── Page routing ───────────────────────────────────────────
  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + id);
    if (page) { page.classList.add('active'); state.currentPage = id; }
    document.querySelectorAll('.nav-btn[data-page]').forEach(b =>
      b.classList.toggle('active', b.dataset.page === id));
  }

  // ── Home ───────────────────────────────────────────────────
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
    catch { alert('Could not load language data. Check the JSON files are uploaded.'); }
  }

  // ── Game flow ──────────────────────────────────────────────
  async function startGameFlow(gameKey) {
    if (!state.playerName) await showNameModal(true);
    if (!state.selectedLanguage) { alert('Please select a language first!'); return; }
    if (!state.selectedLanguage.data) {
      try { state.selectedLanguage.data = await loadLanguageData(state.selectedLanguage); }
      catch { alert('Could not load language data.'); return; }
    }
    state.selectedGame = gameKey;
    if (gameKey === 'sentence') {
      try {
        state.selectedLanguage.sentenceData = await loadSentenceData(state.selectedLanguage);
      } catch { alert('Could not load sentence data. Make sure the JSON files are uploaded.'); return; }
    }
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
    const catSource = state.selectedGame === 'sentence'
      ? lang.sentenceData
      : lang.data;
    catSource.categories.forEach(cat => {
      const sec = document.createElement('div');
      sec.className = 'cat-section';
      sec.innerHTML = `<div class="cat-title">${cat.name}</div>`;
      const subList = document.createElement('div');
      subList.className = 'subcat-list';
      cat.subcategories.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'subcat-btn';
        const count = sub.sentences ? sub.sentences.length : (sub.words ? sub.words.length : 0);
        btn.textContent = sub.name + ' (' + count + ')';
        btn.addEventListener('click', () => chooseSubcategory(cat, sub));
        subList.appendChild(btn);
      });
      sec.appendChild(subList);
      catList.appendChild(sec);
    });

    const memSec = document.getElementById('memory-mode-select');
    memSec.style.display = state.selectedGame === 'memory' ? 'block' : 'none';
  }

  function chooseSubcategory(cat, sub) {
    state.selectedCategory    = cat;
    state.selectedSubcategory = sub;
    if (state.selectedGame === 'memory') {
      document.getElementById('memory-mode-select').scrollIntoView({ behavior: 'smooth' });
    } else {
      launchGame();
    }
  }

  function launchGame() {
    state.gameActive = true;
    if (state.selectedGame === 'fill')     { FillGame.start();     showPage('fill'); }
    if (state.selectedGame === 'memory')   { MemoryGame.start();   showPage('memory'); }
    if (state.selectedGame === 'quiz')     { QuizGame.start();     showPage('quiz'); }
    if (state.selectedGame === 'sentence') { SentenceGame.start(); showPage('sentence'); }
  }

  function quitGame() {
    FillGame.reset();
    MemoryGame.reset();
    QuizGame.reset();
    SentenceGame.reset();
    state.gameActive = false;
    showPage('home');
  }

  // ── Scores page ────────────────────────────────────────────
  function renderScores(filterGame) {
    const all    = Scores.load();
    const games  = ['fill', 'memory', 'quiz', 'sentence'];
    const labels = { fill: 'Fill in Letters', memory: 'Memory Cards', quiz: 'Quest Battle', sentence: 'Missing Word' };

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
    const tbody    = document.getElementById('scores-tbody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="no-scores">No scores yet. Play a game first!</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered.slice(0, 50).map((s, i) => `
      <tr class="${i < 3 ? 'rank-'+(i+1) : ''}">
        <td>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}</td>
        <td style="color:var(--sand);font-weight:600">${s.player || '—'}</td>
        <td class="score-val">${s.score}</td>
        <td>${labels[s.game] || s.game}</td>
        <td>${s.language}</td>
        <td>${s.subcategory}</td>
        <td>${formatTime(s.time)}</td>
        <td>${s.date}</td>
      </tr>`).join('');
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return m + ':' + s;
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    state.playerName = Player.load();
    updateNavPlayerName();

    if (!state.playerName) showNameModal(true);

    document.getElementById('btn-home-nav').addEventListener('click', () => {
      if (state.gameActive) quitGame(); else showPage('home');
    });
    document.getElementById('btn-scores-nav').addEventListener('click', () => {
      renderScores('all'); showPage('scores');
    });
    document.getElementById('nav-player-name').addEventListener('click', () => {
      showNameModal(false);
    });
    document.getElementById('btn-back-select').addEventListener('click', () => showPage('home'));

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.memoryMode = parseInt(btn.dataset.mode);
        if (state.selectedSubcategory) launchGame();
        else alert('Please pick a subcategory first.');
      });
    });

    document.getElementById('btn-clear-scores').addEventListener('click', () => {
      if (confirm('Clear all high scores?')) { Scores.clear(); renderScores('all'); }
    });

    renderHome();
    showPage('home');
  }

  return { init, state, Scores, MAX_SECONDS, quitGame, renderHome, renderScores, formatTime, launchGame, showPage };
})();
