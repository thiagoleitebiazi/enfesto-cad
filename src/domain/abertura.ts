/**
 * A abertura do programa: em que modo o motor de tela é ligado, e o que fazer
 * quando a janela não mostra nada.
 *
 * Há computadores em que a janela abre e fica preta: a página não carrega, ou
 * carrega e nada é desenhado. As causas conhecidas estão fora do programa — o
 * antivírus ou outro programa de segurança que não deixa os processos
 * isolados do motor funcionarem, o processo de vídeo que não sobe —, e não dá
 * para saber de antemão qual é a de cada computador. Por isso o programa abre
 * no modo padrão, confere se a tela apareceu de verdade e, se não apareceu,
 * reabre sozinho em outro modo, até um que funcione. O que funcionou fica
 * guardado, para as próximas aberturas irem direto nele.
 *
 * Aqui fica só a lógica, sem nada do Electron: quem liga as opções, vigia a
 * janela e reabre o programa é o processo principal.
 */

/** Os modos de abertura, do padrão ao mais compatível. */
export type ModoDeAbertura = 'padrao' | 'video-no-principal' | 'sem-isolamento' | 'com-gpu';

/** A ordem em que os modos são tentados. */
export const MODOS_DE_ABERTURA: readonly ModoDeAbertura[] = ['padrao', 'video-no-principal', 'sem-isolamento', 'com-gpu'];

/** Como cada modo é dito a quem usa o programa (nos avisos e no diagnóstico). */
export const NOME_DO_MODO: Readonly<Record<ModoDeAbertura, string>> = {
  padrao: 'modo padrão',
  'video-no-principal': 'vídeo no processo principal',
  'sem-isolamento': 'modo de compatibilidade',
  'com-gpu': 'modo de compatibilidade com a placa de vídeo',
};

/**
 * De que lado está o defeito, pelo que foi visto: a **página** não chegou a
 * carregar (o processo dela não subiu, ou caiu); o **vídeo** não desenhou a
 * página que carregou (ou o processo dele caiu); ou não deu para saber — o
 * programa foi derrubado antes de mostrar a tela.
 */
export type FalhaDeAbertura = 'pagina' | 'video' | 'desconhecida';

export interface OpcoesDoModo {
  /** Desenhar por software, sem a aceleração da placa de vídeo. */
  readonly semAceleracao: boolean;
  /** As opções do motor: o nome de cada uma. */
  readonly opcoes: readonly string[];
  /** Os recursos do motor a desligar (vão juntos numa opção só, `disable-features`). */
  readonly recursosDesligados: readonly string[];
}

/**
 * Desligado em todos os modos: o motor deixa de desenhar a janela que ele
 * julga encoberta por outra, e há computadores em que esse julgamento erra —
 * a janela está à vista e fica sem desenho.
 */
const SEMPRE_DESLIGADO = 'CalculateNativeWinOcclusion';

/** O que cada modo liga e desliga no motor. */
export function opcoesDoModo(modo: ModoDeAbertura): OpcoesDoModo {
  switch (modo) {
    case 'padrao':
      return { semAceleracao: true, opcoes: [], recursosDesligados: [SEMPRE_DESLIGADO] };
    case 'video-no-principal':
      // O vídeo deixa de ser um processo à parte (que pode não subir) e de ser isolado.
      return { semAceleracao: true, opcoes: ['in-process-gpu', 'disable-gpu-sandbox'], recursosDesligados: [SEMPRE_DESLIGADO] };
    case 'sem-isolamento':
      // Nenhum processo do motor é isolado: é o que resolve quando um programa de segurança não os deixa funcionar.
      return { semAceleracao: true, opcoes: ['in-process-gpu', 'no-sandbox'], recursosDesligados: [SEMPRE_DESLIGADO, 'RendererCodeIntegrity'] };
    case 'com-gpu':
      // O último recurso: o desenho volta para a placa de vídeo, para o computador em que é o desenho por software que falha.
      return { semAceleracao: false, opcoes: ['no-sandbox'], recursosDesligados: [SEMPRE_DESLIGADO, 'RendererCodeIntegrity'] };
  }
}

/**
 * O modo a tentar depois que `modo` falhou, fora os já `tentados`; `null` se
 * não sobrou nenhum. Do modo padrão, se foi a página que não carregou, o
 * seguinte já é o sem isolamento: mexer só no vídeo não a faria carregar.
 */
