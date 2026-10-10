/**
 * Atalhos para os outros programas que se usam junto com este (aba Início >
 * Programas): o do plotter, o da máquina de corte, uma planilha, um site. É
 * o usuário quem cadastra cada um; o programa só abre o que está na lista.
 */
export interface Programa {
  readonly id: string;
  readonly nome: string;
  readonly tipo: 'arquivo' | 'endereco';
  /** O caminho do programa ou do arquivo, ou o endereço (http ou https). */
  readonly alvo: string;
}

export const MAXIMO_DE_PROGRAMAS = 12;
export const TAMANHO_MAXIMO_DO_NOME_DO_PROGRAMA = 40;

/**
 * O endereço como vai ser aberto: sem esquema, entende-se https; só http e
 * https são aceitos (nada de `file:`, `javascript:` ou outros).
 */
export function enderecoValido(endereco: string): string {
  const limpo = endereco.trim();
  if (limpo === '') throw new Error('Escreva o endereço.');
  // "servidor:8080" é um nome com porta, não um esquema; "javascript:…" e "arquivo://…" são esquemas.
  const temEsquema = /^[a-z][a-z0-9+.-]*:/i.test(limpo) && !/^[^:/]+:\d+(\/|$)/.test(limpo);
  const comEsquema = temEsquema ? limpo : `https://${limpo}`;
  let url: URL;
  try {
    url = new URL(comEsquema);
  } catch {
    throw new Error('Endereço inválido. Exemplo: https://www.exemplo.com.br');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('O endereço precisa começar por http:// ou https://.');
  if (!url.hostname.includes('.') && url.hostname !== 'localhost') throw new Error('Endereço inválido. Exemplo: https://www.exemplo.com.br');
  return url.href;
}

/** O nome do atalho: o digitado, ou — em branco — o nome do arquivo (sem a extensão) ou o do site. */
function nomeDoAtalho(nome: string, tipo: Programa['tipo'], alvo: string): string {
  const digitado = nome.trim();
  if (digitado !== '') return digitado;
  if (tipo === 'endereco') return new URL(alvo).hostname.replace(/^www\./, '');
  const arquivo = alvo.split(/[\\/]/).pop() ?? '';
  return arquivo.replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'Atalho';
}

export function novoPrograma(id: string, nome: string, tipo: Programa['tipo'], alvo: string): Programa {
  const alvoConferido = tipo === 'endereco' ? enderecoValido(alvo) : alvo.trim();
  if (alvoConferido === '') throw new Error('Escolha o programa ou o arquivo do atalho.');
  const nomeFinal = nomeDoAtalho(nome, tipo, alvoConferido);
  if (nomeFinal.length > TAMANHO_MAXIMO_DO_NOME_DO_PROGRAMA) {
    throw new Error(`O nome do atalho pode ter até ${TAMANHO_MAXIMO_DO_NOME_DO_PROGRAMA} caracteres.`);
  }
  return { id, nome: nomeFinal, tipo, alvo: alvoConferido };
}

export function adicionarPrograma(lista: readonly Programa[], programa: Programa): Programa[] {
  if (lista.length >= MAXIMO_DE_PROGRAMAS) throw new Error(`A lista pode ter até ${MAXIMO_DE_PROGRAMAS} atalhos. Remova um antes de adicionar outro.`);
  if (lista.some((p) => p.tipo === programa.tipo && p.alvo === programa.alvo)) throw new Error(`Já existe um atalho para isso: “${lista.find((p) => p.alvo === programa.alvo)!.nome}”.`);
  return [...lista, programa];
}

export function removerPrograma(lista: readonly Programa[], id: string): Programa[] {
  if (!lista.some((p) => p.id === id)) throw new Error('Atalho não encontrado.');
  return lista.filter((p) => p.id !== id);
}

/**
 * A lista como foi lida do arquivo, só com o que está bem formado: o arquivo
 * pode ter sido mexido por fora, e o que não for um atalho válido é ignorado.
 */
export function lerProgramas(conteudo: unknown): Programa[] {
  if (!Array.isArray(conteudo)) return [];
  const lista: Programa[] = [];
  for (const item of conteudo as readonly unknown[]) {
    if (lista.length >= MAXIMO_DE_PROGRAMAS) break;
    if (typeof item !== 'object' || item === null) continue;
    const { id, nome, tipo, alvo } = item as Record<string, unknown>;
    if (typeof id !== 'string' || id === '' || typeof nome !== 'string' || typeof alvo !== 'string') continue;
    if (tipo !== 'arquivo' && tipo !== 'endereco') continue;
    if (lista.some((p) => p.id === id)) continue;
    try {
      lista.push(novoPrograma(id, nome, tipo, alvo));
    } catch {
      // Nome comprido demais, endereço que não é http(s)…: fica de fora.
    }
  }
  return lista;
}
