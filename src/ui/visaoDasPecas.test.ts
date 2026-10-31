import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { idsParaPosicionar, trazerParaAMesa } from '../domain/encaixeManual';
import { criarConfiguracaoDeEnfesto } from '../domain/enfesto';
import { criarMolde, transladarMolde, type Molde } from '../domain/molde';
import {
  camposDaBarraGuardados,
  codigoDoPacote,
  corDoPacote,
  guardarCamposDaBarra,
  guardarOpcoesDoEncaixe,
  guardarVisao,
  opcoesDoEncaixeGuardadas,
  pacoteDaPeca,
  pacotesDoEncaixe,
  pecasEmOrdemDeTamanho,
  rotuloDaPeca,
  VISAO_PADRAO,
  visaoGuardada,
} from './visaoDasPecas';

const memoria = (): { getItem(k: string): string | null; setItem(k: string, v: string): void } => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

const peca = (id: string, tamanho = 'M', x = 100, y = 100): Molde =>
  transladarMolde(
    criarMolde({ nome: 'Frente', referencia: '', tamanho, quantidade: 2, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(0, 100)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 10), fim: ponto(50, 90) }, restricaoDeRotacao: { permite180: false, permite90e270: false } }, id),
    { x, y },
    id,
  );

const enfesto = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });

describe('o que aparece na peça (ADR 0199)', () => {
  it('por padrão, só o nome', () => {
    expect(rotuloDaPeca(peca('a'), VISAO_PADRAO)).toBe('Frente');
  });

  it('junta o que foi pedido, e o pacote vem na frente', () => {
    const p: Molde = { ...peca('a'), tecidoDoMolde: 'Forro', descricao: 'Lado direito' };
    const r = rotuloDaPeca(p, { ...VISAO_PADRAO, tamanho: true, tecido: true, descricao: true, quantidade: true, giro: true, perimetro: true }, 'A');
    expect(r).toBe('A · Frente · M · Forro · Lado direito · 2× · 0,0° · 40,0 cm');
  });

  it('sem o nome, sai vazio; a ½ camada sempre aparece', () => {
    expect(rotuloDaPeca(peca('a'), { ...VISAO_PADRAO, nome: false })).toBe('');
    expect(rotuloDaPeca({ ...peca('a'), meiaCamada: true }, VISAO_PADRAO)).toBe('Frente · (½ camada)');
  });

  it('a visão é lembrada, e o estragado volta ao padrão', () => {
    const a = memoria();
    guardarVisao(a, { ...VISAO_PADRAO, fio: false });
    expect(visaoGuardada(a).fio).toBe(false);
    a.setItem('enfesto-cad:visao-das-pecas', '{quebrado');
    expect(visaoGuardada(a)).toBe(VISAO_PADRAO);
  });
});

describe('os pacotes', () => {
  it('o pacote é o tamanho e a cópia', () => {
    expect(pacoteDaPeca(peca('x#2', 'G'))).toBe('G#2');
    expect(pacoteDaPeca(peca('x', 'G'))).toBe('G#0');
    expect(pacotesDoEncaixe([peca('a#1'), peca('b#1'), peca('c#0')])).toEqual(['M#0', 'M#1']);
  });

  it('o código é alfanumérico ou numérico', () => {
    expect(codigoDoPacote(0, 'alfanumerico')).toBe('A');
    expect(codigoDoPacote(25, 'alfanumerico')).toBe('Z');
    expect(codigoDoPacote(26, 'alfanumerico')).toBe('AA');
    expect(codigoDoPacote(2, 'numerico')).toBe('3');
  });

  it('cada pacote tem a sua cor, e a paleta dá a volta', () => {
    expect(corDoPacote(0)).not.toBe(corDoPacote(1));
    expect(corDoPacote(8)).toBe(corDoPacote(0));
  });
});

describe('as opções lembradas', () => {
  it('as do encaixe', () => {
    const a = memoria();
    expect(opcoesDoEncaixeGuardadas(a).anguloDeGiro).toBe(90);
    guardarOpcoesDoEncaixe(a, { ...opcoesDoEncaixeGuardadas(a), anguloDeGiro: 45, encaixaAoClicar: true });
    expect(opcoesDoEncaixeGuardadas(a)).toMatchObject({ anguloDeGiro: 45, encaixaAoClicar: true, verificarAoPlotar: true });
  });

  it('os campos da barra descartam o que não existe', () => {
    const a = memoria();
    guardarCamposDaBarra(a, ['area', 'encaixados']);
    expect(camposDaBarraGuardados(a)).toEqual(['area', 'encaixados']);
    a.setItem('enfesto-cad:campos-da-barra', '["area","outro"]');
    expect(camposDaBarraGuardados(a)).toEqual(['area']);
  });
});

describe('pôr na mesa e tirar dela', () => {
  it('escolhe a peça, o tamanho dela, ou todas', () => {
    const pecas = [peca('a', 'M'), peca('b', 'G'), peca('c', 'M')];
    expect(idsParaPosicionar(pecas, 'a', 'molde')).toEqual(['a']);
    expect(idsParaPosicionar(pecas, 'a', 'tamanho')).toEqual(['a', 'c']);
    expect(idsParaPosicionar(pecas, null, 'todos')).toEqual(['a', 'b', 'c']);
    expect(idsParaPosicionar(pecas, null, 'molde')).toEqual([]);
  });

  it('a peça de fora volta para um lugar livre; a que já está na mesa não anda', () => {
    const na = peca('a', 'M', 100, 100);
    const fora = peca('b', 'M', 0, 3300);
    const r = trazerParaAMesa([na, fora], ['a', 'b'], enfesto);
    expect(r.pecas[0]).toBe(na);
    expect(retanguloEnvolvente(r.pecas[1]!.contorno).maxY).toBeLessThanOrEqual(3000);
    expect(r.semLugar).toBe(0);
  });

  it('conta a que não coube', () => {
    const grande: Molde = { ...peca('g', 'M', 0, 3300), contorno: [ponto(0, 3300), ponto(5000, 3300), ponto(5000, 3400), ponto(0, 3400)] };
    expect(trazerParaAMesa([grande], ['g'], enfesto).semLugar).toBe(1);
  });
});

describe('a ordem crescente dos tamanhos (ADR 0205)', () => {
  it('as letras na ordem da grade, depois os números, e o resto no fim', () => {
    const r = pecasEmOrdemDeTamanho([peca('a', 'XX'), peca('b', '42'), peca('c', 'G'), peca('d', 'P'), peca('e', '38')]);
    expect(r.map((p) => p.tamanho)).toEqual(['P', 'G', '38', '42', 'XX']);
  });
});
