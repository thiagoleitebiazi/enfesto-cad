import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { criarMolde, linhaDeCorteDaPeca, transladarMolde, type Molde } from './molde';
import { validarProjeto } from './validacao';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { executarNestingAutomatico, executarNestingPorPontosDeCanto } from './nesting';
import { fazerRisco, pecasDaGrade, type PecaDoRisco } from './risco';
import { modeloDoPlano, quantidadesPorRoupa } from './modeloDoPlano';
import { riscoGeradoNoPlano } from './planejamento';
import { riscoCompensado } from './encolhimento';
import { definirTamanhosDoMolde, expandirTamanhos } from './tamanhosGraduados';
import { definirLinhaDeSimetria, abrirSimetrias } from './anotacoes';
import {
  blocosDasPostas,
  blocosNaMesa,
  blocosQueSeMisturam,
  comGrupoDoEncaixe,
  divisasEntreOsBlocos,
  grupoDaPeca,
  indiceDoGrupo,
  nomeDoBloco,
  ordemDosGrupos,
} from './gruposDoEncaixe';

const enfesto = (largura = 1000, comprimento = 4000): ConfiguracaoDeEnfesto =>
  criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: largura,
    comprimentoMm: comprimento,
    quantidadeDeCamadas: 1,
    margemLateralMm: 0,
    margemDeExtremidadeMm: 0,
    distanciaMinimaEntrePecasMm: 5,
  } as ConfiguracaoDeEnfesto);

function retangulo(nome: string, largura: number, comprimento: number, quantidade: number, grupo?: string): Molde {
  const m = criarMolde(
    {
      nome,
      referencia: '',
      tamanho: 'M',
      quantidade,
      contorno: [ponto(0, 0), ponto(largura, 0), ponto(largura, comprimento), ponto(0, comprimento)],
      linhaDeFio: { inicio: ponto(largura / 2, 10), fim: ponto(largura / 2, comprimento - 10) },
    },
    nome.toLowerCase(),
  );
  return grupo === undefined ? m : comGrupoDoEncaixe(m, grupo);
}

/**
 * Uma frente larga (600 × 900) sem grupo, e duas golas e dois punhos pequenos que vão à entretela, mais um bolso
 * do forro. Sem grupos, as pequenas caberiam ao lado da frente (na largura que sobra); com grupos, cada grupo vai
 * para um trecho seu do comprimento.
 */
const PECAS = (): Molde[] => [
  retangulo('Frente', 600, 900, 1),
  retangulo('Gola', 300, 150, 2, 'Entretela'),
  retangulo('Bolso', 200, 200, 1, 'Forro'),
  retangulo('Punho', 250, 120, 2, 'Entretela'),
];

/** O trecho do comprimento de cada grupo, pelas peças postas. */
function trechos(moldes: readonly Molde[]): Map<string, { ini: number; fim: number }> {
  const m = new Map<string, { ini: number; fim: number }>();
  for (const p of moldes) {
    const c = retanguloEnvolvente(linhaDeCorteDaPeca(p));
    const g = grupoDaPeca(p);
    const a = m.get(g);
    m.set(g, a ? { ini: Math.min(a.ini, c.minY), fim: Math.max(a.fim, c.maxY) } : { ini: c.minY, fim: c.maxY });
  }
  return m;
}

