// app.js – Quiz Seguros (versión con estadísticas mejoradas)

// === Global State ===
let QUESTIONS_ALL = {};
let QUESTIONS_INDEX = {};

let currentModule = null;
let sessionQuestions = [];
let qIndex = 0;
let selectedIdx = null;
let answered = false;
let score = { correct: 0, incorrect: 0 };
let soundEnabled = true;
let batchSize = 20;

// === DOM ===
const loadingScreen = document.getElementById('loadingScreen');
const startScreen = document.getElementById('startScreen');
const questionScreen = document.getElementById('questionScreen');
const endScreen = document.getElementById('endScreen');
const statsDetailScreen = document.getElementById('statsDetailScreen');

const moduleList = document.getElementById('moduleList');
const startBtn = document.getElementById('startBtn');
const numSel = document.getElementById('numQuestions');
const soundChk = document.getElementById('soundEnabled');

const difficultyBadge = document.getElementById('difficultyBadge');
const subtopicText = document.getElementById('subtopicText');
const questionText = document.getElementById('questionText');
const optionsWrap = document.getElementById('optionsContainer');
const feedbackBox = document.getElementById('feedback');
const nextBtn = document.getElementById('nextBtn');
const progressFill = document.getElementById('progressFill');
const counterText = document.getElementById('questionCounter');

const correctCount = document.getElementById('correctCount');
const incorrectCount = document.getElementById('incorrectCount');
const finalScore = document.getElementById('finalScore');
const performanceMessage = document.getElementById('performanceMessage');
const detailedResults = document.getElementById('detailedResults');
const restartBtn = document.getElementById('restartBtn');

const statsModuleName = document.getElementById('statsModuleName');
const statsTableContainer = document.getElementById('statsTableContainer');
const backToStartBtn = document.getElementById('backToStartBtn');

// === Utils ===
function shuffle(arr, rng=Math) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor((rng.random ? rng.random() : Math.random()) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleOptions(q) {
  const opts = q.options.map((t,i)=>({t,i}));
  shuffle(opts);
  const newOptions = opts.map(o=>o.t);
  const newCorrect = opts.findIndex(o=>o.i===q.correct);
  return {...q, options: newOptions, correct: newCorrect};
}

// === Data Loading ===
async function loadAll() {
  try {
    const [idxRes, allRes] = await Promise.all([
      fetch('questions_index.json'),
      fetch('questions_all.json')
    ]);
    if (!idxRes.ok) throw new Error('No se pudo cargar questions_index.json');
    if (!allRes.ok) throw new Error('No se pudo cargar questions_all.json');

    QUESTIONS_INDEX = await idxRes.json();
    QUESTIONS_ALL = await allRes.json();

    renderModules(QUESTIONS_INDEX.modules);

    loadingScreen.style.display = 'none';
    startScreen.style.display = 'block';
  } catch (e) {
    console.error(e);
    alert('Error cargando preguntas. Revisa que questions_all.json y questions_index.json estén en la misma carpeta que index.html');
  }
}

// === Module UI con Estadísticas ===
function renderModules(modules) {
  moduleList.innerHTML = '';
  modules.forEach(row => {
    const card = document.createElement('div');
    card.className = 'module-option';
    card.dataset.module = row.key;
    
    const desc = moduleDescription(row.key);
    
    // Obtener estadísticas
    const lastSessionStats = getLastSessionStats(row.key);
    const last100Stats = getLast100Stats(row.key);
    
    card.innerHTML = `
      <div class="module-info">
        <div class="module-title">${row.title}</div>
        <div class="module-description">${row.count} preguntas · ${desc}</div>
      </div>
      <div class="module-stats">
        <div class="stat-box" data-module="${row.key}" data-type="last">
          <div class="stat-label">Última</div>
          <div class="stat-value">${lastSessionStats.display}</div>
        </div>
        <div class="stat-box" data-module="${row.key}" data-type="avg100">
          <div class="stat-label">Promedio</div>
          <div class="stat-value">${last100Stats.display}</div>
          <div class="stat-detail">${last100Stats.detail}</div>
        </div>
      </div>
    `;
    
    // Click en el card para seleccionar módulo
    card.addEventListener('click', (e) => {
      // No activar si se clickeó una stat-box
      if (e.target.closest('.stat-box')) return;
      
      [...moduleList.children].forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      currentModule = row.key;
      startBtn.disabled = false;
    });
    
    moduleList.appendChild(card);
  });
  
  // Event listeners para las stat-boxes
  document.querySelectorAll('.stat-box').forEach(box => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const module = box.dataset.module;
      const type = box.dataset.type;
      showStatsDetail(module, type);
    });
  });

  startBtn.addEventListener('click', startQuiz);
  restartBtn.addEventListener('click', restart);
  nextBtn.addEventListener('click', nextQuestion);
  backToStartBtn.addEventListener('click', () => {
    statsDetailScreen.style.display = 'none';
    startScreen.style.display = 'block';
  });
  numSel.addEventListener('change', e => batchSize = e.target.value==='all' ? 'all' : parseInt(e.target.value,10));
  soundChk.addEventListener('change', e=> soundEnabled = e.target.checked);
}

