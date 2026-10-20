import type { RiscoDoPlanejamento } from '../domain/planoDeEnfesto';
import { escreverM } from '../domain/planoDeCorte';
import { escreverGrade } from '../domain/risco';

/**
 * O desenho do risco, em escala: o comprimento na horizontal (como a mesa na tela do programa), a largura da malha
 * na vertical, cada peça pela linha de corte, com o nome, o tamanho e a linha de fio (a orientação). As medidas e
 * uma régua de 50 cm ficam em volta.
 */

const CORES = ['#cfe3f7', '#f7e0c4', '#d5efd2', '#efd2ea', '#f3f0c2', '#d8d6f5', '#f5d0cf', '#cdeeee'];

export function DesenhoDoRisco(props: { readonly risco: RiscoDoPlanejamento; readonly tamanhos: readonly string[] }): React.JSX.Element {
  const { risco } = props;
  const comprimento = risco.comprimentoMm;
  const largura = risco.larguraDoRiscoMm;
  const folga = Math.max(60, Math.min(comprimento, largura) * 0.08);
  const letra = Math.max(18, Math.min(60, largura / 22));
  const descricao = `Risco ${escreverGrade(risco.grade)}: ${escreverM(comprimento)} de comprimento × ${escreverM(largura)} de largura (as peças ocupam ${escreverM(risco.larguraMm)}).`;
  if (risco.pecas.length === 0) {
    return (
      <p className="nota-do-formulario">
        {descricao} Risco informado à mão: não há o desenho das peças.
      </p>
    );
  }
  // No desenho, o comprimento (y do molde) vai na horizontal e a largura (x do molde) na vertical.
  const pt = (p: { readonly x: number; readonly y: number }): string => `${p.y.toFixed(1)},${p.x.toFixed(1)}`;
  return (
    <figure className="desenho-do-risco">
      <svg role="img" aria-label={descricao} viewBox={`${-folga} ${-folga * 1.6} ${comprimento + folga * 2} ${largura + folga * 3.2}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="seta-do-fio" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="seta-do-fio" />
          </marker>
        </defs>
        <rect x={0} y={0} width={comprimento} height={largura} className="malha-do-risco" />
        {risco.pecas.map((p, i) => {
          const xs = p.contorno.map((q) => q.y);
          const ys = p.contorno.map((q) => q.x);
          const centro = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
          const cor = CORES[Math.max(0, props.tamanhos.indexOf(p.tamanho)) % CORES.length];
          return (
            <g key={i} className="peca-do-risco">
              <polygon points={p.contorno.map(pt).join(' ')} style={{ fill: cor }} className={p.espelhada ? 'peca-espelhada' : undefined} />
              <line x1={p.fio.inicio.y} y1={p.fio.inicio.x} x2={p.fio.fim.y} y2={p.fio.fim.x} className="fio-do-risco" markerEnd="url(#seta-do-fio)" />
              <text x={centro.x} y={centro.y} fontSize={letra} textAnchor="middle" dominantBaseline="middle" className="rotulo-do-risco">
                {p.nome} {p.tamanho}
                {p.espelhada ? ' (esq.)' : ''}
              </text>
            </g>
          );
        })}
        <text x={comprimento / 2} y={-folga * 0.5} fontSize={letra * 1.3} textAnchor="middle" className="medida-do-risco">
          {escreverM(comprimento)}
        </text>
        <text x={-folga * 0.5} y={largura / 2} fontSize={letra * 1.3} textAnchor="middle" className="medida-do-risco" transform={`rotate(-90 ${-folga * 0.5} ${largura / 2})`}>
          {escreverM(largura)}
        </text>
        <line x1={0} y1={largura + folga * 0.8} x2={500} y2={largura + folga * 0.8} className="regua-do-risco" />
        <text x={250} y={largura + folga * 1.4} fontSize={letra} textAnchor="middle" className="medida-do-risco">
          50 cm
        </text>
      </svg>
      <figcaption>{descricao}</figcaption>
    </figure>
  );
}
