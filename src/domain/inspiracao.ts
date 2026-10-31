/**
 * O painel de inspiração do modelo (ADR 0112): as imagens de referência por categoria (a modelagem, o tecido, a cor,
 * o aviamento, a estampa), cada uma com uma nota e as cores principais tiradas dela; o conceito em texto; a paleta
 * escolhida. Fica no projeto (`Projeto.inspiracao`). As imagens feitas pela IA entram aqui marcadas como rascunho,
 * com o serviço, o modelo e o pedido que as fizeram.
 */

export type CategoriaDaInspiracao = 'modelagem' | 'tecido' | 'cor' | 'aviamento' | 'estampa' | 'outro';

export const ROTULO_DA_CATEGORIA_DA_INSPIRACAO: Readonly<Record<CategoriaDaInspiracao, string>> = {
  modelagem: 'Modelagem',
  tecido: 'Tecido',
  cor: 'Cor',
  aviamento: 'Aviamento',
  estampa: 'Estampa',
  outro: 'Outro',
};

/** De onde veio a imagem que a IA fez: o rascunho guarda o pedido, para refazer ou conferir. */
export interface RascunhoDaIa {
  readonly servico: string;
  readonly modelo: string;
  readonly pedido: string;
  readonly geradoEmIso: string;
}

export interface ItemDeInspiracao {
  readonly id: string;
  readonly categoria: CategoriaDaInspiracao;
  readonly nome: string;
  /** A imagem (data URL), já reduzida ao entrar. */
  readonly dados: string;
  readonly larguraPx: number;
  readonly alturaPx: number;
  readonly nota: string;
  /** As cores principais da imagem (#rrggbb), da que mais aparece para a que menos. */
  readonly cores: readonly string[];
  readonly criadoEmIso: string;
  /** Presente: a imagem foi feita pela IA (é rascunho até alguém decidir usá-la). */
  readonly rascunhoDaIa?: RascunhoDaIa;
}

export interface PainelDeInspiracao {
  /** O conceito do modelo em texto (o público, a ocasião, o clima). */
  readonly conceito: string;
  /** As cores escolhidas para o modelo (#rrggbb). */
  readonly paleta: readonly string[];
  readonly itens: readonly ItemDeInspiracao[];
}

export const PAINEL_VAZIO: PainelDeInspiracao = { conceito: '', paleta: [], itens: [] };
export const MAXIMO_DE_ITENS_DE_INSPIRACAO = 16;
export const MAXIMO_DA_PALETA = 8;
/** O maior lado de uma imagem do painel (px): o projeto não engorda. */
export const LADO_MAXIMO_DA_INSPIRACAO = 640;

export function adicionarItemDeInspiracao(painel: PainelDeInspiracao, item: ItemDeInspiracao): PainelDeInspiracao {
  if (painel.itens.length >= MAXIMO_DE_ITENS_DE_INSPIRACAO) throw new Error(`O painel já tem ${MAXIMO_DE_ITENS_DE_INSPIRACAO} imagens: tire uma antes de pôr outra.`);
  return { ...painel, itens: [...painel.itens, item] };
}

export function mudarItemDeInspiracao(painel: PainelDeInspiracao, id: string, mudanca: Partial<Pick<ItemDeInspiracao, 'categoria' | 'nome' | 'nota'>>): PainelDeInspiracao {
  return { ...painel, itens: painel.itens.map((i) => (i.id === id ? { ...i, ...mudanca } : i)) };
}

export function removerItemDeInspiracao(painel: PainelDeInspiracao, id: string): PainelDeInspiracao {
  return { ...painel, itens: painel.itens.filter((i) => i.id !== id) };
}

/** Põe ou tira uma cor da paleta do modelo (até 8). */
export function alternarCorDaPaleta(painel: PainelDeInspiracao, cor: string): PainelDeInspiracao {
  const c = cor.toLowerCase();
  if (painel.paleta.includes(c)) return { ...painel, paleta: painel.paleta.filter((x) => x !== c) };
  if (painel.paleta.length >= MAXIMO_DA_PALETA) throw new Error(`A paleta já tem ${MAXIMO_DA_PALETA} cores: tire uma antes.`);
  return { ...painel, paleta: [...painel.paleta, c] };
}

