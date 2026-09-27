import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, rotacionarMolde, type Molde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { validarProjeto, projetoTemErrosCriticos, TOLERANCIAS_PADRAO } from './validacao';

function pecaRetangular(
  id: string,
  x: number,
  y: number,
  largura: number,
  altura: number,
  sobrescrever: Partial<Parameters<typeof criarMolde>[0]> = {},
): Molde {
  return criarMolde(
    {
      nome: id,
      referencia: '',
      tamanho: 'M',
      contorno: [ponto(x, y), ponto(x + largura, y), ponto(x + largura, y + altura), ponto(x, y + altura)],
      linhaDeFio: { inicio: ponto(x + largura / 2, y + 10), fim: ponto(x + largura / 2, y + altura - 10) },
      ...sobrescrever,
    },
    id,
  );
}

function enfestoBase(sobrescrever: Partial<ConfiguracaoDeEnfesto> = {}): ConfiguracaoDeEnfesto {
  return criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 1500,
    comprimentoMm: 3000,
    quantidadeDeCamadas: 1,
    margemLateralMm: 10,
    margemDeExtremidadeMm: 10,
    distanciaMinimaEntrePecasMm: 5,
    ...sobrescrever,
  } as ConfiguracaoDeEnfesto);
}

describe('validarProjeto — projeto limpo', () => {
  it('nenhum problema para peças bem posicionadas, espaçadas e sem restrição de rotação', () => {
    const pecas = [pecaRetangular('a', 50, 50, 100, 100), pecaRetangular('b', 200, 50, 100, 100)];
    const problemas = validarProjeto(pecas, enfestoBase());
    expect(problemas).toEqual([]);
    expect(projetoTemErrosCriticos(problemas)).toBe(false);
  });
});

describe('validarProjeto — sobreposição', () => {
  it('detecta duas peças sobrepostas', () => {
    const pecas = [pecaRetangular('a', 0, 0, 100, 100), pecaRetangular('b', 50, 50, 100, 100)];
    const problemas = validarProjeto(pecas, enfestoBase());
    const sobreposicoes = problemas.filter((p) => p.tipo === 'sobreposicao');
    expect(sobreposicoes).toHaveLength(1);
    expect(sobreposicoes[0]!.severidade).toBe('erro');
    expect([...sobreposicoes[0]!.pecasEnvolvidasIds].sort()).toEqual(['a', 'b']);
    expect(projetoTemErrosCriticos(problemas)).toBe(true);
  });
});

describe('validarProjeto — espaçamento insuficiente', () => {
  it('detecta duas peças próximas demais (mas não sobrepostas)', () => {
    const pecas = [pecaRetangular('a', 0, 0, 100, 100), pecaRetangular('b', 102, 0, 100, 100)];
    const problemas = validarProjeto(pecas, enfestoBase({ distanciaMinimaEntrePecasMm: 5 } as Partial<ConfiguracaoDeEnfesto>));
    const espacamentos = problemas.filter((p) => p.tipo === 'espacamento-insuficiente');
    expect(espacamentos).toHaveLength(1);
  });

  it('não reporta nada quando a distância mínima é 0 (desligada)', () => {
    const pecas = [pecaRetangular('a', 0, 0, 100, 100), pecaRetangular('b', 100.5, 0, 100, 100)];
    const problemas = validarProjeto(pecas, enfestoBase({ distanciaMinimaEntrePecasMm: 0 } as Partial<ConfiguracaoDeEnfesto>));
    expect(problemas.filter((p) => p.tipo === 'espacamento-insuficiente')).toHaveLength(0);
  });
});

describe('validarProjeto — fora dos limites do tecido', () => {
  it('detecta peça além da largura útil', () => {
    const enfesto = enfestoBase({ larguraUtilMm: 300, margemLateralMm: 10 } as Partial<ConfiguracaoDeEnfesto>);
    const pecas = [pecaRetangular('a', 250, 50, 100, 100)]; // vai até x=350, acima de 300-10=290
    const problemas = validarProjeto(pecas, enfesto);
    expect(problemas.some((p) => p.tipo === 'fora-dos-limites')).toBe(true);
  });

  it('nenhum problema de limite sem configuração de enfesto (null)', () => {
    const pecas = [pecaRetangular('a', -9999, 0, 100, 100)];
    const problemas = validarProjeto(pecas, null);
    expect(problemas.some((p) => p.tipo === 'fora-dos-limites')).toBe(false);
  });
});

describe('validarProjeto — rotação proibida', () => {
  it('detecta uma peça rotacionada além do que sua restrição permite', () => {
    const peca = pecaRetangular('a', 50, 50, 100, 100);
    const rotacionada = rotacionarMolde(peca, 90); // restrição padrão só permite 0°
    const problemas = validarProjeto([rotacionada], enfestoBase());
    const rotProblemas = problemas.filter((p) => p.tipo === 'rotacao-proibida');
    expect(rotProblemas).toHaveLength(1);
    expect(rotProblemas[0]!.severidade).toBe('erro');
  });

  it('não reporta nada quando a rotação aplicada é explicitamente permitida', () => {
    const peca = pecaRetangular('a', 50, 50, 100, 100, {
      restricaoDeRotacao: { permite180: true, permite90e270: false },
    });
    const rotacionada = rotacionarMolde(peca, 180);
    const problemas = validarProjeto([rotacionada], enfestoBase());
    expect(problemas.filter((p) => p.tipo === 'rotacao-proibida')).toHaveLength(0);
  });
});

describe('validarProjeto — escala suspeita', () => {
  it('avisa (não erro) para peça implausivelmente pequena', () => {
    const pecas = [pecaRetangular('a', 0, 0, 2, 2)];
    const problemas = validarProjeto(pecas, null, TOLERANCIAS_PADRAO);
    const suspeitas = problemas.filter((p) => p.tipo === 'escala-suspeita');
    expect(suspeitas).toHaveLength(1);
    expect(suspeitas[0]!.severidade).toBe('aviso');
    expect(projetoTemErrosCriticos(suspeitas)).toBe(false);
  });

  it('avisa para peça implausivelmente grande', () => {
    const pecas = [pecaRetangular('a', 0, 0, 20000, 20000)];
    const problemas = validarProjeto(pecas, null, TOLERANCIAS_PADRAO);
    expect(problemas.filter((p) => p.tipo === 'escala-suspeita')).toHaveLength(1);
  });
});

describe('validarProjeto — contorno inválido', () => {
  it('detecta furo com contorno degenerado sem lançar exceção', () => {
    // Construído diretamente (bypassando criarMolde) para simular dado corrompido/importado sem validação prévia.
    const pecaComFuroRuim: Molde = {
      ...pecaRetangular('a', 0, 0, 100, 100),
      furos: [[ponto(10, 10), ponto(20, 10)]],
    };
    const problemas = validarProjeto([pecaComFuroRuim], null);
    expect(problemas.some((p) => p.tipo === 'contorno-invalido')).toBe(true);
  });
});

describe('projetoTemErrosCriticos', () => {
  it('falso quando só há avisos', () => {
    const apenasAvisos = validarProjeto([pecaRetangular('a', 0, 0, 2, 2)], null);
    expect(projetoTemErrosCriticos(apenasAvisos)).toBe(false);
  });

  it('verdadeiro quando há ao menos um erro', () => {
    const comSobreposicao = validarProjeto(
      [pecaRetangular('a', 0, 0, 100, 100), pecaRetangular('b', 10, 10, 100, 100)],
      null,
    );
    expect(projetoTemErrosCriticos(comSobreposicao)).toBe(true);
  });
});
