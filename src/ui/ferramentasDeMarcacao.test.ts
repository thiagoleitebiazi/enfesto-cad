import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { criarMolde, type FormatoDePique, type Molde, type Pique } from '../domain/molde';
import { PIQUE_PADRAO } from '../domain/piques';
import { definirTamanhosDoMolde } from '../domain/tamanhosGraduados';
import {
  aplicarAlteracaoDoPique,
  aplicarRemoverTodos,
  aplicarSubstituir,
  caminhoHorario,
  cliqueDeMarcacao,
  dialogoDaMarcacao,
  dialogoDeAlterarPique,
  ehModoDeMarcacao,
  instrucaoDaMarcacao,
  lerDialogoDaMarcacao,
  OPCOES_INICIAIS_DE_MARCACAO,
  posicoesAoLongo,
  previaDaMarcacao,
  removerAgeNaHora,
  tiposEmUso,
  TODOS_OS_TIPOS,
  type CliqueDeMarcacao,
  type ModoDeMarcacao,
  type OpcoesDeMarcacao,
} from './ferramentasDeMarcacao';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';

// Retângulo de 200 × 300 mm; a aresta 0 vai de (0, 0) a (200, 0), e o lado de dentro dela é o do y positivo.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const molde = (extra: Partial<Molde> = {}, id = 'f'): Molde => ({
  ...criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, id),
  ...extra,
});
const O = OPCOES_INICIAIS_DE_MARCACAO;
const inserir = (parte: Partial<OpcoesDeMarcacao['inserir']>): OpcoesDeMarcacao => ({ ...O, inserir: { ...O.inserir, ...parte } });
const multiplos = (parte: Partial<OpcoesDeMarcacao['multiplos']>): OpcoesDeMarcacao => ({ ...O, multiplos: { ...O.multiplos, ...parte } });
const substituir = (parte: Partial<OpcoesDeMarcacao['substituir']>): OpcoesDeMarcacao => ({ ...O, substituir: { ...O.substituir, ...parte } });
const formato = (tipo: string, larguraMm = 4, alturaMm = 6, anguloGraus = 0): FormatoDePique => ({ tipo, larguraMm, alturaMm, anguloGraus });
const na = (indiceAresta: number, x: number, y: number): PosicaoNoContorno => ({ indiceAresta, ponto: ponto(x, y) });
const naBorda = (indiceAresta: number, x: number, y: number): CliqueDeTrecho => ({ noContorno: na(indiceAresta, x, y), livre: ponto(x, y) });
const solto = (x: number, y: number): CliqueDeTrecho => ({ noContorno: null, livre: ponto(x, y) });
const ids = (): (() => string) => {
  let n = 0;
  return () => `n${++n}`;
};
const RAIO = 5;
const clicar = (modo: ModoDeMarcacao, opcoes: OpcoesDeMarcacao, peca: Molde, clique: CliqueDeTrecho, estado: TrechoEmEdicao = SEM_TRECHO, linhaInterna: number | null = null, outras: readonly Molde[] = []): CliqueDeMarcacao =>
  cliqueDeMarcacao(modo, opcoes, [peca, ...outras], peca, estado, clique, { raioMm: RAIO, novoId: ids(), linhaInterna });
const pique = (id: string, x: number, f?: FormatoDePique, extra: Partial<Pique> = {}): Pique => ({ id, posicao: ponto(x, 0), indiceAresta: 0, ...(f ? { formato: f } : {}), ...extra });
const VALORES_DO_FORMATO = { tipo: 'v', largura: 8, altura: 10, angulo: 0 };

describe('quais ferramentas ficam ligadas à espera de cliques', () => {
  it('Inserir, Remover, Múltiplos e Alterar esperam cliques; Substituir age pela janela', () => {
    for (const modo of ['inserir-pique', 'remover-pique', 'multiplos-piques', 'alterar-pique']) expect(ehModoDeMarcacao(modo)).toBe(true);
    for (const outro of ['substituir-piques', 'selecionar', 'pique']) expect(ehModoDeMarcacao(outro)).toBe(false);
  });
});

