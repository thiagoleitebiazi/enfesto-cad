import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { adicionarPlanoDeCorte, criarProjeto } from './projeto';
import { criarConfiguracaoDeEnfesto } from './enfesto';
import {
  ajustesFeitos,
  calcularPlanoDeCorte,
  enfestoDoPlano,
  cmParaMm,
  CONFIGURACAO_PADRAO_DO_PLANO,
  escreverKg,
  escreverM,
  escreverM2,
  escreverRendimento,
  gParaKg,
  impressaoDigitalDoMolde,
  kgParaG,
  mm2ParaM2,
  mmParaM,
  mParaMm,
  mPorKgParaMmPorG,
  rendimentoPelaGramatura,
  riscoDaMesa,
  TAMANHO_UNICO,
  VERSAO_DO_CALCULO,
  type CalculoDoPlano,
  type PlanoDeCorte,
  type ConfiguracaoDoPlano,
  type EntradaDoPlano,
  type MalhaDoPlano,
  type RiscoDoPlano,
} from './planoDeCorte';

// A malha do pedido: algodão 30/1, 310 g/m², 4 m/kg informado, 1,60 m de largura útil, 200 kg.
const MALHA: MalhaDoPlano = {
  descricao: 'Malha algodão 30/1',
  gramaturaGm2: 310,
  rendimentoMmPorG: mPorKgParaMmPorG(4),
  larguraUtilMm: mParaMm(1.6),
  pesoDisponivelG: kgParaG(200),
  tubular: false,
  sentidoUnico: false,
};
// Um risco de 3 m na largura de 1,55 m, com 1 P, 2 M e 1 G por folha.
const RISCO: RiscoDoPlano = { origem: 'informado', comprimentoMm: 3000, larguraMm: 1550, gradePorTamanho: { P: 1, M: 2, G: 1 } };
const SEM_SOBRA: ConfiguracaoDoPlano = { ...CONFIGURACAO_PADRAO_DO_PLANO, sobraPorCamadaMm: 0, margemInicialDaMesaMm: 100, margemFinalDaMesaMm: 150 };

/** A malha sem os campos dados (não informados). */
function sem(malha: MalhaDoPlano, ...campos: ReadonlyArray<'rendimentoMmPorG' | 'gramaturaGm2' | 'pesoDisponivelG'>): MalhaDoPlano {
  const copia: { -readonly [K in keyof MalhaDoPlano]?: MalhaDoPlano[K] } = { ...malha };
  for (const campo of campos) delete copia[campo];
  return copia as MalhaDoPlano;
}

function entrada(extras: Partial<EntradaDoPlano> = {}): EntradaDoPlano {
  return {
    molde: { projetoId: 'p1', codigo: 'ENF-1', nome: 'Camiseta', revisao: 3, impressaoDigital: 'abc' },
    ordem: { codigo: 'OP-17', quantidadesPorTamanho: { P: 40, M: 80, G: 40 } },
    malha: MALHA,
    rendimentoPrincipal: 'informado',
    risco: RISCO,
    tipoDeEnfesto: 'impar',
    ...extras,
  };
}

function resultado(c: CalculoDoPlano) {
  if (!c.ok) throw new Error('não calculou: ' + c.erros.join(' | '));
  return c;
}

describe('unidades', () => {
  it('converte sem perder precisão, e m/kg é o mesmo número que mm/g', () => {
    expect(mmParaM(1550)).toBe(1.55);
    expect(mParaMm(1.6)).toBe(1600);
    expect(cmParaMm(160)).toBe(1600);
    expect(gParaKg(2500)).toBe(2.5);
    expect(kgParaG(2.5)).toBe(2500);
    expect(mm2ParaM2(4_800_000)).toBe(4.8);
    expect(mPorKgParaMmPorG(4)).toBe(4);
  });

  it('o rendimento pela largura e gramatura: 1000 / (largura em m × g/m²)', () => {
    // 1000 / (1,6 × 310) = 2,016 m/kg
    expect(rendimentoPelaGramatura(1600, 310)).toBeCloseTo(1000 / (1.6 * 310), 12);
  });

  it('na malha tubular, as duas folhas do tubo achatado: metade dos metros por quilo (ADR 0098; antes dava o dobro)', () => {
    // Tubo achatado de 0,9 m, 180 g/m²: um metro de tubo tem 2 × 0,9 m² = 324 g → 3,086 m/kg (antes: 6,173).
    expect(rendimentoPelaGramatura(900, 180, true)).toBeCloseTo(1000 / (0.9 * 180 * 2), 12);
    expect(rendimentoPelaGramatura(900, 180, false)).toBeCloseTo(2 * rendimentoPelaGramatura(900, 180, true), 12);
  });

  it('escreve com vírgula e a unidade', () => {
    expect(escreverM(3250)).toBe('3,25 m');
    expect(escreverKg(1500)).toBe('1,50 kg');
    expect(escreverM2(5_200_000)).toBe('5,20 m²');
    expect(escreverRendimento(4)).toBe('4,00 m/kg');
  });
});

