import { escreverKg, escreverM, escreverM2, escreverRendimento } from '../domain/planoDeCorte';
import { DEFINICOES, type AlertaDoPlanejamento, type ConfiguracaoDoPlanejamento, type EntradaDoPlanejamento, type ResultadoDoPlanejamento, type RiscoDoPlanejamento } from '../domain/planoDeEnfesto';
import { ROTULO_DO_TIPO } from '../domain/enfesto';
import { escreverGrade } from '../domain/risco';
import { DesenhoDoRisco } from './DesenhoDoRisco';

/**
 * O plano como se mostra: o calculado agora (na revisão) ou o de um plano guardado (com os valores de então). Os
 * termos (folha, camada, enfesto) ficam definidos ao lado dos números.
 */
export function ResumoDoPlanejamento(props: {
  readonly entrada: EntradaDoPlanejamento;
  readonly configuracao: ConfiguracaoDoPlanejamento;
  readonly resultado: ResultadoDoPlanejamento;
  readonly alertas: readonly AlertaDoPlanejamento[];
  readonly premissas: readonly string[];
  readonly riscos: readonly RiscoDoPlanejamento[];
  readonly tamanhos: readonly string[];
  /** Com o desenho de cada risco. */
  readonly comDesenho?: boolean;
}): React.JSX.Element {
  const { entrada: e, resultado: r } = props;
  const tamanhos = props.tamanhos.filter((t) => t in r.producaoPorTamanho || t in r.pedidoPorTamanho);
  const rendimento = r.rendimentoUsadoMmPorG;
  const lotes = r.rolos ? [...new Set(r.rolos.map((x) => x.grupo))].join('; ') : null;
  // As colunas do que é novo no plano só aparecem quando há o que mostrar (os planos antigos não têm).
  const comJaUsado = r.rolos?.some((x) => (x.jaUsadoMm ?? 0) > 0) ?? false;
  const comPuladoPorDefeito = r.rolos?.some((x) => (x.perdaPorDefeitoMm ?? 0) > 0) ?? false;
  const comEmendas = r.rolos?.some((x) => (x.emendas ?? 0) > 0) ?? false;
  return (
    <div className="resumo-do-planejamento">
      <p className="resumo-do-plano">
        Molde: {e.molde.nome} ({e.molde.codigo}) — {e.molde.revisao !== null ? `revisão ${e.molde.revisao}` : 'peças mudadas depois da última revisão registrada'}.
        <br />
        Ordem: {e.ordem.codigo}
        {e.ordem.produto ? ` — ${e.ordem.produto}` : ''}
        {e.ordem.cor ? ` — cor ${e.ordem.cor}` : ''}
        {e.ordem.prazo ? ` — prazo ${e.ordem.prazo.split('-').reverse().join('/')}` : ''}.
        <br />
        Malha: {e.malha.descricao}
        {e.malha.gramaturaGm2 !== undefined ? ` — ${String(e.malha.gramaturaGm2).replace('.', ',')} g/m²` : ''} — largura útil {escreverM(e.malha.larguraUtilMm)}
        {rendimento !== null ? ` — rendimento usado ${escreverRendimento(rendimento)} (${r.origemDoRendimento === 'informado' ? 'informado' : 'calculado pela gramatura'})` : ''}.
        <br />
        Material: {e.rolos && e.rolos.length > 0 ? `${e.rolos.length} rolo(s) — ${lotes}` : `${escreverKg(e.pesoDisponivelG ?? 0)} (peso)`}; {escreverM(r.disponivelMm)}
        {r.comprimentoEstimado ? ' (estimado em parte pelo peso)' : ''}.
        <br />
        Enfesto {ROTULO_DO_TIPO[e.tipoDeEnfesto]}: {r.camadas} camada(s), {r.folhas} folha(s), em {r.enfestos.length} enfesto(s).
        <br />
        Mesa: {escreverM(r.mesa.comprimentoMm)} × {escreverM(r.mesa.larguraDoTecidoMm)} de malha na mesa
        {r.mesa.larguraDaMesaMm !== null ? ` (mesa física de ${escreverM(r.mesa.larguraDaMesaMm)} de largura: ${escreverM2(r.mesa.areaDaMesaMm2 ?? 0)})` : ''}.
        <br />
        Consumo estimado: {escreverM(r.consumoMm)}
        {r.consumoG !== null ? ` (${escreverKg(r.consumoG)})` : ''}. Sobra estimada: {escreverM(r.sobraMm)}
        {r.sobraG !== null ? ` (${escreverKg(r.sobraG)})` : ''}.{r.deficitMm > 0 ? ` Falta de material: ${escreverM(r.deficitMm)}${r.deficitG !== null ? ` (${escreverKg(r.deficitG)})` : ''}.` : ''}
      </p>
      <p className="nota-do-formulario">Mesa: {r.mesa.formula}.</p>

      <table className="tabela-de-relatorio">
        <caption>Riscos</caption>
        <thead>
          <tr>
            <th scope="col">Risco (roupas por folha)</th>
            <th scope="col">Comprimento</th>
            <th scope="col">Largura ocupada</th>
            <th scope="col">Eficiência</th>
            <th scope="col">Camadas</th>
            <th scope="col">Folhas</th>
            <th scope="col">Enfestos</th>
            <th scope="col">Consumo</th>
          </tr>
        </thead>
        <tbody>
          {r.riscos.map((x) => {
            const desenhado = props.riscos.find((y) => y.chave === x.chave);
            return (
              <tr key={x.chave}>
                <td>
                  {escreverGrade(x.grade)}
                  {x.origem === 'mesa' ? ' (da mesa)' : x.origem === 'informado' ? ' (informado)' : ''}
                  {desenhado?.compensado ? ' (encolhimento compensado)' : ''}
                  {desenhado?.casamento?.conferido ? ' (desenho casado)' : ''}
                </td>
                <td>{escreverM(x.comprimentoMm)}</td>
                <td>{escreverM(x.larguraMm)}</td>
                <td>{x.eficienciaPercentual !== null ? `${x.eficienciaPercentual.toFixed(1).replace('.', ',')}%` : '—'}</td>
                <td>{x.camadas}</td>
                <td>{x.folhas}</td>
                <td>
                  {x.enfestos.length} ({x.enfestos.join(' + ')} camadas; até {x.camadasPorEnfestoMax} por enfesto)
                </td>
                <td>{escreverM(x.consumoMm)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="tabela-de-relatorio">
        <caption>Produção por tamanho</caption>
        <thead>
          <tr>
            <th scope="col">Tamanho</th>
            <th scope="col">Pedido</th>
            <th scope="col">Planejado</th>
            <th scope="col">Excedente</th>
            <th scope="col">Falta</th>
            {r.possivelPorTamanho && <th scope="col">Com o material que há</th>}
          </tr>
        </thead>
        <tbody>
          {tamanhos.map((t) => (
            <tr key={t}>
              <th scope="row">{t}</th>
              <td>{r.pedidoPorTamanho[t] ?? 0}</td>
              <td>{r.producaoPorTamanho[t] ?? 0}</td>
              <td>{r.excedentePorTamanho[t] ?? 0}</td>
              <td>{r.faltaPorTamanho[t] ?? 0}</td>
              {r.possivelPorTamanho && <td>{r.possivelPorTamanho[t] ?? 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="tabela-de-relatorio">
        <caption>Enfestos</caption>
        <thead>
          <tr>
            <th scope="col">Enfesto</th>
            <th scope="col">Risco</th>
            <th scope="col">Camadas</th>
            <th scope="col">Folhas</th>
            <th scope="col">Altura</th>
            <th scope="col">Peso</th>
            <th scope="col">Lote · tonalidade</th>
          </tr>
        </thead>
        <tbody>
          {r.enfestos.map((x) => {
            const risco = r.riscos.find((y) => y.chave === x.chave);
            return (
              <tr key={x.numero}>
                <td>{x.numero}</td>
                <td>{risco ? escreverGrade(risco.grade) : x.chave}</td>
                <td>{x.camadas}</td>
                <td>{x.folhas}</td>
                <td>{x.alturaMm !== null ? `${(x.alturaMm / 10).toFixed(1).replace('.', ',')} cm` : '—'}</td>
                <td>{x.pesoG !== null ? escreverKg(x.pesoG) : '—'}</td>
                <td>{x.grupos.length > 0 ? x.grupos.join('; ') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {r.rolos && (
        <table className="tabela-de-relatorio">
          <caption>Rolos</caption>
          <thead>
            <tr>
              <th scope="col">Rolo</th>
              <th scope="col">Lote · tonalidade</th>
              <th scope="col">Comprimento</th>
              <th scope="col">Largura na mesa</th>
              {comJaUsado && <th scope="col">Já usado por outros planos</th>}
              <th scope="col">Perda e defeitos</th>
              {comPuladoPorDefeito && <th scope="col">Pulado por defeito (com posição)</th>}
              <th scope="col">Camadas</th>
              {comEmendas && <th scope="col">Emendas</th>}
              <th scope="col">Usado</th>
              <th scope="col">Sobra do rolo</th>
            </tr>
          </thead>
          <tbody>
            {r.rolos.map((x) => (
              <tr key={x.id}>
                <td>{x.identificacao}</td>
                <td>{x.grupo}</td>
                <td>
                  {escreverM(x.comprimentoMm)} ({x.origemDoComprimento === 'medido' ? 'medido' : 'estimado pelo peso'})
                </td>
                <td>{escreverM(x.larguraMm)}</td>
                {comJaUsado && <td>{escreverM(x.jaUsadoMm ?? 0)}</td>}
                <td>{escreverM(x.perdasMm + x.defeitosMm)}</td>
                {comPuladoPorDefeito && <td>{escreverM(x.perdaPorDefeitoMm ?? 0)}</td>}
                <td>{Object.values(x.camadasPorRisco).reduce((s, n) => s + n, 0)}</td>
                {comEmendas && <td>{x.emendas ?? 0}</td>}
                <td>{escreverM(x.usadoMm)}</td>
                <td>{escreverM(x.sobraMm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {r.emendas && r.emendas.length > 0 && (
        <table className="tabela-de-relatorio">
          <caption>Emendas (a camada continua no rolo seguinte)</caption>
          <thead>
            <tr>
              <th scope="col">Risco</th>
              <th scope="col">Do rolo</th>
              <th scope="col">Para o rolo</th>
              <th scope="col">Onde (do começo do risco)</th>
              <th scope="col">Sobreposição</th>
            </tr>
          </thead>
          <tbody>
            {r.emendas.map((x, i) => {
              const risco = r.riscos.find((y) => y.chave === x.chave);
              const nome = (id: string): string => r.rolos?.find((y) => y.id === id)?.identificacao ?? id;
              return (
                <tr key={i}>
                  <td>{risco ? escreverGrade(risco.grade) : x.chave}</td>
                  <td>{nome(x.roloDe)}</td>
                  <td>{nome(x.roloPara)}</td>
                  <td>{escreverM(x.posicaoNoRiscoMm)}</td>
                  <td>{escreverM(x.sobreposicaoMm)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="nota-do-formulario">
        Perdas: pontas das camadas {escreverM(r.pontasMm)}; perda dos rolos {escreverM(r.perdaDosRolosMm)}; defeitos {escreverM(r.defeitosMm)}
        {r.perdaPorDefeitosMm ? `; trechos pulados por defeitos com posição ${escreverM(r.perdaPorDefeitosMm)}` : ''}
        {r.sobreposicoesMm ? `; sobreposição das emendas ${escreverM(r.sobreposicoesMm)}` : ''}.
        {r.eficienciaMediaPercentual !== null ? ` Eficiência média dos riscos: ${r.eficienciaMediaPercentual.toFixed(1).replace('.', ',')}% (área das peças ÷ comprimento × largura do risco).` : ''}
      </p>

      {props.alertas.length > 0 && (
        <ul className="alertas-do-plano" aria-label="Avisos do plano">
          {props.alertas.map((a, i) => (
            <li key={i} className={a.nivel === 'aviso' ? 'alerta-do-plano alerta-aviso' : 'alerta-do-plano alerta-info'}>
              {a.texto}
            </li>
          ))}
        </ul>
      )}

      {props.comDesenho && props.riscos.map((risco) => <DesenhoDoRisco key={risco.chave} risco={risco} tamanhos={props.tamanhos} />)}

      <details className="premissas-do-plano">
        <summary>Termos, premissas e configuração usadas</summary>
        <ul>
          <li>{DEFINICOES.risco}</li>
          {props.premissas.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