function moduleDescription(name) {
  if (name.includes('Aspectos Generales')) return 'conceptos base, contrato, autoridades, sanciones, PLD/FT';
  if (name.includes('Riesgos Individuales de Seguro de Daños')) return 'autos, hogar, RC, exclusiones, siniestros';
  if (name.includes('Riesgos Individuales de Seguro de Personas')) return 'vida, GM, accidentes, bases técnicas, beneficios';
  if (name.includes('Sistema y Mercados Financieros')) return 'sistema financiero, mercado de valores, tasas e instrumentos';
  return '';
}

// === Estadísticas ===
function historyKey(module){ return `qp_hist_${module}`; }
function seenKey(module){ return `qp_seen_${module}`; }
function lastSessionKey(module){ return `qp_last_session_${module}`; }

function pushHistory(module, entry) {
  const key = historyKey(module);
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.unshift(entry);
  const trimmed = arr.slice(0,100);
  localStorage.setItem(key, JSON.stringify(trimmed));
}

function getLastSessionStats(module) {
  const data = JSON.parse(localStorage.getItem(lastSessionKey(module)) || 'null');
  if (!data) return { display: '—', pct: null };
  const pct = Math.round((data.correct / data.total) * 100);
  return { display: `${pct}%`, pct, data };
}

function getLast100Stats(module) {
  const hist = JSON.parse(localStorage.getItem(historyKey(module)) || '[]');
  if (hist.length === 0) return { display: '—', detail: '', pct: null };
  
  const count = Math.min(hist.length, 100);
  const relevant = hist.slice(0, count);
  const correct = relevant.filter(h => h.correct).length;
  const pct = Math.round((correct / count) * 100);
  
  const detail = count < 100 ? `últimas ${count}` : 'últimas 100';
  
  return { 
    display: `${pct}%`, 
    detail, 
    pct,
    count,
    correct
  };
}

function getStatsBySubtopic(module, type) {
  let entries = [];
  
  if (type === 'last') {
    // Última sesión
    const data = JSON.parse(localStorage.getItem(lastSessionKey(module)) || 'null');
    if (!data || !data.details) return {};
    entries = data.details;
  } else {
    // Últimas 100
    const hist = JSON.parse(localStorage.getItem(historyKey(module)) || '[]');
    entries = hist.slice(0, 100);
  }
  
  const by = {};
  entries.forEach(e => {
    const sub = e.subtopic || 'General';
    if (!by[sub]) by[sub] = { correct: 0, total: 0 };
    by[sub].total += 1;
    by[sub].correct += e.correct ? 1 : 0;
  });
  
  return by;
}

