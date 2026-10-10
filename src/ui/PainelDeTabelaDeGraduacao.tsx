import { useState } from 'react';
import type { Ponto2D } from '../core/geometria';
import { Sobreposicao } from './Sobreposicao';
import { lerMedida } from './medidas';
import {
  colunaDaSeta,
  dePolar,
  paraAbsoluto,
  paraATela,
  paraIncremental,
  paraOCampo,
  paraOMundo,
  paraPolar,
  type SetaDaTabela,
} from './tabelaDeGraduacao';

interface PainelDeTabelaDeGraduacaoProps {
  readonly nomeDaPeca: string;
  /** O número do ponto como aparece no desenho (a partir de 1). */
  readonly numeroDoPonto: number;
  /** O ponto tem regra própria; senão, anda na proporção dos vizinhos (e a tabela mostra essa proporção). */
  readonly graduado: boolean;
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

/**
 * A regra (em mm do mundo) como as duas colunas da tabela, em absoluto ou
 * incremental. Em `polar`, a primeira coluna é a distância e a segunda, o
 * ângulo (de cada linha como ela é mostrada: absoluta ou incremental).
 */
function paraAsColunas(deslocamentos: readonly Ponto2D[], base: number, incremental: boolean, polar = false): Colunas {
  const naTela = deslocamentos.map(paraATela);
  const dx = incremental ? paraIncremental(naTela.map((d) => d.dx), base) : naTela.map((d) => d.dx);
  const dy = incremental ? paraIncremental(naTela.map((d) => d.dy), base) : naTela.map((d) => d.dy);
  if (!polar) return { dx: dx.map(paraOCampo), dy: dy.map(paraOCampo) };
  const polares = dx.map((valor, t) => paraPolar({ dx: valor, dy: dy[t]! }));
  return { dx: polares.map((p) => paraOCampo(p.distancia)), dy: polares.map((p) => paraOCampo(p.angulo)) };
}

const SETAS: ReadonlyArray<{ readonly seta: SetaDaTabela; readonly simbolo: string; readonly nome: string }> = [
  { seta: 'esquerda', simbolo: '←', nome: 'para a esquerda' },
  { seta: 'cima', simbolo: '↑', nome: 'para cima' },
  { seta: 'baixo', simbolo: '↓', nome: 'para baixo' },
  { seta: 'direita', simbolo: '→', nome: 'para a direita' },
];

/**
 * "Graduar via tabela": a regra de um ponto do contorno — quanto ele anda em
 * cada tamanho, a partir do base. "Incremental" mostra e aceita, em vez disso,
 * a diferença de cada tamanho para o vizinho do lado do base. "Copiar" guarda
 * a regra para "Colar" na tabela de outro ponto.
 */
export function PainelDeTabelaDeGraduacao(props: PainelDeTabelaDeGraduacaoProps): React.JSX.Element {
  const { base, tamanhos } = props;
  const [incremental, setIncremental] = useState(false);
  const [polar, setPolar] = useState(false);
  const [valorDaSeta, setValorDaSeta] = useState('');
  const [colunas, setColunas] = useState<Colunas>(() => paraAsColunas(props.deslocamentos, base, false));
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  /** A regra digitada, em mm do mundo; `null` (com a mensagem posta) se algum campo não é número. */
  function lerRegra(): Ponto2D[] | null {
    const ler = (textos: readonly string[], oQue: string): number[] | null => {
      const numeros: number[] = [];
      for (let t = 0; t < tamanhos.length; t++) {
        const numero = t === base ? 0 : lerMedida(textos[t] ?? '');
        if (numero === null) {
          setErro(`${oQue} do tamanho ${tamanhos[t]} precisa ser um número em ${oQue === 'O ângulo' ? 'graus' : 'mm'}.`);
          return null;
        }
        numeros.push(numero);
      }
      return numeros;
    };
    const primeira = ler(colunas.dx, polar ? 'A distância' : 'O DX');
    const segunda = primeira && ler(colunas.dy, polar ? 'O ângulo' : 'O DY');
    if (!primeira || !segunda) return null;
    // Cada linha, como está mostrada (absoluta ou incremental), vira DX e DY; depois, o incremental vira absoluto.
    const linhas = primeira.map((valor, t) => (polar ? dePolar({ distancia: valor, angulo: segunda[t]! }) : { dx: valor, dy: segunda[t]! }));
    const dx = incremental ? paraAbsoluto(linhas.map((l) => l.dx), base) : linhas.map((l) => l.dx);
    const dy = incremental ? paraAbsoluto(linhas.map((l) => l.dy), base) : linhas.map((l) => l.dy);
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
    setColunas(paraAsColunas(regra, base, ligado, polar));
  }

  function alternarPolar(ligado: boolean): void {
    const regra = lerRegra();
    if (!regra) return;
    setPolar(ligado);
    setColunas(paraAsColunas(regra, base, incremental, ligado));
  }

  /** Uma seta: o valor digitado vai para a coluna DX ou DY, um passo por tamanho, com os tamanhos maiores para o lado da seta. */
  function aplicarSeta(seta: SetaDaTabela): void {
    const regra = lerRegra();
    if (!regra) return;
    const valor = lerMedida(valorDaSeta);
    if (valor === null || valor === 0) return setErro('Digite o valor da seta: quanto o ponto anda por tamanho, em mm.');
    const { coluna, valores } = colunaDaSeta(seta, valor, tamanhos.length, base);
    const nova = regra.map((d, t) => paraOMundo({ ...paraATela(d), [coluna]: valores[t]! }));
    setColunas(paraAsColunas(nova, base, incremental, polar));
    setErro(null);
    setRecado(`${coluna === 'dx' ? 'DX' : 'DY'} preenchido: ${paraOCampo(Math.abs(valor))} mm por tamanho, com os tamanhos maiores ${SETAS.find((s) => s.seta === seta)!.nome}. Confira e use “Aplicar”.`);
  }

  function zerar(): void {
    setColunas(paraAsColunas(tamanhos.map(() => ({ x: 0, y: 0 })), base, incremental, polar));
    setErro(null);
    setRecado('Graduação do ponto zerada na tabela. Confira e use “Aplicar”.');
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
            {props.graduado ? 'graduado' : 'proporcional aos vizinhos'}
          </dd>
        </dl>

        <label className="opcao-em-linha">
          <input type="checkbox" checked={incremental} onChange={(e) => alternarIncremental(e.target.checked)} />
          Incremental: a diferença de cada tamanho para o vizinho, do lado do base
        </label>

        <label className="opcao-em-linha">
          <input type="checkbox" checked={polar} onChange={(e) => alternarPolar(e.target.checked)} />
          Distância e ângulo, em vez de DX e DY
        </label>

        <div className="opcao-em-linha" role="group" aria-label="Preencher pela seta">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Valor da seta (mm por tamanho)"
            placeholder="mm por tamanho"
            value={valorDaSeta}
            onChange={(e) => setValorDaSeta(e.target.value)}
          />
          {SETAS.map(({ seta, simbolo, nome }) => (
            <button key={seta} type="button" aria-label={`Seta ${nome}`} title={`Os tamanhos maiores vão ${nome}`} onClick={() => aplicarSeta(seta)}>
              {simbolo}
            </button>
          ))}
          <button type="button" aria-label="Zerar a graduação do ponto" title="Zera a graduação deste ponto" onClick={zerar}>
            0
          </button>
        </div>

        <table className="tabela-de-graduacao">
          <thead>
            <tr>
              <th scope="col">Tamanho</th>
              <th scope="col">{polar ? 'Distância (mm)' : 'DX (mm, + para a direita)'}</th>
              <th scope="col">{polar ? 'Ângulo (graus: 0 para a direita, anti-horário)' : 'DY (mm, + para baixo)'}</th>
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
                      aria-label={`${coluna === 'dx' ? (polar ? 'Distância' : 'DX') : polar ? 'Ângulo' : 'DY'} do tamanho ${tamanho}`}
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
              setColunas(paraAsColunas(props.copiada, base, incremental, polar));
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
