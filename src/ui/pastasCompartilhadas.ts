import type { TipoDePasta } from '../../electron/pastasCompartilhadas';
import type { AcessoAPasta } from '../domain/pastaCompartilhada';

/**
 * A pasta compartilhada de um tipo, vista pela interface (ADR 0141, 0142): fora do programa (no navegador, nos
 * testes), não há pasta — `null`.
 */
export function acessoAPasta(tipo: TipoDePasta): AcessoAPasta | null {
  const api = window.enfestoCad;
  if (!api) return null;
  return {
    onde: () => api.ondeEstaAPasta(tipo),
    escolher: () => api.escolherPasta(tipo),
    esquecer: () => api.esquecerPasta(tipo),
    listar: (subpasta) => api.listarNaPasta(tipo, subpasta),
    ler: (subpasta, nome) => api.lerNaPasta(tipo, subpasta, nome),
    gravar: (subpasta, nome, texto) => api.gravarNaPasta(tipo, subpasta, nome, texto),
    mover: (de, nome, para, novoNome) => api.moverNaPasta(tipo, de, nome, para, novoNome),
    criarSeNaoExiste: (subpasta, nome, texto) => api.criarNaPastaSeNaoExiste(tipo, subpasta, nome, texto),
    apagar: (subpasta, nome) => api.apagarNaPasta(tipo, subpasta, nome),
  };
}