function showStatsDetail(module, type) {
  const moduleInfo = QUESTIONS_INDEX.modules.find(m => m.key === module);
  const typeLabel = type === 'last' ? 'Última sesión' : 'Últimas 100 preguntas';
  
  statsModuleName.textContent = `${moduleInfo.title} - ${typeLabel}`;
  
  const lastStats = getStatsBySubtopic(module, 'last');
  const avg100Stats = getStatsBySubtopic(module, 'avg100');
  
  // Obtener todos los subtemas que aparecen en cualquiera de las dos
  const allSubtopics = new Set([
    ...Object.keys(lastStats),
    ...Object.keys(avg100Stats)
  ]);
  
  let tableHTML = `
    <table class="stats-table">
      <thead>
        <tr>
          <th>Subtema</th>
          <th>Última sesión</th>
          <th>Últimas 100</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  [...allSubtopics].sort().forEach(sub => {
    const last = lastStats[sub] || { correct: 0, total: 0 };
    const avg = avg100Stats[sub] || { correct: 0, total: 0 };
    
    const lastPct = last.total > 0 ? Math.round((last.correct / last.total) * 100) : 0;
    const avgPct = avg.total > 0 ? Math.round((avg.correct / avg.total) * 100) : 0;
    
    const lastDisplay = last.total > 0 ? `${last.correct}/${last.total} (${lastPct}%)` : '—';
    const avgDisplay = avg.total > 0 ? `${avg.correct}/${avg.total} (${avgPct}%)` : '—';
    
    const lastClass = lastPct >= 80 ? 'perf-good' : lastPct >= 60 ? 'perf-ok' : lastPct > 0 ? 'perf-bad' : '';
    const avgClass = avgPct >= 80 ? 'perf-good' : avgPct >= 60 ? 'perf-ok' : avgPct > 0 ? 'perf-bad' : '';
    
    tableHTML += `
      <tr>
        <td>${sub}</td>
        <td class="${lastClass}">${lastDisplay}</td>
        <td class="${avgClass}">${avgDisplay}</td>
      </tr>
    `;
  });
  
  tableHTML += `
      </tbody>
    </table>
  `;
  
  statsTableContainer.innerHTML = tableHTML;
  
  startScreen.style.display = 'none';
  statsDetailScreen.style.display = 'block';
}

function subtopicStats(module) {
  const arr = JSON.parse(localStorage.getItem(historyKey(module)) || '[]');
  const by = {};
  arr.forEach(e=>{
    const k = e.subtopic || 'General';
    if(!by[k]) by[k] = {correct:0,total:0};
    by[k].total += 1;
    by[k].correct += e.correct ? 1 : 0;
  });
  const stats = Object.entries(by).map(([sub, v]) => {
    const acc = v.total ? (v.correct/v.total) : 0.0;
    const w = 0.3 + (1.0 - acc) * 0.7;
    return { subtopic: sub, total: v.total, accuracy: acc, weight: w };
  });
  return stats;
}

// === Selección del lote ===
function nextBatchFromModule(module, size) {
  const pool = (QUESTIONS_ALL[module] || []).slice();
  const seen = new Set(JSON.parse(localStorage.getItem(seenKey(module)) || '[]'));
  let candidates = pool.filter(q => !seen.has(q.id));

  if (candidates.length === 0) {
    localStorage.setItem(seenKey(module), JSON.stringify([]));
    candidates = pool.slice();
  }

  const stats = subtopicStats(module);
  const wBySub = Object.fromEntries(stats.map(s => [s.subtopic, s.weight]));
  const defaultW = 0.6;

  shuffle(candidates);
  const N = size === 'all' ? candidates.length : Math.min(size, candidates.length);
  const take = [];
  const perSubCount = {};
  let guard = 0;
  while (take.length < N && guard < 5000) {
    guard++;
    const pick = weightedPick(candidates, q => (wBySub[q.subtopic] ?? defaultW));
    if (!pick) break;
    const limit = Math.ceil(N/2);
    if ((perSubCount[pick.subtopic] || 0) >= limit) continue;
    take.push(pick);
    perSubCount[pick.subtopic] = (perSubCount[pick.subtopic] || 0) + 1;
    candidates = candidates.filter(x => x.id !== pick.id);
  }

  while (take.length < N && candidates.length) {
    take.push(candidates.pop());
  }

  const newSeen = new Set(JSON.parse(localStorage.getItem(seenKey(module)) || '[]'));
  take.forEach(q => newSeen.add(q.id));
  localStorage.setItem(seenKey(module), JSON.stringify(Array.from(newSeen)));

  return shuffle(take).map(q => shuffleOptions(q));
}

function weightedPick(arr, weightFn) {
  if (!arr.length) return null;
  const weights = arr.map(weightFn);
  const sum = weights.reduce((a,b)=>a+b,0);
  if (sum <= 0) return arr[Math.floor(Math.random()*arr.length)];
  let r = Math.random()*sum;
  for (let i=0;i<arr.length;i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length-1];
}

// === Quiz Flow ===
function startQuiz() {
  if (!currentModule) return;
  score = {correct:0, incorrect:0};
  qIndex = 0;
  answered = false;
  batchSize = (numSel.value==='all') ? 'all' : parseInt(numSel.value || '20',10);

  sessionQuestions = nextBatchFromModule(currentModule, batchSize);

  startScreen.style.display = 'none';
  questionScreen.style.display = 'block';
  renderQuestion();
}

function renderQuestion() {
  const q = sessionQuestions[qIndex];
  counterText.textContent = `Pregunta ${qIndex+1} de ${sessionQuestions.length}`;
  questionText.textContent = q.question;
  subtopicText.textContent = q.subtopic || '';
  subtopicText.style.display = q.subtopic ? 'inline-block' : 'none';

  difficultyBadge.textContent = difficultyLabel(q.difficulty);
  difficultyBadge.className = 'difficulty-badge ' + difficultyClass(q.difficulty);

  const pct = (qIndex / sessionQuestions.length) * 100;
  progressFill.style.width = `${pct}%`;

  optionsWrap.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('div');
    btn.className = 'option';
    btn.textContent = opt;
    btn.addEventListener('click', () => onSelect(idx));
    optionsWrap.appendChild(btn);
  });

  feedbackBox.textContent = '';
  feedbackBox.className = 'feedback';
  nextBtn.disabled = true;
  selectedIdx = null;
  answered = false;

  correctCount.textContent = score.correct;
  incorrectCount.textContent = score.incorrect;
}

function difficultyLabel(d) {
  if (d==='basic') return 'Básica';
  if (d==='intermediate') return 'Media';
  if (d==='advanced') return 'Difícil';
  return d || '';
}
function difficultyClass(d) {
  if (d==='basic') return 'diff-basic';
  if (d==='intermediate') return 'diff-intermediate';
  if (d==='advanced') return 'diff-advanced';
  return 'diff-basic';
}

function onSelect(idx) {
  if (answered) return;
  selectedIdx = idx;
  [...optionsWrap.children].forEach((el,i) => {
    el.classList.toggle('selected', i===idx);
  });
  submitAnswer();
}

function submitAnswer() {
  const q = sessionQuestions[qIndex];
  if (selectedIdx==null) return;

  answered = true;
  const isCorrect = (selectedIdx === q.correct);
  score[isCorrect ? 'correct' : 'incorrect']++;

  [...optionsWrap.children].forEach((el,i)=>{
    el.classList.remove('selected');
    if (i===q.correct) el.classList.add('correct');
    if (i===selectedIdx && !isCorrect) el.classList.add('incorrect');
    el.classList.add('disabled');
  });

  feedbackBox.textContent = (isCorrect ? '¡Correcto! ' : 'Respuesta incorrecta. ') + (q.explanation || '');
  feedbackBox.className = 'feedback ' + (isCorrect ? 'correct' : 'incorrect');

  if (soundEnabled) {
    if (isCorrect) playCorrectSound(); else playIncorrectSound();
  }

  pushHistory(currentModule, {
    id: q.id,
    subtopic: q.subtopic || 'General',
    difficulty: q.difficulty || 'basic',
    correct: isCorrect,
    ts: Date.now()
  });

  nextBtn.disabled = false;

  correctCount.textContent = score.correct;
  incorrectCount.textContent = score.incorrect;
}

function nextQuestion() {
  if (qIndex < sessionQuestions.length - 1) {
    qIndex++;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  questionScreen.style.display = 'none';
  endScreen.style.display = 'block';
  const total = sessionQuestions.length;
  const pct = Math.round((score.correct/total)*100);
  finalScore.textContent = `${pct}%`;
  performanceMessage.textContent = performanceText(pct);

  // Guardar última sesión
  const sessionDetails = [];
  const lastIds = new Set(sessionQuestions.map(q=>q.id));
  const hist = JSON.parse(localStorage.getItem(historyKey(currentModule)) || '[]');
  hist.filter(h=>lastIds.has(h.id)).forEach(h => sessionDetails.push(h));
  
  localStorage.setItem(lastSessionKey(currentModule), JSON.stringify({
    correct: score.correct,
    total: total,
    pct: pct,
    ts: Date.now(),
    details: sessionDetails
  }));

  // Detailed results by subtopic from this session
  const agg = {};
  sessionDetails.forEach(h => {
    const s = h.subtopic || 'General';
    if(!agg[s]) agg[s]={correct:0,total:0};
    agg[s].total += 1;
    agg[s].correct += h.correct ? 1 : 0;
  });

  detailedResults.innerHTML = '';
  Object.entries(agg).forEach(([sub,v])=>{
    const p = v.total? Math.round((v.correct/v.total)*100) : 0;
    const row = document.createElement('div');
    row.textContent = `${sub}: ${v.correct}/${v.total} (${p}%)`;
    detailedResults.appendChild(row);
  });
}

function restart() {
  endScreen.style.display = 'none';
  startScreen.style.display = 'block';
  // Re-render modules para actualizar las estadísticas
  renderModules(QUESTIONS_INDEX.modules);
}

// === Beeps ===
function createBeep(f, d, type='sine') {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = f; osc.type = type;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + d);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + d);
  } catch(e){}
}
function playCorrectSound() {
  createBeep(523, 0.15);
  setTimeout(()=>createBeep(659, 0.15), 100);
  setTimeout(()=>createBeep(784, 0.2), 200);
}
function playIncorrectSound() {
  createBeep(400, 0.15);
  setTimeout(()=>createBeep(350, 0.15), 100);
  setTimeout(()=>createBeep(300, 0.2), 200);
}

// === Boot ===
document.addEventListener('DOMContentLoaded', loadAll);

function performanceText(p){ 
  if(p>=90) return "¡Excelente!"; 
  if(p>=75) return "¡Muy bien!"; 
  if(p>=60) return "Vas por buen camino"; 
  return "A repasar los subtemas débiles";
}
