import { escreverReais, type EstimativaDeCustoDoTecido } from '../domain/custoDoTecido';
import { escreverM, escreverM2, escreverRendimento } from '../domain/planoDeCorte';
import { ROTULO_DA_UNIDADE_DO_CUSTO, ROTULO_DO_TIPO_DE_TECIDO } from '../domain/tecido';

const NAO_CALCULADO = 'não calculado';
const emReais = (v: number | null): string => (v !== null ? escreverReais(v) : NAO_CALCULADO);
const emM2 = (mm2: number | null, casas = 2): string => (mm2 !== null ? escreverM2(mm2, casas) : NAO_CALCULADO);

/**
 * A estimativa do custo do tecido de um plano: os dados usados (com as unidades), o custo por unidade de cada tamanho,
 * os totais do enfesto e o que não foi calculado (com o motivo). Um custo que não saiu aparece como "não calculado",
 * nunca como zero. O plano guardado antes da estimativa diz que não a tem.
 */
export function CustoDoTecidoNoPlano(props: { readonly estimativa: EstimativaDeCustoDoTecido | 'sem-estimativa' }): React.JSX.Element {
  if (props.estimativa === 'sem-estimativa') {
    return (
      <section className="custo-do-tecido" aria-label="Custo do tecido">
        <p className="titulo-do-custo">Custo do tecido (estimativa)</p>
        <p className="nota-do-formulario">Este plano é de antes da estimativa de custo do tecido: ela não é feita depois, para o plano ficar como foi guardado.</p>
      </section>
    );
  }
  const e = props.estimativa;
  return (
    <section className="custo-do-tecido" aria-label="Custo do tecido">
      <p className="titulo-do-custo">Custo do tecido (estimativa — só o tecido, não é o custo definitivo de produção)</p>
      <p className="resumo-do-plano">
        Tipo de tecido: {e.tipoDeTecido ? ROTULO_DO_TIPO_DE_TECIDO[e.tipoDeTecido] : 'Não informado'}.
        <br />
        Custo informado: {e.custoInformado ? `${escreverReais(e.custoInformado.valor)} ${ROTULO_DA_UNIDADE_DO_CUSTO[e.custoInformado.unidade]}` : 'Não informado'}.
        {e.rendimentoMmPorG !== null && (
          <>
            <br />
            Rendimento usado: {escreverRendimento(e.rendimentoMmPorG)} ({e.origemDoRendimento === 'informado' ? 'informado' : 'calculado pela largura e gramatura'}).
          </>
        )}
        <br />
        Largura: {escreverM(e.larguraUtilMm)} útil; {escreverM(e.larguraNaMesaMm)} na mesa × {e.folhasPorCamada} folha(s) por camada
        {e.larguraDeMalhaPorMetroMm !== null ? ` = ${escreverM2(e.larguraDeMalhaPorMetroMm * 1000)} de malha por metro` : ''}.
        <br />
        Comprimento: {escreverM(e.comprimentoMm)} de malha (as camadas do enfesto, com as pontas).
        {e.custoPorM2 !== null && e.custoPorMetroLinear !== null && (
          <>
            <br />
            Custo por metro: {escreverReais(e.custoPorMetroLinear)}; por m²: {escreverReais(e.custoPorM2)}.
          </>
        )}
      </p>

      {e.faltas.length > 0 && (
        <div role="note" className="faltas-do-plano" aria-label="O que falta para o custo">
          <p>O que não foi calculado, e por quê:</p>
          <ul>
            {e.faltas.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <table className="tabela-de-relatorio">
        <caption>Por unidade (uma roupa), por tamanho</caption>
        <thead>
          <tr>
            <th scope="col">Tamanho</th>
            <th scope="col" className="coluna-numerica">Área de uma roupa</th>
            <th scope="col" className="coluna-numerica">Custo direto (as peças)</th>
            <th scope="col" className="coluna-numerica">Com a perda rateada pela área</th>
            <th scope="col" className="coluna-numerica">Unidades produzidas</th>
          </tr>
        </thead>
        <tbody>
          {e.porTamanho.map((t) => (
            <tr key={t.tamanho}>
              <th scope="row">{t.tamanho}</th>
              <td className="coluna-numerica">{t.areaPorUnidadeMm2 > 0 ? escreverM2(t.areaPorUnidadeMm2, 4) : NAO_CALCULADO}</td>
              <td className="coluna-numerica">{emReais(t.custoDiretoPorUnidade)}</td>
              <td className="coluna-numerica">{emReais(t.custoPorUnidadeComPerda)}</td>
              <td className="coluna-numerica">{t.unidadesProduzidas}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="tabela-de-relatorio">
        <caption>O enfesto inteiro</caption>
        <thead>
          <tr>
            <th scope="col"> </th>
            <th scope="col" className="coluna-numerica">Área</th>
            <th scope="col" className="coluna-numerica">Custo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Malha do enfesto (custo total)</th>
            <td className="coluna-numerica">{emM2(e.areaTotalMm2)}</td>
            <td className="coluna-numerica">{emReais(e.custoTotal)}</td>
          </tr>
          <tr>
            <th scope="row">Peças cortadas (custo direto)</th>
            <td className="coluna-numerica">{emM2(e.areaDasPecasMm2)}</td>
            <td className="coluna-numerica">{emReais(e.custoDiretoTotal)}</td>
          </tr>
          <tr>
            <th scope="row">Área não aproveitada estimada</th>
            <td className="coluna-numerica">{emM2(e.naoAproveitada?.totalMm2 ?? null)}</td>
            <td className="coluna-numerica">{emReais(e.custoNaoAproveitado)}</td>
          </tr>
          {e.naoAproveitada?.partes.map((p) => (
            <tr key={p.rotulo} className="parte-nao-aproveitada">
              <td>— {p.rotulo}</td>
              <td className="coluna-numerica">{escreverM2(p.areaMm2)}</td>
              <td className="coluna-numerica">{emReais(p.custo)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Custo médio por unidade (custo total ÷ {e.unidadesProduzidas} unidades produzidas)</th>
            <td> </td>
            <td className="coluna-numerica">{emReais(e.custoMedioPorUnidade)}</td>
          </tr>
        </tbody>
      </table>

      {e.foraDoEnfesto.length > 0 && (
        <p className="nota-do-formulario">
          Fora do enfesto (não somado ao custo acima):{' '}
          {e.foraDoEnfesto.map((p) => `${p.rotulo.toLowerCase()} ${escreverM(p.comprimentoMm)}${p.custo !== null ? ` (${escreverReais(p.custo)})` : ''}`).join('; ')}.
        </p>
      )}

      {e.avisos.length > 0 && (
        <ul className="alertas-do-plano" aria-label="Avisos do custo">
          {e.avisos.map((a) => (
            <li key={a} className="alerta-do-plano alerta-aviso">
              {a}
            </li>
          ))}
        </ul>
      )}

      <details>
        <summary>As peças de cada roupa (área real do contorno)</summary>
        <table className="tabela-de-relatorio">
          <thead>
            <tr>
              <th scope="col">Tamanho</th>
              <th scope="col">Peça</th>
              <th scope="col" className="coluna-numerica">Área de uma peça</th>
              <th scope="col" className="coluna-numerica">Por roupa</th>
              <th scope="col" className="coluna-numerica">Área na roupa</th>
            </tr>
          </thead>
          <tbody>
            {e.porTamanho.flatMap((t) =>
              t.pecas.map((p) => (
                <tr key={`${t.tamanho}-${p.pecaId}`}>
                  <td>{t.tamanho}</td>
                  <td>{p.nome}</td>
                  <td className="coluna-numerica">{escreverM2(p.areaMm2 * e.fatorDeArea, 4)}</td>
                  <td className="coluna-numerica">
                    {p.quantidadePorRoupa}
                    {p.emPar ? ' (em par)' : ''}
                  </td>
                  <td className="coluna-numerica">{escreverM2(p.areaMm2 * e.fatorDeArea * p.quantidadePorRoupa, 4)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </details>

      <details className="premissas-do-plano">
        <summary>Como o custo foi estimado (fórmulas e premissas)</summary>
        <ul>
          {e.premissas.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
