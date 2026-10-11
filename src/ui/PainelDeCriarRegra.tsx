import { useState } from 'react';
import type { Ponto2D } from '../core/geometria';
import { Sobreposicao } from './Sobreposicao';
import {
  comIncremental,
  comOBaseNa,
  comOMesmoPasso,
  comTamanhoNovo,
  semOTamanho,
  tabelaDaRegra,
  type LinhaDaRegra,
  type TabelaDaRegra,
} from './tabelaDaRegra';

interface PainelDeCriarRegraProps {
  readonly nomeDaPeca: string;
  /** O número do ponto como aparece no desenho (a partir de 1). */
  readonly numeroDoPonto: number;
  readonly tamanhos: readonly string[];
  readonly base: number;
  /** O que o ponto anda em cada tamanho, em mm do mundo: é com isso que a tabela abre. */
  readonly deslocamentos: readonly Ponto2D[];
  /** Guarda a regra; devolve a mensagem de erro, ou `null` se deu certo. */
  readonly onCriar: (nome: string, codigo: string, tabela: TabelaDaRegra) => string | null;
  readonly onFechar: () => void;
}

/**
 * "Criar regra": o nome, o código e a tabela do ponto — uma linha por
 * tamanho, com o DX e o DY de cada um —, que pode ser mudada antes de
 * guardar. Os botões agem na linha escolhida: criar um tamanho acima ou
 * abaixo dela, excluir, definir como base e dar o mesmo passo a todos.
 */
