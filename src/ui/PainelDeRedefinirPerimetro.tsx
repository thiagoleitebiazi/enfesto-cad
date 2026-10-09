import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { formatarMm, lerMedida } from './medidas';
import { distancia } from '../core/geometria';
import type { Molde, PontaDaAresta } from '../domain/molde';

/** O que o diálogo escolhe e o desenho mostra: a aresta, o modo e, no uni-direcional, a ponta que anda. */
export interface RedefinicaoDePerimetro {
  readonly indiceAresta: number;
  readonly modo: 'uni-direcional' | 'bi-direcional';
  /** No uni-direcional, a ponta que anda: a do início da aresta (o vértice i) ou a do fim (i+1). */
  readonly extremidade: 'inicio' | 'fim';
}

interface PainelDeRedefinirPerimetroProps {
  readonly peca: Molde;
  /** Fica com quem abre o diálogo porque o desenho destaca a aresta e a ponta que anda. */
  readonly redefinicao: RedefinicaoDePerimetro;
  readonly onAlterar: (redefinicao: RedefinicaoDePerimetro) => void;
  /** Aplica o novo comprimento; devolve a mensagem de erro, ou `null` se deu certo. */
  readonly onAplicar: (novoComprimentoMm: number, ponta: PontaDaAresta) => string | null;
  readonly onFechar: () => void;
}

const SO_PARA_CURVAS =
  'Indisponível aqui: com as duas pontas paradas, só uma curva muda de comprimento, e neste programa as arestas do contorno são retas.';

/**
 * "Redefinir perímetro" de uma aresta: mostra o comprimento atual e aplica
 * o novo ("Para"), sem mudar a direção da aresta. Uni-direcional: só a
 * ponta escolhida anda (a mais perto do clique vem marcada). Bi-direcional:
 * as duas andam, metade cada uma. "Manter extremos" aparece desligado: é
 * para curvas, e aqui as arestas são retas.
 */
export function PainelDeRedefinirPerimetro(props: PainelDeRedefinirPerimetroProps): React.JSX.Element {
  const { peca, redefinicao } = props;
  const [para, setPara] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const indiceDoFim = (redefinicao.indiceAresta + 1) % peca.contorno.length;
  const comprimentoAtual = distancia(peca.contorno[redefinicao.indiceAresta]!, peca.contorno[indiceDoFim]!);
  const numeroDoInicio = redefinicao.indiceAresta + 1;
  const numeroDoFim = indiceDoFim + 1;
  const bidirecional = redefinicao.modo === 'bi-direcional';

  const digitado = para.trim() === '' ? null : lerMedida(para);
  const diferenca = digitado !== null && digitado > 0 ? digitado - comprimentoAtual : null;
  const previa =
    diferenca === null
      ? null
      : Math.abs(diferenca) < 0.005
        ? 'Mesmo comprimento de agora.'
        : `${diferenca > 0 ? 'Cresce' : 'Encolhe'} ${formatarMm(Math.abs(diferenca), 2)}: ${
            bidirecional
              ? `cada ponta anda ${formatarMm(Math.abs(diferenca) / 2, 2)}.`
              : `só o ponto ${redefinicao.extremidade === 'inicio' ? numeroDoInicio : numeroDoFim} anda.`
          }`;

  function alterar(mudanca: Partial<RedefinicaoDePerimetro>): void {
    props.onAlterar({ ...redefinicao, ...mudanca });
    setErro(null);
  }

  function aplicar(): void {
    if (para.trim() === '') {
      setErro('Digite o novo comprimento, em mm.');
      return;
    }
    const comprimento = lerMedida(para);
    if (comprimento === null) {
      setErro('O novo comprimento precisa ser um número em mm.');
      return;
    }
    if (comprimento <= 0) {
      setErro('O novo comprimento precisa ser maior que zero.');
      return;
    }
    if (Math.abs(comprimento - comprimentoAtual) < 1e-6) {
      setErro('A aresta já tem esse comprimento.');
      return;
    }
    const ponta: PontaDaAresta = bidirecional ? 'ambas' : redefinicao.extremidade;
    const mensagem = props.onAplicar(comprimento, ponta);
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    props.onFechar();
  }

  return (
    <Sobreposicao titulo="Redefinir perímetro" onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao formulario-de-medida-exata"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
      >
        <dl className="lista-de-propriedades">
          <dt>Peça</dt>
          <dd>{peca.nome}</dd>
          <dt>Aresta</dt>
          <dd>
            do ponto {numeroDoInicio} ao ponto {numeroDoFim}
          </dd>
          <dt>Comprimento atual</dt>
          <dd>{formatarMm(comprimentoAtual, 2)}</dd>
        </dl>

        <fieldset className="grupo-de-opcoes-do-formulario">
          <legend>Modo</legend>
          <label className="opcao-em-linha opcao-indisponivel" title={SO_PARA_CURVAS}>
            <input type="radio" name="modo-de-redefinir" disabled />
            Manter extremos (só para curvas)
          </label>
          <label className="opcao-em-linha">
            <input
              type="radio"
              name="modo-de-redefinir"
              checked={!bidirecional}
              onChange={() => alterar({ modo: 'uni-direcional' })}
            />
            Uni-direcional: só uma ponta anda
          </label>
          <div className="sub-opcoes" role="radiogroup" aria-label="Ponta que anda">
            <label className="opcao-em-linha">
              <input
                type="radio"
                name="ponta-que-anda"
                checked={redefinicao.extremidade === 'inicio'}
                disabled={bidirecional}
                onChange={() => alterar({ extremidade: 'inicio' })}
              />
              Ponto {numeroDoInicio}
            </label>
            <label className="opcao-em-linha">
              <input
                type="radio"
                name="ponta-que-anda"
                checked={redefinicao.extremidade === 'fim'}
                disabled={bidirecional}
                onChange={() => alterar({ extremidade: 'fim' })}
              />
              Ponto {numeroDoFim}
            </label>
          </div>
          <label className="opcao-em-linha">
            <input
              type="radio"
              name="modo-de-redefinir"
              checked={bidirecional}
              onChange={() => alterar({ modo: 'bi-direcional' })}
            />
            Bi-direcional: as duas pontas andam, metade cada uma
          </label>
          <p className="nota-do-formulario">
            A aresta não muda de direção. As arestas vizinhas acompanham a ponta que anda, com os piques delas; os
            piques desta aresta ficam onde estão.
          </p>
        </fieldset>

        <label>
          Para (mm): o novo comprimento
          <input
            type="text"
            inputMode="decimal"
            value={para}
            onChange={(e) => {
              setPara(e.target.value);
              setErro(null);
            }}
            autoFocus
          />
        </label>
        {previa && <p className="nota-do-formulario">{previa}</p>}

        {erro && (
          <p className="mensagem-de-erro" role="alert">
            {erro}
          </p>
        )}

        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao-primario">
            Redefinir
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
