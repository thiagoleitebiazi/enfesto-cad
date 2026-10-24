import { useState } from 'react';
import { estadoDoRolo, type CadastroDeProducao } from '../domain/cadastroDeProducao';
import {
  cancelarAExecucao,
  comparativoDaExecucao,
  concluirOCorte,
  execucaoAtualDoPlano,
  execucoesDoPlano,
  iniciarOCorte,
  liberarParaOCorte,
  planoParaExecutar,
  ROTULO_DA_SITUACAO,
  type ResultadoDaConclusao,
} from '../domain/execucaoDoCorte';
import { escreverM } from '../domain/planoDeCorte';
import type { PlanoDeCorteV2 } from '../domain/planejamento';
import { numeroComVirgula } from '../core/numeros';
import { lerMedida } from './medidas';

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const quando = (iso: string): string => DATA.format(new Date(iso));
/** Metros para o campo: com vírgula, sem zeros sobrando. */
const emMetros = (mm: number): string => numeroComVirgula(Math.round(mm) / 1000);
const duracao = (min: number): string => (min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`);

/**
 * A execução do corte de um plano confirmado (ADR 0098): liberar para a sala de corte, começar e concluir o corte
 * com o que de fato aconteceu (as camadas e o consumo real de cada rolo), e o comparativo planejado × executado.
 * Os nomes e as horas são os informados por quem opera; o programa não se liga a máquina nenhuma.
 */
export function ExecucaoDoPlano(props: {
  readonly plano: PlanoDeCorteV2;
  readonly cadastro: CadastroDeProducao;
  readonly responsavelSugerido: string;
  readonly agoraIso: () => string;
  readonly novoId: (prefixo: string) => string;
  /** Faz a mudança no cadastro e grava; devolve se deu certo (a mensagem aparece na janela). */
  readonly onMudar: (mudar: () => CadastroDeProducao, sucesso: string) => Promise<boolean>;
}): React.JSX.Element {
  const { plano, cadastro } = props;
  const paraExecutar = planoParaExecutar(plano);
  const execucao = execucaoAtualDoPlano(cadastro, plano.id);
  const canceladas = execucoesDoPlano(cadastro, plano.id).filter((e) => e.situacao === 'cancelada');
  const [quem, setQuem] = useState(props.responsavelSugerido);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [camadas, setCamadas] = useState(String(paraExecutar.camadas));
  const [consumos, setConsumos] = useState<Record<string, string>>(() => Object.fromEntries(paraExecutar.usos.map((u) => [u.roloId, emMetros(u.comprimentoMm)])));
  const [retalhos, setRetalhos] = useState<Record<string, boolean>>({});
  const [consumoTotal, setConsumoTotal] = useState(emMetros(paraExecutar.consumoMm));
  const [observacoes, setObservacoes] = useState('');

  if (plano.situacao !== 'confirmado') return <p className="nota-do-formulario">A execução do corte começa depois que o plano é confirmado.</p>;

  const nomeDoRolo = (id: string): string => cadastro.rolos.find((r) => r.id === id)?.identificacao ?? id;
  const mudar = (fazer: () => CadastroDeProducao, sucesso: string): Promise<boolean> => props.onMudar(fazer, sucesso);

  /** Calcula a conclusão primeiro (o erro aparece na janela, sem mudar nada) e grava uma vez só. */
  const concluir = (): void => {
    if (!execucao) return;
    const metros = (texto: string | undefined): number => {
      const m = lerMedida(texto ?? '');
      return m === null || (texto ?? '').trim() === '' ? Number.NaN : m * 1000;
    };
    let resultado: ResultadoDaConclusao;
    try {
      resultado = concluirOCorte(cadastro, execucao.id, paraExecutar, {
        responsavel: quem,
        agoraIso: props.agoraIso(),
        camadasRealizadas: camadas.trim() === '' ? Number.NaN : Number(camadas.trim()),
        ...(paraExecutar.usos.length > 0
          ? { consumoPorRolo: paraExecutar.usos.map((u) => ({ roloId: u.roloId, realMm: metros(consumos[u.roloId]), sobraViraRetalho: retalhos[u.roloId] === true })) }
          : { consumoRealMm: metros(consumoTotal) }),
        observacoes,
        novoId: () => props.novoId('mov'),
      });
    } catch (e) {
      void mudar(() => {
        throw e;
      }, '');
      return;
    }
    void mudar(() => resultado.cadastro, ['Corte concluído.', ...resultado.mensagens].join(' '));
  };

  const cancelar = (): void => {
    if (!execucao) return;
    void mudar(() => cancelarAExecucao(cadastro, execucao.id, { responsavel: quem, motivo, agoraIso: props.agoraIso() }), 'Execução cancelada (fica no registro, com o motivo).').then((ok) => {
      if (ok) {
        setCancelando(false);
        setMotivo('');
      }
    });
  };

  const comparativo = execucao?.situacao === 'concluida' ? comparativoDaExecucao(execucao) : null;
  const sinal = (n: number): string => (n > 0 ? '+' : n < 0 ? '−' : '');
  const diferenca = (mm: number | null, percentual: number | null): string =>
    mm === null ? '—' : `${sinal(mm)}${escreverM(Math.abs(mm))}${percentual === null ? '' : ` (${sinal(mm)}${numeroComVirgula(Math.abs(percentual), 1)}%)`}`;

  return (
    <section className="execucao-do-plano" aria-label="Execução do corte">
      <h4>Execução do corte</h4>
      <p className="nota-do-formulario">
        Situação: <strong className={`situacao-da-execucao situacao-${execucao?.situacao ?? 'nao-liberada'}`}>{execucao ? ROTULO_DA_SITUACAO[execucao.situacao] : 'Não liberada'}</strong>
        {execucao && ` — liberada em ${quando(execucao.liberadaEmIso)} por ${execucao.liberadaPor}`}
        {execucao?.iniciadaEmIso && `; corte começado em ${quando(execucao.iniciadaEmIso)} por ${execucao.operador}`}
        {execucao?.concluidaEmIso && `; concluído em ${quando(execucao.concluidaEmIso)} por ${execucao.concluidaPor}`}.
      </p>

      {execucao?.situacao !== 'concluida' && (
        <label>
          Quem faz (informado — o programa não tem login)
          <input type="text" value={quem} onChange={(e) => setQuem(e.target.value)} />
        </label>
      )}

      {!execucao && (
        <div className="acoes-em-linha">
          <button type="button" className="botao-primario" onClick={() => void mudar(() => liberarParaOCorte(cadastro, paraExecutar, { responsavel: quem, agoraIso: props.agoraIso(), novoId: () => props.novoId('exec') }), 'Plano liberado para o corte.')}>
            Liberar para o corte
          </button>
        </div>
      )}

      {execucao?.situacao === 'liberada' && (
        <div className="acoes-em-linha">
          <button type="button" className="botao-primario" onClick={() => void mudar(() => iniciarOCorte(cadastro, execucao.id, { operador: quem, agoraIso: props.agoraIso() }), 'Corte começado.')}>
            Começar o corte
          </button>{' '}
          <button type="button" onClick={() => setCancelando(true)}>
            Cancelar a liberação
          </button>
        </div>
      )}

      {execucao?.situacao === 'em-corte' && (
        <div className="conclusao-do-corte">
          <label>
            Camadas enfestadas (o plano: {paraExecutar.camadas})
            <input type="text" inputMode="numeric" value={camadas} onChange={(e) => setCamadas(e.target.value)} />
          </label>
          {paraExecutar.usos.length > 0 ? (
            <table className="tabela-de-relatorio">
              <caption>O consumo real de cada rolo (o que saiu dele: as camadas e as pontas)</caption>
              <thead>
                <tr>
                  <th scope="col">Rolo</th>
                  <th scope="col" className="coluna-numerica">O plano usa</th>
                  <th scope="col">Consumo real (m)</th>
                  <th scope="col">A sobra vira retalho</th>
                </tr>
              </thead>
              <tbody>
                {paraExecutar.usos.map((u) => (
                  <tr key={u.roloId}>
                    <td>{nomeDoRolo(u.roloId)}</td>
                    <td className="coluna-numerica">{escreverM(u.comprimentoMm)}</td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Consumo real do rolo ${nomeDoRolo(u.roloId)} (m)`}
                        value={consumos[u.roloId] ?? ''}
                        onChange={(e) => setConsumos({ ...consumos, [u.roloId]: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`A sobra do rolo ${nomeDoRolo(u.roloId)} vira retalho`}
                        checked={retalhos[u.roloId] === true}
                        onChange={(e) => setRetalhos({ ...retalhos, [u.roloId]: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <label>
              Consumo real de malha (m) — o plano usa um peso, sem rolos
              <input type="text" inputMode="decimal" value={consumoTotal} onChange={(e) => setConsumoTotal(e.target.value)} />
            </label>
          )}
          <label>
            Observações (opcional)
            <input type="text" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </label>
          <p className="nota-do-formulario">
            Ao concluir, a baixa do estoque fica sendo a do consumo real: a baixa planejada já dada é estornada (fica no histórico) e a do real entra no lugar.
          </p>
          <div className="acoes-em-linha">
            <button type="button" className="botao-primario" onClick={concluir}>
              Concluir o corte
            </button>{' '}
            <button type="button" onClick={() => setCancelando(true)}>
              Cancelar o corte
            </button>
          </div>
        </div>
      )}

      {cancelando && execucao && (execucao.situacao === 'liberada' || execucao.situacao === 'em-corte') && (
        <div className="acoes-em-linha">
          <input aria-label="Motivo do cancelamento" placeholder="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />{' '}
          <button type="button" onClick={cancelar}>
            Cancelar mesmo
          </button>{' '}
          <button type="button" onClick={() => setCancelando(false)}>
            Não
          </button>
        </div>
      )}

      {comparativo && execucao && (
        <>
          <table className="tabela-de-relatorio">
            <caption>Planejado × executado</caption>
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col" className="coluna-numerica">Planejado</th>
                <th scope="col" className="coluna-numerica">Executado</th>
                <th scope="col" className="coluna-numerica">Diferença</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Camadas</th>
                <td className="coluna-numerica">{comparativo.camadasPlanejadas}</td>
                <td className="coluna-numerica">{comparativo.camadasRealizadas ?? '—'}</td>
                <td className="coluna-numerica">
                  {comparativo.camadasRealizadas === null ? '—' : sinal(comparativo.camadasRealizadas - comparativo.camadasPlanejadas) + Math.abs(comparativo.camadasRealizadas - comparativo.camadasPlanejadas)}
                </td>
              </tr>
              <tr>
                <th scope="row">Consumo de malha</th>
                <td className="coluna-numerica">{escreverM(comparativo.consumoPlanejadoMm)}</td>
                <td className="coluna-numerica">{comparativo.consumoRealMm === null ? '—' : escreverM(comparativo.consumoRealMm)}</td>
                <td className="coluna-numerica">{diferenca(comparativo.diferencaMm, comparativo.diferencaPercentual)}</td>
              </tr>
              <tr>
                <th scope="row">Consumo por camada</th>
                <td className="coluna-numerica">{comparativo.consumoPorCamadaPlanejadoMm === null ? '—' : escreverM(comparativo.consumoPorCamadaPlanejadoMm)}</td>
                <td className="coluna-numerica">{comparativo.consumoPorCamadaRealMm === null ? '—' : escreverM(comparativo.consumoPorCamadaRealMm)}</td>
                <td className="coluna-numerica">
                  {comparativo.consumoPorCamadaPlanejadoMm === null || comparativo.consumoPorCamadaRealMm === null
                    ? '—'
                    : diferenca(comparativo.consumoPorCamadaRealMm - comparativo.consumoPorCamadaPlanejadoMm, null)}
                </td>
              </tr>
              <tr>
                <th scope="row">Tempo do corte</th>
                <td className="coluna-numerica">—</td>
                <td className="coluna-numerica">{comparativo.duracaoMin === null ? '—' : duracao(comparativo.duracaoMin)}</td>
                <td className="coluna-numerica">—</td>
              </tr>
            </tbody>
          </table>
          {execucao.consumoPorRolo && execucao.consumoPorRolo.length > 0 && (
            <table className="tabela-de-relatorio">
              <caption>Por rolo</caption>
              <thead>
                <tr>
                  <th scope="col">Rolo</th>
                  <th scope="col" className="coluna-numerica">Planejado</th>
                  <th scope="col" className="coluna-numerica">Real</th>
                  <th scope="col" className="coluna-numerica">Saldo agora</th>
                  <th scope="col">Sobra</th>
                </tr>
              </thead>
              <tbody>
                {execucao.consumoPorRolo.map((c) => {
                  const rolo = cadastro.rolos.find((r) => r.id === c.roloId);
                  const saldo = rolo ? estadoDoRolo(cadastro, rolo).saldoFisicoMm : null;
                  return (
                    <tr key={c.roloId}>
                      <td>{nomeDoRolo(c.roloId)}</td>
                      <td className="coluna-numerica">{escreverM(c.planejadoMm)}</td>
                      <td className="coluna-numerica">{escreverM(c.realMm)}</td>
                      <td className="coluna-numerica">{saldo === null ? '—' : escreverM(saldo)}</td>
                      <td>{c.sobraViraRetalho ? 'retalho' : 'continua no rolo'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {execucao.observacoes && <p className="nota-do-formulario">Observações: {execucao.observacoes}</p>}
          <p className="nota-do-formulario">As horas, as camadas e o consumo são os informados por quem operou: o programa não se liga a máquina nenhuma.</p>
        </>
      )}

      {canceladas.length > 0 && (
        <p className="nota-do-formulario">
          {canceladas.length === 1 ? 'Uma liberação cancelada' : `${canceladas.length} liberações canceladas`}:{' '}
          {canceladas.map((e) => `${quando(e.canceladaEmIso!)} por ${e.canceladaPor} — ${e.motivoDoCancelamento}`).join('; ')}.
        </p>
      )}
    </section>
  );
}