export function proximoModo(modo: ModoDeAbertura, falha: FalhaDeAbertura, tentados: readonly ModoDeAbertura[] = []): ModoDeAbertura | null {
  const aPartirDe = modo === 'padrao' && falha === 'pagina' ? MODOS_DE_ABERTURA.indexOf('sem-isolamento') : MODOS_DE_ABERTURA.indexOf(modo) + 1;
  return MODOS_DE_ABERTURA.slice(aPartirDe).find((candidato) => !tentados.includes(candidato)) ?? null;
}

/** O que fica guardado, neste computador, entre uma abertura e outra. */
export interface EstadoDaAbertura {
  /** A versão do programa que gravou: com outra versão, tudo recomeça do modo padrão. */
  readonly versao: string;
  /** O modo em que o programa abre. */
  readonly modo: ModoDeAbertura;
  /** Quantas aberturas seguidas nesse modo não mostraram a tela a tempo. */
  readonly falhas: number;
  /** O modo de uma abertura que começou e ainda não mostrou a tela (nem foi cancelada); `null` se não há. */
  readonly emCurso: ModoDeAbertura | null;
  /** Quantas vezes seguidas o programa foi fechado logo depois de abrir. */
  readonly fechadasLogo: number;
  /** A pessoa já respondeu que a janela abre direito: não se pergunta de novo. */
  readonly abreDireito: boolean;
}

export function estadoInicial(versao: string): EstadoDaAbertura {
  return { versao, modo: 'padrao', falhas: 0, emCurso: null, fechadasLogo: 0, abreDireito: false };
}

function ehModo(valor: unknown): valor is ModoDeAbertura {
  return typeof valor === 'string' && (MODOS_DE_ABERTURA as readonly string[]).includes(valor);
}

function ehContagem(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= 1000;
}

/**
 * O estado lido do arquivo. O que não dá para ler, o que está estragado e o
 * que foi gravado por outra versão do programa valem como o estado inicial:
 * o arquivo nunca impede o programa de abrir.
 */
export function lerEstado(texto: string | null, versao: string): EstadoDaAbertura {
  try {
    const lido: unknown = JSON.parse(texto ?? 'null');
    const e = lido as Partial<Record<keyof EstadoDaAbertura, unknown>> | null;
    if (typeof e !== 'object' || e === null || e.versao !== versao || !ehModo(e.modo) || !ehContagem(e.falhas) || !ehContagem(e.fechadasLogo)) return estadoInicial(versao);
    return { versao, modo: e.modo, falhas: e.falhas, emCurso: ehModo(e.emCurso) ? e.emCurso : null, fechadasLogo: e.fechadasLogo, abreDireito: e.abreDireito === true };
  } catch {
    return estadoInicial(versao);
  }
}

/**
 * Quantas aberturas seguidas sem mostrar a tela a tempo fazem o modo ser
 * deixado. O padrão tem duas chances: num computador lento, a primeira
 * abertura depois de instalar pode só ter demorado. Os outros, uma.
 */
export function falhasParaDeixarOModo(modo: ModoDeAbertura): number {
  return modo === 'padrao' ? 2 : 1;
}

/**
 * Ao começar uma abertura. Se a anterior começou e não mostrou a tela — o
 * programa caiu, ou foi derrubado, antes disso —, o modo dela é deixado de
 * vez: o seguinte passa a ser o do computador. O modo do estado devolvido é o
 * desta abertura, e fica marcado como em curso.
 */
export function aoComecar(estado: EstadoDaAbertura): EstadoDaAbertura {
  const modo = estado.emCurso === null ? estado.modo : (proximoModo(estado.emCurso, 'desconhecida') ?? 'padrao');
  return { ...estado, modo, falhas: estado.emCurso === null ? estado.falhas : 0, emCurso: modo };
}

/**
 * A abertura no modo `modoDaSessao` não mostrou a tela. Devolve o estado a
 * guardar e o modo a tentar já, nesta mesma abertura (`null`: não sobrou
 * nenhum). O modo guardado só é trocado quando as falhas dele chegam ao
 * limite; o que foi tentado só para esta abertura não muda o que está guardado.
 */
