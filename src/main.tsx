import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ServidorDeEncaixes } from './ui/ServidorDeEncaixes';
import { aplicarEsquema, esquemaGuardado } from './ui/preferencias';
import './App.css';

// O esquema de cores escolhido (ADR 0177), antes do primeiro desenho.
try {
  aplicarEsquema(esquemaGuardado(window.localStorage), null, document.documentElement);
} catch {
  // Sem o armazenamento do navegador, fica o padrão.
}

const elemento = document.getElementById('root');
if (!elemento) {
  throw new Error('Elemento #root não encontrado em index.html.');
}

// O servidor de encaixes (ADR 0147): o programa aberto com "--servidor-de-encaixes" mostra só a janela dele.
const modoServidor = new URLSearchParams(window.location.search).get('modo') === 'servidor';

createRoot(elemento).render(<StrictMode>{modoServidor ? <ServidorDeEncaixes /> : <App />}</StrictMode>);

// Montada a interface e desenhados os primeiros quadros, avisa o processo principal: fica no diagnóstico da abertura.
requestAnimationFrame(() => requestAnimationFrame(() => window.enfestoCad?.avisarInterfacePronta()));
