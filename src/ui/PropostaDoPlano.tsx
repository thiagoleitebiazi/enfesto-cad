import { ROTULO_DO_TIPO } from '../domain/enfesto';
import {
  escreverKg,
  escreverM,
  escreverM2,
  escreverRendimento,
  type AlertaDoPlano,
  type ConfiguracaoDoPlano,
  type EntradaDoPlano,
  type ResultadoDoPlano,
} from '../domain/planoDeCorte';

/**
 * A proposta de um plano da primeira versão do cálculo (um risco só), como foi guardada: os planos feitos antes do
 * planejamento com vários riscos continuam no projeto e aparecem assim, com os valores de então.
 */

/** A proposta: o resultado do plano, como se mostra — o calculado agora ou o de um plano guardado. */
export function PropostaDoPlano(props: {
  readonly entrada: EntradaDoPlano;
  readonly configuracao: ConfiguracaoDoPlano;
  readonly resultado: ResultadoDoPlano;
  readonly alertas: readonly AlertaDoPlano[];
  readonly premissas: readonly string[];
}): React.JSX.Element {
  const { entrada, configuracao: c, resultado: r } = props;
  const tamanhos = Object.keys(r.producaoPorTamanho);
  const rendimento = r.rendimentoUsadoMmPorG;
  const porEnfesto = r.enfestos.length > 0 && r.enfestos.every((n) => n === r.enfestos[0]) ? `${r.enfestos[0]} camadas` : r.enfestos.join(' + ') + ' camadas';
  return (
    <div className="proposta-do-plano">
      <p className="resumo-do-plano">
        Malha: {entrada.malha.descricao || '(sem descrição)'}
        {entrada.malha.gramaturaGm2 !== undefined && ` — gramatura ${String(entrada.malha.gramaturaGm2).replace('.', ',')} g/m²`}
        {r.rendimentoInformadoMmPorG !== null && ` — rendimento informado ${escreverRendimento(r.rendimentoInformadoMmPorG)}`}.
        <br />
        Molde: {entrada.molde.nome} ({entrada.molde.codigo}, revisão {entrada.molde.revisao}) — largura útil: {escreverM(entrada.malha.larguraUtilMm)}.
        <br />
        Risco: {escreverM(entrada.risco.comprimentoMm)} ({entrada.risco.origem === 'mesa' ? 'medido na mesa' : 'informado'}).
        <br />
        Mesa sugerida: {escreverM(r.comprimentoDaMesaMm)} × {escreverM(r.larguraDaMesaMm)} = {escreverM2(r.areaDaMesaMm2)}.
        <br />
        Enfesto sugerido: {porEnfesto} por enfesto, em {r.enfestos.length} enfesto(s) — {r.camadas} camada(s) no total.
        <br />
        Consumo estimado: {escreverM(r.consumoMm)}
        {r.consumoG !== null && ` (${escreverKg(r.consumoG)})`}. Sobra estimada: {escreverM(r.sobraMm)}
        {r.sobraG !== null && ` (${escreverKg(r.sobraG)})`}.
      </p>

      <dl className="lista-de-propriedades">
        <dt>Comprimento do risco</dt>
        <dd>
          {escreverM(entrada.risco.comprimentoMm)} × {escreverM(entrada.risco.larguraMm)} de largura
        </dd>
        <dt>Margens da mesa</dt>
        <dd>
          {escreverM(c.margemInicialDaMesaMm, 3)} no começo e {escreverM(c.margemFinalDaMesaMm, 3)} no fim
        </dd>
        <dt>Mesa</dt>
        <dd>
          {escreverM(r.comprimentoDaMesaMm)} × {escreverM(r.larguraDaMesaMm)} = {escreverM2(r.areaDaMesaMm2)}
          {r.comprimentoDaMesaMm !== r.comprimentoDaMesaSugeridoMm && ` (sugerida: ${escreverM(r.comprimentoDaMesaSugeridoMm)})`}
        </dd>
        <dt>Enfesto</dt>
        <dd>
          {ROTULO_DO_TIPO[entrada.tipoDeEnfesto]}, {r.folhasPorCamada} folha(s) por camada; até {r.camadasPorEnfestoMax} camadas por enfesto
        </dd>
        <dt>Camadas</dt>
        <dd>
          {r.camadas} (fecham a ordem: {r.camadasNecessarias}; o material dá: {r.camadasPossiveis})
        </dd>
        <dt>Enfestos</dt>
        <dd>
          {r.enfestos.length}: {r.enfestos.join(', ')} camadas
        </dd>
        <dt>Consumo por camada</dt>
        <dd>
          {escreverM(r.consumoPorCamadaMm, 3)} (risco + {escreverM(c.sobraPorCamadaMm, 3)} de pontas)
        </dd>
        <dt>Consumo estimado</dt>
        <dd>
          {escreverM(r.consumoMm)}
          {r.consumoG !== null && ` = ${escreverKg(r.consumoG)}`}
        </dd>
        <dt>Perda nas pontas</dt>
        <dd>{escreverM(r.perdaDePontasMm)} (dentro do consumo)</dd>
        <dt>Material disponível</dt>
        <dd>
          {escreverM(r.disponivelMm)}
          {r.disponivelG !== null && ` = ${escreverKg(r.disponivelG)}`}
        </dd>
        <dt>Sobra estimada</dt>
        <dd>
          {escreverM(r.sobraMm)}
          {r.sobraG !== null && ` = ${escreverKg(r.sobraG)}`}
          {r.rolos && ` (das quais ${escreverM(r.rolos.filter((x) => x.compativel).reduce((s, x) => s + x.pontaMm, 0))} em pontas de rolo)`}
        </dd>
        {r.deficitMm > 0 && (
          <>
            <dt>Falta de material</dt>
            <dd>
              {escreverM(r.deficitMm)}
              {r.deficitG !== null && ` = ${escreverKg(r.deficitG)}`}
            </dd>
          </>
        )}
        <dt>Rendimento usado</dt>
        <dd>
          {rendimento !== null ? `${escreverRendimento(rendimento)} (${r.origemDoRendimento === 'informado' ? 'informado' : 'calculado pela largura e gramatura'})` : '—'}
          {r.rendimentoInformadoMmPorG !== null && r.rendimentoCalculadoMmPorG !== null &&
            ` — informado ${escreverRendimento(r.rendimentoInformadoMmPorG)}, calculado ${escreverRendimento(r.rendimentoCalculadoMmPorG)}`}
        </dd>
        <dt>Eficiência do encaixe</dt>
        <dd>{r.eficienciaPercentual !== null ? `${r.eficienciaPercentual.toFixed(1).replace('.', ',')}%` : '— (só com o risco medido na mesa)'}</dd>
      </dl>

      <table className="tabela-de-relatorio">
        <thead>
          <tr>
            <th>Tamanho</th>
            <th>Ordem</th>
            <th>Por camada</th>
            <th>Produção prevista</th>
            <th>Falta</th>
            <th>A mais</th>
          </tr>
        </thead>
        <tbody>
          {tamanhos.map((t) => (
            <tr key={t}>
              <td>{t}</td>
              <td>{entrada.ordem.quantidadesPorTamanho[t] ?? 0}</td>
              <td>{(entrada.risco.gradePorTamanho[t] ?? 0) * r.folhasPorCamada}</td>
              <td>{r.producaoPorTamanho[t]}</td>
              <td>{r.faltaPorTamanho[t]}</td>
              <td>{r.excedentePorTamanho[t]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {r.rolos && (
        <table className="tabela-de-relatorio">
          <thead>
            <tr>
              <th>Rolo (lote)</th>
              <th>Comprimento</th>
              <th>Camadas</th>
              <th>Ponta que sobra</th>
            </tr>
          </thead>
          <tbody>
            {r.rolos.map((x) => (
              <tr key={x.id}>
                <td>{x.lote || '(sem lote)'}</td>
                <td>{escreverM(x.comprimentoMm)}</td>
                <td>{x.compativel ? x.camadas : 'não serve (estreito)'}</td>
                <td>{escreverM(x.pontaMm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {props.alertas.length > 0 && (
        <ul className="alertas-do-plano">
          {props.alertas.map((a, i) => (
            <li key={i} className={`alerta-do-plano alerta-${a.nivel}`}>
              {a.texto}
            </li>
          ))}
        </ul>
      )}
      <details className="premissas-do-plano">
        <summary>Premissas</summary>
        <ul>
          {props.premissas.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/**
 * O planejamento de corte: o risco, a ordem e a malha entram; a mesa, as camadas, os enfestos, o consumo e a
 * sobra saem, calculados a cada mudança, com os alertas e as premissas. Quem planeja revisa, ajusta e confirma.
 */
