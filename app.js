// Variables globales
let questionDatabase = {};
let currentModule = '';
let currentQuestions = [];
let currentQuestionIndex = 0;
let selectedOption = null;
let score = { correct: 0, incorrect: 0 };
let answered = false;
let soundEnabled = true;
let numQuestionsToShow = 20;

// Elementos del DOM
const loadingScreen = document.getElementById('loadingScreen');
const errorScreen = document.getElementById('errorScreen');
const startScreen = document.getElementById('startScreen');
const questionScreen = document.getElementById('questionScreen');
const endScreen = document.getElementById('endScreen');
const moduleOptions = document.querySelectorAll('.module-option');
const startBtn = document.getElementById('startBtn');
const questionCounter = document.getElementById('questionCounter');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const feedback = document.getElementById('feedback');
const nextBtn = document.getElementById('nextBtn');
const correctCount = document.getElementById('correctCount');
const incorrectCount = document.getElementById('incorrectCount');
const progressFill = document.getElementById('progressFill');
const finalScore = document.getElementById('finalScore');
const performanceMessage = document.getElementById('performanceMessage');
const detailedResults = document.getElementById('detailedResults');
const restartBtn = document.getElementById('restartBtn');
const numQuestionsSelect = document.getElementById('numQuestions');
const soundEnabledCheckbox = document.getElementById('soundEnabled');

// Cargar base de datos de preguntas
async function loadQuestions() {
    try {
        const response = await fetch('questions.json');
        if (!response.ok) {
            throw new Error('No se pudo cargar el archivo de preguntas');
        }
        questionDatabase = await response.json();
        
        // Actualizar contadores de preguntas
        document.getElementById('module1-count').textContent = 
            `${questionDatabase['teoria-riesgo'].length} preguntas sobre conceptos básicos, tipos de riesgo, agentes y regulación`;
        document.getElementById('module2-count').textContent = 
            `${questionDatabase['riesgos-individuales'].length} preguntas sobre vida individual, planes básicos, beneficios adicionales, accidentes personales, gastos médicos y salud`;
        document.getElementById('module3-count').textContent = 
            `${questionDatabase['sistema-financiero'].length} preguntas sobre teoría de finanzas, conceptos básicos, matemáticas financieras e instrumentos financieros`;
        
        // Mostrar pantalla de inicio
        loadingScreen.style.display = 'none';
        startScreen.style.display = 'block';
        
        setupEventListeners();
    } catch (error) {
        console.error('Error cargando preguntas:', error);
        loadingScreen.style.display = 'none';
        errorScreen.style.display = 'block';
    }
}

// Configurar event listeners
function setupEventListeners() {
    moduleOptions.forEach(option => {
        option.addEventListener('click', () => {
            moduleOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            currentModule = option.dataset.module;
            startBtn.disabled = false;
        });
    });

    startBtn.addEventListener('click', startQuiz);
    nextBtn.addEventListener('click', nextQuestion);
    restartBtn.addEventListener('click', restart);

    numQuestionsSelect.addEventListener('change', (e) => {
        numQuestionsToShow = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
    });

    soundEnabledCheckbox.addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
    });
}

// Generar sonidos sintéticos
function createBeep(frequency, duration, type = 'sine') {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        console.log('Audio no disponible');
    }
}

function playCorrectSound() {
    createBeep(523, 0.15);
    setTimeout(() => createBeep(659, 0.15), 100);
    setTimeout(() => createBeep(784, 0.2), 200);
}

function playIncorrectSound() {
    createBeep(400, 0.15);
    setTimeout(() => createBeep(350, 0.15), 100);
    setTimeout(() => createBeep(300, 0.2), 200);
}

function showAnimation(isCorrect) {
    const animation = document.createElement('div');
    animation.className = `animation-overlay ${isCorrect ? 'check-mark' : 'x-mark'}`;
    animation.textContent = isCorrect ? '✓' : '✗';
    document.body.appendChild(animation);
    
    setTimeout(() => {
        document.body.removeChild(animation);
    }, 800);
}

function startQuiz() {
    if (!currentModule) return;

    let allQuestions = [...questionDatabase[currentModule]];
    shuffleArray(allQuestions);
    
    if (numQuestionsToShow === 'all') {
        currentQuestions = allQuestions;
    } else {
        currentQuestions = allQuestions.slice(0, Math.min(numQuestionsToShow, allQuestions.length));
    }
    
    currentQuestionIndex = 0;
    score = { correct: 0, incorrect: 0 };
    
    startScreen.style.display = 'none';
    questionScreen.style.display = 'block';
    
    showQuestion();
}

function showQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    
    questionCounter.textContent = `Pregunta ${currentQuestionIndex + 1} de ${currentQuestions.length}`;
    questionText.textContent = question.question;

    // Mostrar subtema si existe
    const subtopicElement = document.getElementById('subtopicText');
    if (question.subtopic) {
        subtopicElement.textContent = question.subtopic;
        subtopicElement.style.display = 'block';
    } else {
        subtopicElement.style.display = 'none';
    }
    
    const progress = ((currentQuestionIndex) / currentQuestions.length) * 100;
    progressFill.style.width = progress + '%';
    
    optionsContainer.innerHTML = '';
    const shuffledOptions = [...question.options];
    const correctAnswer = question.options[question.correct];
    shuffleArray(shuffledOptions);
    const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
    
    shuffledOptions.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.addEventListener('click', () => selectOption(index, optionElement, newCorrectIndex));
        optionsContainer.appendChild(optionElement);
    });
    
    selectedOption = null;
    answered = false;
    nextBtn.disabled = true;
    feedback.style.display = 'none';
    
    correctCount.textContent = score.correct;
    incorrectCount.textContent = score.incorrect;
}

function selectOption(index, element, correctIndex) {
    if (answered) return;
    
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    element.classList.add('selected');
    selectedOption = index;
    nextBtn.disabled = false;
    element.dataset.correctIndex = correctIndex;
}

function nextQuestion() {
    if (selectedOption === null) return;
    
    // Si ya se respondió esta pregunta, avanzar a la siguiente
    if (answered) {
        currentQuestionIndex++;
        showQuestion();
        return;
    }
    
    const correctIndex = parseInt(document.querySelector('.option.selected').dataset.correctIndex);
    const isCorrect = selectedOption === correctIndex;
    
    const options = document.querySelectorAll('.option');
    options.forEach((opt, index) => {
        opt.classList.add('disabled');
        if (index === correctIndex) {
            opt.classList.add('correct');
        } else if (index === selectedOption && !isCorrect) {
            opt.classList.add('incorrect');
        }
    });
    
    feedback.style.display = 'block';
    if (isCorrect) {
        feedback.className = 'feedback correct';
        feedback.textContent = '¡Correcto! Excelente trabajo.';
        score.correct++;
        if (soundEnabled) playCorrectSound();
        showAnimation(true);
    } else {
        feedback.className = 'feedback incorrect';
        feedback.textContent = `Incorrecto. La respuesta correcta es: ${options[correctIndex].textContent}`;
        score.incorrect++;
        if (soundEnabled) playIncorrectSound();
        showAnimation(false);
    }
    
    answered = true;
    correctCount.textContent = score.correct;
    incorrectCount.textContent = score.incorrect;
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
        nextBtn.textContent = 'Siguiente';
    } else {
        nextBtn.textContent = 'Ver Resultados';
        nextBtn.onclick = showResults;
    }
}

function showResults() {
    const totalQuestions = currentQuestions.length;
    const percentage = Math.round((score.correct / totalQuestions) * 100);
    
    questionScreen.style.display = 'none';
    endScreen.style.display = 'block';
    
    finalScore.textContent = `${percentage}%`;
    
    let performanceClass = '';
    let message = '';
    
    if (percentage >= 90) {
        performanceClass = 'performance-excellent';
        message = '¡Excelente! Dominas muy bien el tema.';
    } else if (percentage >= 70) {
        performanceClass = 'performance-good';
        message = '¡Buen trabajo! Tienes un conocimiento sólido.';
    } else {
        performanceClass = 'performance-needs-improvement';
        message = 'Necesitas repasar más. ¡Sigue practicando!';
    }
    
    performanceMessage.className = `performance-message ${performanceClass}`;
    performanceMessage.textContent = message;
    
    detailedResults.textContent = `Respondiste correctamente ${score.correct} de ${totalQuestions} preguntas.`;
    
    progressFill.style.width = '100%';
}

function restart() {
    currentModule = '';
    currentQuestions = [];
    currentQuestionIndex = 0;
    selectedOption = null;
    score = { correct: 0, incorrect: 0 };
    answered = false;
    
    endScreen.style.display = 'none';
    startScreen.style.display = 'block';
    
    moduleOptions.forEach(opt => opt.classList.remove('selected'));
    startBtn.disabled = true;
    nextBtn.textContent = 'Siguiente';
    nextBtn.onclick = nextQuestion;
    progressFill.style.width = '0%';
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Inicializar aplicación
loadQuestions();
