import { retanguloEnvolvente } from '../core/geometria';
import { moverParaForaDoEnfesto } from './encaixeManual';
import { linhaDeCorteDaPeca, transladarMolde, type Molde } from './molde';
import type { ModeloDoPlano } from './modeloDoPlano';
import type { PlanoDeCorteV2 } from './planejamento';
import { enfestoDoPlano } from './planoDeCorte';
import type { EstadoDoProjeto } from './projeto';
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

export function estadosDosRiscos(plano: Pick<PlanoDeCorteV2, 'riscos' | 'resultado' | 'entrada'>, modelo: ModeloDoPlano, base: EstadoDoProjeto, distanciaPadraoMm: number, novoId: () => string): EstadoDoProjeto[] {
  return plano.riscos.map((risco) => {
    const camadas = plano.resultado.riscos.find((r) => r.chave === risco.chave)?.camadas ?? 1;
    const noLugar = pecasNoLugar(risco, modelo, novoId);
    const alcance = noLugar ? Math.max(...noLugar.map((p) => retanguloEnvolvente(linhaDeCorteDaPeca(p)).maxY)) : 0;
    const enfesto = enfestoDoPlano(base.enfesto, plano.entrada.tipoDeEnfesto, { larguraDaMesaMm: risco.larguraDoRiscoMm, comprimentoDaMesaMm: risco.comprimentoMm, enfestos: [camadas] }, distanciaPadraoMm, alcance);
    if (noLugar) return { pecas: noLugar, tecido: base.tecido, enfesto };
    const nasGrades = expandirComGrade(base.pecas, novoId, risco.grade);
    return { pecas: moverParaForaDoEnfesto(nasGrades, new Set(nasGrades.map((p) => p.id)), enfesto), tecido: base.tecido, enfesto };
  });
}
