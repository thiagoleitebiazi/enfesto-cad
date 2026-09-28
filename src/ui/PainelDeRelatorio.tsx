import { Sobreposicao } from './Sobreposicao';
import type { RelatorioDeProducao } from '../domain/relatorio';

interface PainelDeRelatorioProps {
  readonly relatorio: RelatorioDeProducao;
  readonly gerando: boolean;
  readonly onExportarPdf: () => void;
  readonly onExportarExcel: () => void;
  readonly onFechar: () => void;
}

export function PainelDeRelatorio(props: PainelDeRelatorioProps): React.JSX.Element {
  const r = props.relatorio;
  return (
    <Sobreposicao titulo="Relatório de produção" onFechar={props.onFechar}>
      <div className="painel-de-relatorio">
        <dl className="lista-de-propriedades">
          <dt>Projeto</dt>
          <dd>{r.nomeDoProjeto} ({r.codigoDoProjeto})</dd>
          <dt>Status</dt>
          <dd>{r.status}</dd>
          <dt>Referências</dt>
          <dd>{r.referencias.length > 0 ? r.referencias.join(', ') : '—'}</dd>
          <dt>Tecido</dt>
          <dd>{r.tecidoNome}</dd>
          <dt>Largura total / útil</dt>
          <dd>{r.larguraTotalMm ?? '—'} mm / {r.larguraUtilMm ?? '—'} mm</dd>
          <dt>Comprimento configurado</dt>
          <dd>{r.comprimentoConfiguradoMm ?? '—'} mm</dd>
          <dt>Tipo de enfesto</dt>
          <dd>{r.tipoDeEnfesto ?? '—'}</dd>
          <dt>Camadas</dt>
          <dd>{r.quantidadeDeCamadas ?? '—'}</dd>
          <dt>Comprimento utilizado</dt>
          <dd>{r.comprimentoUtilizadoMm.toFixed(1)} mm</dd>
          <dt>Aproveitamento / Desperdício</dt>
          <dd>
            {r.aproveitamentoPercentual !== null
              ? `${r.aproveitamentoPercentual.toFixed(1)}% / ${r.desperdicioPercentual!.toFixed(1)}%`
              : '— (configure o enfesto)'}
          </dd>
          <dt>Versão do encaixe</dt>
          <dd>{r.versaoDoEncaixe}</dd>
        </dl>

        <h3>Peças por tamanho</h3>
        {r.pecasPorTamanho.length === 0 ? (
          <p className="texto-vazio">Nenhuma peça no projeto.</p>
        ) : (
          <table className="tabela-de-relatorio">
            <thead>
              <tr>
                <th>Tamanho</th>
                <th>Modelos distintos</th>
                <th>Quantidade total</th>
              </tr>
            </thead>
            <tbody>
              {r.pecasPorTamanho.map((linha) => (
                <tr key={linha.tamanho}>
                  <td>{linha.tamanho}</td>
                  <td>{linha.quantidadeDeModelos}</td>
                  <td>{linha.quantidadeTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="acoes-da-sobreposicao">
          <button onClick={props.onFechar} disabled={props.gerando}>
            Fechar
          </button>
          <button onClick={props.onExportarExcel} disabled={props.gerando}>
            {props.gerando ? 'Gerando...' : 'Exportar Excel'}
          </button>
          <button onClick={props.onExportarPdf} className="botao-primario" disabled={props.gerando}>
            {props.gerando ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>
    </Sobreposicao>
  );
}
