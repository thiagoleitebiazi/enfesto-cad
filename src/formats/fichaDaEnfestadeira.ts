import { numeroComVirgula } from '../core/numeros';
import { ROTULO_DO_TIPO, type ConfiguracaoDeEnfesto } from '../domain/enfesto';
import type { Molde } from '../domain/molde';
import type { ResultadoDoPlanejamento } from '../domain/planoDeEnfesto';
import { escreverGrade } from '../domain/risco';
import { statusDoEncaixe } from '../domain/statusDoEncaixe';
import { enfestoDoTecido, pecasDoRisco, pecasDoTecido, tecidosDoModelo } from '../domain/tecidosDoModelo';

/**
 * A ficha da enfestadeira (ADR 0222): o arquivo próprio dela é fechado, mas o que ela precisa saber não é. Uma linha por
 * tecido, com o que o operador programa na máquina, ou o que uma integração lê.
 */
export function csvDaEnfestadeira(modelo: { readonly nome: string; readonly codigo: string }, pecas: readonly Molde[], enfesto: ConfiguracaoDeEnfesto): string {
  const celula = (v: string): string => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const linhas = tecidosDoModelo(pecas).map((tecido) => {
    const mesa = enfestoDoTecido(enfesto, tecido);
    const noRisco = pecasDoRisco(pecasDoTecido(pecas, tecido), mesa);
    const { consumoMm } = statusDoEncaixe(noRisco, mesa);
    const total = (consumoMm * mesa.quantidadeDeCamadas) / 1000;
    return [modelo.nome, modelo.codigo, tecido, ROTULO_DO_TIPO[mesa.tipo], numeroComVirgula(mesa.larguraUtilMm, 1), numeroComVirgula(consumoMm, 1), String(mesa.quantidadeDeCamadas), numeroComVirgula(total, 2), (mesa.emendasMm ?? []).join(' ')];
  });
  const cabecalho = ['Modelo', 'Código', 'Tecido', 'Enfesto', 'Largura (mm)', 'Comprimento por camada (mm)', 'Camadas', 'Total (m)', 'Emendas (mm)'];
  return String.fromCharCode(0xfeff) + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}

/** A sequência do plano (ADR 0223): os enfestos em ordem, com comprimentos e camadas diferentes, como a máquina programa. */
export function csvDaSequenciaDeEnfestos(resultado: Pick<ResultadoDoPlanejamento, 'riscos' | 'enfestos'>): string {
  const celula = (v: string): string => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const linhas = resultado.enfestos.map((e) => {
    const risco = resultado.riscos.find((r) => r.chave === e.chave);
    return [String(e.numero), risco ? escreverGrade(risco.grade) : e.chave, risco ? numeroComVirgula(risco.comprimentoMm, 1) : '', risco ? numeroComVirgula(risco.larguraMm, 1) : '', String(e.camadas), String(e.folhas), e.grupos.join(' + ')];
  });
  const cabecalho = ['Enfesto', 'Risco', 'Comprimento (mm)', 'Largura (mm)', 'Camadas', 'Folhas', 'Lotes'];
  return String.fromCharCode(0xfeff) + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}
