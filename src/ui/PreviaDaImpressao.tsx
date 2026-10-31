import { linhaDeCorteDaPeca, type Molde } from '../domain/molde';

interface PreviaDaImpressaoProps {
  readonly pecas: readonly Molde[];
  readonly larguraMm: number;
  readonly comprimentoMm: number;
  /** A área impressa de uma folha, no mesmo sentido do desenho (mm). */
  readonly folhaHorizontalMm: number;
  readonly folhaVerticalMm: number;
}

/** A janela de prévia (ADR 0185): as peças e o corte das folhas, como a impressão vai sair. A horizontal é o comprimento. */
export function PreviaDaImpressao(props: PreviaDaImpressaoProps): React.JSX.Element {
  const colunas = Math.max(1, Math.ceil(props.comprimentoMm / props.folhaHorizontalMm));
  const linhas = Math.max(1, Math.ceil(props.larguraMm / props.folhaVerticalMm));
  const largura = colunas * props.folhaHorizontalMm;
  const altura = linhas * props.folhaVerticalMm;
  const fio = Math.max(largura, altura) / 500;
  return (
    <figure className="previa-da-impressao">
      <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label="Prévia da impressão" width="100%" style={{ maxHeight: 220, background: '#fff' }}>
        {Array.from({ length: colunas * linhas }, (_, i) => (
          <rect key={i} data-folha x={(i % colunas) * props.folhaHorizontalMm} y={Math.floor(i / colunas) * props.folhaVerticalMm} width={props.folhaHorizontalMm} height={props.folhaVerticalMm} fill="none" stroke="#adb5bd" strokeWidth={fio} />
        ))}
        {props.pecas.map((p) => (
          <polygon key={p.id} points={linhaDeCorteDaPeca(p).map((q) => `${q.y},${q.x}`).join(' ')} fill={p.cor ?? '#e9ecef'} stroke="#212529" strokeWidth={fio} />
        ))}
      </svg>
      <figcaption>{colunas * linhas === 1 ? '1 folha' : `${colunas * linhas} folhas (${linhas} × ${colunas})`}</figcaption>
    </figure>
  );
}