describe('calcularPlanoDeCorte — o caso do pedido', () => {
  const c = resultado(calcularPlanoDeCorte(entrada(), SEM_SOBRA));
  const r = c.resultado;

  it('a mesa é o risco mais as margens configuradas, na largura útil', () => {
    expect(r.comprimentoDaMesaSugeridoMm).toBe(3000 + 100 + 150);
    expect(r.comprimentoDaMesaMm).toBe(3250);
    expect(r.larguraDaMesaMm).toBe(1600);
    expect(r.areaDaMesaMm2).toBe(3250 * 1600);
  });

  it('as camadas fecham a ordem pelo tamanho que mais pede: 40 P ÷ 1, 80 M ÷ 2, 40 G ÷ 1 = 40 camadas', () => {
    expect(r.camadasNecessarias).toBe(40);
    expect(r.camadas).toBe(40);
    expect(r.producaoPorTamanho).toEqual({ P: 40, M: 80, G: 40 });
    expect(r.faltaPorTamanho).toEqual({ P: 0, M: 0, G: 0 });
  });

  it('o material: 200 kg × 4 m/kg = 800 m; a ordem gasta 40 × 3 m = 120 m (30 kg); sobram 680 m', () => {
    expect(r.disponivelMm).toBe(800_000);
    expect(r.consumoMm).toBe(120_000);
    expect(r.consumoG).toBe(30_000);
    expect(r.sobraMm).toBe(680_000);
    expect(r.sobraG).toBe(170_000);
    expect(r.deficitMm).toBe(0);
    expect(r.camadasPossiveis).toBe(266);
  });

  it('um enfesto de 40 camadas (o limite é 100 folhas)', () => {
    expect(r.camadasPorEnfestoMax).toBe(100);
    expect(r.enfestos).toEqual([40]);
  });

  it('a divergência entre 4 m/kg informado e 2,02 calculado é apontada, com os dois valores, e vale o informado', () => {
    expect(r.rendimentoInformadoMmPorG).toBe(4);
    expect(r.rendimentoCalculadoMmPorG).toBeCloseTo(2.016, 3);
    expect(r.rendimentoUsadoMmPorG).toBe(4);
    expect(r.origemDoRendimento).toBe('informado');
    expect(r.divergenciaDeRendimentoPercentual).toBeCloseTo(((4 - 2.016129) / 2.016129) * 100, 3);
    const aviso = c.alertas.find((a) => a.texto.includes('diferem'));
    expect(aviso?.texto).toContain('4,00 m/kg');
    expect(aviso?.texto).toContain('2,02 m/kg');
    expect(aviso?.texto).toContain('Com o informado o material dá 800,00 m; com o calculado, 403,23 m');
  });

  it('sem eficiência: o risco foi informado à mão', () => {
    expect(r.eficienciaPercentual).toBeNull();
    expect(c.premissas.join(' ')).toContain('o resultado depende do comprimento e da grade informados');
  });
});