describe('as janelas', () => {
  it('Inserir pergunta o formato, onde o pique fica e o que vai junto', () => {
    const dialogo = dialogoDaMarcacao('inserir-pique', O, [molde()])!;

    expect(dialogo.titulo).toBe('Inserir pique');
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['tipo', 'traco'],
      ['largura', '4'],
      ['altura', '6'],
      ['angulo', '0'],
      ['sobreOContorno', true],
      ['distancia', ''],
      ['codigo', false],
      ['pontoDeControle', false],
      ['manterDistancia', false],
      ['naCostura', 'nao'],
      ['usarDxDy', false],
      ['dx', '0'],
      ['dy', '0'],
    ]);
    const tipo = dialogo.campos[0]!;
    expect(tipo.tipo === 'escolha' && tipo.opcoes.map((o) => o.valor)).toEqual(['traco', 'v', 't', 'u', 'caixa', 'cruz', 'circulo']);
    // Onde o manual se cala, a janela diz o que é leitura nossa.
    expect(dialogo.nota).toMatch(/não descreve os tipos nem diz de onde o ângulo é contado: os formatos e o ângulo contado do esquadro com a borda \(positivo, no sentido anti-horário da tela\) são a nossa leitura\./);
    expect(dialogo.nota).toMatch(/O manual também não diz de onde partem o Dx e o Dy: aqui, do ponto clicado\.$/);
  });

  it('lê as opções do Inserir, e recusa o formato e a distância que não servem', () => {
    const lidas = lerDialogoDaMarcacao('inserir-pique', O, { ...VALORES_DO_FORMATO, sobreOContorno: true, distancia: 25, codigo: true, pontoDeControle: true, manterDistancia: true, naCostura: 'estendido', usarDxDy: true, dx: 5, dy: -3 });

    expect(lidas.inserir).toEqual({ formato: formato('v', 8, 10), sobreOContorno: true, distanciaMm: 25, codigo: true, pontoDeControle: true, manterDistancia: true, naCostura: 'estendido', usarDxDy: true, dxMm: 5, dyMm: -3 });
    // Em branco, a distância não vem: o pique fica onde for clicado.
    expect(lerDialogoDaMarcacao('inserir-pique', O, { ...VALORES_DO_FORMATO, naCostura: 'outra', dx: 0, dy: 0 }).inserir).toMatchObject({ distanciaMm: null, sobreOContorno: false, naCostura: 'nao', codigo: false });
    expect(() => lerDialogoDaMarcacao('inserir-pique', O, { ...VALORES_DO_FORMATO, distancia: -1, dx: 0, dy: 0 })).toThrow('A distância do ponto de referência precisa ser zero ou mais.');
    expect(() => lerDialogoDaMarcacao('inserir-pique', O, { ...VALORES_DO_FORMATO, largura: 0, dx: 0, dy: 0 })).toThrow(/largura do pique/);
  });

  it('o tipo cadastrado entra na lista e traz a forma dele; o que saiu do cadastro continua na lista do pique que o tem', () => {
    const SETA = { id: 'c1', nome: 'Seta', descricao: 'ponta fina', forma: [[ponto(-0.5, 0), ponto(0, 1), ponto(0.5, 0)]] };
    const comCadastro = dialogoDaMarcacao('inserir-pique', O, [molde()], [SETA])!.campos[0]!;

    expect(comCadastro.tipo === 'escolha' && comCadastro.opcoes.at(-1)).toEqual({ valor: 'cadastrado:c1', rotulo: 'Seta: ponta fina (cadastrado)' });
    const lido = lerDialogoDaMarcacao('inserir-pique', O, { ...VALORES_DO_FORMATO, tipo: 'cadastrado:c1', dx: 0, dy: 0 }, [SETA]).inserir.formato;
    expect(lido).toEqual({ tipo: 'cadastrado:c1', larguraMm: 8, alturaMm: 10, anguloGraus: 0, forma: SETA.forma, nome: 'Seta' });
    // O mesmo formato, com o cadastro vazio: a janela ainda o mostra, e ler de novo mantém a forma.
    const semCadastro = dialogoDaMarcacao('inserir-pique', inserir({ formato: lido }), [molde()])!.campos[0]!;
    expect(semCadastro.tipo === 'escolha' && semCadastro.opcoes.at(-1)).toEqual({ valor: 'cadastrado:c1', rotulo: 'Seta (do pique)' });
    expect(lerDialogoDaMarcacao('inserir-pique', inserir({ formato: lido }), { ...VALORES_DO_FORMATO, tipo: 'cadastrado:c1', dx: 0, dy: 0 }).inserir.formato.forma).toEqual(SETA.forma);
    expect(() => lerDialogoDaMarcacao('inserir-pique', O, { ...VALORES_DO_FORMATO, tipo: 'cadastrado:c1', dx: 0, dy: 0 })).toThrow('Escolha um tipo de pique da lista.');
  });

  it('Remover, Múltiplos e Substituir têm janela; Alterar liga direto', () => {
    expect(dialogoDaMarcacao('remover-pique', O, [molde()])!.campos.map((c) => c.id)).toEqual(['doContorno', 'internos']);
    expect(dialogoDaMarcacao('multiplos-piques', O, [molde()])!.campos.map((c) => c.id)).toEqual(['modo', 'por', 'quantidade', 'espaco', 'tipo', 'largura', 'altura', 'angulo']);
    expect(dialogoDaMarcacao('multiplos-piques', O, [molde()])!.nota).toMatch(/não a conta: os espaços iguais do começo ao fim e a contagem a partir do começo são a nossa leitura\./);
    expect(dialogoDaMarcacao('substituir-piques', O, [molde()])!.campos.map((c) => c.id)).toEqual(['de', 'onde', 'acao', 'tipo', 'largura', 'altura', 'angulo', 'distancia']);
    expect(dialogoDaMarcacao('alterar-pique', O, [molde()])).toBeNull();
    expect(dialogoDaMarcacao('pique-texto', O, [molde()])).toBeNull();
    expect(lerDialogoDaMarcacao('alterar-pique', O, {})).toBe(O);
  });

  it('lê as opções do Remover, do Múltiplos e do Substituir, com os limites de cada um', () => {
    expect(lerDialogoDaMarcacao('remover-pique', O, { doContorno: true, internos: false }).remover).toEqual({ doContorno: true, internos: false });
    expect(lerDialogoDaMarcacao('multiplos-piques', O, { ...VALORES_DO_FORMATO, modo: 'mouse', por: 'perimetro', quantidade: 4, espaco: 25 }).multiplos).toEqual({ modo: 'mouse', por: 'perimetro', quantidade: 4, espacoMm: 25, formato: formato('v', 8, 10) });
    expect(lerDialogoDaMarcacao('multiplos-piques', O, { ...VALORES_DO_FORMATO, modo: 'x', por: 'x', quantidade: 4, espaco: 25 }).multiplos).toMatchObject({ modo: 'contorno', por: 'numero' });
    expect(() => lerDialogoDaMarcacao('multiplos-piques', O, { ...VALORES_DO_FORMATO, por: 'numero', quantidade: 0, espaco: 25 })).toThrow('O número de piques precisa ficar entre 1 e 200.');
    expect(() => lerDialogoDaMarcacao('multiplos-piques', O, { ...VALORES_DO_FORMATO, por: 'numero', quantidade: 201, espaco: 25 })).toThrow(/entre 1 e 200/);
    expect(() => lerDialogoDaMarcacao('multiplos-piques', O, { ...VALORES_DO_FORMATO, por: 'perimetro', quantidade: 0, espaco: 0 })).toThrow('O espaço entre um pique e outro precisa ser maior que zero.');
    expect(lerDialogoDaMarcacao('substituir-piques', O, { ...VALORES_DO_FORMATO, de: 't', onde: 'todas', acao: 'marca', distancia: 12 }).substituir).toEqual({ de: 't', onde: 'todas', acao: 'marca', formato: formato('v', 8, 10), distanciaMm: 12 });
    expect(lerDialogoDaMarcacao('substituir-piques', O, { ...VALORES_DO_FORMATO, de: 't', onde: 'x', acao: 'x', distancia: 0 }).substituir).toMatchObject({ onde: 'selecionada', acao: 'trocar' });
    expect(() => lerDialogoDaMarcacao('substituir-piques', O, { ...VALORES_DO_FORMATO, de: 't', onde: 'todas', acao: 'marca', distancia: 0 })).toThrow('A distância do pique interno precisa ser maior que zero.');
  });
});

