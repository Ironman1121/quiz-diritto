import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

const COLORS = ['#8C6D23', '#243B55', '#4B1D52', '#2D4A22'];

export default function HostView({ socket, serverUrl }) {
  const [gameState, setGameState] = useState(null);
  const [localTimer, setLocalTimer] = useState(20);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);

  useEffect(() => {
    const handleState = (state) => {
      setGameState(state);
      setLocalTimer(state.timeRemaining);
      if (state.status === 'podium') launchConfetti();
    };
    socket.on('game_state_update', handleState);

    const handleTimer = (t) => setLocalTimer(t);
    socket.on('timer_update', handleTimer);

    socket.emit('request_state');

    return () => {
      socket.off('game_state_update', handleState);
      socket.off('timer_update', handleTimer);
    };
  }, [socket]);

  const launchConfetti = () => {
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0, colors: ['#D4AF37', '#F3E5AB', '#ffffff'] };
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 } });
    }, 250);
  };

  const startGame = () => socket.emit('start_game');
  const nextQuestion = () => socket.emit('next_question');
  const forceReveal = () => socket.emit('force_reveal');

  if (!gameState) return <div className="loader"></div>;

  const { status, players, currentQuestion, totalQuestions, currentQuestionIndex } = gameState;
  const timerUrgent = localTimer <= 5;

  if (status === 'lobby') {
    const joinUrl = `${window.location.origin}${window.location.pathname}${window.location.pathname.endsWith('/') ? '' : '/'}?player`;
    return (
      <div className="host-lobby">
        <header className="lobby-header">
          <h1>💼 Codice del Lavoro</h1>
          <p className="subtitle elegant-subtitle">Il Processo Inizia</p>
        </header>
        <div className="join-methods">
          <div className="qr-container">
            <QRCodeSVG value={joinUrl} size={220} bgColor={"#ffffff"} fgColor={"#0a0a0f"} />
          </div>
          <div className="player-count">
            Cittadini Convocati
            <span>{players.length}</span>
          </div>
        </div>
        <button className="btn btn-start-game" onClick={startGame} disabled={players.length === 0}>
          APRI IL CASO
        </button>
        <div className="players-grid">
          {players.map((p, i) => (
            <div key={i} className="player-badge bounce">
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === 'question' && currentQuestion) {
    const answeredCount = players.filter(p => p.hasAnswered).length;
    return (
      <div className="host-question">
        <div className="question-header">
          <div className="question-number">Domanda {currentQuestionIndex + 1} di {totalQuestions}</div>
          <div className={`timer-circle ${timerUrgent ? 'urgent' : ''}`}>{localTimer}</div>
          <div className="answered-count">{answeredCount} / {players.length} Risposte</div>
        </div>
        <h1 className="question-text">{currentQuestion.text}</h1>
        {currentQuestion.image && (
          <div className="question-image">
            <img src={currentQuestion.image} alt="Question context" />
          </div>
        )}
        <div className="options-grid">
          {currentQuestion.options.map((opt, i) => (
            <div key={i} className="option-card" style={{ backgroundColor: COLORS[i] }}>
              <span className="shape">{['❖', '✦', '✧', '❂'][i]}</span>
              <span className="opt-text">{opt}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-force-reveal" onClick={forceReveal}>
          ⏭ Salta Attesa
        </button>
      </div>
    );
  }

  if (status === 'reveal' && currentQuestion) {
    const correctCount = players.filter(p => p.answeredCorrectly).length;
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
      <div className="host-reveal">
        <h1 className="question-text reveal-question">{currentQuestion.text}</h1>
        <div className="options-grid reveal-mode">
          {currentQuestion.options.map((opt, i) => {
            const isCorrect = i === currentQuestion.correctIndex;
            return (
              <div key={i} className={`option-card ${isCorrect ? 'correct' : 'faded'}`} style={{ backgroundColor: COLORS[i] }}>
                <span className="opt-text">{opt}</span>
                {isCorrect && <span className="check-icon">✨</span>}
              </div>
            );
          })}
        </div>
        <div className="reveal-stats">
          <span className="stat-correct">✅ {correctCount} corretti</span>
          <span className="stat-wrong">❌ {players.length - correctCount} sbagliati</span>
        </div>
        
        <div className="current-results-grid">
          {players.map((p, i) => (
            <div key={i} className={`mini-player-result ${p.answeredCorrectly ? 'res-correct' : 'res-wrong'}`}>
              <span className="res-icon">{p.answeredCorrectly ? '✅' : '❌'}</span>
              <span className="res-name">{p.name}</span>
            </div>
          ))}
        </div>
        <div className="interim-leaderboard">
          <div className="lb-header">
            <h3 className="leaderboard-title">⚖️ Le Sacre Altezze (Top 3)</h3>
            <button className="btn btn-royalty" onClick={() => setShowFullLeaderboard(true)}>
              👑 MOSTRA SENTENZA COMPLETA
            </button>
          </div>
          <NoblePodium top3={sortedPlayers.slice(0, 3)} />
        </div>

        {showFullLeaderboard && (
          <div className="leaderboard-overlay">
            <div className="overlay-content glass-panel">
              <div className="overlay-header">
                <h1 className="title-animate">⚖️ SENTENZA DELLA SUPREMA CORTE ⚖️</h1>
                <button className="btn-close-overlay" onClick={() => setShowFullLeaderboard(false)}>✕</button>
              </div>
              <div className="full-leaderboard-list">
                {sortedPlayers.map((p, i) => (
                  <div key={i} className={`leaderboard-row-full ${p.answeredCorrectly ? 'lb-correct' : 'lb-wrong'}`}>
                    <span className="lb-rank">#{i + 1}</span>
                    <span className="lb-name">{p.name}</span>
                    <span className="lb-score">{p.score} PT</span>
                    <span className="lb-result-icon">{p.answeredCorrectly === true ? '✅' : '❌'}</span>
                  </div>
                ))}
              </div>
              <div className="overlay-footer">
                <button className="btn btn-next" onClick={() => { setShowFullLeaderboard(false); nextQuestion(); }}>
                  PROSEGUI ▶
                </button>
              </div>
            </div>
          </div>
        )}
        <button className="btn btn-next" onClick={nextQuestion}>Prosegui ▶</button>
      </div>
    );
  }

  if (status === 'podium') {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const top3 = sorted.slice(0, 3);
    return (
      <div className="host-podium">
        <h1 className="title-animate">Suprema Corte: Il Verdetto</h1>
        <NoblePodium top3={top3} isFinal={true} />
        <div className="final-leaderboard">
          {sorted.map((p, i) => (
            <div key={i} className="final-row">
              <span className="final-rank">{i + 1}.</span>
              <span className="final-name">{p.name}</span>
              <span className="final-pts">{p.score} pt</span>
            </div>
          ))}
        </div>
        <div className="download-report">
          <a href={`${serverUrl}/api/report`} target="_blank" rel="noreferrer" className="btn btn-download elegant-btn">
            ⚖️ Emetti Sentenza (PDF)
          </a>
        </div>
      </div>
    );
  }
}

function NoblePodium({ top3, isFinal = false }) {
  // Ordiniamo per visualizzazione fisica sul podio: 2°, 1°, 3°
  const displayItems = [
    { rank: 2, player: top3[1], className: 'p-silver' },
    { rank: 1, player: top3[0], className: 'p-gold' },
    { rank: 3, player: top3[2], className: 'p-bronze' }
  ];

  return (
    <div className={`noble-podium ${isFinal ? 'final-podium' : ''}`}>
      {displayItems.map((item, i) => {
        if (!item.player) return <div key={i} className="podium-placeholder"></div>;
        return (
          <div key={i} className={`podium-column ${item.className}`}>
            {item.rank === 1 && <div className="player-aura active"></div>}
            <div className="podium-medal-icon">
              {item.rank === 1 ? '👑' : item.rank === 2 ? '🥈' : '🥉'}
            </div>
            <div className="podium-player-info">
              <span className="p-name">{item.player.name}</span>
              <span className="p-score">{item.player.score} PT</span>
            </div>
            <div className="podium-step"></div>
          </div>
        );
      })}
    </div>
  );
}