describe('calcularPlanoDeCorte — o rendimento', () => {
  it('escolhido o calculado, ele vale (e o aviso diz isso)', () => {
    const c = resultado(calcularPlanoDeCorte(entrada({ rendimentoPrincipal: 'calculado' }), SEM_SOBRA));
    expect(c.resultado.rendimentoUsadoMmPorG).toBeCloseTo(2.016129, 5);
    expect(c.resultado.disponivelMm).toBeCloseTo(200_000 * 2.016129, 0);
    expect(c.alertas.some((a) => a.texto.includes('O plano usa o calculado'))).toBe(true);
  });

  it('malha tubular sem rendimento informado: o comprimento que o peso dá conta as duas folhas do tubo (ADR 0098)', () => {
    const tubular: MalhaDoPlano = { ...sem(MALHA, 'rendimentoMmPorG'), larguraUtilMm: 900, tubular: true };
    const c = resultado(calcularPlanoDeCorte(entrada({ malha: tubular, tipoDeEnfesto: 'tubular', risco: { ...RISCO, larguraMm: 880 } }), SEM_SOBRA));
    const porGrama = 1_000_000 / (900 * 310 * 2);
    expect(c.resultado.origemDoRendimento).toBe('calculado');
    expect(c.resultado.rendimentoUsadoMmPorG).toBeCloseTo(porGrama, 9);
    // 200 kg de tubo: 200 000 g × 1,792 mm/g = 358 m (antes, 717 m — o dobro do tecido que existe).
    expect(c.resultado.disponivelMm).toBeCloseTo(200_000 * porGrama, 3);
  });

  it('dentro da tolerância, não há aviso de divergência', () => {
    const malha = { ...MALHA, rendimentoMmPorG: 2.05 };
    const c = resultado(calcularPlanoDeCorte(entrada({ malha }), SEM_SOBRA));
    expect(c.alertas.some((a) => a.texto.includes('diferem'))).toBe(false);
  });

  it('a tolerância é o limite: 9% de diferença avisa com 5% de tolerância, e não com 10%', () => {
    // 2,2 m/kg informado contra 2,016 calculado: 9,1% de diferença.
    const malha = { ...MALHA, rendimentoMmPorG: 2.2 };
    const avisa = (tolerancia: number) =>
      resultado(calcularPlanoDeCorte(entrada({ malha }), { ...SEM_SOBRA, toleranciaDeRendimentoPercentual: tolerancia })).alertas.some((a) =>
        a.texto.includes('diferem'),
      );
    expect(avisa(5)).toBe(true);
    expect(avisa(10)).toBe(false);
  });

  it('só a gramatura: o calculado vale; só o informado: o informado', () => {
    const soGramatura = sem(MALHA, 'rendimentoMmPorG');
    expect(resultado(calcularPlanoDeCorte(entrada({ malha: soGramatura }), SEM_SOBRA)).resultado.origemDoRendimento).toBe('calculado');
    const soInformado = sem(MALHA, 'gramaturaGm2');
    const c = resultado(calcularPlanoDeCorte(entrada({ malha: soInformado, rendimentoPrincipal: 'calculado' }), SEM_SOBRA));
    expect(c.resultado.origemDoRendimento).toBe('informado');
    expect(c.resultado.rendimentoCalculadoMmPorG).toBeNull();
  });
});