describe('Inserir', () => {
  it('na borda: o pique fica onde foi clicado, com o formato da janela', () => {
    const feito = clicar('inserir-pique', inserir({ formato: formato('v', 8, 10) }), molde(), naBorda(0, 100, 0));

    expect(feito.pecas![0]!.piques).toEqual([{ id: 'n1', posicao: ponto(100, 0), indiceAresta: 0, formato: formato('v', 8, 10) }]);
    expect(feito.estado).toBe(SEM_TRECHO);
    expect(feito.recado).toBe('Pique (V, de 8,0 mm × 10,0 mm) posto na borda de “Frente”.');
  });

  it('fora da borda, o clique só diz onde clicar', () => {
    const fora = clicar('inserir-pique', O, molde(), solto(100, 150));

    expect(fora.pecas).toBeUndefined();
    expect(fora.recado).toBe('Clique na borda da peça selecionada: é nela que o pique fica.');
  });

  it('com a distância da referência, o pique fica a essa distância do ponto do contorno mais perto do clique', () => {
    const feito = clicar('inserir-pique', inserir({ distanciaMm: 50 }), molde(), naBorda(0, 170, 0));
    expect(feito.pecas![0]!.piques[0]!.posicao).toEqual(ponto(150, 0));
  });

  it('perto de um canto, onde o clique é preso no canto, o lado é o do ponto clicado de verdade', () => {
    // O clique em (180, 2) é preso no canto (200, 0): o pique vai para a aresta de onde se clicou, e não para a outra.
    const presoNoCanto = (x: number, y: number): CliqueDeTrecho => ({ noContorno: na(1, 200, 0), livre: ponto(x, y) });
    expect(clicar('inserir-pique', inserir({ distanciaMm: 50 }), molde(), presoNoCanto(180, 2)).pecas![0]!.piques[0]!.posicao).toEqual(ponto(150, 0));
    expect(clicar('inserir-pique', inserir({ distanciaMm: 50 }), molde(), presoNoCanto(198, 20)).pecas![0]!.piques[0]!.posicao).toEqual(ponto(200, 50));
    const previa = previaDaMarcacao('inserir-pique', inserir({ distanciaMm: 50 }), molde(), SEM_TRECHO, presoNoCanto(180, 2), { raioMm: RAIO, linhaInterna: null });
    expect(previa.marcas).toEqual([ponto(150, 0)]);
  });

  it('com “Código”, cada pique recebe o código seguinte da sequência do projeto', () => {
    const outra = molde({ piques: [pique('a', 20, undefined, { codigo: '4' })] }, 'c');
    const primeiro = clicar('inserir-pique', inserir({ codigo: true }), molde(), naBorda(0, 100, 0), SEM_TRECHO, null, [outra]);

    expect(primeiro.pecas![0]!.piques[0]!.codigo).toBe('5');
    expect(primeiro.recado).toBe('Pique (Traço (I), de 4,0 mm × 6,0 mm) posto na borda de “Frente”, com o código 5.');
    const segundo = clicar('inserir-pique', inserir({ codigo: true }), primeiro.pecas![0]!, naBorda(0, 150, 0), SEM_TRECHO, null, [outra]);
    expect(segundo.pecas![0]!.piques[1]!.codigo).toBe('6');
  });

  it('as opções que não valem na peça são ditas na mensagem', () => {
    const feito = clicar('inserir-pique', inserir({ manterDistancia: true, naCostura: 'projetado', pontoDeControle: true }), molde(), naBorda(0, 100, 0));

    expect(feito.recado).toBe(
      'Pique (Traço (I), de 4,0 mm × 6,0 mm) posto na borda de “Frente”, com um ponto no contorno. “Manter distância nos tamanhos” só vale na peça graduada. “Pique na costura” só aparece na peça com margem de costura.',
    );
    expect(feito.pecas![0]!.contorno).toHaveLength(5);
    expect(feito.pecas![0]!.piques[0]!.naCostura).toBe('projetado');
    // Na peça graduada e com margem, valem — e a mensagem não avisa nada.
    const graduada = { ...definirTamanhosDoMolde(molde(), ['P', 'M', 'G'], 'M'), margemDeCosturaMm: 10 };
    const naGraduada = clicar('inserir-pique', inserir({ manterDistancia: true, naCostura: 'projetado' }), graduada, naBorda(0, 100, 0));
    expect(naGraduada.recado).toBe('Pique (Traço (I), de 4,0 mm × 6,0 mm) posto na borda de “Frente”.');
    expect(naGraduada.pecas![0]!.piques[0]!.graduacao!.perimetros).toEqual([0, 0, 0]);
  });

  it('interno: uma marca com formato no ponto clicado — ou a Dx e Dy dele, contados do ponto do contorno sob o clique', () => {
    const interno = inserir({ sobreOContorno: false, formato: formato('cruz') });
    const feito = clicar('inserir-pique', interno, molde(), solto(100, 150));

    expect(feito.pecas![0]!.marcas).toEqual([{ id: 'n1', posicao: ponto(100, 150), formato: formato('cruz') }]);
    expect(feito.recado).toBe('Pique interno (Cruz, de 4,0 mm × 6,0 mm) posto em “Frente”.');
    // Dx é a horizontal da tela (o y do mundo); Dy, a vertical para baixo (o x do mundo).
    const comEsquadro = inserir({ sobreOContorno: false, usarDxDy: true, dxMm: 30, dyMm: 20 });
    expect(clicar('inserir-pique', comEsquadro, molde(), solto(100, 150)).pecas![0]!.marcas[0]!.posicao).toEqual(ponto(120, 180));
    expect(clicar('inserir-pique', comEsquadro, molde(), naBorda(0, 0, 0)).pecas![0]!.marcas[0]!.posicao).toEqual(ponto(20, 30));
    // O clique perto do canto é preso nele: o Dx e o Dy partem do canto, e não do ponto clicado.
    expect(clicar('inserir-pique', comEsquadro, molde(), { noContorno: na(0, 0, 0), livre: ponto(3, 4) }).pecas![0]!.marcas[0]!.posicao).toEqual(ponto(20, 30));
    // Fora da peça, não entra.
    const fora = clicar('inserir-pique', interno, molde(), solto(300, 150));
    expect(fora.pecas).toBeUndefined();
    expect(fora.recado).toBe('O pique interno precisa ficar dentro da peça.');
  });

  it('a prévia mostra o pique como ficaria, e a instrução diz o que o clique faz', () => {
    const naBordaDaPeca = previaDaMarcacao('inserir-pique', inserir({ formato: formato('v', 8, 10) }), molde(), SEM_TRECHO, naBorda(0, 100, 0), { raioMm: RAIO, linhaInterna: null });
    expect(naBordaDaPeca.marcas).toEqual([ponto(100, 0)]);
    expect(naBordaDaPeca.linhas![0]![1]!.y).toBeCloseTo(10, 9);
    expect(previaDaMarcacao('inserir-pique', O, molde(), SEM_TRECHO, solto(100, 150), { raioMm: RAIO, linhaInterna: null })).toEqual({});
    expect(previaDaMarcacao('inserir-pique', O, molde(), SEM_TRECHO, null, { raioMm: RAIO, linhaInterna: null })).toEqual({});
    const interno = inserir({ sobreOContorno: false, formato: formato('cruz') });
    expect(previaDaMarcacao('inserir-pique', interno, molde(), SEM_TRECHO, solto(100, 150), { raioMm: RAIO, linhaInterna: null }).linhas).toHaveLength(2);
    expect(previaDaMarcacao('inserir-pique', interno, molde(), SEM_TRECHO, solto(300, 150), { raioMm: RAIO, linhaInterna: null })).toEqual({});

    expect(instrucaoDaMarcacao('inserir-pique', O, SEM_TRECHO)).toBe('Inserir pique (Traço (I)): clique na borda da peça selecionada, onde o pique deve ficar. O tracejado mostra. Esc sai.');
    expect(instrucaoDaMarcacao('inserir-pique', inserir({ distanciaMm: 50 }), SEM_TRECHO)).toMatch(/o pique fica a 50,0 mm do ponto do contorno mais perto do clique, para o lado do clique\. O tracejado mostra\. Esc sai\.$/);
    expect(instrucaoDaMarcacao('inserir-pique', interno, SEM_TRECHO)).toBe('Inserir pique interno (Cruz): clique dentro da peça selecionada, onde o pique deve ficar. Esc sai.');
    expect(instrucaoDaMarcacao('inserir-pique', inserir({ sobreOContorno: false, usarDxDy: true, dxMm: 30, dyMm: 20 }), SEM_TRECHO)).toMatch(/no ponto de onde contar o Dx de 30,0 mm e o Dy de 20,0 mm\. Esc sai\.$/);
  });
});

