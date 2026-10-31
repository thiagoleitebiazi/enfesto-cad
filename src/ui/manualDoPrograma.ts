/**
 * O manual e as novidades dentro do programa (ADR 0204): o caminho de cada trabalho, em poucas linhas. As dicas de cada
 * botão seguem sendo o detalhe; aqui fica a ordem das coisas.
 */

export interface SecaoDoManual {
  readonly titulo: string;
  readonly passos: readonly string[];
}

export const MANUAL_DO_PROGRAMA: readonly SecaoDoManual[] = [
  {
    titulo: 'Começar um modelo',
    passos: [
      'Novo projeto cria o modelo, com o tecido e a mesa. Depois, em Informações, entram o cliente, a descrição e as palavras chave.',
      'Importe o DXF, o PDF vetorial, o PLT ou o ISO, ou desenhe na aba Construção. O Molde da foto transforma a foto de um molde de papel em peça, e "Criar todos da foto" faz isso com todos os moldes de uma vez.',
    ],
  },
  {
    titulo: 'Modelar',
    passos: [
      'A aba Construção desenha retas, curvas e arcos. A aba Manipulação mexe nos pontos: Mover ponto, Modificar (1 ponto, N pontos, Discreto, Proporcional), Redefinir perímetro.',
      'A aba Produção faz pences, pregas, costura, bainha, forro, entretela e vista. Extrair molde cria uma peça com uma região desenhada; o diálogo diz o que ela leva junto.',
      'A aba Marcações cuida dos piques, das linhas auxiliares, das listras e dos furos.',
    ],
  },
  {
    titulo: 'Graduar',
    passos: [
      'Defina os tamanhos e a regra dos pontos na aba Graduação. Visão › "Pontos não graduados" mostra o que falta.',
      'Um tamanho novo pode entrar entre dois, ou depois do último com "Manter diferença". Sob medida faz um tamanho pelas medidas da pessoa.',
    ],
  },
  {
    titulo: 'Tecidos do modelo',
    passos: [
      'Cada peça diz o tecido dela no painel: principal, contraste, forro, entretela. O forro e a entretela gerados já vêm com o deles.',
      'Na janela do encaixe, "Gerar encaixe para" faz um tecido por vez, e as outras peças saem da mesa ao aplicar.',
    ],
  },
  {
    titulo: 'Encaixar',
    passos: [
      'Configure o Enfesto: tipo, largura, comprimento, margens, áreas bloqueadas, linhas de referência, emendas, perdas e padronagem. "Usar como padrão" guarda a mesa para os próximos.',
      'Nesting Automático calcula. A janela tem a grade de corte, o limite de tempo, manter peças no lugar, espelhamento, compactar e a dobra. Pôr na fila deixa calcular em segundo plano.',
      'À mão, arraste as peças. As setas encostam, Ctrl+setas giram, F3 gira 180°, F4 espelha, F5 e F6 levam à dobra, Ctrl+F tira da mesa. F1 mostra todas as teclas.',
      'O botão Status mostra o consumo, o aproveitamento e o que falta. Compactar encurta o encaixe.',
    ],
  },
  {
    titulo: 'Planejar e cortar',
    passos: [
      'O Planejamento de corte parte da ordem e dos rolos, e propõe riscos e alternativas. A Sala de corte acompanha as ordens, o consumo real, os retalhos e os indicadores.',
      'Em Relatórios, a previsão de compra diz o que falta, e a rastreabilidade diz onde cada rolo foi usado.',
    ],
  },
  {
    titulo: 'Plotar, imprimir e exportar',
    passos: [
      'Plotar (Ctrl+P) gera o PLT, com fatores, espelho, limites e observação. Em Opções ficam as canetas, o texto como linha, o auto ajuste de texto e a pasta do plotter.',
      'O PDF sai em escala real, em folhas, ou com proporção, e Visualizar mostra como fica. Também saem DXF, ASTM, ISO, SVG e XML.',
      'Confira a escala no primeiro risco impresso.',
    ],
  },
  {
    titulo: 'Ficha técnica, coleção e 3D',
    passos: [
      'A ficha técnica junta o desenho, os materiais, o pré-custo e as medidas. Coleções acompanha os modelos, as etapas, os prazos, os looks e o catálogo.',
      'O Provador 3D veste as peças no manequim, com o tecido, as cores e os aviamentos.',
    ],
  },
];

export const NOVIDADES_DO_PROGRAMA: readonly string[] = [
  'Tecido por molde: o encaixe pode gerar um tecido por vez, com a grade de cada um.',
  'Encaixe automático com manter peças no lugar, usar só as da mesa, espelhamento, compactar e dobra inferior.',
  'Comando Compactar, Status do encaixe, perdas e rendimento por peça.',
  'Linhas de referência e pontos de emenda automáticos.',
  'As teclas do encaixe: F2 a F12, setas, Ctrl+setas, Ctrl+F, Ctrl+R, Ctrl+G, Ctrl+U, Ctrl+W.',
  'Modificar com Discreto e Proporcional; fundir pique ao contorno; inverter costura; manter diferença.',
  'Moldes no encaixe: o que aparece em cada peça. Destacar pacotes e relacionamento de piques.',
  'Sentido por tamanho e por pacote nos tecidos de um sentido só.',
  'Plotar com fatores, espelho e limites; texto como linha; pasta do plotter; importar ISO; exportar SVG e XML.',
  'Impressão com proporção, cores e prévia.',
  'Captura em lote do molde da foto, rastreabilidade do material e previsão de compra.',
];
