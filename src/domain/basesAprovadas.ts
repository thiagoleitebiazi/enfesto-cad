import { retanguloEnvolvente } from '../core/geometria';
import { transladarMolde, type Molde } from './molde';
import { criarProjeto, revisaoAtualDoMolde, type Projeto } from './projeto';

/**
 * A biblioteca de bases aprovadas (ADR 0126): o molde que a empresa aprovou para começar modelos novos — a base de
 * camisa, de calça, de vestido, já provada e graduada. A base é um projeto da biblioteca marcado como tal; o modelo
 * novo começa de uma cópia dela, e a base não muda.
 */

export interface BaseAprovada {
  readonly aprovadaEmIso: string;
  /** Quem aprovou (digitado: o programa não tem login). */
  readonly responsavel: string;
  /** O que a base é (o tipo de peça, a tabela de medidas, o tecido), para quem procura uma. Pode ficar vazia. */
  readonly nota: string;
}

/** De que base o modelo começou: o nome, o código e a revisão de então — ditos mesmo se a base sair da biblioteca. */
export interface OrigemNaBase {
  readonly id: string;
  readonly nome: string;
  readonly codigo: string;
  /** A revisão do molde da base naquele momento, se as peças eram as de uma revisão registrada. */
  readonly revisao?: number;
  readonly emIso: string;
}

/** Marca o projeto como base aprovada. Recusa sem quem aprova, ou sem peças. */
export function aprovarComoBase(projeto: Projeto, dados: { readonly responsavel: string; readonly nota: string }, agoraIso: string): Projeto {
  const responsavel = dados.responsavel.trim();
  if (responsavel === '') throw new Error('Informe quem aprova a base.');
  if (projeto.estadoAtual.pecas.length === 0) throw new Error(`“${projeto.nome}” não tem peças: não há molde para ser base.`);
  return { ...projeto, base: { aprovadaEmIso: agoraIso, responsavel, nota: dados.nota.trim() }, modificadoEmIso: agoraIso };
}

/** Tira o projeto das bases. Os modelos feitos dela continuam dizendo de onde vieram. */
export function tirarDasBases(projeto: Projeto, agoraIso: string): Projeto {
  const copia: { -readonly [K in keyof Projeto]: Projeto[K] } = { ...projeto, modificadoEmIso: agoraIso };
  delete copia.base;
  return copia;
}

/** As bases para escolher: as aprovadas que não foram arquivadas, pelo nome. */
export function basesAprovadas(projetos: readonly Projeto[]): Projeto[] {
  return projetos.filter((p) => p.base && p.status !== 'arquivado').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * O modelo novo feito da base: um projeto novo com as peças, o tecido e a mesa da base, e o que vale para o modelo
 * todo — as regras de caimento, o tecido da recomendação de tamanho, a montagem do provador 3D. A ficha técnica, as
 * imagens, os planos e o histórico são da base e ficam nela. `impressaoDasPecas` é a das peças da base (diz a revisão).
 */
export function modeloDaBase(base: Projeto, nome: string, id: string, codigo: string, agoraIso: string, impressaoDasPecas: string): Projeto {
  if (!base.base) throw new Error(`“${base.nome}” não é uma base aprovada.`);
  const nomeLimpo = nome.trim();
  if (nomeLimpo === '') throw new Error('Informe o nome do modelo novo.');
  const revisao = revisaoAtualDoMolde(base, impressaoDasPecas)?.numero;
  const novo = criarProjeto(nomeLimpo, id, codigo, agoraIso, base.estadoAtual);
  const descricao = `Feito da base “${base.nome}” (${base.codigo})${revisao !== undefined ? `, revisão ${revisao} do molde` : ''}`;
  return {
    ...novo,
    historico: novo.historico.map((e) => (e.tipo === 'criacao' ? { ...e, descricao } : e)),
    feitoDaBase: { id: base.id, nome: base.nome, codigo: base.codigo, emIso: agoraIso, ...(revisao !== undefined ? { revisao } : {}) },
    ...(base.regrasDeCaimento ? { regrasDeCaimento: base.regrasDeCaimento } : {}),
    ...(base.elasticidadeDaRecomendacao ? { elasticidadeDaRecomendacao: base.elasticidadeDaRecomendacao } : {}),
    ...(base.montagem3d ? { montagem3d: base.montagem3d } : {}),
  };
}

/**
 * As peças da base para pôr no projeto aberto (a manga de uma base no corpo de outra): cópias com ids novos, todas
 * andadas juntas para a direita das peças do projeto (o y do mundo), sem cair em cima delas.
 */
export function pecasDaBase(base: Projeto, pecasDoProjeto: readonly Molde[], novoId: () => string, folgaMm = 40): Molde[] {
  const daBase = base.estadoAtual.pecas;
  if (daBase.length === 0) throw new Error(`“${base.nome}” não tem peças.`);
  const ondeAcaba = Math.max(...pecasDoProjeto.flatMap((p) => p.contorno.map((q) => q.y)), -Infinity);
  const ondeComeca = Math.min(...daBase.flatMap((p) => p.contorno.map((q) => q.y)));
  const minX = Math.min(...daBase.map((p) => retanguloEnvolvente(p.contorno).minX));
  const minXDoProjeto = pecasDoProjeto.length > 0 ? Math.min(...pecasDoProjeto.map((p) => retanguloEnvolvente(p.contorno).minX)) : minX;
  const deslocamento = { x: minXDoProjeto - minX, y: Number.isFinite(ondeAcaba) ? ondeAcaba + folgaMm - ondeComeca : 0 };
  return daBase.map((p) => transladarMolde(p, deslocamento, novoId()));
}