describe('Remover', () => {
  const comPiques = (): Molde => molde({ piques: [pique('a', 50), pique('b', 150, formato('v'))], marcas: [{ id: 'm', posicao: ponto(100, 150) }] });

  it('o clique tira o pique sob ele — do contorno ou interno', () => {
    const semB = clicar('remover-pique', O, comPiques(), solto(151, 1));
    expect(semB.pecas![0]!.piques.map((q) => q.id)).toEqual(['a']);
    expect(semB.recado).toBe('Pique removido de “Frente”.');
    const semM = clicar('remover-pique', O, comPiques(), solto(101, 149));
    expect(semM.pecas![0]!.marcas).toEqual([]);
    expect(semM.pecas![0]!.piques).toHaveLength(2);
    expect(semM.recado).toBe('Pique interno removido de “Frente”.');
    const nada = clicar('remover-pique', O, comPiques(), solto(100, 80));
    expect(nada.pecas).toBeUndefined();
    expect(nada.recado).toBe('Clique em cima de um pique da peça selecionada — do contorno ou interno.');
  });

  it('com uma das caixas de “todos”, age ao confirmar a janela, e diz quantos saíram', () => {
    const todos = { ...O, remover: { doContorno: true, internos: true } };
    const soContorno = { ...O, remover: { doContorno: true, internos: false } };
    const soInternos = { ...O, remover: { doContorno: false, internos: true } };

    expect(removerAgeNaHora(O)).toBe(false);
    expect(removerAgeNaHora(soContorno)).toBe(true);
    expect(removerAgeNaHora(soInternos)).toBe(true);
    const feito = aplicarRemoverTodos(todos, [comPiques()], comPiques());
    expect(feito.pecas[0]).toMatchObject({ piques: [], marcas: [] });
    expect(feito.recado).toBe('Removidos de “Frente”: 2 piques do contorno e 1 pique interno.');
    expect(aplicarRemoverTodos(soContorno, [comPiques()], comPiques()).pecas[0]!.marcas).toHaveLength(1);
    expect(aplicarRemoverTodos(soInternos, [comPiques()], comPiques()).recado).toBe('Removidos de “Frente”: 1 pique interno.');
    expect(() => aplicarRemoverTodos(todos, [molde()], molde())).toThrow('“Frente” não tem piques para remover.');
    expect(() => aplicarRemoverTodos(soContorno, [molde()], molde())).toThrow('“Frente” não tem piques no contorno para remover.');
    expect(() => aplicarRemoverTodos(soInternos, [molde()], molde())).toThrow('“Frente” não tem piques internos para remover.');
  });

  it('o anel mostra o pique que o clique pega', () => {
    const contexto = { raioMm: RAIO, linhaInterna: null };
    expect(previaDaMarcacao('remover-pique', O, comPiques(), SEM_TRECHO, solto(151, 1), contexto)).toEqual({ marcas: [ponto(150, 0)] });
    expect(previaDaMarcacao('remover-pique', O, comPiques(), SEM_TRECHO, solto(101, 149), contexto)).toEqual({ marcas: [ponto(100, 150)] });
    expect(previaDaMarcacao('remover-pique', O, comPiques(), SEM_TRECHO, solto(100, 80), contexto)).toEqual({});
    expect(instrucaoDaMarcacao('remover-pique', O, SEM_TRECHO)).toMatch(/^Remover pique: clique em cima de cada pique que deve sair/);
  });
});

