import { retanguloEnvolvente } from '../core/geometria';
import { linhaDeCorteDaPeca, type Molde } from '../domain/molde';

/** A imagem do encaixe na lista da biblioteca (ADR 0203): as peças, sem precisar abrir o projeto. */
export function MiniaturaDoProjeto(props: { readonly pecas: readonly Molde[] }): React.JSX.Element | null {
  if (props.pecas.length === 0) return null;
  const cortes = props.pecas.map(linhaDeCorteDaPeca);
  const c = retanguloEnvolvente(cortes.flat());
  const largura = Math.max(1, c.maxY - c.minY);
  const altura = Math.max(1, c.maxX - c.minX);
  return (
    <svg viewBox={`${c.minY} ${c.minX} ${largura} ${altura}`} width={72} height={48} role="img" aria-label="Miniatura do encaixe" style={{ flex: 'none', background: '#fff', border: '1px solid #d1d5db' }}>
      {cortes.map((corte, i) => (
        <polygon key={i} points={corte.map((p) => `${p.y},${p.x}`).join(' ')} fill={props.pecas[i]!.cor ?? '#dee2e6'} stroke="#495057" strokeWidth={Math.max(largura, altura) / 150} />
      ))}
    </svg>
  );
}