describe('os grupos do encaixe — a regra', () => {
  it('o grupo da peça sem os espaços das pontas; a ordem é a da lista; as sem grupo por último', () => {
    expect(grupoDaPeca({ grupoDoEncaixe: '  Entretela ' })).toBe('Entretela');
    expect(grupoDaPeca({})).toBe('');
    expect(ordemDosGrupos(PECAS())).toEqual(['Entretela', 'Forro']);
    expect(indiceDoGrupo(['Entretela', 'Forro'], 'Forro')).toBe(1);
    expect(indiceDoGrupo(['Entretela', 'Forro'], '')).toBe(2);
  });

  it('pôr e tirar o grupo da peça (só espaços: sem grupo, como antes)', () => {
    const m = retangulo('Gola', 100, 100, 1);
    const comGrupo = comGrupoDoEncaixe(m, 'Forro de bolso');
    expect(comGrupo.grupoDoEncaixe).toBe('Forro de bolso');
    const sem = comGrupoDoEncaixe(comGrupo, '   ');
    expect('grupoDoEncaixe' in sem).toBe(false);
    expect(comGrupoDoEncaixe(m, '')).toBe(m);
  });

  it('os blocos: um por grupo, na ordem; sem grupo nenhum, nenhum bloco; os que se misturam', () => {
    const quadrado = (y: number) => [ponto(0, y), ponto(10, y), ponto(10, y + 10), ponto(0, y + 10)];
    expect(blocosDasPostas([{ grupo: '', corte: quadrado(0) }], [])).toEqual([]);
    const blocos = blocosDasPostas(
      [
        { grupo: '', corte: quadrado(100) },
        { grupo: 'B', corte: quadrado(40) },
        { grupo: 'A', corte: quadrado(0) },
        { grupo: 'A', corte: quadrado(15) },
      ],
      ['A', 'B'],
    );
    expect(blocos).toEqual([
      { grupo: 'A', inicioMm: 0, fimMm: 25, pecas: 2 },
      { grupo: 'B', inicioMm: 40, fimMm: 50, pecas: 1 },
      { grupo: '', inicioMm: 100, fimMm: 110, pecas: 1 },
    ]);
    expect(blocosQueSeMisturam(blocos)).toEqual([]);
    expect(blocosQueSeMisturam([blocos[0]!, { ...blocos[1]!, inicioMm: 20 }])).toHaveLength(1);
    expect(nomeDoBloco(blocos[2]!)).toBe('Sem grupo');
  });

  it('o grupo vai junto com a peça aberta nos tamanhos e na simetria', () => {
    const graduada = comGrupoDoEncaixe(definirTamanhosDoMolde(retangulo('Gola', 100, 100, 1), ['P', 'M', 'G'], 'M'), 'Entretela');
    let n = 0;
    const novoId = (): string => `n${++n}`;
    expect(expandirTamanhos([graduada], novoId).map(grupoDaPeca)).toEqual(['Entretela', 'Entretela', 'Entretela']);
    const dobrada = comGrupoDoEncaixe(definirLinhaDeSimetria(retangulo('Costas', 100, 200, 1), 1), 'Forro');
    expect(abrirSimetrias([dobrada], novoId).map(grupoDaPeca)).toEqual(['Forro']);
  });
});

describe('os grupos do encaixe — nos motores', () => {
  it('sem grupos, as pequenas entram ao lado da frente (o encaixe de sempre)', () => {
    const semGrupos = PECAS().map((p) => comGrupoDoEncaixe(p, ''));
    const r = executarNestingAutomatico(semGrupos, enfesto(), { agora: () => 0 });
    expect(r.pecasNaoColocadas).toHaveLength(0);
    expect(r.blocosDosGrupos).toBeUndefined();
    // A frente (900 mm) mais os 4 mm da margem de segurança da mesa: as outras couberam ao lado dela.
    expect(r.comprimentoUtilizadoMm).toBeCloseTo(904, 0);
  });

  it('busca em grade: cada grupo num trecho só, na ordem (Entretela, Forro, sem grupo), à distância entre as peças', () => {
    const r = executarNestingAutomatico(PECAS(), enfesto(), { agora: () => 0 });
    expect(r.pecasNaoColocadas).toHaveLength(0);
    expect(r.pecasColocadas).toHaveLength(6);
    const t = trechos(r.pecasColocadas.map((c) => c.molde));
    expect(t.get('Entretela')!.ini).toBeCloseTo(4, 6); // a margem de segurança da mesa
    expect(t.get('Forro')!.ini).toBeGreaterThanOrEqual(t.get('Entretela')!.fim + 5 - 1e-6);
    expect(t.get('')!.ini).toBeGreaterThanOrEqual(t.get('Forro')!.fim + 5 - 1e-6);
    expect(r.blocosDosGrupos!.map((b) => [b.grupo, b.pecas])).toEqual([
      ['Entretela', 4],
      ['Forro', 1],
      ['', 1],
    ]);
    expect(blocosQueSeMisturam(r.blocosDosGrupos!)).toEqual([]);
    // As peças aplicadas na mesa dizem os mesmos blocos.
    expect(blocosNaMesa(r.pecasColocadas.map((c) => c.molde))).toEqual(r.blocosDosGrupos);
  });

  it('pontos de canto: a mesma separação', () => {
    const r = executarNestingPorPontosDeCanto(PECAS(), enfesto(), { agora: () => 0 });
    expect(r.pecasNaoColocadas).toHaveLength(0);
    const t = trechos(r.pecasColocadas.map((c) => c.molde));
    expect(t.get('Forro')!.ini).toBeGreaterThanOrEqual(t.get('Entretela')!.fim + 5 - 1e-6);
    expect(t.get('')!.ini).toBeGreaterThanOrEqual(t.get('Forro')!.fim + 5 - 1e-6);
    expect(r.blocosDosGrupos!.map((b) => b.grupo)).toEqual(['Entretela', 'Forro', '']);
    expect(blocosQueSeMisturam(r.blocosDosGrupos!)).toEqual([]);
  });

  it('o risco do planejamento de corte também separa os grupos (e diz os blocos)', () => {
    const copias: PecaDoRisco[] = PECAS().flatMap((molde) =>
      Array.from({ length: molde.quantidade }, (_, i) => ({ pecaId: molde.id, nome: molde.nome, tamanho: 'M', molde: { ...molde, quantidade: 1 }, espelhada: false, copia: i })),
    );
    const risco = fazerRisco(copias, { M: 1 }, { larguraMm: 1000, comprimentoMaximoMm: 4000, distanciaMm: 5, sentidoUnico: false, agora: () => 0 });
    expect(risco.ok).toBe(true);
    if (!risco.ok) return;
    expect(risco.pecas).toHaveLength(6);
    expect(risco.blocosDosGrupos!.map((b) => b.grupo)).toEqual(['Entretela', 'Forro', '']);
    expect(blocosQueSeMisturam(risco.blocosDosGrupos!)).toEqual([]);
    const [entretela, forro] = risco.blocosDosGrupos!;
    expect(forro!.inicioMm).toBeGreaterThanOrEqual(entretela!.fimMm + 5);
  });

  it('um grupo que não cabe no que sobra da mesa fica de fora (e é dito), sem invadir o trecho do outro', () => {
    const pecas = [retangulo('Frente', 900, 2500, 1, 'A'), retangulo('Costas', 900, 2500, 1, 'B')];
    const r = executarNestingAutomatico(pecas, enfesto(1000, 4000), { agora: () => 0 });
    expect(r.pecasColocadas.map((c) => c.molde.nome)).toEqual(['Frente']);
    expect(r.pecasNaoColocadas.map((p) => p.nome)).toEqual(['Costas']);
  });
});

