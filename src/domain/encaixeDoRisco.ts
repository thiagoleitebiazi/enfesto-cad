import { retanguloEnvolvente } from '../core/geometria';
import { moverParaForaDoEnfesto } from './encaixeManual';
import { dobraDoEnfesto, margensDaMesa, type DobraDoTecido } from './enfesto';
import { linhaDeCorteDaPeca, transladarMolde, type Molde } from './molde';
import type { ModeloDoPlano } from './modeloDoPlano';
import type { PlanoDeCorteV2 } from './planejamento';
import { enfestoDoPlano } from './planoDeCorte';
import type { EstadoDoProjeto, Projeto } from './projeto';
import type { RiscoDoPlanejamento } from './planoDeEnfesto';
import { moldeOrientado, type PecaPostaNoRisco } from './risco';
import { expandirComGrade } from './tamanhosGraduados';

/**
 * "Criar arquivos de encaixe" (ADR 0212): cada risco do plano vira um projeto, com a mesa dele e as camadas dele. As
 * peças ficam no lugar em que o plano as pôs; o risco informado à mão não tem lugar nenhum, e as peças dele ficam fora
 * da mesa, na grade certa, esperando o encaixe.
 */

function pecaNoLugar(posta: PecaPostaNoRisco, modelo: ModeloDoPlano, novoId: () => string): Molde | null {
  const doModelo = modelo.pecasPorTamanho[posta.tamanho]?.find((p) => p.pecaId === posta.pecaId);
  if (!doModelo || !posta.deslocamentoMm) return null;
  const { molde } = doModelo;
  const peca = { pecaId: posta.pecaId, nome: molde.nome, tamanho: posta.tamanho, molde, espelhada: molde.emPar === true && posta.espelhada };
  return { ...transladarMolde(moldeOrientado(peca, posta), posta.deslocamentoMm, novoId()), quantidade: 1 };
}

/** As peças do risco no lugar; `null` se alguma não tem lugar (o risco informado, ou guardado antes do deslocamento). */
function pecasNoLugar(risco: RiscoDoPlanejamento, modelo: ModeloDoPlano, novoId: () => string): Molde[] | null {
  if (risco.pecas.length === 0) return null;
  const pecas = risco.pecas.map((p) => pecaNoLugar(p, modelo, novoId));
  return pecas.every((p) => p !== null) ? pecas : null;
}

/**
 * O risco nasce encostado na borda; a mesa do projeto tem a margem de segurança. As peças andam até ela, todas juntas,
 * menos no sentido da dobra: ali elas têm de encostar.
 */
function dentroDasMargens(pecas: readonly Molde[], margens: ReturnType<typeof margensDaMesa>, dobra: DobraDoTecido | null): { readonly pecas: Molde[]; readonly maxX: number; readonly maxY: number } {
  const caixa = retanguloEnvolvente(pecas.flatMap((p) => [...linhaDeCorteDaPeca(p)]));
  const x = dobra === 'horizontal' ? 0 : Math.max(0, margens.lateralMm - caixa.minX);
  const y = dobra === 'vertical' ? 0 : Math.max(0, margens.extremidadeMm - caixa.minY);
  return { pecas: pecas.map((p) => transladarMolde(p, { x, y }, p.id)), maxX: caixa.maxX + x, maxY: caixa.maxY + y };
}

export function estadosDosRiscos(plano: Pick<PlanoDeCorteV2, 'riscos' | 'resultado' | 'entrada'>, modelo: ModeloDoPlano, base: EstadoDoProjeto, distanciaPadraoMm: number, novoId: () => string): EstadoDoProjeto[] {
  return plano.riscos.map((risco) => {
    const camadas = plano.resultado.riscos.find((r) => r.chave === risco.chave)?.camadas ?? 1;
    const margens = margensDaMesa(base.enfesto ?? { margemLateralMm: 0, margemDeExtremidadeMm: 0 });
    const lugar = pecasNoLugar(risco, modelo, novoId);
    const noLugar = lugar ? dentroDasMargens(lugar, margens, dobraDoEnfesto(plano.entrada.tipoDeEnfesto)) : null;
    const largura = noLugar ? Math.max(risco.larguraDoRiscoMm, noLugar.maxX + margens.lateralMm) : risco.larguraDoRiscoMm;
    const enfesto = enfestoDoPlano(base.enfesto, plano.entrada.tipoDeEnfesto, { larguraDaMesaMm: largura, comprimentoDaMesaMm: risco.comprimentoMm, enfestos: [camadas] }, distanciaPadraoMm, noLugar?.maxY ?? 0);
    if (noLugar) return { pecas: noLugar.pecas, tecido: base.tecido, enfesto };
    const nasGrades = expandirComGrade(base.pecas, novoId, risco.grade);
    return { pecas: moverParaForaDoEnfesto(nasGrades, new Set(nasGrades.map((p) => p.id)), enfesto), tecido: base.tecido, enfesto };
  });
}

/** O projeto já criado para este risco: criar de novo atualiza esse, em vez de fazer outro (ADR 0219). */
export function arquivoDoRisco(projetos: readonly Projeto[], origem: NonNullable<Projeto['origemDoPlano']>): Projeto | undefined {
  return projetos.find((p) => p.origemDoPlano?.projetoId === origem.projetoId && p.origemDoPlano.chaveDoRisco === origem.chaveDoRisco);
}