export function aoFalhar(
  estado: EstadoDaAbertura,
  modoDaSessao: ModoDeAbertura,
  falha: FalhaDeAbertura,
  tentados: readonly ModoDeAbertura[] = [],
): { readonly estado: EstadoDaAbertura; readonly proximo: ModoDeAbertura | null } {
  const proximo = proximoModo(modoDaSessao, falha, tentados);
  // Acabaram os modos: a escada recomeça do padrão na próxima abertura (o que impedia pode ter mudado).
  if (proximo === null) return { estado: { ...estadoInicial(estado.versao), abreDireito: estado.abreDireito }, proximo };
  if (modoDaSessao !== estado.modo) return { estado: { ...estado, emCurso: null }, proximo };
  const falhas = estado.falhas + 1;
  if (falhas < falhasParaDeixarOModo(estado.modo)) return { estado: { ...estado, falhas, emCurso: null }, proximo };
  return { estado: { ...estado, modo: proximo, falhas: 0, emCurso: null }, proximo };
}

/** A tela apareceu (e foi conferida) no modo `modoDaSessao`. */
export function aoMostrarATela(estado: EstadoDaAbertura, modoDaSessao: ModoDeAbertura): EstadoDaAbertura {
  return { ...estado, falhas: modoDaSessao === estado.modo ? 0 : estado.falhas, emCurso: null };
}

/** A abertura foi cancelada por quem usa o programa: não conta como falha de modo nenhum. */
export function aoCancelar(estado: EstadoDaAbertura): EstadoDaAbertura {
  return { ...estado, emCurso: null };
}

/** Menos que isto (s) entre a tela aparecer e o programa ser fechado conta como "fechado logo". */
export const SEGUNDOS_DE_UMA_SESSAO_CURTA = 25;

/** Quantas vezes seguidas fechado logo fazem o programa perguntar se a janela está abrindo direito. */
export const SESSOES_CURTAS_PARA_PERGUNTAR = 2;

/** O programa foi fechado `segundosAberta` depois de a tela aparecer. */
export function aoFechar(estado: EstadoDaAbertura, segundosAberta: number): EstadoDaAbertura {
  return { ...estado, fechadasLogo: segundosAberta < SEGUNDOS_DE_UMA_SESSAO_CURTA ? estado.fechadasLogo + 1 : 0 };
}

/**
 * Hora de perguntar se a janela abriu direito? Há um defeito que o programa
 * não tem como ver: o motor desenha, e a janela mesmo assim fica preta. Quem
 * vê isso fecha o programa e abre de novo — então, fechado logo duas vezes
 * seguidas, ele pergunta (por uma caixa do próprio Windows, que não depende
 * do motor).
 */
export function devePerguntarSeAbriuDireito(estado: EstadoDaAbertura): boolean {
  return !estado.abreDireito && estado.fechadasLogo >= SESSOES_CURTAS_PARA_PERGUNTAR;
}

/** A resposta à pergunta: se a janela não abriu direito, o modo é deixado de vez (o defeito é de vídeo). */
export function aoResponderSeAbriuDireito(estado: EstadoDaAbertura, abriu: boolean): EstadoDaAbertura {
  if (abriu) return { ...estado, fechadasLogo: 0, abreDireito: true };
  return { ...estado, modo: proximoModo(estado.modo, 'video') ?? 'padrao', falhas: 0, emCurso: null, fechadasLogo: 0 };
}

/** O que a linha de comando pede para a abertura. */
export interface PedidoDeAbertura {
  /** O modo desta abertura, quando ela é a continuação de outra que falhou (`--abertura=`). */
  readonly modo: ModoDeAbertura | null;
  /** Os modos que já falharam nesta abertura (`--abertura-tentados=`). */
  readonly tentados: readonly ModoDeAbertura[];
  /** `--modo-de-compatibilidade`: abrir sempre no modo de compatibilidade, a pedido de quem usa. */
  readonly compatibilidade: boolean;
  /** `--modo-padrao`: esquecer o que está guardado e recomeçar do modo padrão. */
  readonly padrao: boolean;
}

const OPCAO_DO_MODO = '--abertura=';
const OPCAO_DOS_TENTADOS = '--abertura-tentados=';

