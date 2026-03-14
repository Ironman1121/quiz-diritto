import React, { useState, useEffect } from 'react';

const COLORS = ['#8C6D23', '#243B55', '#4B1D52', '#2D4A22'];
const SHAPES = ['❖', '✦', '✧', '❂'];

export default function PlayerView({ socket }) {
  const [name, setName] = useState('');
  const [step, setStep] = useState('name'); // name, waiting
  const [gameState, setGameState] = useState(null);
  const [myAnswer, setMyAnswer] = useState(null);

  useEffect(() => {
    socket.on('game_state_update', (state) => {
      setGameState(state);
    });
    socket.emit('request_state');
    return () => {
      socket.off('game_state_update');
    };
  }, [socket]);

  useEffect(() => {
    if (gameState && gameState.status === 'question' && myAnswer !== null) {
        setMyAnswer(null);
    }
  }, [gameState?.currentQuestionIndex, gameState?.status]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      socket.emit('join_game', { name });
      setStep('waiting');
    }
  };

  const submitAnswer = (index) => {
    if (myAnswer === null) {
      setMyAnswer(index);
      socket.emit('submit_answer', index);
    }
  };

  if (step === 'name') {
    return (
      <div className="player-join glass-panel elegant-panel">
        <h1 className="title-animate">Tribunale</h1>
        <p className="subtitle elegant-subtitle">Identificati per la seduta</p>
        <form onSubmit={handleNameSubmit} className="join-form">
          <input 
            type="text" 
            placeholder="Nome per il Processo" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            maxLength={15}
            required 
            className="input-name"
          />
          <button type="submit" className="btn btn-join elegant-btn">Procedi</button>
        </form>
      </div>
    );
  }

  if (!gameState) return <div className="loader"></div>;

  const me = gameState.players.find(p => p.name === name);

  if (gameState.status !== 'lobby' && step === 'waiting' && me) {
      // Continue
  } else if (step === 'waiting') {
    return (
      <div className="player-waiting">
        <h2>In Custodia 🏛️</h2>
        <p>In attesa che l'udienza abbia inizio, {name}.</p>
        <div className="loader"></div>
      </div>
    );
  }

  if (gameState.status === 'lobby') {
    return (
      <div className="player-waiting">
        <h2>In Attesa di Sentenza ⚖️</h2>
        <p>L'udienza inizierà a breve, {name}.</p>
        <div className="loader"></div>
      </div>
    );
  }

  if (gameState.status === 'question') {
    if (myAnswer !== null) {
      return (
        <div className="question-ui-container">
          <div className="player-waiting question-wait">
            <h2>Deposizione Registrata 🖋️</h2>
            <p>La Giuria sta deliberando...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="player-question">
        <div className="status-bar">
          <span>Capo d'Imputazione: {gameState.currentQuestionIndex + 1}/{gameState.totalQuestions}</span>
        </div>
        <div className="options-grid-mobile">
          {gameState.currentQuestion?.options.map((opt, i) => (
            <button 
              key={i} 
              className="option-btn-mobile" 
              style={{ backgroundColor: COLORS[i] }}
              onClick={() => submitAnswer(i)}
            >
              <span className="shape">{SHAPES[i]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (gameState.status === 'reveal') {
    const isCorrect = me?.answeredCorrectly;
    return (
      <div className="player-reveal">
        <h1 className={isCorrect ? 'text-gold' : 'text-crimson'}>
            {isCorrect ? '✨ Innocente!' : '⛓️ Colpevole!'}
        </h1>
        <div className="waiting-next">Prossimo capo d'accusa in arrivo...</div>
      </div>
    );
  }

  if (gameState.status === 'podium') {
    return (
      <div className="player-podium glass-panel">
        <h1 className="title-animate">Verdetto Finale</h1>
        <h2>Il tuo onore:</h2>
        <div className="final-score">{me?.score || 0} pt</div>
        <p>Guarda lo schermo per la proclamazione ufficiale!</p>
      </div>
    );
  }

  return <div className="loader"></div>;
}
