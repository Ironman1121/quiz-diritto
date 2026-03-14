const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const path = require('path');
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend/dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const questions = require('./questions.json');

// Game State
let gameState = {
  status: 'lobby', // lobby, question, reveal, podium
  players: {}, // socketId -> { name, score, currentAnswer, answeredCorrectly, history: [] }
  currentQuestionIndex: -1,
  timeRemaining: 20,
  hostId: null,
};

let timerInterval = null;

const TIME_PER_QUESTION = 20;

function emitState() {
  io.emit('game_state_update', {
    status: gameState.status,
    players: Object.values(gameState.players).map(p => ({
      name: p.name,
      score: p.score,
      answeredCorrectly: p.answeredCorrectly,
      hasAnswered: p.currentAnswer !== null
    })),
    currentQuestionIndex: gameState.currentQuestionIndex,
    currentQuestion: gameState.currentQuestionIndex >= 0 && gameState.currentQuestionIndex < questions.length 
      ? { ...questions[gameState.currentQuestionIndex], correctIndex: gameState.status === 'reveal' ? questions[gameState.currentQuestionIndex].correctIndex : null } 
      : null,
    timeRemaining: gameState.timeRemaining,
    totalQuestions: questions.length
  });
}

function startTimer() {
  clearInterval(timerInterval);
  gameState.timeRemaining = TIME_PER_QUESTION;
  
  timerInterval = setInterval(() => {
    gameState.timeRemaining--;
    io.emit('timer_update', gameState.timeRemaining);
    
    if (gameState.timeRemaining <= 0) {
      clearInterval(timerInterval);
      revealAnswer();
    }
  }, 1000);
}

function revealAnswer() {
  gameState.status = 'reveal';
  const q = questions[gameState.currentQuestionIndex];
  
  // Calculate scores
  for (let id in gameState.players) {
    const p = gameState.players[id];
    if (p.currentAnswer === q.correctIndex) {
      p.score += 1000 + (gameState.timeRemaining * 10); // Bonus for speed
      p.answeredCorrectly = true;
    } else {
      p.answeredCorrectly = false;
    }
    // Salva nella cronologia (true = corretto, false = sbagliato, null = non risposto)
    p.history[gameState.currentQuestionIndex] = p.answeredCorrectly;
  }
  
  // Salva cronologia su file (opzionale, come richiesto)
  try {
    const historyData = {
      timestamp: new Date().toISOString(),
      questionIndex: gameState.currentQuestionIndex,
      questionText: questions[gameState.currentQuestionIndex].text,
      results: Object.values(gameState.players).map(p => ({
        name: p.name,
        correct: p.answeredCorrectly,
        score: p.score
      }))
    };
    fs.appendFileSync(path.join(__dirname, 'history.log'), JSON.stringify(historyData) + '\n');
  } catch (err) {
    console.error('Errore nel salvataggio della history:', err);
  }
  
  emitState();
}