export function PainelDeCriarRegra(props: PainelDeCriarRegraProps): React.JSX.Element {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tabela, setTabela] = useState<TabelaDaRegra>(() => tabelaDaRegra(props.tamanhos, props.base, props.deslocamentos));
  // A linha em que os botões agem: de início, a primeira que não é a do base.
  const [escolhida, setEscolhida] = useState(() => (props.base === 0 ? 1 : 0));
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  /** Uma mudança na tabela: se não dá para fazer, a mensagem diz por quê e a tabela fica como está. */
  function tentar(mudanca: () => TabelaDaRegra, dito: string | null, novaEscolhida = escolhida): void {
    try {
      setTabela(mudanca());
      setEscolhida(novaEscolhida);
      setErro(null);
      setRecado(dito);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  function mudar(linha: number, campo: keyof LinhaDaRegra, texto: string): void {
    setTabela((atual) => ({ ...atual, linhas: atual.linhas.map((l, t) => (t === linha ? { ...l, [campo]: texto } : l)) }));
    setErro(null);
    setRecado(null);
  }

  const daEscolhida = tabela.linhas[escolhida]?.tamanho.trim() || `da linha ${escolhida + 1}`;

  return (
    <Sobreposicao titulo="Criar regra" onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao formulario-de-medida-exata painel-de-tabela-de-graduacao"
        onSubmit={(e) => {
          e.preventDefault();
          const mensagem = props.onCriar(nome, codigo, tabela);
          if (mensagem) return setErro(mensagem);
          props.onFechar();
        }}
      >
        <dl className="lista-de-propriedades">
          <dt>Peça</dt>
          <dd>{props.nomeDaPeca}</dd>
          <dt>Ponto</dt>
          <dd>{props.numeroDoPonto}</dd>
        </dl>

        <label>
          Nome da regra
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        <label>
          Código (opcional): um rótulo curto para achar a regra
          <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </label>

        <label className="opcao-em-linha">
          <input
            type="checkbox"
            checked={tabela.incremental}
            onChange={(e) => tentar(() => comIncremental(tabela, e.target.checked), null)}
          />
          Incremental: a diferença de cada tamanho para o vizinho, do lado do base
        </label>

        <div className="opcao-em-linha botoes-da-tabela-da-regra" role="group" aria-label="Mudar os tamanhos da regra">
          <button
            type="button"
            title="Cria um tamanho acima da linha escolhida, com os números na proporção dos vizinhos"
            onClick={() => tentar(() => comTamanhoNovo(tabela, escolhida, 'acima'), 'Tamanho criado acima, com os números na proporção dos vizinhos: dê o nome dele e confira.')}
          >
            Criar tamanho acima
          </button>
          <button
            type="button"
            title="Cria um tamanho abaixo da linha escolhida, com os números na proporção dos vizinhos"
            onClick={() =>
              tentar(() => comTamanhoNovo(tabela, escolhida, 'abaixo'), 'Tamanho criado abaixo, com os números na proporção dos vizinhos: dê o nome dele e confira.', escolhida + 1)
            }
          >
            Criar tamanho abaixo
          </button>
          <button
            type="button"
            title="Tira da regra o tamanho da linha escolhida"
            onClick={() => tentar(() => semOTamanho(tabela, escolhida), `Tamanho ${daEscolhida} excluído da regra.`, Math.min(escolhida, tabela.linhas.length - 2))}
          >
            Excluir tamanho
          </button>
          <button
            type="button"
            title="O tamanho da linha escolhida passa a ser o base: os números passam a ser contados dele"
            onClick={() => tentar(() => comOBaseNa(tabela, escolhida), `O base da regra agora é o tamanho ${daEscolhida}: os números passaram a ser contados dele.`)}
          >
            Definir como base
          </button>
          <button
            type="button"
            title="O que a linha escolhida anda por tamanho passa a valer para todos: os maiores que o base para esse lado, os menores para o outro"
            onClick={() => tentar(() => comOMesmoPasso(tabela, escolhida), `Todos os tamanhos andam agora o mesmo por tamanho, pelo passo do tamanho ${daEscolhida}. Confira.`)}
          >
            Mesmo passo em todos
          </button>
        </div>

        <table className="tabela-de-graduacao tabela-da-regra">
          <thead>
            <tr>
              <th scope="col">Linha</th>
              <th scope="col">Tamanho</th>
              <th scope="col">DX (mm, + para a direita)</th>
              <th scope="col">DY (mm, + para baixo)</th>
            </tr>
          </thead>
          <tbody>
            {tabela.linhas.map((linha, t) => {
              const ehBase = t === tabela.base;
              const rotulo = linha.tamanho.trim() !== '' ? `do tamanho ${linha.tamanho.trim()}` : `da linha ${t + 1}`;
              const classes = [ehBase ? 'linha-do-base' : '', t === escolhida ? 'linha-escolhida' : ''].filter((c) => c !== '').join(' ');
              return (
                <tr key={t} className={classes === '' ? undefined : classes} onFocus={() => setEscolhida(t)}>
                  <td>
                    <input type="radio" name="linha-escolhida" aria-label={`Escolher a linha ${rotulo}`} checked={t === escolhida} onChange={() => setEscolhida(t)} />
                  </td>
                  <td>
                    <input type="text" aria-label={`Nome do tamanho da linha ${t + 1}`} value={linha.tamanho} onChange={(e) => mudar(t, 'tamanho', e.target.value)} />
                    {ehBase && <span className="marca-do-base"> (base)</span>}
                  </td>
                  {(['dx', 'dy'] as const).map((coluna) => (
                    <td key={coluna}>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${coluna === 'dx' ? 'DX' : 'DY'} ${rotulo}`}
                        value={ehBase ? '0' : linha[coluna]}
                        disabled={ehBase}
                        onChange={(e) => mudar(t, coluna, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="nota-do-formulario">
          A regra guarda o que um ponto anda em cada tamanho. A tabela vem com o que este ponto anda, contado do base, e pode ser mudada antes de guardar. Os
          botões agem na linha escolhida (a marcada na primeira coluna): criar um tamanho acima ou abaixo dela — ele vem com os números na proporção dos
          vizinhos —, excluir, definir como base e “Mesmo passo em todos”, que faz todos os tamanhos andarem, por tamanho, o que a linha escolhida anda: os
          maiores que o base para esse lado, os menores para o outro (é a nossa leitura do “mesmo DX e DY para todos” da referência). A regra fica no
          cadastro deste computador, em “Regras”, e vale para as peças que têm esses tamanhos. O código aparece na lista, ao lado do nome; não muda as
          contas.
        </p>

        {erro && (
          <p className="mensagem-de-erro" role="alert">
            {erro}
          </p>
        )}
        {recado && !erro && (
          <p className="nota-do-formulario" role="status">
            {recado}
          </p>
        )}

        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao-primario">
            Criar regra
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
