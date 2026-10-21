import type { Ponto2D } from '../core/geometria';
import { comOFioNaHorizontal, criarMolde, type Molde } from '../domain/molde';
import { alturaDoDesenho, dxfParaMundo, type ResultadoImportacaoDxf } from './dxf-importacao';
import { contornoEmMundo, linhaDeFioSobreContorno, type ResultadoContornosPdf } from './pdf-pecas-vetoriais';

/**
 * A importação direta (pedido do usuário, ADR 0091): o arquivo vira peças sem perguntar nada — o nome vem do
 * arquivo, e o fio fica sempre na horizontal da tela (o comprimento do tecido na mesa).
 *
 * - A peça sem linha de fio no arquivo recebe uma, deitada, no meio dela.
 * - A peça com a linha de fio do arquivo em outra direção é girada até o fio ficar deitado (só trocar a seta, sem
 *   girar, faria cortá-la fora do fio). A orientação que sai é a de origem da peça.
 */

export interface PecasImportadas {
  readonly moldes: Molde[];
  /** Os nomes das peças giradas para o fio ficar na horizontal, com o giro (graus, anti-horário na tela). */
  readonly giradas: readonly { readonly nome: string; readonly giroGraus: number }[];
  /** Os nomes das peças que não tinham linha de fio no arquivo. */
  readonly semFioNoArquivo: readonly string[];
}

/** As peças do DXF no mundo (como a tela as mostra), com o nome do arquivo e o fio na horizontal. */
export function moldesDoDxf(resultado: ResultadoImportacaoDxf, novoId: () => string): PecasImportadas {
  const altura = alturaDoDesenho(resultado);
  const noMundo = (pontos: readonly Ponto2D[]): Ponto2D[] => pontos.map((p) => dxfParaMundo(p, altura));
  const giradas: { nome: string; giroGraus: number }[] = [];
  const semFioNoArquivo: string[] = [];
  const moldes = resultado.pecas.map((peca) => {
    const contorno = noMundo(peca.contorno);
    const doArquivo = peca.linhaDeFio ? { inicio: dxfParaMundo(peca.linhaDeFio.inicio, altura), fim: dxfParaMundo(peca.linhaDeFio.fim, altura) } : null;
    if (!doArquivo) semFioNoArquivo.push(peca.nome);
    const molde = criarMolde(
      {
        nome: peca.nome,
        referencia: '',
        tamanho: '',
        contorno,
        furos: peca.furos.map(noMundo),
        linhasInternas: peca.linhasInternas.map(noMundo),
        piques: peca.piques.map((p) => ({ id: novoId(), posicao: dxfParaMundo(p.posicao, altura), indiceAresta: p.indiceAresta })),
        linhaDeFio: doArquivo ?? linhaDeFioSobreContorno(contorno, 'horizontal'),
      },
      novoId(),
    );
    const deitada = comOFioNaHorizontal(molde);
    if (deitada.giroGraus !== 0) giradas.push({ nome: peca.nome, giroGraus: deitada.giroGraus });
    return deitada.molde;
  });
  return { moldes, giradas, semFioNoArquivo };
}

/**
 * Os contornos de um PDF de outro programa como peças, no tamanho do papel (1 ponto = 1/72 de polegada), com o nome
 * do arquivo e o fio na horizontal.
 */
export function moldesDosContornosDoPdf(contornos: ResultadoContornosPdf, nomeBase: string, novoId: () => string): Molde[] {
  if (contornos.alturaPaginaPt === null) return [];
  const altura = contornos.alturaPaginaPt;
  return contornos.candidatos.map((candidato, i) => {
    const contorno = contornoEmMundo(candidato, altura, 1);
    return criarMolde(
      {
        nome: contornos.candidatos.length === 1 ? nomeBase : `${nomeBase}-${i + 1}`,
        referencia: '',
        tamanho: '',
        contorno,
        linhaDeFio: linhaDeFioSobreContorno(contorno, 'horizontal'),
      },
      novoId(),
    );
  });
}
