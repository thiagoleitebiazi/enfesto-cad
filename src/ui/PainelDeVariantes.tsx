import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import type { Projeto } from '../domain/projeto';

interface PainelDeVariantesProps {
  /** O projeto aberto e as variantes da mesma família, da mais antiga à mais nova. */
  readonly variantes: readonly Projeto[];
  readonly projetoAtualId: string;
  readonly nomeSugerido: string;
  /** Cria a variante a partir do projeto aberto e passa a trabalhar nela; devolve a mensagem de erro, ou `null`. */
  readonly onCriar: (nome: string) => string | null;
  readonly onAbrir: (id: string) => void;
  readonly onFechar: () => void;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * "Variantes" (aba Modelo): cópias do projeto para testar outra versão do
 * mesmo trabalho — outras quantidades, outro tecido, outro encaixe — sem
 * perder esta. Cada variante é um projeto inteiro da Biblioteca.
 */
export function PainelDeVariantes(props: PainelDeVariantesProps): React.JSX.Element {
  const [nome, setNome] = useState(props.nomeSugerido);
  const [erro, setErro] = useState<string | null>(null);

  // Depois de criar uma variante, a sugestão passa a ser a do nome seguinte
  // (ajuste de estado durante a renderização, quando a prop muda).
  const [sugestaoAnterior, setSugestaoAnterior] = useState(props.nomeSugerido);
  if (sugestaoAnterior !== props.nomeSugerido) {
    setSugestaoAnterior(props.nomeSugerido);
    setNome(props.nomeSugerido);
  }

  function criar(): void {
    if (nome.trim() === '') {
      setErro('Dê um nome à variante.');
      return;
    }
    setErro(props.onCriar(nome.trim()));
  }

  return (
    <Sobreposicao titulo="Variantes" onFechar={props.onFechar}>
      <div className="painel-de-variantes">
        <p className="nota-do-formulario">
          Uma variante é uma cópia deste projeto para testar outra versão do mesmo trabalho — outras quantidades, outro
          tecido, outro encaixe — sem perder esta. Cada uma fica na Biblioteca, com o próprio histórico.
        </p>

        <ul className="lista-de-variantes" aria-label="Variantes deste projeto">
          {props.variantes.map((variante) => {
            const aberta = variante.id === props.projetoAtualId;
            return (
              <li key={variante.id} className={aberta ? 'variante-aberta' : undefined} aria-current={aberta ? 'true' : undefined}>
                <div>
                  <strong>{variante.nome}</strong>
                  <span className="detalhes-da-variante">
                    {variante.varianteDe === undefined ? 'original' : 'variante'} · {variante.estadoAtual.pecas.length} peça(s)
                    · alterada em {formatarData(variante.modificadoEmIso)}
                  </span>
                </div>
                {aberta ? (
                  <span className="selo-de-variante-aberta">aberta</span>
                ) : (
                  <button type="button" onClick={() => props.onAbrir(variante.id)}>
                    Abrir
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <form
          className="formulario-de-sobreposicao"
          onSubmit={(e) => {
            e.preventDefault();
            criar();
          }}
        >
          <label>
            Nome da nova variante
            <input
              type="text"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setErro(null);
              }}
            />
          </label>
          <p className="nota-do-formulario">
            A variante parte do projeto como está agora. Ao criar, o projeto aberto é salvo e você passa a trabalhar na
            variante.
          </p>
          {erro && (
            <p className="mensagem-de-erro" role="alert">
              {erro}
            </p>
          )}
          <div className="acoes-da-sobreposicao">
            <button type="button" onClick={props.onFechar}>
              Fechar
            </button>
            <button type="submit" className="botao-primario">
              Criar variante
            </button>
          </div>
        </form>
      </div>
    </Sobreposicao>
  );
}
