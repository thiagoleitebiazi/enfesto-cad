import { useState } from 'react';
import type { Ponto2D } from '../core/geometria';
import { Sobreposicao } from './Sobreposicao';
import { lerMedida } from './medidas';
import { paraAbsoluto, paraATela, paraIncremental, paraOCampo, paraOMundo } from './tabelaDeGraduacao';

interface PainelDeTabelaDeGraduacaoProps {
  readonly nomeDaPeca: string;
  /** O número do ponto como aparece no desenho (a partir de 1). */
  readonly numeroDoPonto: number;
  /** O ponto tem regra própria; senão, anda na proporção dos vizinhos (e a tabela mostra essa proporção). */
  readonly graduado: boolean;
  /** O ponto está num grupo: a regra aplicada vale para todos os pontos dele. */
  readonly emGrupo: boolean;
  readonly tamanhos: readonly string[];
  readonly base: number;
  /** A regra de hoje: o deslocamento do ponto em cada tamanho, em mm do mundo. */
  readonly deslocamentos: readonly Ponto2D[];
  /** A regra guardada pelo último "Copiar", já nos tamanhos desta peça; `null` se não há ou não serve. */
  readonly copiada: readonly Ponto2D[] | null;
  readonly onCopiar: (deslocamentos: readonly Ponto2D[]) => void;
  /** Aplica a regra; devolve a mensagem de erro, ou `null` se deu certo. */
  readonly onAplicar: (deslocamentos: readonly Ponto2D[]) => string | null;
  readonly onFechar: () => void;
}

interface Colunas {
  readonly dx: readonly string[];
  readonly dy: readonly string[];
}

/** A regra (em mm do mundo) como as duas colunas da tabela, em absoluto ou incremental. */
function paraAsColunas(deslocamentos: readonly Ponto2D[], base: number, incremental: boolean): Colunas {
  const naTela = deslocamentos.map(paraATela);
  const dx = naTela.map((d) => d.dx);
  const dy = naTela.map((d) => d.dy);
  return {
    dx: (incremental ? paraIncremental(dx, base) : dx).map(paraOCampo),
    dy: (incremental ? paraIncremental(dy, base) : dy).map(paraOCampo),
  };
}

/**
 * "Graduar via tabela": a regra de um ponto do contorno — quanto ele anda em
 * cada tamanho, a partir do base. "Incremental" mostra e aceita, em vez disso,
 * a diferença de cada tamanho para o vizinho do lado do base. "Copiar" guarda
 * a regra para "Colar" na tabela de outro ponto.
 */
export function PainelDeTabelaDeGraduacao(props: PainelDeTabelaDeGraduacaoProps): React.JSX.Element {
  const { base, tamanhos } = props;
  const [incremental, setIncremental] = useState(false);
  const [colunas, setColunas] = useState<Colunas>(() => paraAsColunas(props.deslocamentos, base, false));
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  /** A regra digitada, em mm do mundo; `null` (com a mensagem posta) se algum campo não é número. */
  function lerRegra(): Ponto2D[] | null {
    const ler = (textos: readonly string[], coluna: string): number[] | null => {
      const numeros: number[] = [];
      for (let t = 0; t < tamanhos.length; t++) {
        const numero = t === base ? 0 : lerMedida(textos[t] ?? '');
        if (numero === null) {
          setErro(`O ${coluna} do tamanho ${tamanhos[t]} precisa ser um número em mm.`);
          return null;
        }
        numeros.push(numero);
      }
      return incremental ? paraAbsoluto(numeros, base) : numeros;
    };
    const dx = ler(colunas.dx, 'DX');
    const dy = dx && ler(colunas.dy, 'DY');
    if (!dx || !dy) return null;
    return dx.map((valor, t) => paraOMundo({ dx: valor, dy: dy[t]! }));
  }

  function mudar(coluna: 'dx' | 'dy', t: number, texto: string): void {
    setColunas((atual) => ({ ...atual, [coluna]: atual[coluna].map((valor, i) => (i === t ? texto : valor)) }));
    setErro(null);
    setRecado(null);
  }

  function alternarIncremental(ligado: boolean): void {
    const regra = lerRegra();
    if (!regra) return;
    setIncremental(ligado);
    setColunas(paraAsColunas(regra, base, ligado));
  }

  return (
    <Sobreposicao titulo={`Graduação do ponto ${props.numeroDoPonto}`} onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao formulario-de-medida-exata painel-de-tabela-de-graduacao"
        onSubmit={(e) => {
          e.preventDefault();
          const regra = lerRegra();
          if (!regra) return;
          const mensagem = props.onAplicar(regra);
          if (mensagem) return setErro(mensagem);
          props.onFechar();
        }}
      >
        <dl className="lista-de-propriedades">
          <dt>Peça</dt>
          <dd>{props.nomeDaPeca}</dd>
          <dt>Ponto</dt>
          <dd>
            {props.numeroDoPonto} —{' '}
            {props.graduado ? (props.emGrupo ? 'graduado, num grupo' : 'graduado') : 'proporcional aos vizinhos'}
          </dd>
        </dl>

        <label className="opcao-em-linha">
          <input type="checkbox" checked={incremental} onChange={(e) => alternarIncremental(e.target.checked)} />
          Incremental: a diferença de cada tamanho para o vizinho, do lado do base
        </label>

        <table className="tabela-de-graduacao">
          <thead>
            <tr>
              <th scope="col">Tamanho</th>
              <th scope="col">DX (mm, + para a direita)</th>
              <th scope="col">DY (mm, + para baixo)</th>
            </tr>
          </thead>
          <tbody>
            {tamanhos.map((tamanho, t) => (
              <tr key={tamanho} className={t === base ? 'linha-do-base' : undefined}>
                <th scope="row">{t === base ? `${tamanho} (base)` : tamanho}</th>
                {(['dx', 'dy'] as const).map((coluna) => (
                  <td key={coluna}>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`${coluna === 'dx' ? 'DX' : 'DY'} do tamanho ${tamanho}`}
                      value={t === base ? '0' : (colunas[coluna][t] ?? '')}
                      disabled={t === base}
                      onChange={(e) => mudar(coluna, t, e.target.value)}
                      autoFocus={coluna === 'dx' && t === (base === 0 ? 1 : 0)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="nota-do-formulario">
          {props.graduado
            ? 'A regra vale para este ponto; os pontos proporcionais vizinhos acompanham.'
            : 'Este ponto ainda não tem regra própria: os números são os que ele tem na proporção dos vizinhos. Aplicando, ele passa a ser um ponto graduado.'}
          {props.emGrupo && ' Como ele está num grupo, a regra vale para todos os pontos do grupo.'}
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
          <button
            type="button"
            onClick={() => {
              const regra = lerRegra();
              if (!regra) return;
              props.onCopiar(regra);
              setRecado('Regra copiada: abra a tabela de outro ponto e use “Colar”.');
            }}
          >
            Copiar
          </button>
          <button
            type="button"
            disabled={!props.copiada}
            title={props.copiada ? undefined : 'Não há regra copiada que sirva para os tamanhos desta peça'}
            onClick={() => {
              if (!props.copiada) return;
              setColunas(paraAsColunas(props.copiada, base, incremental));
              setErro(null);
              setRecado('Regra colada: confira e use “Aplicar”.');
            }}
          >
            Colar
          </button>
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao-primario">
            Aplicar
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