describe('calcularPlanoDeCorte — dados faltando ou impossíveis (não calcula)', () => {
  const erros = (e: EntradaDoPlano, conf: ConfiguracaoDoPlano = SEM_SOBRA) => {
    const c = calcularPlanoDeCorte(e, conf);
    expect(c.ok).toBe(false);
    return c.ok ? [] : c.erros;
  };

  it('sem largura útil, sem comprimento do risco, sem material, sem rendimento', () => {
    expect(erros(entrada({ malha: { ...MALHA, larguraUtilMm: 0 } }))).toContain('Falta a largura útil da malha (um número maior que zero).');
    expect(erros(entrada({ risco: { ...RISCO, comprimentoMm: 0 } }))).toContain('Falta o comprimento do risco (um número maior que zero).');
    expect(erros(entrada({ malha: sem(MALHA, 'pesoDisponivelG') }))).toContain('Falta o material disponível: informe o peso da malha (kg) ou os rolos.');
    expect(erros(entrada({ malha: sem(MALHA, 'rendimentoMmPorG', 'gramaturaGm2') }))).toContain(
      'Falta o rendimento para converter o peso em metros: informe o rendimento (m/kg) ou a gramatura (g/m²).',
    );
  });

  it('o risco mais largo que a malha, a ordem vazia, quantidades quebradas, valores negativos', () => {
    expect(erros(entrada({ risco: { ...RISCO, larguraMm: 1700 } }))[0]).toContain('é mais largo que a largura útil da malha');
    expect(erros(entrada({ ordem: { codigo: 'OP', quantidadesPorTamanho: { P: 0 } } }))).toContain('A ordem não tem nenhuma peça: informe a quantidade de pelo menos um tamanho.');
    expect(erros(entrada({ ordem: { codigo: 'OP', quantidadesPorTamanho: { P: 2.5 } } }))).toContain('As quantidades da ordem precisam ser números inteiros de 0 para cima.');
    expect(erros(entrada({ ordem: { codigo: ' ', quantidadesPorTamanho: { P: 2 } } }))).toContain('Falta o código da ordem de produção.');
    expect(erros(entrada({ malha: { ...MALHA, gramaturaGm2: -310 } }))).toContain('A gramatura da malha precisa ser um número maior que zero.');
    expect(erros(entrada({ risco: { ...RISCO, gradePorTamanho: { P: 0 } } }))).toContain('O risco não tem nenhuma peça de roupa: informe quantas de cada tamanho uma folha dá.');
  });

  it('o risco sem nenhum tamanho da ordem não serve', () => {
    expect(erros(entrada({ ordem: { codigo: 'OP', quantidadesPorTamanho: { GG: 10 } } }))).toEqual(['Nenhum tamanho da ordem está no risco: este risco não serve para esta ordem.']);
  });

  it('material que não dá nem uma camada: não calcula (nada de zero camadas na tela)', () => {
    const pouco = { ...MALHA, pesoDisponivelG: 500 }; // 2 m
    expect(erros(entrada({ malha: pouco }))[0]).toContain('não dá nem uma camada');
  });

  it('configurações impossíveis', () => {
    expect(erros(entrada(), { ...SEM_SOBRA, folhasPorEnfestoMax: 0 })).toContain('O limite de folhas por enfesto precisa ser um número inteiro de 1 para cima.');
    expect(erros(entrada(), { ...SEM_SOBRA, folhasPorEnfestoMax: 2.5 })).toContain('O limite de folhas por enfesto precisa ser um número inteiro de 1 para cima.');
    expect(erros(entrada(), { ...SEM_SOBRA, sobraPorCamadaMm: -1 })).toContain('As margens da mesa e a sobra por camada precisam ser de 0 para cima.');
    // Enfesto par (2 folhas por camada) com limite de 1 folha.
    expect(erros(entrada({ tipoDeEnfesto: 'par' }), { ...SEM_SOBRA, folhasPorEnfestoMax: 1 })[0]).toContain('não comporta uma camada de 2 folhas');
  });
});

describe('calcularPlanoDeCorte — material que não dá a ordem', () => {
  it('informa o déficit e o que dá para fazer, sem mudar a ordem', () => {
    const malha = { ...MALHA, pesoDisponivelG: kgParaG(20) }; // 80 m: 26 camadas de 3 m
    const c = resultado(calcularPlanoDeCorte(entrada({ malha }), SEM_SOBRA));
    const r = c.resultado;
    expect(r.camadasPossiveis).toBe(26);
    expect(r.camadas).toBe(26);
    expect(r.deficitMm).toBe(40 * 3000 - 80_000);
    expect(r.deficitG).toBe((40 * 3000 - 80_000) / 4);
    expect(r.possivelPorTamanho).toEqual({ P: 26, M: 52, G: 26 });
    expect(r.faltaPorTamanho).toEqual({ P: 14, M: 28, G: 14 });
    const aviso = c.alertas.find((a) => a.texto.includes('não dá a ordem inteira'));
    expect(aviso?.texto).toContain('faltam 40,00 m (10,00 kg)');
    expect(aviso?.texto).toContain('A ordem não foi mudada.');
  });
});

