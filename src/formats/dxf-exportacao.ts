import type { Contorno, Ponto2D } from '../core/geometria';
import { ponto, pontoDentroDoContorno, pontoMaisProximoNoContorno, retanguloEnvolvente } from '../core/geometria';
import type { Molde, Pique } from '../domain/molde';
import { linhaDeCorteDaPeca } from '../domain/molde';
import { arestaDeSimetria, ondeEscreverOCodigo } from '../domain/anotacoes';
import { linhasDoMolde } from '../domain/linhasAuxiliares';

/**
 * Exportação de DXF (ADR 0096): as peças como estão na mesa, em milímetros, num DXF R12 (AC1009) — o formato
 * clássico que os programas de modelagem, de encaixe e de corte abrem. Cada parte da peça vai numa camada própria,
 * com os nomes que a importação deste programa reconhece (CONTORNO, FURO, FIO, LINHAS-INTERNAS): o arquivo volta
 * pela importação com a mesma forma.
 *
 * O DXF leva a geometria; o que só este programa entende (a graduação, o desenho de cada pique, os registros de
 * pences e curvas) fica no projeto e no PDF com o registro da peça.
 */

/** As camadas do arquivo, com a cor de cada uma (o número de cor do AutoCAD). */
export const CAMADAS_DO_DXF = {
  contorno: { nome: 'CONTORNO', cor: 7 },
  costura: { nome: 'COSTURA', cor: 8 },
  furo: { nome: 'FURO', cor: 7 },
  linhasInternas: { nome: 'LINHAS-INTERNAS', cor: 5 },
  fio: { nome: 'FIO', cor: 1 },
  piques: { nome: 'PIQUES', cor: 6 },
  simetria: { nome: 'SIMETRIA', cor: 6 },
  marcas: { nome: 'MARCAS', cor: 4 },
  texto: { nome: 'TEXTO', cor: 7 },
} as const;

type Camada = (typeof CAMADAS_DO_DXF)[keyof typeof CAMADAS_DO_DXF]['nome'];

/** O pique sai como um corte reto na linha de corte: um pouco para fora dela e o traço de sempre para dentro. */
export const PIQUE_PARA_FORA_MM = 1;
export const PIQUE_PARA_DENTRO_MM = 6;
/** A altura das letras do nome da peça e do código dos piques. */
const ALTURA_DO_NOME_MM = 5;
const ALTURA_DO_CODIGO_MM = 3;

export interface OpcoesDoDxf {
  /** A largura útil da mesa: com ela, o y do arquivo é contado da borda da mesa, como na tela. */
  readonly larguraDaMesaMm?: number;
}

/**
 * Do mundo para o arquivo: o x do DXF é a horizontal da tela (o y do mundo) e o y do DXF sobe (o −x do mundo),
 * contado a partir de `alturaMm` — o inverso de `dxfParaMundo`, da importação.
 */
export function mundoParaDxf(p: Ponto2D, alturaMm: number): Ponto2D {
  return ponto(p.y, alturaMm - p.x);
}

/** O número como o DXF o escreve: ponto decimal, até 4 casas, sem zeros sobrando. */
function n(valor: number): string {
  const arredondado = Number(valor.toFixed(4));
  return String(arredondado === 0 ? 0 : arredondado);
}

/** O texto dentro de uma linha do DXF: sem quebra de linha. */
const umaLinha = (texto: string): string => texto.replace(/[\r\n]+/g, ' ');

class Escritor {
  readonly linhas: string[] = [];

  par(codigo: number, valor: string | number): void {
    this.linhas.push(String(codigo), typeof valor === 'number' ? n(valor) : valor);
  }

  polilinha(camada: Camada, pontos: readonly Ponto2D[], fechada: boolean): void {
    if (pontos.length < 2) return;
    this.par(0, 'POLYLINE');
    this.par(8, camada);
    this.par(66, '1');
    this.par(10, 0);
    this.par(20, 0);
    this.par(30, 0);
    this.par(70, fechada ? '1' : '0');
    for (const p of pontos) {
      this.par(0, 'VERTEX');
      this.par(8, camada);
      this.par(10, p.x);
      this.par(20, p.y);
      this.par(30, 0);
    }
    this.par(0, 'SEQEND');
    this.par(8, camada);
  }

  reta(camada: Camada, de: Ponto2D, ate: Ponto2D): void {
    this.par(0, 'LINE');
    this.par(8, camada);
    this.par(10, de.x);
    this.par(20, de.y);
    this.par(30, 0);
    this.par(11, ate.x);
    this.par(21, ate.y);
    this.par(31, 0);
  }

  marca(camada: Camada, p: Ponto2D): void {
    this.par(0, 'POINT');
    this.par(8, camada);
    this.par(10, p.x);
    this.par(20, p.y);
    this.par(30, 0);
  }