export function lerLinhaDeComando(argumentos: readonly string[]): PedidoDeAbertura {
  const valorDe = (opcao: string): string | null => argumentos.find((a) => a.startsWith(opcao))?.slice(opcao.length) ?? null;
  const modo = valorDe(OPCAO_DO_MODO);
  return {
    modo: ehModo(modo) ? modo : null,
    tentados: (valorDe(OPCAO_DOS_TENTADOS) ?? '').split(',').filter(ehModo),
    compatibilidade: argumentos.includes('--modo-de-compatibilidade'),
    padrao: argumentos.includes('--modo-padrao'),
  };
}

/** Os argumentos para reabrir o programa em `modo`: os mesmos de agora, trocados os da abertura. */
export function argumentosParaReabrir(argumentos: readonly string[], modo: ModoDeAbertura, tentados: readonly ModoDeAbertura[]): string[] {
  const outros = argumentos.filter((a) => !a.startsWith(OPCAO_DO_MODO) && !a.startsWith(OPCAO_DOS_TENTADOS) && a !== '--modo-de-compatibilidade' && a !== '--modo-padrao');
  return [...outros, `${OPCAO_DO_MODO}${modo}`, `${OPCAO_DOS_TENTADOS}${tentados.join(',')}`];
}

/**
 * O estado e o modo desta abertura, pelo que está guardado e pelo que a linha
 * de comando pede. A continuação de uma abertura que falhou (`--abertura=`)
 * usa o modo pedido sem mexer no que está guardado, além de marcá-lo em curso.
 */
export function abertura(guardado: EstadoDaAbertura, pedido: PedidoDeAbertura): { readonly estado: EstadoDaAbertura; readonly modo: ModoDeAbertura } {
  if (pedido.modo !== null) return { estado: { ...guardado, emCurso: pedido.modo }, modo: pedido.modo };
  if (pedido.compatibilidade) {
    const estado: EstadoDaAbertura = { ...guardado, modo: 'sem-isolamento', falhas: 0, emCurso: 'sem-isolamento' };
    return { estado, modo: estado.modo };
  }
  const estado = aoComecar(pedido.padrao ? estadoInicial(guardado.versao) : guardado);
  return { estado, modo: estado.modo };
}

/** Os prazos de uma abertura (ms). */
export interface PrazosDeAbertura {
  /** Sem tela até aqui, aparece o aviso de que a abertura está demorando. */
  readonly avisoMs: number;
  /** Sem a página começar a carregar até aqui, a abertura falhou pelo lado da página. */
  readonly paginaMs: number;
  /** Carregada a página, sem desenho conferido até aqui, a abertura falhou pelo lado do vídeo. */
  readonly pinturaMs: number;
}

/** O prazo padrão (s) para a página começar a carregar. */
export const PRAZO_PADRAO_DA_PAGINA_S = 25;

/**
 * Os prazos, pelo prazo da página em segundos (o padrão, ou o da variável de
 * ambiente `ENFESTO_CAD_PRAZO_DE_ABERTURA_S`, de 2 a 600 — para o computador
 * muito lento, e para os ensaios). Os outros dois saem dele.
 */
export function prazosDeAbertura(pedidoEmSegundos: string | undefined): PrazosDeAbertura {
  const pedido = Number(pedidoEmSegundos);
  // (O que não é número, o vazio e o que não foi dado caem fora da faixa: valem como o padrão.)
  const segundos = pedido >= 2 && pedido <= 600 ? pedido : PRAZO_PADRAO_DA_PAGINA_S;
  return { avisoMs: Math.round((segundos * 1000) / 3), paginaMs: segundos * 1000, pinturaMs: Math.round(segundos * 600) };
}

/**
 * A foto da página (BGRA ou RGBA, 4 bytes por ponto) está preta? É a
 * conferência de que o vídeo desenhou de verdade: a página do programa é
 * clara, então uma foto vazia, ou com quase tudo preto, é a tela preta. Olha
 * uma amostra de pontos espalhados.
 */
export function fotoEstaPreta(pontos: Uint8Array, largura: number, altura: number): boolean {
  const total = largura * altura;
  if (total <= 0 || pontos.length < total * 4) return true;
  const passo = Math.max(1, Math.floor(total / 4000));
  let vistos = 0;
  let pretos = 0;
  for (let i = 0; i < total; i += passo) {
    vistos++;
    if (pontos[i * 4]! < 16 && pontos[i * 4 + 1]! < 16 && pontos[i * 4 + 2]! < 16) pretos++;
  }
  return pretos / vistos >= 0.99;
}