describe('os grupos do encaixe — a validação', () => {
  it('peças de grupos diferentes no mesmo trecho: aviso, com as peças dos dois grupos; separadas, nada', () => {
    const r = executarNestingAutomatico(PECAS(), enfesto(), { agora: () => 0 });
    const naMesa = r.pecasColocadas.map((c) => c.molde);
    expect(validarProjeto(naMesa, enfesto()).filter((p) => p.tipo === 'grupos-misturados')).toEqual([]);
    // O bolso do forro arrastado para o começo, ao lado das golas.
    const misturadas = naMesa.map((m) => (m.nome === 'Bolso' ? transladarMolde(m, { x: 650 - retanguloEnvolvente(m.contorno).minX, y: 4 - retanguloEnvolvente(m.contorno).minY }, m.id) : m));
    const avisos = validarProjeto(misturadas, enfesto()).filter((p) => p.tipo === 'grupos-misturados');
    expect(avisos).toHaveLength(1);
    expect(avisos[0]!.severidade).toBe('aviso');
    expect(avisos[0]!.mensagem).toMatch(/^Grupos do encaixe misturados no comprimento: “Entretela” \(de 4,0 a \d+ mm\) e “Forro” \(de 4,0 a 204 mm\) ocupam o mesmo trecho/);
    expect(avisos[0]!.pecasEnvolvidasIds).toHaveLength(5);
  });
});

describe('os grupos do encaixe — no planejamento de corte', () => {
  it('o modelo do plano diz o grupo de cada peça; o risco gerado leva os trechos; a compensação do encolhimento os aumenta junto', () => {
    const modelo = modeloDoPlano(PECAS());
    expect(modelo.pecas.map((p) => [p.nome, p.grupo])).toEqual([
      ['Frente', ''],
      ['Gola', 'Entretela'],
      ['Bolso', 'Forro'],
      ['Punho', 'Entretela'],
    ]);
    const copias = pecasDaGrade(modelo, { M: 1 }, quantidadesPorRoupa(modelo, {}).quantidades);
    const risco = fazerRisco(copias, { M: 1 }, { larguraMm: 1000, comprimentoMaximoMm: 4000, distanciaMm: 5, sentidoUnico: false, agora: () => 0 });
    expect(risco.ok).toBe(true);
    if (!risco.ok) return;
    const noPlano = riscoGeradoNoPlano('M:1', risco);
    expect(noPlano.blocosDosGrupos).toEqual(risco.blocosDosGrupos);
    const compensado = riscoCompensado(noPlano, { comprimento: 1.05, largura: 1.02, encolhimentoComprimentoPercentual: 5, encolhimentoLarguraPercentual: 2 }, 1000);
    const [antes, depois] = [noPlano.blocosDosGrupos![1]!, compensado.blocosDosGrupos![1]!];
    expect(depois.grupo).toBe('Forro');
    expect(depois.inicioMm).toBeCloseTo(antes.inicioMm * 1.05, 1);
    expect(depois.fimMm).toBeCloseTo(antes.fimMm * 1.05, 1);
  });
});

describe('as divisas entre os trechos (ADR 0115)', () => {
  it('no meio entre um bloco e o seguinte; os que se misturam não têm divisa', () => {
    expect(divisasEntreOsBlocos([
      { grupo: 'A', inicioMm: 0, fimMm: 200, pecas: 1 },
      { grupo: '', inicioMm: 250, fimMm: 400, pecas: 2 },
      { grupo: 'B', inicioMm: 380, fimMm: 500, pecas: 1 },
    ])).toEqual([225]);
  });
});