  /** Texto com o ponto de alinhamento: 72 é o horizontal (0 começo, 1 meio, 2 fim); 73 = 2, o meio na vertical. */
  texto(camada: Camada, conteudo: string, p: Ponto2D, alturaMm: number, anguloGraus: number, horizontal: 0 | 1 | 2): void {
    this.par(0, 'TEXT');
    this.par(8, camada);
    this.par(10, p.x);
    this.par(20, p.y);
    this.par(30, 0);
    this.par(40, alturaMm);
    this.par(1, umaLinha(conteudo));
    if (anguloGraus !== 0) this.par(50, anguloGraus);
    this.par(72, String(horizontal));
    this.par(11, p.x);
    this.par(21, p.y);
    this.par(31, 0);
    this.par(73, '2');
  }
}

/** A linha interna fechada (a que termina onde começou) sai fechada, sem o ponto repetido. */
function comoPolilinha(linha: Contorno): { readonly pontos: readonly Ponto2D[]; readonly fechada: boolean } {
  const primeiro = linha[0];
  const ultimo = linha.at(-1);
  const fechada = linha.length > 3 && primeiro !== undefined && ultimo !== undefined && Math.hypot(primeiro.x - ultimo.x, primeiro.y - ultimo.y) < 1e-6;
  return { pontos: fechada ? linha.slice(0, -1) : linha, fechada };
}

/** O corte do pique, no mundo: na linha de corte, atravessando-a — é assim que a importação o reconhece. */
export function corteDoPique(peca: Molde, linhaDeCorte: Contorno, pique: Pique): [Ponto2D, Ponto2D] {
  const base = peca.margemDeCosturaMm > 0 ? pontoMaisProximoNoContorno(pique.posicao, linhaDeCorte).ponto : pique.posicao;
  const quantos = peca.contorno.length;
  const a = peca.contorno[pique.indiceAresta % quantos]!;
  const b = peca.contorno[(pique.indiceAresta + 1) % quantos]!;
  const comprimento = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let dentro = ponto((b.y - a.y) / comprimento, (a.x - b.x) / comprimento);
  // Para dentro da peça, qualquer que seja o sentido em que o contorno foi desenhado.
  if (!pontoDentroDoContorno(ponto(base.x + dentro.x * 0.5, base.y + dentro.y * 0.5), linhaDeCorte)) dentro = ponto(-dentro.x, -dentro.y);
  return [
    ponto(base.x - dentro.x * PIQUE_PARA_FORA_MM, base.y - dentro.y * PIQUE_PARA_FORA_MM),
    ponto(base.x + dentro.x * PIQUE_PARA_DENTRO_MM, base.y + dentro.y * PIQUE_PARA_DENTRO_MM),
  ];
}

