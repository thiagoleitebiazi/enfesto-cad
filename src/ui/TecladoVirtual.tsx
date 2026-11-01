import { useState } from 'react';
import { confirmarCampo, digitarNoCampo, irAoProximoCampo } from './digitarNoCampo';

const LINHAS = ['1234567890', 'qwertyuiop', 'asdfghjklç', 'zxcvbnm,.-', 'áéíóúâêôãõ'] as const;

interface TecladoVirtualProps {
  readonly onFechar: () => void;
}

/** O teclado na tela (ADR 0211), para a mesa sem teclado: fica por cima de tudo e não tira o foco do campo. */
export function TecladoVirtual(props: TecladoVirtualProps): React.JSX.Element {
  const [maiusculas, setMaiusculas] = useState(false);
  const tecla = (rotulo: string, nome: string, fazer: () => void, classe = ''): React.JSX.Element => (
    <button key={nome} type="button" tabIndex={-1} className={classe} aria-label={nome} onMouseDown={(e) => e.preventDefault()} onClick={fazer}>
      {rotulo}
    </button>
  );
  const digitar = (texto: string) => (): void => void digitarNoCampo(document.activeElement, texto);
  return (
    <div className="teclado-virtual" role="group" aria-label="Teclado virtual">
      {LINHAS.map((linha) => (
        <div key={linha}>
          {[...linha].map((c) => {
            const letra = maiusculas ? c.toUpperCase() : c;
            return tecla(letra, letra, digitar(letra));
          })}
        </div>
      ))}
      <div>
        {tecla('Maiúsculas', 'Maiúsculas', () => setMaiusculas((v) => !v), maiusculas ? 'ativa' : '')}
        {tecla('Espaço', 'Espaço', digitar(' '), 'larga')}
        {tecla('Apagar', 'Apagar', digitar('apagar'))}
        {tecla('Tab', 'Tab', () => irAoProximoCampo(document.activeElement))}
        {tecla('Enter', 'Enter', () => confirmarCampo(document.activeElement))}
        {tecla('Fechar', 'Fechar o teclado', props.onFechar)}
      </div>
    </div>
  );
}