const hex2 = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export const corHex = (r: number, g: number, b: number): string => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/**
 * As cores principais de uma imagem (os pixels RGBA, largura × altura), pelo agrupamento em `k` cores (k-médias,
 * começando pelas cores mais distantes entre si, para sair sempre o mesmo). Os pixels quase transparentes não contam.
 * Da que mais aparece para a que menos; as quase iguais (até 24 de distância) viram uma só.
 */
export function coresDaImagem(rgba: ArrayLike<number>, largura: number, altura: number, k = 5): string[] {
  const passo = Math.max(1, Math.floor(Math.sqrt((largura * altura) / 4000)));
  const pontos: [number, number, number][] = [];
  for (let y = 0; y < altura; y += passo) {
    for (let x = 0; x < largura; x += passo) {
      const i = 4 * (y * largura + x);
      if ((rgba[i + 3] ?? 255) < 128) continue;
      pontos.push([rgba[i]!, rgba[i + 1]!, rgba[i + 2]!]);
    }
  }
  if (pontos.length === 0) return [];
  const d2 = (a: readonly number[], b: readonly number[]): number => (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;
  // Os centros de partida: o primeiro pixel, e depois sempre o mais longe dos já escolhidos.
  const centros: number[][] = [[...pontos[0]!]];
  while (centros.length < Math.min(k, pontos.length)) {
    let melhor = 0;
    let maior = -1;
    pontos.forEach((p, i) => {
      const d = Math.min(...centros.map((c) => d2(p, c)));
      if (d > maior) {
        maior = d;
        melhor = i;
      }
    });
    if (maior <= 0) break;
    centros.push([...pontos[melhor]!]);
  }
  const grupo = new Int32Array(pontos.length);
  for (let volta = 0; volta < 12; volta++) {
    let mudou = false;
    pontos.forEach((p, i) => {
      let g = 0;
      let menor = Infinity;
      centros.forEach((c, j) => {
        const d = d2(p, c);
        if (d < menor) {
          menor = d;
          g = j;
        }
      });
      if (grupo[i] !== g) {
        grupo[i] = g;
        mudou = true;
      }
    });
    const somas = centros.map(() => [0, 0, 0, 0]);
    pontos.forEach((p, i) => {
      const s = somas[grupo[i]!]!;
      s[0]! += p[0];
      s[1]! += p[1];
      s[2]! += p[2];
      s[3]! += 1;
    });
    somas.forEach((s, j) => {
      if (s[3]! > 0) centros[j] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!];
    });
    if (!mudou && volta > 0) break;
  }
  const contagem = centros.map(() => 0);
  for (let i = 0; i < pontos.length; i++) contagem[grupo[i]!]!++;
  const ordem = centros.map((c, j) => ({ c, n: contagem[j]! })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const saida: number[][] = [];
  for (const { c } of ordem) if (!saida.some((s) => d2(s, c) < 24 * 24)) saida.push(c);
  return saida.map((c) => corHex(c[0]!, c[1]!, c[2]!));
}

/** O nome de uma cor em português, aproximado (para o pedido à IA). */
export function nomeDaCor(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1]!, 16) / 255;
  const g = parseInt(m[2]!, 16) / 255;
  const b = parseInt(m[3]!, 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / (max - min) + 2) * 60;
    else h = ((r - g) / (max - min) + 4) * 60;
  }
  if (l < 0.12) return 'preto';
  if (l > 0.92) return 'branco';
  if (s < 0.12) return l < 0.4 ? 'cinza-escuro' : l > 0.7 ? 'cinza-claro' : 'cinza';
  const tom =
    h < 15 || h >= 345
      ? 'vermelho'
      : h < 40
        ? l < 0.45 ? 'marrom' : 'laranja'
        : h < 65
          ? l < 0.4 ? 'mostarda' : 'amarelo'
          : h < 160
            ? 'verde'
            : h < 195
              ? 'turquesa'
              : h < 255
                ? 'azul'
                : h < 290
                  ? 'roxo'
                  : 'rosa';
  if (tom === 'azul' && l < 0.3) return 'azul-marinho';
  if (tom === 'vermelho' && l < 0.3) return 'vinho';
  // O vermelho e o rosa bem claros são o rosa-claro.
  if ((tom === 'rosa' || tom === 'vermelho') && l > 0.75) return 'rosa-claro';
  return l > 0.75 ? `${tom} claro` : l < 0.3 ? `${tom} escuro` : tom;
}