describe('Alterar', () => {
  const comPiques = (): Molde => molde({ piques: [pique('a', 50, undefined, { codigo: '9' }), pique('b', 150, formato('v'))], marcas: [{ id: 'm', posicao: ponto(100, 150) }] });

  it('o clique num pique pede a janela dele; fora deles, diz onde clicar', () => {
    expect(clicar('alterar-pique', O, comPiques(), solto(151, 1)).abrir).toEqual({ id: 'b', interno: false });
    expect(clicar('alterar-pique', O, comPiques(), solto(101, 149)).abrir).toEqual({ id: 'm', interno: true });
    const nada = clicar('alterar-pique', O, comPiques(), solto(100, 80));
    expect(nada.abrir).toBeUndefined();
    expect(nada.recado).toMatch(/^Clique em cima de um pique da peça selecionada/);
  });

  it('a janela do pique do contorno traz o formato, o ponto de referência com a distância dele, o código e a costura', () => {
    const dialogo = dialogoDeAlterarPique(comPiques(), 'a', false)!;

    expect(dialogo.titulo).toBe('Alterar pique');
    // O pique em (50, 0): o ponto mais perto é o 1, a 50 mm.
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['tipo', 'traco'],
      ['largura', '4'],
      ['altura', '6'],
      ['angulo', '0'],
      ['ponto', '1'],
      ['perimetro', '50'],
      ['codigo', '9'],
      ['naCostura', 'nao'],
      ['mover', false],
    ]);
    expect(dialogo.nota).toMatch(/dos de antes da aba Marcações.*passa a ter formato — e a ser desenhado para dentro da peça\.$/);
    // O pique perto do ponto 2 conta a distância contra a numeração; o que já tem formato tem outra nota.
    const doB = dialogoDeAlterarPique(comPiques(), 'b', false)!;
    expect(doB.campos.filter((c) => c.id === 'ponto' || c.id === 'perimetro').map((c) => c.inicial)).toEqual(['2', '-50']);
    expect(doB.nota).toMatch(/^O pique é refeito com o formato e no lugar pedidos\./);
    // Na peça graduada, a janela pergunta se a distância se mantém nos tamanhos.
    const graduada = definirTamanhosDoMolde(comPiques(), ['P', 'M', 'G'], 'M');
    expect(dialogoDeAlterarPique(graduada, 'a', false)!.campos.map((c) => c.id)).toContain('manterDistancia');
    expect(dialogoDeAlterarPique(comPiques(), 'x', false)).toBeNull();
  });

  it('aplica o formato, o lugar, o código e a costura', () => {
    const feito = aplicarAlteracaoDoPique([comPiques()], comPiques(), 'a', false, { ...VALORES_DO_FORMATO, ponto: 2, perimetro: -30, codigo: 'A1', naCostura: 'estendido', mover: false });

    expect(feito.pecas[0]!.piques[0]).toEqual({ id: 'a', posicao: ponto(170, 0), indiceAresta: 0, formato: formato('v', 8, 10), codigo: 'A1', naCostura: 'estendido' });
    expect(feito.recado).toBe('Pique de “Frente” alterado: V, de 8,0 mm × 10,0 mm, agora a 30,0 mm do ponto 2.');
    expect(feito.mover).toBe(false);
    // Sem o código e com "não vai": os dois saem do pique. No mesmo lugar, a mensagem não fala de lugar.
    const limpo = aplicarAlteracaoDoPique([comPiques()], comPiques(), 'a', false, { ...VALORES_DO_FORMATO, ponto: 1, perimetro: 50, naCostura: 'nao', mover: true });
    expect(Object.keys(limpo.pecas[0]!.piques[0]!).sort()).toEqual(['formato', 'id', 'indiceAresta', 'posicao']);
    expect(limpo.recado).toBe('Pique de “Frente” alterado: V, de 8,0 mm × 10,0 mm.');
    expect(limpo.mover).toBe(true);
    expect(() => aplicarAlteracaoDoPique([comPiques()], comPiques(), 'a', false, { ...VALORES_DO_FORMATO, ponto: 9, perimetro: 0 })).toThrow('O ponto de referência precisa ser um número de 1 a 4.');
    expect(() => aplicarAlteracaoDoPique([comPiques()], comPiques(), 'x', false, VALORES_DO_FORMATO)).toThrow('Esse pique já não está na peça.');
  });

  it('sem mexer no ponto nem no perímetro, o pique fica exatamente onde estava — mesmo que a janela mostre o perímetro arredondado', () => {
    // O pique a 198,2371 mm do ponto 1: a janela mostra 198,24.
    const peca = molde({ piques: [{ id: 'a', posicao: ponto(200, 98.2371), indiceAresta: 1 }, { id: 'longe', posicao: ponto(200, 150), indiceAresta: 1 }] });
    const dialogo = dialogoDeAlterarPique(peca, 'a', false)!;
    const [doPonto, doPerimetro] = ['ponto', 'perimetro'].map((id) => String(dialogo.campos.find((c) => c.id === id)!.inicial));
    expect([doPonto, doPerimetro]).toEqual(['2', '98,24']);
    const semMexer = aplicarAlteracaoDoPique([peca], peca, 'a', false, { ...VALORES_DO_FORMATO, ponto: 2, perimetro: 98.24, naCostura: 'nao', mover: false });

    expect(semMexer.pecas[0]!.piques[0]!.posicao).toEqual(ponto(200, 98.2371));
    expect(semMexer.recado).toBe('Pique de “Frente” alterado: V, de 8,0 mm × 10,0 mm.');
    // Mexendo no perímetro, vale o que foi digitado.
    const mexendo = aplicarAlteracaoDoPique([peca], peca, 'a', false, { ...VALORES_DO_FORMATO, ponto: 2, perimetro: 98.3, naCostura: 'nao', mover: false });
    expect(mexendo.pecas[0]!.piques[0]!.posicao.y).toBeCloseTo(98.3, 9);
    expect(mexendo.recado).toMatch(/agora a 98,3 mm do ponto 2\.$/);
  });

  it('“Manter distância” liga e desliga a graduação de zeros do pique', () => {
    const graduada = definirTamanhosDoMolde(comPiques(), ['P', 'M', 'G'], 'M');
    const valores = { ...VALORES_DO_FORMATO, ponto: 1, perimetro: 50, naCostura: 'nao', mover: false };
    const ligada = aplicarAlteracaoDoPique([graduada], graduada, 'a', false, { ...valores, manterDistancia: true }).pecas[0]!;

    expect(ligada.piques[0]!.graduacao!.perimetros).toEqual([0, 0, 0]);
    expect(dialogoDeAlterarPique(ligada, 'a', false)!.campos.find((c) => c.id === 'manterDistancia')!.inicial).toBe(true);
    const desligada = aplicarAlteracaoDoPique([ligada], ligada, 'a', false, { ...valores, manterDistancia: false }).pecas[0]!;
    expect(desligada.piques[0]!.graduacao).toBeUndefined();
  });

  it('o pique interno muda de formato; a marca que era só um ponto passa a ser um pique interno', () => {
    const dialogo = dialogoDeAlterarPique(comPiques(), 'm', true)!;
    expect(dialogo.titulo).toBe('Alterar pique interno');
    expect(dialogo.campos.map((c) => c.id)).toEqual(['tipo', 'largura', 'altura', 'angulo', 'mover']);
    expect(dialogo.nota).toMatch(/ainda é só um ponto/);
    const feito = aplicarAlteracaoDoPique([comPiques()], comPiques(), 'm', true, { ...VALORES_DO_FORMATO, tipo: 'circulo', mover: false });

    expect(feito.pecas[0]!.marcas[0]).toEqual({ id: 'm', posicao: ponto(100, 150), formato: formato('circulo', 8, 10) });
    expect(feito.recado).toBe('Pique interno de “Frente” alterado: Círculo, de 8,0 mm × 10,0 mm.');
    expect(dialogoDeAlterarPique(feito.pecas[0]!, 'm', true)!.nota).toMatch(/^O pique interno é refeito/);
    expect(() => aplicarAlteracaoDoPique([comPiques()], comPiques(), 'x', true, VALORES_DO_FORMATO)).toThrow('Esse pique interno já não está na peça.');
  });

  it('com a posição por indicar, o clique seguinte leva o pique para lá', () => {
    const esperandoOPique: TrechoEmEdicao = { ...SEM_TRECHO, alvo: 'b' };
    const levado = clicar('alterar-pique', O, comPiques(), naBorda(1, 200, 100), esperandoOPique);

    expect(levado.pecas![0]!.piques[1]).toMatchObject({ id: 'b', posicao: ponto(200, 100), indiceAresta: 1, formato: formato('v') });
    expect(levado.estado).toBe(SEM_TRECHO);
    expect(levado.recado).toBe('Pique de “Frente” levado para o ponto clicado.');
    const foraDaBorda = clicar('alterar-pique', O, comPiques(), solto(100, 80), esperandoOPique);
    expect(foraDaBorda.estado).toBe(esperandoOPique);
    expect(foraDaBorda.recado).toBe('Clique na borda da peça: é nela que o pique fica.');
    // O interno vai para dentro da peça.
    const esperandoAMarca: TrechoEmEdicao = { ...SEM_TRECHO, alvo: 'm' };
    expect(clicar('alterar-pique', O, comPiques(), solto(60, 200), esperandoAMarca).pecas![0]!.marcas[0]!.posicao).toEqual(ponto(60, 200));
    expect(clicar('alterar-pique', O, comPiques(), solto(300, 200), esperandoAMarca).recado).toBe('O pique interno precisa ficar dentro da peça: clique dentro dela.');
    expect(clicar('alterar-pique', O, comPiques(), solto(60, 200), { ...SEM_TRECHO, alvo: 'sumiu' }).recado).toBe('Esse pique já não está na peça.');
    // A prévia mostra o pique no lugar novo e marca o de antes; a instrução muda.
    const previa = previaDaMarcacao('alterar-pique', O, comPiques(), esperandoOPique, naBorda(1, 200, 100), { raioMm: RAIO, linhaInterna: null });
    expect(previa.marcas).toEqual([ponto(150, 0)]);
    // O V no lugar novo: a boca na borda x = 200, o bico 6 mm para dentro.
    expect(previa.linhas![0]![0]).toEqual(ponto(200, 98));
    expect(previa.linhas![0]![1]!.x).toBeCloseTo(194, 9);
    expect(previa.linhas![0]![1]!.y).toBeCloseTo(100, 9);
    expect(instrucaoDaMarcacao('alterar-pique', O, esperandoOPique)).toMatch(/^Alterar pique: clique onde o pique deve ficar/);
    expect(instrucaoDaMarcacao('alterar-pique', O, SEM_TRECHO)).toMatch(/^Alterar pique: clique em cima de um pique/);
  });
});

