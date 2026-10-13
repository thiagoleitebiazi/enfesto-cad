import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

const elemento = document.getElementById('root');
if (!elemento) {
  throw new Error('Elemento #root não encontrado em index.html.');
}

createRoot(elemento).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Montada a interface e desenhados os primeiros quadros, avisa o processo principal: fica no diagnóstico da abertura.
requestAnimationFrame(() => requestAnimationFrame(() => window.enfestoCad?.avisarInterfacePronta()));