// ---- Os pedidos para a IA

export type TipoDeGeracao = 'peca' | 'croqui' | 'variacoes' | 'foto';

export const TIPOS_DE_GERACAO: Readonly<Record<TipoDeGeracao, { readonly nome: string; readonly explicacao: string; readonly precisaDeReferencia: boolean }>> = {
  peca: { nome: 'A peça pelas inspirações', explicacao: 'Uma imagem da peça a partir do conceito, da paleta e das imagens do painel.', precisaDeReferencia: false },
  croqui: { nome: 'Croqui frente e costas', explicacao: 'Um croqui técnico preliminar, em traço preto, de frente e de costas.', precisaDeReferencia: false },
  variacoes: { nome: 'Variações de um desenho', explicacao: 'Variações do desenho técnico (ou de uma imagem do painel), mantendo a ideia.', precisaDeReferencia: true },
  foto: { nome: 'Foto comercial num modelo virtual', explicacao: 'A peça vestida num modelo virtual, em estúdio, para catálogo.', precisaDeReferencia: false },
};

export interface ContextoDoPedido {
  readonly nomeDoModelo: string;
  /** A descrição do produto na ficha técnica. */
  readonly descricao?: string;
  /** O tecido do projeto (o nome). */
  readonly tecido?: string;
  /** Quantas imagens vão como referência. */
  readonly referencias: number;
  /** Como é o modelo virtual da foto comercial (ADR 0203). */
  readonly modeloVirtual?: ModeloVirtual;
}

export interface ModeloVirtual {
  readonly corpo?: string;
  readonly idade?: string;
  readonly cabelo?: string;
  readonly pose?: string;
}

/** O recorte central da imagem na proporção da loja: 1:1, 3:4, 9:16. */
export function recorteParaProporcao(largura: number, altura: number, a: number, b: number): { readonly x: number; readonly y: number; readonly largura: number; readonly altura: number } {
  const alvo = a / b;
  if (largura / altura > alvo) {
    const l = Math.round(altura * alvo);
    return { x: Math.round((largura - l) / 2), y: 0, largura: l, altura };
  }
  const h = Math.round(largura / alvo);
  return { x: 0, y: Math.round((altura - h) / 2), largura, altura: h };
}