/** O texto do DXF (com as letras como são: `codificarDxf` faz os bytes do arquivo). */
export function gerarDxf(pecas: readonly Molde[], opcoes: OpcoesDoDxf = {}): string {
  const todos = pecas.flatMap((p) => [...linhaDeCorteDaPeca(p), ...p.contorno]);
  // Sem espalhar os pontos em Math.max: um encaixe grande passa do limite de argumentos de uma chamada.
  const altura = todos.reduce((maior, p) => Math.max(maior, p.x), opcoes.larguraDaMesaMm ?? 0);
  const noArquivo = (p: Ponto2D): Ponto2D => mundoParaDxf(p, altura);
  const noArquivoTodos = (pontos: readonly Ponto2D[]): Ponto2D[] => pontos.map(noArquivo);

  const corpo = new Escritor();
  for (const peca of pecas) {
    const linhaDeCorte = linhaDeCorteDaPeca(peca);
    corpo.polilinha(CAMADAS_DO_DXF.contorno.nome, noArquivoTodos(linhaDeCorte), true);
    if (linhaDeCorte !== peca.contorno) corpo.polilinha(CAMADAS_DO_DXF.costura.nome, noArquivoTodos(peca.contorno), true);
    for (const furo of peca.furos) corpo.polilinha(CAMADAS_DO_DXF.furo.nome, noArquivoTodos(furo), true);
    for (const linha of linhasDoMolde(peca)) {
      const { pontos, fechada } = comoPolilinha(linha);
      corpo.polilinha(CAMADAS_DO_DXF.linhasInternas.nome, noArquivoTodos(pontos), fechada);
    }
    corpo.reta(CAMADAS_DO_DXF.fio.nome, noArquivo(peca.linhaDeFio.inicio), noArquivo(peca.linhaDeFio.fim));
    for (const pique of peca.piques) {
      const [de, ate] = corteDoPique(peca, linhaDeCorte, pique);
      corpo.reta(CAMADAS_DO_DXF.piques.nome, noArquivo(de), noArquivo(ate));
      if (pique.codigo) corpo.texto(CAMADAS_DO_DXF.texto.nome, pique.codigo, noArquivo(ondeEscreverOCodigo(peca, pique, 4)), ALTURA_DO_CODIGO_MM, 0, 1);
    }
    const simetria = arestaDeSimetria(peca);
    if (simetria !== null) {
      corpo.reta(CAMADAS_DO_DXF.simetria.nome, noArquivo(peca.contorno[simetria]!), noArquivo(peca.contorno[(simetria + 1) % peca.contorno.length]!));
    }
    for (const marca of peca.marcas) corpo.marca(CAMADAS_DO_DXF.marcas.nome, noArquivo(marca.posicao));
    for (const texto of peca.textos ?? []) {
      const horizontal = texto.ancora === 'inicio' ? 0 : texto.ancora === 'fim' ? 2 : 1;
      corpo.texto(CAMADAS_DO_DXF.texto.nome, texto.texto, noArquivo(texto.posicao), texto.alturaMm, texto.anguloGraus ?? 0, horizontal);
    }
    const caixa = retanguloEnvolvente(peca.contorno);
    const centro = ponto((caixa.minX + caixa.maxX) / 2, (caixa.minY + caixa.maxY) / 2);
    corpo.texto(CAMADAS_DO_DXF.texto.nome, `${peca.nome} (${peca.referencia || '—'}) ${peca.tamanho}`.trim(), noArquivo(centro), ALTURA_DO_NOME_MM, 0, 1);
  }

  const doArquivo = noArquivoTodos(todos);
  const minimo = doArquivo.reduce((m, p) => ponto(Math.min(m.x, p.x), Math.min(m.y, p.y)), ponto(0, 0));
  const maximo = doArquivo.reduce((m, p) => ponto(Math.max(m.x, p.x), Math.max(m.y, p.y)), ponto(0, 0));

  const arquivo = new Escritor();
  arquivo.par(0, 'SECTION');
  arquivo.par(2, 'HEADER');
  arquivo.par(9, '$ACADVER');
  arquivo.par(1, 'AC1009');
  arquivo.par(9, '$DWGCODEPAGE');
  arquivo.par(3, 'ANSI_1252');
  // Milímetros: sem isto, quem abre o arquivo tem de adivinhar a unidade.
  arquivo.par(9, '$INSUNITS');
  arquivo.par(70, '4');
  arquivo.par(9, '$EXTMIN');
  arquivo.par(10, minimo.x);
  arquivo.par(20, minimo.y);
  arquivo.par(30, 0);
  arquivo.par(9, '$EXTMAX');
  arquivo.par(10, maximo.x);
  arquivo.par(20, maximo.y);
  arquivo.par(30, 0);
  arquivo.par(0, 'ENDSEC');

  arquivo.par(0, 'SECTION');
  arquivo.par(2, 'TABLES');
  arquivo.par(0, 'TABLE');
  arquivo.par(2, 'LTYPE');
  arquivo.par(70, '1');
  arquivo.par(0, 'LTYPE');
  arquivo.par(2, 'CONTINUOUS');
  arquivo.par(70, '0');
  arquivo.par(3, 'Solid line');
  arquivo.par(72, '65');
  arquivo.par(73, '0');
  arquivo.par(40, 0);
  arquivo.par(0, 'ENDTAB');
  const camadas = Object.values(CAMADAS_DO_DXF);
  arquivo.par(0, 'TABLE');
  arquivo.par(2, 'LAYER');
  arquivo.par(70, String(camadas.length));
  for (const camada of camadas) {
    arquivo.par(0, 'LAYER');
    arquivo.par(2, camada.nome);
    arquivo.par(70, '0');
    arquivo.par(62, String(camada.cor));
    arquivo.par(6, 'CONTINUOUS');
  }
  arquivo.par(0, 'ENDTAB');
  arquivo.par(0, 'ENDSEC');

  arquivo.par(0, 'SECTION');
  arquivo.par(2, 'ENTITIES');
  arquivo.linhas.push(...corpo.linhas);
  arquivo.par(0, 'ENDSEC');
  arquivo.par(0, 'EOF');
  return arquivo.linhas.join('\r\n') + '\r\n';
}

/** As letras que o Windows-1252 tem fora do Latin-1 (aspas curvas, travessão, reticências...). */
const DO_WINDOWS_1252: Readonly<Record<string, number>> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

/** Os bytes do arquivo, em Windows-1252 (o `$DWGCODEPAGE` dele): os acentos do português saem certos. */
export function codificarDxf(texto: string): Uint8Array {
  const bytes: number[] = [];
  for (const letra of texto) {
    const codigo = letra.codePointAt(0)!;
    if (codigo < 0x80 || (codigo >= 0xa0 && codigo <= 0xff)) bytes.push(codigo);
    else bytes.push(DO_WINDOWS_1252[letra] ?? 0x3f);
  }
  return Uint8Array.from(bytes);
}