describe('Múltiplos', () => {
  it('o caminho horário: no retângulo, de (150, 0) a (50, 0) é o trecho curto; ao contrário, a volta inteira', () => {
    expect(caminhoHorario(molde(), na(0, 150, 0), na(0, 50, 0))).toEqual([ponto(150, 0), ponto(50, 0)]);
    expect(caminhoHorario(molde(), na(0, 50, 0), na(0, 150, 0))).toEqual([ponto(50, 0), ponto(0, 0), ponto(0, 300), ponto(200, 300), ponto(200, 0), ponto(150, 0)]);
    // O mesmo contorno guardado no outro sentido dá o mesmo caminho.
    const invertido = molde({ contorno: [...RETANGULO].reverse() });
    expect(caminhoHorario(invertido, na(2, 150, 0), na(2, 50, 0))).toEqual([ponto(150, 0), ponto(50, 0)]);
  });

  it('pelo número: essa quantidade, com espaços iguais do começo ao fim; pelo perímetro: um a cada tantos mm', () => {
    const reta: Ponto2D[] = [ponto(0, 0), ponto(100, 0)];

    expect(posicoesAoLongo(reta, { ...O.multiplos, por: 'numero', quantidade: 3 })).toEqual([ponto(0, 0), ponto(50, 0), ponto(100, 0)]);
    expect(posicoesAoLongo(reta, { ...O.multiplos, por: 'numero', quantidade: 1 })).toEqual([ponto(0, 0)]);
    expect(posicoesAoLongo(reta, { ...O.multiplos, por: 'perimetro', espacoMm: 40 })).toEqual([ponto(0, 0), ponto(40, 0), ponto(80, 0)]);
    expect(posicoesAoLongo(reta, { ...O.multiplos, por: 'perimetro', espacoMm: 50 })).toEqual([ponto(0, 0), ponto(50, 0), ponto(100, 0)]);
    // Numa linha quebrada, a conta é sobre a linha.
    expect(posicoesAoLongo([ponto(0, 0), ponto(100, 0), ponto(100, 100)], { ...O.multiplos, por: 'numero', quantidade: 3 })).toEqual([ponto(0, 0), ponto(100, 0), ponto(100, 100)]);
    expect(() => posicoesAoLongo([ponto(0, 0), ponto(0, 0)], O.multiplos)).toThrow('Os dois pontos precisam ser diferentes.');
    expect(() => posicoesAoLongo(reta, { ...O.multiplos, por: 'perimetro', espacoMm: 0.4 })).toThrow('Com esse espaço seriam 251 piques: o máximo de uma vez é 200.');
  });

  it('sobre o contorno: dois cliques na borda, e os piques vão do primeiro ao segundo no sentido horário', () => {
    const opcoes = multiplos({ modo: 'contorno', por: 'numero', quantidade: 3, formato: formato('v') });
    const primeiro = clicar('multiplos-piques', opcoes, molde(), naBorda(0, 150, 0));

    expect(primeiro.pecas).toBeUndefined();
    expect(primeiro.estado.inicio).toEqual(na(0, 150, 0));
    const feito = clicar('multiplos-piques', opcoes, molde(), naBorda(0, 50, 0), primeiro.estado);
    expect(feito.pecas![0]!.piques.map((q) => q.posicao)).toEqual([ponto(150, 0), ponto(100, 0), ponto(50, 0)]);
    expect(feito.pecas![0]!.piques.every((q) => q.formato!.tipo === 'v' && q.indiceAresta === 0)).toBe(true);
    expect(feito.estado).toBe(SEM_TRECHO);
    expect(feito.recado).toBe('3 piques postos em “Frente”, na borda, no sentido horário: V, de 4,0 mm × 6,0 mm.');
    expect(clicar('multiplos-piques', opcoes, molde(), solto(100, 150)).recado).toBe('Clique na borda da peça selecionada.');
    // Dobrando o canto: de (50, 0), no sentido horário, até (0, 50), um a cada 40 mm.
    const peloPerimetro = multiplos({ modo: 'contorno', por: 'perimetro', espacoMm: 40 });
    const noCanto = clicar('multiplos-piques', peloPerimetro, molde(), naBorda(3, 0, 50), { ...SEM_TRECHO, inicio: na(0, 50, 0) });
    expect(noCanto.pecas![0]!.piques.map((q) => q.posicao)).toEqual([ponto(50, 0), ponto(10, 0), ponto(0, 30)]);
  });

  it('pontos do mouse: piques internos na reta entre dois pontos clicados', () => {
    const opcoes = multiplos({ modo: 'mouse', por: 'numero', quantidade: 3, formato: formato('cruz') });
    const primeiro = clicar('multiplos-piques', opcoes, molde(), solto(50, 100));

    expect(primeiro.estado.livres).toEqual([ponto(50, 100)]);
    const feito = clicar('multiplos-piques', opcoes, molde(), solto(150, 200), primeiro.estado);
    expect(feito.pecas![0]!.marcas.map((m) => m.posicao)).toEqual([ponto(50, 100), ponto(100, 150), ponto(150, 200)]);
    expect(feito.pecas![0]!.piques).toEqual([]);
    expect(feito.recado).toBe('3 piques postos em “Frente”, na reta entre os dois pontos: Cruz, de 4,0 mm × 6,0 mm.');
    // Um ponto fora da peça recusa todos, e o primeiro ponto continua guardado.
    const fora = clicar('multiplos-piques', opcoes, molde(), solto(300, 200), primeiro.estado);
    expect(fora.pecas).toBeUndefined();
    expect(fora.estado).toBe(primeiro.estado);
    expect(fora.recado).toBe('O pique interno precisa ficar dentro da peça.');
  });

  it('elemento: piques internos ao longo da linha interna clicada', () => {
    const comLinha = molde({ linhasInternas: [[ponto(50, 100), ponto(150, 100)]] });
    const opcoes = multiplos({ modo: 'elemento', por: 'perimetro', espacoMm: 50 });
    const feito = clicar('multiplos-piques', opcoes, comLinha, solto(100, 100), SEM_TRECHO, 0);

    expect(feito.pecas![0]!.marcas.map((m) => m.posicao)).toEqual([ponto(50, 100), ponto(100, 100), ponto(150, 100)]);
    expect(feito.recado).toMatch(/^3 piques postos em “Frente”, ao longo da linha interna: /);
    expect(clicar('multiplos-piques', opcoes, comLinha, solto(100, 200), SEM_TRECHO, null).recado).toBe('Clique em cima de uma linha interna da peça selecionada: os piques ficam ao longo dela.');
    // A linha que sai da peça: só entram os piques de dentro, e a mensagem diz quantos pontos ficaram de fora.
    const saindo = molde({ linhasInternas: [[ponto(50, 100), ponto(250, 100)]] });
    const parte = clicar('multiplos-piques', multiplos({ modo: 'elemento', por: 'numero', quantidade: 3 }), saindo, solto(100, 100), SEM_TRECHO, 0);
    expect(parte.pecas![0]!.marcas.map((m) => m.posicao)).toEqual([ponto(50, 100), ponto(150, 100)]);
    expect(parte.recado).toBe('2 piques postos em “Frente”, ao longo da linha interna: Traço (I), de 4,0 mm × 6,0 mm. 1 ponto da linha cai fora da peça e não recebeu pique.');
    const todaFora = molde({ linhasInternas: [[ponto(250, 100), ponto(350, 100)]] });
    expect(clicar('multiplos-piques', multiplos({ modo: 'elemento' }), todaFora, solto(300, 100), SEM_TRECHO, 0).recado).toBe('Nenhum ponto dessa linha fica dentro da peça.');
  });

  it('a prévia mostra onde cada pique cai, e a instrução acompanha o modo e o passo', () => {
    const contexto = { raioMm: RAIO, linhaInterna: null };
    const noContorno = multiplos({ modo: 'contorno', por: 'numero', quantidade: 3 });
    const comInicio: TrechoEmEdicao = { ...SEM_TRECHO, inicio: na(0, 150, 0) };

    expect(previaDaMarcacao('multiplos-piques', noContorno, molde(), comInicio, naBorda(0, 50, 0), contexto)).toEqual({ substituido: [ponto(150, 0), ponto(50, 0)], marcas: [ponto(150, 0), ponto(100, 0), ponto(50, 0)] });
    expect(previaDaMarcacao('multiplos-piques', noContorno, molde(), comInicio, solto(100, 150), contexto)).toEqual({ marcas: [ponto(150, 0)] });
    expect(previaDaMarcacao('multiplos-piques', noContorno, molde(), SEM_TRECHO, naBorda(0, 50, 0), contexto)).toEqual({ marcas: [ponto(50, 0)] });
    const doMouse = multiplos({ modo: 'mouse', por: 'numero', quantidade: 2 });
    expect(previaDaMarcacao('multiplos-piques', doMouse, molde(), { ...SEM_TRECHO, livres: [ponto(50, 100)] }, solto(150, 100), contexto)).toEqual({ novo: [ponto(50, 100), ponto(150, 100)], marcas: [ponto(50, 100), ponto(150, 100)] });
    const comLinha = molde({ linhasInternas: [[ponto(50, 100), ponto(150, 100)]] });
    expect(previaDaMarcacao('multiplos-piques', multiplos({ modo: 'elemento', por: 'numero', quantidade: 2 }), comLinha, SEM_TRECHO, solto(100, 100), { raioMm: RAIO, linhaInterna: 0 }).marcas).toEqual([ponto(50, 100), ponto(150, 100)]);

    expect(instrucaoDaMarcacao('multiplos-piques', noContorno, SEM_TRECHO)).toBe('Múltiplos piques (3 piques): clique na borda da peça selecionada, onde os piques começam. Esc sai.');
    expect(instrucaoDaMarcacao('multiplos-piques', noContorno, comInicio)).toMatch(/eles vão do primeiro ponto até ali no sentido horário \(o trecho em destaque\)\. Esc sai\.$/);
    expect(instrucaoDaMarcacao('multiplos-piques', multiplos({ modo: 'mouse', por: 'perimetro', espacoMm: 25 }), SEM_TRECHO)).toBe('Múltiplos piques (um pique a cada 25,0 mm): clique dentro da peça, onde fica o primeiro. Esc sai.');
    expect(instrucaoDaMarcacao('multiplos-piques', doMouse, { ...SEM_TRECHO, livres: [ponto(50, 100)] })).toMatch(/clique onde fica o último/);
    expect(instrucaoDaMarcacao('multiplos-piques', multiplos({ modo: 'elemento', por: 'numero', quantidade: 1 }), SEM_TRECHO)).toMatch(/^Múltiplos piques \(1 pique\): clique numa linha interna/);
  });
});