function shuffleAnswers() {
  questions.forEach(q => {
    const correctAnswerText = q.options[q.correctIndex];
    // Shuffle options using Fisher-Yates
    for (let i = q.options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
    }
    // Update correctIndex to the new position of the correct text
    q.correctIndex = q.options.indexOf(correctAnswerText);
  });
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Send current state
  socket.emit('game_state_update', {
    ...gameState,
    players: Object.values(gameState.players)
  });

  socket.on('request_state', () => {
    socket.emit('game_state_update', {
      status: gameState.status,
      players: Object.values(gameState.players).map(p => ({
        name: p.name,
        score: p.score,
        answeredCorrectly: p.answeredCorrectly,
        hasAnswered: p.currentAnswer !== null
      })),
      currentQuestionIndex: gameState.currentQuestionIndex,
      currentQuestion: gameState.currentQuestionIndex >= 0 && gameState.currentQuestionIndex < questions.length 
        ? { ...questions[gameState.currentQuestionIndex], correctIndex: gameState.status === 'reveal' ? questions[gameState.currentQuestionIndex].correctIndex : null } 
        : null,
      timeRemaining: gameState.timeRemaining,
      totalQuestions: questions.length
    });
  });

  socket.on('register_host', () => {
    gameState.hostId = socket.id;
    socket.emit('host_registered');
    console.log('Host registered');
  });

  socket.on('join_game', (data) => {
    let name = '';
    let avatar = null;
    
    if (typeof data === 'object' && data !== null) {
      name = data.name;
      avatar = data.avatar;
    } else {
      name = data; // Assume data is the name string if not an object
    }

    if (!name) {
      socket.emit('error', 'Player name cannot be empty.');
      return;
    }

    // Check if name already exists
    if (Object.values(gameState.players).some(p => p.name === name)) {
      socket.emit('error', 'Player with this name already exists.');
      return;
    }

    if (gameState.status !== 'lobby') {
      socket.emit('error', 'Game already in progress');
      return;
    }
    
    gameState.players[socket.id] = {
      name,
      avatar, // { face, hat, accessory }
      score: 0,
      currentAnswer: null,
      answeredCorrectly: null,
      history: new Array(questions.length).fill(null)
    };
    emitState();
  });

  socket.on('start_game', () => {
    if (socket.id !== gameState.hostId) return;
    shuffleAnswers(); // Shuffle when game starts
    gameState.currentQuestionIndex = 0;
    gameState.status = 'question';
    for (let id in gameState.players) {
        gameState.players[id].currentAnswer = null;
        gameState.players[id].answeredCorrectly = null;
    }
    startTimer();
    emitState();
  });

  socket.on('next_question', () => {
    if (socket.id !== gameState.hostId) return;
    
    if (gameState.currentQuestionIndex < questions.length - 1) {
      gameState.currentQuestionIndex++;
      gameState.status = 'question';
      
      for (let id in gameState.players) {
        gameState.players[id].currentAnswer = null;
        gameState.players[id].answeredCorrectly = null;
      }
      
      startTimer();
      emitState();
    } else {
      gameState.status = 'podium';
      emitState();
    }
  });

  socket.on('submit_answer', (answerIndex) => {
    if (gameState.status !== 'question') return;
    const player = gameState.players[socket.id];
    if (player && player.currentAnswer === null) {
      player.currentAnswer = answerIndex;
      emitState(); // update host view to show player has answered
    }
  });

  // Host forza la fine del tempo → passa subito al reveal
  socket.on('force_reveal', () => {
    if (socket.id !== gameState.hostId) return;
    if (gameState.status !== 'question') return;
    clearInterval(timerInterval);
    revealAnswer();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
      emitState();
    }
    if (socket.id === gameState.hostId) {
      gameState.hostId = null;
    }
  });
});

// PDF Generation Endpoint
app.get('/api/report', (req, res) => {
  const doc = new PDFDocument();
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Risultati_Quiz_Doveri_Lavoratore.pdf');
  
  doc.pipe(res);
  
  doc.fontSize(25).text('Risultati Quiz: Doveri del Lavoratore', { align: 'center' });
  doc.moveDown();
  
  const sortedPlayers = Object.values(gameState.players).sort((a, b) => b.score - a.score);
  
  doc.fontSize(16).text('Classifica Finale:', { underline: true });
  doc.moveDown();
  
  sortedPlayers.forEach((p, index) => {
    doc.fontSize(14).text(`${index + 1}. ${p.name} - ${p.score} pt`);
  });

  doc.addPage();
  doc.fontSize(20).text('Dettaglio Risposte per Domanda', { align: 'center', underline: true });
  doc.moveDown();

  questions.forEach((q, qIndex) => {
    doc.fontSize(14).fillColor('black').text(`Domanda ${qIndex + 1}: ${q.text}`, { bold: true });
    doc.fontSize(11).text(`Risposta corretta: ${q.options[q.correctIndex]}`);
    doc.moveDown(0.5);

    Object.values(gameState.players).forEach(p => {
      const result = p.history[qIndex];
      const statusText = result === true ? 'CORRETTO' : result === false ? 'SBAGLIATO' : 'NON RISPOSTO';
      const color = result === true ? 'green' : result === false ? 'red' : 'gray';
      
      doc.fillColor(color).text(`  - ${p.name}: ${statusText}`);
    });
    
    doc.moveDown();
    if (doc.y > 650) doc.addPage(); // Evita di tagliare a metà una domanda
  });
  
  doc.end();
});

// React Router fallback (must be after all API routes)
// React Router fallback (must be after all API routes)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