describe('calcularPlanoDeCorte — sobra por camada, enfestos e limites', () => {
  it('a divisão que não fecha arredonda para cima: 81 M com 2 por folha pedem 41 camadas', () => {
    const ordem = { codigo: 'OP-18', quantidadesPorTamanho: { M: 81 } };
    const c = resultado(calcularPlanoDeCorte(entrada({ ordem }), SEM_SOBRA));
    expect(c.resultado.camadasNecessarias).toBe(41);
    expect(c.resultado.producaoPorTamanho['M']).toBe(82);
    expect(c.resultado.faltaPorTamanho['M']).toBe(0);
  });

  it('a sobra por camada entra no consumo e é separada como perda de pontas', () => {
    const c = resultado(calcularPlanoDeCorte(entrada(), { ...SEM_SOBRA, sobraPorCamadaMm: 20 }));
    expect(c.resultado.consumoPorCamadaMm).toBe(3020);
    expect(c.resultado.consumoMm).toBe(40 * 3020);
    expect(c.resultado.perdaDePontasMm).toBe(40 * 20);
  });

  it('acima do limite de folhas, mais de um enfesto, com as camadas repartidas por igual', () => {
    const ordem = { codigo: 'OP', quantidadesPorTamanho: { P: 130, M: 0, G: 0 } };
    const r = resultado(calcularPlanoDeCorte(entrada({ ordem }), { ...SEM_SOBRA, folhasPorEnfestoMax: 60 })).resultado;
    expect(r.camadas).toBe(130);
    expect(r.enfestos).toEqual([44, 43, 43]);
  });

  it('no enfesto par, cada camada tem 2 folhas: metade das camadas, e o limite conta folhas', () => {
    const r = resultado(calcularPlanoDeCorte(entrada({ tipoDeEnfesto: 'par' }), { ...SEM_SOBRA, folhasPorEnfestoMax: 30 })).resultado;
    expect(r.folhasPorCamada).toBe(2);
    expect(r.camadasNecessarias).toBe(20);
    expect(r.camadasPorEnfestoMax).toBe(15);
    expect(r.enfestos).toEqual([10, 10]);
    expect(r.producaoPorTamanho).toEqual({ P: 40, M: 80, G: 40 });
  });

  it('a grade que não fecha: produz a mais e diz quanto', () => {
    const ordem = { codigo: 'OP', quantidadesPorTamanho: { P: 40, M: 50, G: 40 } };
    const c = resultado(calcularPlanoDeCorte(entrada({ ordem }), SEM_SOBRA));
    expect(c.resultado.excedentePorTamanho).toEqual({ P: 0, M: 30, G: 0 });
    expect(c.alertas.some((a) => a.texto === 'A grade do risco produz a mais: 30 do M.')).toBe(true);
  });

  it('o tamanho que o risco não tem é avisado, e o resto é planejado', () => {
    const ordem = { codigo: 'OP', quantidadesPorTamanho: { P: 40, GG: 10 } };
    const c = resultado(calcularPlanoDeCorte(entrada({ ordem }), SEM_SOBRA));
    expect(c.resultado.camadas).toBe(40);
    expect(c.alertas.some((a) => a.texto === 'O risco não tem o tamanho GG: as 10 peças dele não saem deste plano.')).toBe(true);
  });
});

describe('calcularPlanoDeCorte — ajustes de quem planeja', () => {
  it('camadas e camadas por enfesto ajustadas, e os ajustes registrados com o sugerido', () => {
    const sugerido = resultado(calcularPlanoDeCorte(entrada(), SEM_SOBRA)).resultado;
    const ajustes = { camadas: 30, camadasPorEnfesto: 15, comprimentoDaMesaMm: 4000 };
    const c = resultado(calcularPlanoDeCorte(entrada(), SEM_SOBRA, ajustes));
    expect(c.resultado.camadas).toBe(30);
    expect(c.resultado.enfestos).toEqual([15, 15]);
    expect(c.resultado.comprimentoDaMesaMm).toBe(4000);
    expect(c.resultado.areaDaMesaMm2).toBe(4000 * 1600);
    expect(c.alertas.some((a) => a.texto.includes('a ordem não fecha'))).toBe(true);
    expect(ajustesFeitos(sugerido, c.resultado, ajustes)).toEqual([
      { campo: 'comprimentoDaMesaMm', sugerido: 3250, escolhido: 4000 },
      { campo: 'camadas', sugerido: 40, escolhido: 30 },
      { campo: 'camadasPorEnfesto', sugerido: 40, escolhido: 15 },
    ]);
  });

  it('ajustes impossíveis são recusados: mais camadas que o material, acima do limite, mesa menor que o risco', () => {
    const malha = { ...MALHA, pesoDisponivelG: kgParaG(20) };
    const c1 = calcularPlanoDeCorte(entrada({ malha }), SEM_SOBRA, { camadas: 30 });
    expect(c1.ok === false && c1.erros[0]).toContain('O material dá até 26 camadas');
    const c2 = calcularPlanoDeCorte(entrada(), SEM_SOBRA, { camadasPorEnfesto: 101 });
    expect(c2.ok === false && c2.erros[0]).toContain('O limite é de 100 camadas por enfesto');
    const c3 = calcularPlanoDeCorte(entrada(), SEM_SOBRA, { comprimentoDaMesaMm: 2000 });
    expect(c3.ok === false && c3.erros[0]).toContain('A mesa ajustada precisa ter pelo menos o comprimento do risco');
    // O limite é exato: 26 camadas cabem, 27 não.
    expect(calcularPlanoDeCorte(entrada({ malha }), SEM_SOBRA, { camadas: 26 }).ok).toBe(true);
    const c4 = calcularPlanoDeCorte(entrada({ malha }), SEM_SOBRA, { camadas: 27 });
    expect(c4.ok === false && c4.erros[0]).toContain('O material dá até 26 camadas');
  });

  it('a mesa ajustada menor que a sugerida (mas maior que o risco) passa, com aviso', () => {
    const c = resultado(calcularPlanoDeCorte(entrada(), SEM_SOBRA, { comprimentoDaMesaMm: 3100 }));
    expect(c.alertas.some((a) => a.texto.includes('é menor que a sugerida'))).toBe(true);
  });

  it('camadas ajustadas iguais às necessárias não avisam, acima delas avisam; o ajuste igual à sugestão não é registrado', () => {
    const passa = (camadas: number) =>
      resultado(calcularPlanoDeCorte(entrada(), SEM_SOBRA, { camadas })).alertas.some((a) => a.texto.includes('passam das'));
    expect(passa(40)).toBe(false);
    expect(passa(41)).toBe(true);
    const sugerido = resultado(calcularPlanoDeCorte(entrada(), SEM_SOBRA)).resultado;
    expect(ajustesFeitos(sugerido, sugerido, { camadas: 40, camadasPorEnfesto: 40, comprimentoDaMesaMm: 3250 })).toEqual([]);
  });
});

