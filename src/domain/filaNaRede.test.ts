import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import type { ResultadoDeNesting } from './nesting';
import {
  adicionarTrabalho,
  cancelarTrabalho,
  concluidosSemAplicar,
  concluirTrabalho,
  contagemDaFila,
  enviarParaARede,
  FILA_VAZIA,
  iniciarTrabalho,
  lerFilaDeEncaixes,
  proximoTrabalho,
  receberDaRede,
  removerTrabalho,
  trabalhosNaOrdem,
  trazerDaRede,
  type DadosDoTrabalho,
  type FilaDeEncaixes,
} from './filaDeEncaixes';
import {
  buscarProntos,
  dadosDoPedido,
  devolverPedido,
  entregarPronto,
  lerPedido,
  lerPronto,
  mandarPedido,
  pedidoDoTrabalho,
  pegarOProximoPedido,
  prontoDoTrabalho,
  retirarPedido,
} from './filaNaRede';
import type { PastaDeArquivos } from './pastaCompartilhada';

const ENFESTO: ConfiguracaoDeEnfesto = criarConfiguracaoDeEnfesto({
  tipo: 'impar',
  larguraUtilMm: 1000,
  comprimentoMm: 3000,
  quantidadeDeCamadas: 1,
  margemLateralMm: 0,
  margemDeExtremidadeMm: 0,
  distanciaMinimaEntrePecasMm: 5,
} as ConfiguracaoDeEnfesto);

const PECA = criarMolde(
  { nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 400), ponto(0, 400)], linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 350) } },
  'frente',
);

const dados = (projetoId = 'p1'): DadosDoTrabalho => ({
  projetoId,
  projetoNome: `Projeto ${projetoId}`,
  projetoCodigo: `C-${projetoId}`,
  impressaoDasPecas: 'abc',
  prioridade: 'normal',
  pecas: [PECA],
  enfesto: ENFESTO,
  opcoes: { metodo: 'grade' },
});

const AGORA = '2026-10-26T10:00:00.000Z';
const RESULTADO: ResultadoDeNesting = {
  pecasColocadas: [{ idOriginal: 'frente', indiceCopia: 0, molde: PECA }],
  pecasNaoColocadas: [],
  comprimentoUtilizadoMm: 400,
  areaOcupadaMm2: 120_000,
  aproveitamentoPercentual: 30,
  tempoDeProcessamentoMs: 100,
  interrompido: false,
  paradaPorTempoLimite: false,
  paradaPorMetaDeAproveitamento: false,
};

const comUm = (): FilaDeEncaixes => adicionarTrabalho(FILA_VAZIA, dados(), 't1', AGORA);

/** Uma pasta na memória: subpasta → nome → texto; `levar` simula outra estação levando antes. */
function pastaNaMemoria(levar: readonly string[] = []): PastaDeArquivos & { readonly pastas: Map<string, Map<string, string>> } {
  const pastas = new Map<string, Map<string, string>>(['pedidos', 'calculando', 'prontos'].map((s) => [s, new Map()]));
  return {
    pastas,
    listar: async (sub) => [...pastas.get(sub)!.keys()].map((nome) => ({ nome })),
    ler: async (sub, nome) => pastas.get(sub)!.get(nome) ?? null,
    gravar: async (sub, nome, texto) => {
      pastas.get(sub)!.set(nome, texto);
      return true;
    },
    mover: async (de, nome, para, novoNome) => {
      const texto = pastas.get(de)!.get(nome);
      if (texto === undefined || levar.includes(nome) || pastas.get(para)!.has(novoNome)) return false;
      pastas.get(de)!.delete(nome);
      pastas.get(para)!.set(novoNome, texto);
      return true;
    },
    criarSeNaoExiste: async () => false,
    apagar: async (sub, nome) => pastas.get(sub)!.delete(nome),
  };
}

