import { numeroComVirgula } from '../core/numeros';
import type { StatusDoEncaixe } from '../domain/statusDoEncaixe';
import { Sobreposicao } from './Sobreposicao';

interface PainelDeStatusDoEncaixeProps {
  readonly status: StatusDoEncaixe;
  readonly camadas: number;
  readonly onFechar: () => void;
}

const metros = (mm: number): string => `${numeroComVirgula(mm / 1000, 3)} m`;

/** A janela "Status" do encaixe (ADR 0198): o consumo, os modelos e os moldes do que está na mesa. */
export function PainelDeStatusDoEncaixe(props: PainelDeStatusDoEncaixeProps): React.JSX.Element {
  const s = props.status;
  return (
    <Sobreposicao titulo="Status do encaixe" onFechar={props.onFechar}>
      <dl className="lista-de-propriedades">
        <dt>Encaixadas</dt>
        <dd>
          {s.encaixados} {s.foraDaMesa > 0 ? `(${s.foraDaMesa} fora da mesa)` : ''}
        </dd>
        <dt>Comprimento</dt>
        <dd>{metros(s.comprimentoMm)}</dd>
        <dt>Consumo com as perdas</dt>
        <dd>{metros(s.consumoMm)}</dd>
        <dt>Consumo no enfesto ({props.camadas} camadas)</dt>
        <dd>{metros(s.consumoMm * props.camadas)}</dd>
        <dt>Aproveitamento</dt>
        <dd>{numeroComVirgula(s.aproveitamentoPercentual, 1)}%</dd>
        <dt>Rendimento consumo</dt>
        <dd>{s.rendimentoConsumoM !== null ? `${numeroComVirgula(s.rendimentoConsumoM, 3)} m por peça` : '—'}</dd>
        <dt>Rendimento peso</dt>
        <dd>{s.rendimentoPesoKg !== null ? `${numeroComVirgula(s.rendimentoPesoKg, 3)} kg por peça` : '—'}</dd>
      </dl>
      <table className="tabela-de-moldes">
        <caption>Modelos</caption>
        <thead>
          <tr>
            <th scope="col">Tamanho</th>
            <th scope="col" className="coluna-numerica">
              Completos
            </th>
            <th scope="col" className="coluna-numerica">
              Encaixados
            </th>
          </tr>
        </thead>
        <tbody>
          {s.porTamanho.map((t) => (
            <tr key={t.tamanho}>
              <td>{t.tamanho || '—'}</td>
              <td className="coluna-numerica">{t.completos}</td>
              <td className="coluna-numerica">{t.encaixados}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="tabela-de-moldes">
        <caption>Moldes</caption>
        <thead>
          <tr>
            <th scope="col">Molde</th>
            <th scope="col" className="coluna-numerica">
              Encaixados
            </th>
          </tr>
        </thead>
        <tbody>
          {s.porMolde.map((m) => (
            <tr key={m.nome}>
              <td>{m.nome}</td>
              <td className="coluna-numerica">{m.encaixados}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="acoes-da-sobreposicao">
        <button type="button" onClick={props.onFechar}>
          Fechar
        </button>
      </div>
    </Sobreposicao>
  );
}
