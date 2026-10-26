import type { AcessoAPastaDeTroca } from '../domain/trocaComOErp';

/**
 * A pasta compartilhada de um tipo, vista pela interface (ADR 0141): fora do programa (no navegador, nos testes), não
 * há pasta — `null`.
 */
export function acessoAPasta(tipo: 'erp'): AcessoAPastaDeTroca | null {
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
  };
}