describe('a fila de encaixes com a rede (ADR 0143)', () => {
  it('mandar para a rede: sai da vez desta estação, aparece na lista, não é removido sem trazer de volta', () => {
    const f = enviarParaARede(comUm(), 't1', AGORA);
    expect(f.trabalhos[0]).toMatchObject({ situacao: 'na-rede', enviadoParaARedeEmIso: AGORA });
    expect(proximoTrabalho(f)).toBeNull();
    expect(trabalhosNaOrdem(f).map((t) => t.id)).toEqual(['t1']);
    expect(contagemDaFila(f)['na-rede']).toBe(1);
    expect(removerTrabalho(f, 't1')).toBe(f);
    expect(cancelarTrabalho(f, 't1', AGORA)).toBe(f);
    // Trazer de volta: espera a vez aqui de novo, sem a hora do envio.
    const devolta = trazerDaRede(f, 't1');
    expect(devolta.trabalhos[0]!.situacao).toBe('aguardando');
    expect(devolta.trabalhos[0]!.enviadoParaARedeEmIso).toBeUndefined();
    // O que está calculando aqui não vai para a rede.
    const calculando = iniciarTrabalho(comUm(), 't1', AGORA);
    expect(enviarParaARede(calculando, 't1', AGORA)).toBe(calculando);
  });

  it('receber da rede: concluído com o encaixe e quem calculou, ou com falha', () => {
    const f = enviarParaARede(comUm(), 't1', AGORA);
    const ok = receberDaRede(f, 't1', { calculadoPor: 'Estação 2', terminadoEmIso: '2026-10-26T10:05:00.000Z', resultado: RESULTADO });
    expect(ok.trabalhos[0]).toMatchObject({ situacao: 'concluido', calculadoPor: 'Estação 2', terminadoEmIso: '2026-10-26T10:05:00.000Z', resultado: RESULTADO });
    expect(concluidosSemAplicar(ok)).toBe(1);
    const falhou = receberDaRede(f, 't1', { calculadoPor: 'Estação 2', terminadoEmIso: AGORA, erro: 'sem memória' });
    expect(falhou.trabalhos[0]).toMatchObject({ situacao: 'falhou', erro: 'sem memória' });
    // Só vale para o que está na rede.
    expect(receberDaRede(comUm(), 't1', { calculadoPor: 'x', terminadoEmIso: AGORA, resultado: RESULTADO })).toEqual(comUm());
    // A fila gravada com um trabalho na rede é lida de volta.
    expect(lerFilaDeEncaixes(JSON.parse(JSON.stringify(f))).fila.trabalhos[0]!.situacao).toBe('na-rede');
  });

  it('o pedido de uma estação vira um trabalho da fila de quem atende; o resultado volta como pronto', () => {
    const t = comUm().trabalhos[0]!;
    const pedido = pedidoDoTrabalho(t, 'Estação 1', AGORA);
    expect(lerPedido(JSON.stringify(pedido))).toEqual(pedido);
    expect(lerPedido('{"id":"x"}')).toBeNull();
    expect(lerPedido('não é json')).toBeNull();
    let atende = adicionarTrabalho(FILA_VAZIA, dadosDoPedido(pedido), 'rede-t1', AGORA);
    expect(atende.trabalhos[0]!.pedidoDaRede).toEqual({ id: 't1', pedidoPor: 'Estação 1' });
    expect(prontoDoTrabalho(atende.trabalhos[0]!, 'Estação 2', AGORA)).toBeNull();
    atende = concluirTrabalho(iniciarTrabalho(atende, 'rede-t1', AGORA), 'rede-t1', RESULTADO, '2026-10-26T10:05:00.000Z');
    // O pedido de outra estação não conta como "pronto para aplicar" aqui.
    expect(concluidosSemAplicar(atende)).toBe(0);
    const pronto = prontoDoTrabalho(atende.trabalhos[0]!, 'Estação 2', AGORA)!;
    expect(pronto).toEqual({ id: 't1', calculadoPor: 'Estação 2', terminadoEmIso: '2026-10-26T10:05:00.000Z', resultado: RESULTADO });
    expect(lerPronto(JSON.stringify(pronto))).toEqual(pronto);
    const cancelado = cancelarTrabalho(adicionarTrabalho(FILA_VAZIA, dadosDoPedido(pedido), 'rede-t1', AGORA), 'rede-t1', AGORA);
    expect(prontoDoTrabalho(cancelado.trabalhos[0]!, 'Estação 2', AGORA)).toMatchObject({ erro: 'cancelado na estação Estação 2' });
  });

  it('na pasta: mandar, pegar o mais antigo (o levado por outra estação é pulado), entregar e buscar o pronto', async () => {
    const pasta = pastaNaMemoria(['t1.json']);
    const fila = adicionarTrabalho(comUm(), dados('p2'), 't2', AGORA);
    for (const t of fila.trabalhos) await mandarPedido(pasta, pedidoDoTrabalho(t, 'Estação 1', AGORA));
    pasta.pastas.get('pedidos')!.set('lixo.json', '{"x":1}');
    const pedido = await pegarOProximoPedido(pasta);
    expect(pedido?.id).toBe('t2');
    expect([...pasta.pastas.get('calculando')!.keys()]).toEqual(['t2.json']);
    // O que não é pedido foi levado e apagado.
    expect(await pegarOProximoPedido(pasta)).toBeNull();
    expect([...pasta.pastas.get('pedidos')!.keys()]).toEqual(['t1.json']);
    expect(await buscarProntos(pasta, ['t2'])).toEqual([]);
    const pronto = { id: 't2', calculadoPor: 'Estação 2', terminadoEmIso: AGORA, resultado: RESULTADO };
    expect(await entregarPronto(pasta, pronto)).toBe(true);
    expect(pasta.pastas.get('calculando')!.size).toBe(0);
    expect(await buscarProntos(pasta, ['t1', 't2'])).toEqual([pronto]);
  });

  it('retirar o pedido que ninguém levou; devolver um levado à pasta de pedidos', async () => {
    const pasta = pastaNaMemoria();
    await mandarPedido(pasta, pedidoDoTrabalho(comUm().trabalhos[0]!, 'Estação 1', AGORA));
    expect(await retirarPedido(pasta, 't1')).toBe(true);
    expect(await retirarPedido(pasta, 't1')).toBe(false);
    await mandarPedido(pasta, pedidoDoTrabalho(comUm().trabalhos[0]!, 'Estação 1', AGORA));
    await pegarOProximoPedido(pasta);
    expect(await devolverPedido(pasta, 't1')).toBe(true);
    expect([...pasta.pastas.get('pedidos')!.keys()]).toEqual(['t1.json']);
  });
});
