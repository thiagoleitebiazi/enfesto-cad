import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { gerarIso } from './iso-exportacao';

export const LADO_DO_QUADRADO_MM = 100;
const LARGURA_DA_MESA_DO_TESTE_MM = 140;

/** O teste da mesa de corte (ADR 0217): um quadrado de 100 mm, com a faca, para rodar em papel. */
export function testeDaMesaDeCorte(): string {
  const quadrado = criarMolde(
    {
      nome: 'Quadrado de 100 mm',
      referencia: '',
      tamanho: '',
      quantidade: 1,
      contorno: [ponto(20, 20), ponto(20 + LADO_DO_QUADRADO_MM, 20), ponto(20 + LADO_DO_QUADRADO_MM, 20 + LADO_DO_QUADRADO_MM), ponto(20, 20 + LADO_DO_QUADRADO_MM)],
      margemDeCosturaMm: 0,
      linhaDeFio: { inicio: ponto(70, 40), fim: ponto(70, 100) },
      restricaoDeRotacao: { permite180: true, permite90e270: true },
    },
    'teste-do-equipamento',
  );
  return gerarIso([quadrado], { larguraDaMesaMm: LARGURA_DA_MESA_DO_TESTE_MM });
}