describe('Substituir', () => {
  const frente = (): Molde => molde({ piques: [pique('a', 50), pique('b', 100, formato('v')), pique('c', 150, formato('t'), { codigo: '3' })] });
  const costas = (): Molde => ({ ...molde({ piques: [pique('d', 60, formato('v'))] }, 'c'), nome: 'Costas' });

  it('a janela lista os tipos que as peças têm no contorno; o pique sem formato conta como traço', () => {
    expect(tiposEmUso([frente(), costas()])).toEqual(['traco', 'v', 't']);
    const de = dialogoDaMarcacao('substituir-piques', O, [frente(), costas()])!.campos[0]!;
    expect(de.tipo === 'escolha' && de.opcoes.map((o) => [o.valor, o.rotulo])).toEqual([[TODOS_OS_TIPOS, 'Todos os tipos'], ['traco', 'Traço (I)'], ['v', 'V'], ['t', 'T']]);
    // O tipo guardado que não está mais em uso volta para "todos".
    expect(dialogoDaMarcacao('substituir-piques', substituir({ de: 'u' }), [frente()])!.campos[0]!.inicial).toBe(TODOS_OS_TIPOS);
    expect(dialogoDaMarcacao('substituir-piques', substituir({ de: 'v' }), [frente()])!.campos[0]!.inicial).toBe('v');
  });

  it('substituir pelo pique: os do tipo escolhido ganham o formato novo, no mesmo lugar e com o mesmo código', () => {
    const feito = aplicarSubstituir(substituir({ de: 't', acao: 'trocar', formato: formato('u', 8, 8) }), [frente(), costas()], ['f'], ids());

    expect(feito.pecas[0]!.piques.map((q) => q.formato?.tipo)).toEqual([undefined, 'v', 'u']);
    expect(feito.pecas[0]!.piques[2]).toMatchObject({ posicao: ponto(150, 0), codigo: '3' });
    expect(feito.pecas[1]).toEqual(costas());
    expect(feito.recado).toBe('1 pique substituído do tipo T em 1 peça: agora é U, de 8,0 mm × 8,0 mm.');
    // Todos os tipos, nas duas peças.
    const todos = aplicarSubstituir(substituir({ de: TODOS_OS_TIPOS, acao: 'trocar', formato: formato('u', 8, 8) }), [frente(), costas()], ['f', 'c'], ids());
    expect(todos.pecas.flatMap((p) => p.piques.map((q) => q.formato!.tipo))).toEqual(['u', 'u', 'u', 'u']);
    expect(todos.recado).toBe('4 piques substituídos em 2 peças: agora são U, de 8,0 mm × 8,0 mm.');
    // O pique sem formato é do tipo traço.
    expect(aplicarSubstituir(substituir({ de: 'traco', acao: 'trocar' }), [frente()], ['f'], ids()).pecas[0]!.piques.map((q) => q.formato?.tipo)).toEqual(['v', 'v', 't']);
  });

  it('remover piques selecionados: os do tipo escolhido saem', () => {
    const feito = aplicarSubstituir(substituir({ de: 'v', acao: 'remover' }), [frente(), costas()], ['f', 'c'], ids());

    expect(feito.pecas.map((p) => p.piques.map((q) => q.id))).toEqual([['a', 'c'], []]);
    expect(feito.recado).toBe('2 piques removidos do tipo V em 2 peças.');
  });

  it('substituir por marca: o pique do contorno sai, e entra um pique interno à distância dada, para dentro da peça', () => {
    const feito = aplicarSubstituir(substituir({ de: 'v', acao: 'marca', formato: formato('cruz'), distanciaMm: 15 }), [frente()], ['f'], ids());

    expect(feito.pecas[0]!.piques.map((q) => q.id)).toEqual(['a', 'c']);
    expect(feito.pecas[0]!.marcas).toEqual([{ id: 'n1', posicao: ponto(100, 15), formato: formato('cruz') }]);
    expect(feito.recado).toBe('1 pique do contorno substituído do tipo V por pique interno a 15,0 mm da borda, em 1 peça.');
    // Longe demais, o pique interno cairia fora da peça: nada muda, e a mensagem diz por quê.
    expect(() => aplicarSubstituir(substituir({ de: 'v', acao: 'marca', distanciaMm: 500 }), [frente()], ['f'], ids())).toThrow('Nenhum pique substituído: a 500,0 mm da borda, o pique interno cairia fora da peça.');
  });

  it('sem pique do tipo, ou sem peça, explica', () => {
    expect(() => aplicarSubstituir(substituir({ de: 'u' }), [frente()], ['f'], ids())).toThrow('Não há pique do tipo U no contorno da peça escolhida.');
    expect(() => aplicarSubstituir(substituir({ de: TODOS_OS_TIPOS }), [molde(), costas()], ['f'], ids())).toThrow('Não há pique no contorno da peça escolhida.');
    expect(() => aplicarSubstituir(substituir({ de: 'u' }), [frente(), costas()], ['f', 'c'], ids())).toThrow('Não há pique do tipo U no contorno das peças escolhidas.');
    expect(() => aplicarSubstituir(O, [frente()], [], ids())).toThrow('Não há peça em que substituir: selecione uma, ou marque as peças na lista.');
    expect(() => aplicarSubstituir(substituir({ acao: 'trocar', formato: formato('v', 0) }), [frente()], ['f'], ids())).toThrow(/largura do pique/);
  });
});

describe('o formato padrão', () => {
  it('as ferramentas começam com o traço de 4 × 6 mm, e o Substituir, com o V', () => {
    expect(O.inserir.formato).toBe(PIQUE_PADRAO);
    expect(O.multiplos.formato).toBe(PIQUE_PADRAO);
    expect(O.substituir.formato.tipo).toBe('v');
  });
});