describe('calcularPlanoDeCorte — rolos', () => {
  it('cada rolo dá camadas inteiras; o estreito fica de fora; lotes diferentes são avisados', () => {
    const malha: MalhaDoPlano = {
      ...sem(MALHA, 'pesoDisponivelG'),
      rolos: [
        { id: 'r1', lote: 'L1', comprimentoMm: 50_000 }, // 16 camadas de 3 m, ponta de 2 m
        { id: 'r2', lote: 'L2', pesoG: kgParaG(10) }, // 40 m pelo rendimento: 13 camadas, ponta de 1 m
        { id: 'r3', lote: 'L1', comprimentoMm: 60_000, larguraUtilMm: 1500 }, // mais estreito que o risco
      ],
    };
    const c = resultado(calcularPlanoDeCorte(entrada({ malha }), SEM_SOBRA));
    const r = c.resultado;
    expect(r.rolos?.map((x) => [x.id, x.compativel, x.camadas, x.pontaMm])).toEqual([
      ['r1', true, 16, 2000],
      ['r2', true, 13, 1000],
      ['r3', false, 0, 60_000],
    ]);
    expect(r.camadasPossiveis).toBe(29);
    expect(r.disponivelMm).toBe(90_000);
    expect(c.alertas.some((a) => a.texto.includes('mais estreito que o risco'))).toBe(true);
    expect(c.alertas.some((a) => a.texto.includes('Rolos de lotes diferentes (L1, L2)'))).toBe(true);
  });

  it('o rolo só com peso, sem rendimento nenhum, não calcula', () => {
    const malha: MalhaDoPlano = { ...sem(MALHA, 'rendimentoMmPorG', 'gramaturaGm2', 'pesoDisponivelG'), rolos: [{ id: 'r1', lote: 'A', pesoG: 5000 }] };
    const c = calcularPlanoDeCorte(entrada({ malha }), SEM_SOBRA);
    expect(c.ok === false && c.erros[0]).toContain('tem só o peso');
  });
});

describe('calcularPlanoDeCorte — o que a malha pede do enfesto', () => {
  it('malha tubular com enfesto aberto, sentido único com zigue-zague, encolhimento', () => {
    const malha = { ...MALHA, tubular: true, sentidoUnico: true, encolhimentoPercentual: 3 };
    const c = resultado(calcularPlanoDeCorte(entrada({ malha, tipoDeEnfesto: 'zigue-zague' }), SEM_SOBRA));
    const textos = c.alertas.map((a) => a.texto).join(' | ');
    expect(textos).toContain('A malha é tubular, e o enfesto não');
    expect(textos).toContain('o enfesto zigue-zague vira o tecido a cada camada');
    expect(textos).toContain('Encolhimento informado: 3,0%. Ele não foi aplicado ao risco');
  });

  it('sem conflito, sem aviso: malha tubular no enfesto tubular, sentido único no ímpar; malha aberta no tubular avisa', () => {
    const avisos = (malha: MalhaDoPlano, tipoDeEnfesto: EntradaDoPlano['tipoDeEnfesto']) =>
      resultado(calcularPlanoDeCorte(entrada({ malha, tipoDeEnfesto }), SEM_SOBRA))
        .alertas.map((a) => a.texto)
        .join(' | ');
    const tubular = avisos({ ...MALHA, tubular: true }, 'tubular');
    expect(tubular).not.toContain('A malha é tubular');
    expect(tubular).not.toContain('O enfesto é tubular');
    expect(avisos({ ...MALHA, sentidoUnico: true }, 'impar')).not.toContain('sentido único');
    expect(avisos(MALHA, 'tubular')).toContain('O enfesto é tubular, e a malha está como aberta');
  });
});

