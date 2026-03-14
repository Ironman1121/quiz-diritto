import React, { useMemo } from 'react';
import { io } from 'socket.io-client';
import HostView from './HostView';
import PlayerView from './PlayerView';
import './index.css';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SOCKET_SERVER_URL = isLocal
  ? `http://${window.location.hostname}:3001`
  : 'https://quiz-diritto-production.up.railway.app';

// Se la URL contiene ?player entra direttamente come cittadino (usato dal QR code)
const autoPlayer = new URLSearchParams(window.location.search).has('player');

const socket = io(SOCKET_SERVER_URL);

// Simboli a tema diritto, costituzione, giustizia
const LEGAL_SYMBOLS = ['⚖️','🏛️','📜','🔏','📋','🖋️','🗝️','⚔️','🕊️','👁','🔨','📖','🪶','🏺','🎭'];

function AnimatedBackground() {
  const particles = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      bottom: Math.random() * 100,
      size: Math.random() * 3 + 2,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 15,
      opacity: Math.random() * 0.4 + 0.1,
      // 4 direzioni: su, giù, sinistra, destra
      type: ['up', 'down', 'left', 'right'][i % 4],
    }));
  }, []);

  const symbols = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      symbol: LEGAL_SYMBOLS[i % LEGAL_SYMBOLS.length],
      left: Math.random() * 94 + 3,
      top: Math.random() * 94 + 3,
      size: Math.random() * 1.5 + 0.8,
      duration: Math.random() * 25 + 15,
      delay: Math.random() * 10,
      animType: ['float-symbol', 'drift-symbol', 'orbit-symbol'][i % 3],
      opacity: Math.random() * 0.15 + 0.05,
    }));
  }, []);

  return (
    <div className="animated-bg" aria-hidden="true">
      {/* Nebbia stratificata potenziata */}
      <div className="fog fog-1" />
      <div className="fog fog-2" />
      <div className="fog fog-3" />
      <div className="fog fog-4" />

      {/* Particelle multidirezionali */}
      {particles.map(p => (
        <div
          key={p.id}
          className={`particle p-${p.type}`}
          style={{
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Simboli legali fluttuanti distribuite meglio */}
      {symbols.map(s => (
        <span
          key={s.id}
          className={`floating-symbol ${s.animType}`}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            fontSize: `${s.size}rem`,
            opacity: s.opacity,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        >
          {s.symbol}
        </span>
      ))}
    </div>
  );
}

function App() {
  const [role, setRole] = React.useState(autoPlayer ? 'player' : null);

  const handleHost = () => {
    socket.emit('register_host');
    setRole('host');
  };

  const handlePlayer = () => {
    setRole('player');
  };

  return (
    <>
      <AnimatedBackground />

      {role === 'host' && <HostView socket={socket} serverUrl={SOCKET_SERVER_URL} />}
      {role === 'player' && <PlayerView socket={socket} />}

      {!role && (
        <div className="welcome-screen">
          <div className="glass-panel elegant-panel">
            <div className="crown-icon">⚖️</div>
            <h1 className="title-animate">Doveri del Lavoratore</h1>
            <p className="subtitle elegant-subtitle">La Legge è Uguale per Tutti. Il Quiz ha inizio.</p>
            <div className="role-buttons">
              <button className="btn btn-host elegant-btn" onClick={handleHost}>
                Avvia come Supremazia Giuridica
              </button>
              <button className="btn btn-player elegant-btn" onClick={handlePlayer}>
                Unisciti come Cittadino
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