/** O pedido em texto para o serviço de imagem (a pessoa pode mudar antes de mandar). */
export function pedidoParaIa(tipo: TipoDeGeracao, painel: PainelDeInspiracao, contexto: ContextoDoPedido): string {
  const partes: string[] = [];
  const modelo = contexto.nomeDoModelo.trim() || 'peça de vestuário';
  const cores = painel.paleta.length > 0 ? painel.paleta.map(nomeDaCor) : [...new Set(painel.itens.flatMap((i) => i.cores.slice(0, 2)))].slice(0, 5).map(nomeDaCor);
  const notas = painel.itens.filter((i) => i.nota.trim() !== '').map((i) => `${ROTULO_DA_CATEGORIA_DA_INSPIRACAO[i.categoria].toLowerCase()}: ${i.nota.trim()}`);
  switch (tipo) {
    case 'peca':
      partes.push(`Imagem de moda de uma peça de vestuário: ${modelo}.`);
      break;
    case 'croqui':
      partes.push(`Desenho técnico de moda (croqui plano) da peça "${modelo}", vista de frente e de costas lado a lado, traço preto fino sobre fundo branco, sem sombras, sem pessoa, proporções reais, com pespontos tracejados e detalhes de construção visíveis.`);
      break;
    case 'variacoes':
      partes.push(`Três variações de design da peça "${modelo}" a partir do desenho de referência, mantendo a mesma ideia e as mesmas proporções, mudando detalhes (decote, mangas, recortes, comprimento), no mesmo estilo de desenho, lado a lado sobre fundo branco.`);
      break;
    case 'foto':
      partes.push(`Fotografia comercial de catálogo: a peça "${modelo}" vestida por um modelo virtual em pé, corpo inteiro, em estúdio de fundo neutro, luz suave, caimento realista do tecido.`);
      break;
  }
  if (tipo === 'foto' && contexto.modeloVirtual) {
    const { corpo, idade, cabelo, pose } = contexto.modeloVirtual;
    const detalhes = [corpo ? `corpo ${corpo}` : null, idade ?? null, cabelo ? `cabelo ${cabelo}` : null, pose ? `pose ${pose}` : null].filter((d) => d !== null);
    if (detalhes.length > 0) partes.push(`Modelo virtual: ${detalhes.join(', ')}.`);
  }
  if (contexto.descricao?.trim()) partes.push(`Descrição: ${contexto.descricao.trim()}`);
  if (painel.conceito.trim()) partes.push(`Conceito: ${painel.conceito.trim()}`);
  if (contexto.tecido?.trim()) partes.push(`Tecido: ${contexto.tecido.trim()}.`);
  if (cores.length > 0 && tipo !== 'croqui') partes.push(`Cores: ${cores.join(', ')}.`);
  if (notas.length > 0) partes.push(`Referências: ${notas.join('; ')}.`);
  if (contexto.referencias > 0) partes.push(`Use as ${contexto.referencias} imagem(ns) anexada(s) como referência visual.`);
  if (tipo !== 'croqui' && tipo !== 'variacoes') partes.push('Sem texto, sem marca d’água, sem logotipos.');
  return partes.join('\n');
}

// ---- A leitura (de dentro do projeto)

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const CATEGORIAS = Object.keys(ROTULO_DA_CATEGORIA_DA_INSPIRACAO) as CategoriaDaInspiracao[];
const ehCor = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);

/** O painel guardado no projeto, conferido (o item sem imagem fica de fora). */
export function lerPainelDeInspiracao(bruto: unknown): PainelDeInspiracao {
  if (!ehObjeto(bruto)) return PAINEL_VAZIO;
  const itens: ItemDeInspiracao[] = [];
  if (Array.isArray(bruto.itens)) {
    for (const x of bruto.itens) {
      if (!ehObjeto(x) || typeof x.id !== 'string' || typeof x.dados !== 'string' || !x.dados.startsWith('data:image/')) continue;
      const base: ItemDeInspiracao = {
        id: x.id,
        categoria: CATEGORIAS.includes(x.categoria as CategoriaDaInspiracao) ? (x.categoria as CategoriaDaInspiracao) : 'outro',
        nome: typeof x.nome === 'string' ? x.nome : '',
        dados: x.dados,
        larguraPx: typeof x.larguraPx === 'number' ? x.larguraPx : 0,
        alturaPx: typeof x.alturaPx === 'number' ? x.alturaPx : 0,
        nota: typeof x.nota === 'string' ? x.nota : '',
        cores: Array.isArray(x.cores) ? x.cores.filter(ehCor) : [],
        criadoEmIso: typeof x.criadoEmIso === 'string' ? x.criadoEmIso : '',
      };
      const r = x.rascunhoDaIa;
      itens.push(
        ehObjeto(r) && typeof r.servico === 'string' && typeof r.modelo === 'string' && typeof r.pedido === 'string'
          ? { ...base, rascunhoDaIa: { servico: r.servico, modelo: r.modelo, pedido: r.pedido, geradoEmIso: typeof r.geradoEmIso === 'string' ? r.geradoEmIso : '' } }
          : base,
      );
      if (itens.length >= MAXIMO_DE_ITENS_DE_INSPIRACAO) break;
    }
  }
  return {
    conceito: typeof bruto.conceito === 'string' ? bruto.conceito : '',
    paleta: Array.isArray(bruto.paleta) ? bruto.paleta.filter(ehCor).map((c) => c.toLowerCase()).slice(0, MAXIMO_DA_PALETA) : [],
    itens,
  };
}