describe('calcularPlanoDeCorte — a eficiência, só com o risco medido', () => {
  it('área das peças ÷ (comprimento do risco × largura útil)', () => {
    const risco: RiscoDoPlano = { ...RISCO, origem: 'mesa', areaDasPecasMm2: 3_840_000 };
    const r = resultado(calcularPlanoDeCorte(entrada({ risco }), SEM_SOBRA)).resultado;
    expect(r.eficienciaPercentual).toBeCloseTo((3_840_000 / (3000 * 1600)) * 100, 9);
  });
});

describe('impressaoDigitalDoMolde', () => {
  const peca = { nome: 'Frente', tamanho: 'M', quantidade: 1, margemDeCosturaMm: 10, contorno: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }] };
  it('igual para as mesmas peças (em qualquer ordem), diferente quando o molde muda', () => {
    const outra = { ...peca, nome: 'Costas' };
    expect(impressaoDigitalDoMolde([peca, outra])).toBe(impressaoDigitalDoMolde([outra, peca]));
    expect(impressaoDigitalDoMolde([peca])).not.toBe(impressaoDigitalDoMolde([{ ...peca, contorno: [{ x: 0, y: 0 }, { x: 101, y: 0 }, { x: 100, y: 200 }] }]));
    expect(impressaoDigitalDoMolde([peca])).not.toBe(impressaoDigitalDoMolde([{ ...peca, margemDeCosturaMm: 12 }]));
    expect(impressaoDigitalDoMolde([peca])).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('riscoDaMesa — o risco das peças posicionadas', () => {
  const retangulo = (nome: string, tamanho: string, x: number, y: number, largura: number, comprimento: number, margemDeCosturaMm = 0): Molde =>
    criarMolde(
      {
        nome,
        referencia: '',
        tamanho,
        contorno: [ponto(x, y), ponto(x + largura, y), ponto(x + largura, y + comprimento), ponto(x, y + comprimento)],
        linhaDeFio: { inicio: ponto(x + 5, y + 5), fim: ponto(x + 5, y + comprimento - 5) },
        margemDeCosturaMm,
      },
      `${nome}-${tamanho}-${x}-${y}`,
    );

  it('sem peças, não há risco', () => {
    expect(riscoDaMesa([])).toBeNull();
  });

  it('o comprimento e a largura vão de ponta a ponta das linhas de corte, e a área é a delas', () => {
    const risco = riscoDaMesa([retangulo('Frente', 'M', 0, 0, 500, 700, 10), retangulo('Costas', 'M', 600, 100, 500, 700)])!;
    expect(risco.origem).toBe('mesa');
    expect(risco.larguraMm).toBe(1100 + 10);
    expect(risco.comprimentoMm).toBe(800 + 10);
    expect(risco.areaDasPecasMm2).toBeCloseTo(520 * 720 + 500 * 700, 6);
  });

  it('a grade: em cada tamanho, a peça que menos se repete (duas mangas por peça de roupa não dobram a conta)', () => {
    const pecas = [
      retangulo('Frente', 'M', 0, 0, 100, 100),
      retangulo('Costas', 'M', 0, 200, 100, 100),
      retangulo('Manga', 'M', 0, 400, 100, 100),
      retangulo('Manga', 'M', 0, 600, 100, 100),
      retangulo('Frente', 'G', 200, 0, 100, 100),
      retangulo('Frente', 'G', 200, 200, 100, 100),
      retangulo('Costas', 'G', 200, 400, 100, 100),
      retangulo('Costas', 'G', 200, 600, 100, 100),
      retangulo('Bolso', '', 400, 0, 50, 50),
    ];
    expect(riscoDaMesa(pecas)!.gradePorTamanho).toEqual({ M: 1, G: 2, [TAMANHO_UNICO]: 1 });
  });
});

describe('adicionarPlanoDeCorte — o plano guardado no projeto', () => {
  const projeto = criarProjeto('Camiseta', 'p1', 'ENF-1', '2026-10-19T10:00:00.000Z', { pecas: [], tecido: null, enfesto: null });
  const calculo = resultado(calcularPlanoDeCorte(entrada(), SEM_SOBRA));
  const plano = (id: string, codigo = 'OP-17'): PlanoDeCorte => ({
    id,
    criadoEmIso: '2026-10-19T10:00:00.000Z',
    responsavel: 'Ana',
    versaoDoCalculo: VERSAO_DO_CALCULO,
    entrada: entrada({ ordem: { codigo, quantidadesPorTamanho: { P: 40, M: 80, G: 40 } } }),
    configuracao: SEM_SOBRA,
    ajustes: [],
    resultado: calculo.resultado,
    alertas: calculo.alertas,
    premissas: calculo.premissas,
  });

  it('um projeto de antes do planejamento recebe a lista; o plano vai como foi calculado', () => {
    expect(projeto.planosDeCorte).toBeUndefined();
    const com = adicionarPlanoDeCorte(projeto, plano('a'), '2026-10-19T11:00:00.000Z');
    expect(com.planosDeCorte).toEqual([plano('a')]);
    expect(com.modificadoEmIso).toBe('2026-10-19T11:00:00.000Z');
  });

  it('um plano novo da mesma ordem não substitui o anterior: diz qual veio substituir, e o anterior fica', () => {
    const dois = adicionarPlanoDeCorte(adicionarPlanoDeCorte(projeto, plano('a'), 't1'), plano('b', ' op-17 '), 't2');
    expect(dois.planosDeCorte!.map((p) => [p.id, p.substituiPlanoId])).toEqual([
      ['a', undefined],
      ['b', 'a'],
    ]);
    // Outra ordem não substitui nada.
    const tres = adicionarPlanoDeCorte(dois, plano('c', 'OP-18'), 't3');
    expect(tres.planosDeCorte!.at(-1)!.substituiPlanoId).toBeUndefined();
    expect(() => adicionarPlanoDeCorte(tres, plano('c', 'OP-18'), 't4')).toThrow(/já está guardado/);
  });
});

describe('enfestoDoPlano — o enfesto do projeto ajustado ao plano', () => {
  const r = resultado(calcularPlanoDeCorte(entrada({ ordem: { codigo: 'OP', quantidadesPorTamanho: { P: 130 } } }), { ...SEM_SOBRA, folhasPorEnfestoMax: 60 })).resultado;

  it('a largura da malha, a mesa do plano e as camadas do maior enfesto; o resto fica como estava', () => {
    const anterior = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1500, comprimentoMm: 9000, quantidadeDeCamadas: 1, margemLateralMm: 5, margemDeExtremidadeMm: 7, distanciaMinimaEntrePecasMm: 4 });
    expect(enfestoDoPlano(anterior, 'par', r, 3)).toEqual({ tipo: 'par', larguraUtilMm: 1600, comprimentoMm: 3250, quantidadeDeCamadas: 44, margemLateralMm: 5, margemDeExtremidadeMm: 7, distanciaMinimaEntrePecasMm: 4 });
  });

  it('sem enfesto antes, as margens de segurança (4 mm) e a distância padrão; o tubular leva a largura do tubo', () => {
    expect(enfestoDoPlano(null, 'tubular', r, 3)).toEqual({ tipo: 'tubular', larguraUtilMm: 1600, comprimentoMm: 3250, quantidadeDeCamadas: 44, margemLateralMm: 4, margemDeExtremidadeMm: 4, distanciaMinimaEntrePecasMm: 3, larguraDoTuboMm: 1600 });
    expect(enfestoDoPlano(null, 'ramado', r, 3)).toMatchObject({ tipo: 'ramado', alinhamentoDasBordas: 'alinhado', sentidoDeAlimentacao: 'unico' });
  });

  it('a mesa não fica mais curta que as peças que estão nela, com a margem de segurança depois delas', () => {
    expect(enfestoDoPlano(null, 'impar', r, 3, 5000).comprimentoMm).toBe(5004);
    expect(enfestoDoPlano(null, 'impar', r, 3, 1000).comprimentoMm).toBe(3250);
  });
});
