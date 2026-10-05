import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AreaDeDesenho, type ModoDeDesenho } from './ui/AreaDeDesenho';
import { BarraDeFerramentas } from './ui/BarraDeFerramentas';
import { PainelDePecas, PainelDePropriedades, type PatchDeMolde } from './ui/PainelLateral';
import { BarraDeStatus } from './ui/BarraDeStatus';
import { Sobreposicao } from './ui/Sobreposicao';
import { aplicarZoom, type TransformacaoDeTela } from './ui/transformacaoDeTela';
import {
  criarMolde,
  transladarMolde,
  adicionarPique,
  adicionarMarca,
  rotacionarMolde,
  rotacaoEhPermitida,
  rotacoesPermitidas,
  espelharMolde,
  moverVariosPontosDoMolde,
  inserirPontoNoMolde,
  removerPontoDoMolde,
  chanfrarCantoDoMolde,
  arredondarCantoDoMolde,
  dimensionarMolde,
  dimensoesDoMolde,
  type Molde,
} from './domain/molde';
import { importarDxf } from './formats/dxf-importacao';
import { importarPdf } from './formats/pdf-importacao';
import { diagnosticarVetorPdf, descreverDiagnosticoVetorial } from './formats/pdf-diagnostico-vetorial';
import { gerarPdfDeEncaixe, gerarPdfDeMoldesIndividuais } from './formats/pdf-exportacao';
import { gerarPdfDeRelatorio, gerarExcelDeRelatorio } from './formats/relatorio-exportacao';
import { gerarRelatorioDeProducao } from './domain/relatorio';
import { ponto, area, retanguloEnvolvente, deslocarContornoParaFora, type Ponto2D } from './core/geometria';
import { criarTecido, type Tecido } from './domain/tecido';
import type { ConfiguracaoDeEnfesto } from './domain/enfesto';
import { ROTULO_DO_TIPO, criarConfiguracaoDeEnfesto } from './domain/enfesto';
import { validarProjeto } from './domain/validacao';
import { sugerirPosicaoSemSobreposicao } from './domain/posicionamento';
import type { ResultadoDeNesting } from './domain/nesting';
import type { MensagemParaWorker } from './nesting.worker';
import { PainelDeTecido } from './ui/PainelDeTecido';
import { PainelDeEnfesto } from './ui/PainelDeEnfesto';
import { PainelDeNesting } from './ui/PainelDeNesting';
import { PainelDeExportacaoPdf, type OpcoesDeExportacaoEscolhidas } from './ui/PainelDeExportacaoPdf';
import { PainelDeBiblioteca } from './ui/PainelDeBiblioteca';
import { PainelDeHistorico } from './ui/PainelDeHistorico';
import { PainelDeRelatorio } from './ui/PainelDeRelatorio';
import { PainelDeNovoProjeto, type DadosDeNovoProjeto } from './ui/PainelDeNovoProjeto';
import { PainelDeDimensionar } from './ui/PainelDeDimensionar';
import {
  criarProjeto,
  registrarEvento,
  restaurarVersao,
  alterarStatus,
  renomearProjeto,
  gerarCodigoDeProjeto,
  type Projeto,
  type EstadoDoProjeto,
  type TipoDeEvento,
} from './domain/projeto';
import './App.css';

function proximoId(): string {
  return `peca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Mesa e tecido de demonstração — sem eles o app abre com "Enfesto: não
 * configurado" e nenhuma mesa desenhada (só um fundo cinza vazio), o que
 * não mostra a mesa retangular horizontal que é uma característica
 * constante do app, não algo que só aparece depois de configurar um
 * projeto na mão. Nenhuma peça de demonstração — o projeto abre vazio,
 * pronto para o usuário desenhar as próprias peças.
 */
function enfestoDeDemonstracao(): ConfiguracaoDeEnfesto {
  return criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 1500,
    comprimentoMm: 3000,
    quantidadeDeCamadas: 1,
    margemLateralMm: 0,
    margemDeExtremidadeMm: 0,
    distanciaMinimaEntrePecasMm: 5,
  } as ConfiguracaoDeEnfesto);
}

function tecidoDeDemonstracao(): Tecido {
  return criarTecido(
    { nome: 'Tecido de demonstração', referencia: '', larguraTotalMm: 1500, larguraUtilMm: 1500 },
    'tecido-demo',
  );
}

function transformParaEnquadrarMesa(larguraUtilMm: number, comprimentoMm: number): TransformacaoDeTela {
  // Mesmo cálculo de `ajustarTela`/`criarNovoProjetoComDados`: eixos
  // trocados na tela (ver ui/transformacaoDeTela.ts), comprimento na
  // horizontal, largura na vertical.
  const margemPx = 60;
  const larguraDisponivel = 900 - margemPx * 2;
  const alturaDisponivel = 600 - margemPx * 2;
  const escala = Math.min(larguraDisponivel / comprimentoMm, alturaDisponivel / larguraUtilMm);
  return { escalaPxPorMm: escala, offsetXPx: margemPx, offsetYPx: margemPx };
}

function novoProjetoVazio(estadoInicial: EstadoDoProjeto, nome = 'Projeto sem título'): Projeto {
  const agora = new Date().toISOString();
  const id = `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return criarProjeto(nome, id, gerarCodigoDeProjeto(agora, 1), agora, estadoInicial);
}

export default function App(): React.JSX.Element {
  const [pecas, setPecas] = useState<Molde[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [idsSelecionadosEmLote, setIdsSelecionadosEmLote] = useState<ReadonlySet<string>>(new Set());
  const [clipboard, setClipboard] = useState<Molde | null>(null);
  const [transform, setTransform] = useState<TransformacaoDeTela>(() => transformParaEnquadrarMesa(1500, 3000));
  const [cursorMundo, setCursorMundo] = useState<Ponto2D | null>(null);

  const [passado, setPassado] = useState<Molde[][]>([]);
  const [futuro, setFuturo] = useState<Molde[][]>([]);

  const [modo, setModo] = useState<ModoDeDesenho>('selecionar');
  const [pontosEmEdicao, setPontosEmEdicao] = useState<Ponto2D[]>([]);
  const [contornoPendente, setContornoPendente] = useState<Ponto2D[] | null>(null);
  const [mensagensImportacao, setMensagensImportacao] = useState<readonly string[] | null>(null);

  const [tecido, setTecido] = useState<Tecido | null>(tecidoDeDemonstracao);
  const [enfesto, setEnfesto] = useState<ConfiguracaoDeEnfesto | null>(enfestoDeDemonstracao);
  const [painelAberto, setPainelAberto] = useState<'tecido' | 'enfesto' | null>(null);
  const [mostrarValidacao, setMostrarValidacao] = useState(false);

  const workerDeNestingRef = useRef<Worker | null>(null);
  const [nestingExecutando, setNestingExecutando] = useState(false);
  const [progressoNesting, setProgressoNesting] = useState<{ colocadas: number; total: number } | null>(null);
  const [resultadoNesting, setResultadoNesting] = useState<ResultadoDeNesting | null>(null);
  const [mostrarPainelDeNesting, setMostrarPainelDeNesting] = useState(false);

  const [mostrarExportacaoPdf, setMostrarExportacaoPdf] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [mostrarDimensionar, setMostrarDimensionar] = useState(false);
  const [mostrarPropriedadesDaPeca, setMostrarPropriedadesDaPeca] = useState(false);

  const [projetoAtual, setProjetoAtual] = useState<Projeto>(() =>
    novoProjetoVazio({
      pecas: [],
      tecido: tecidoDeDemonstracao(),
      enfesto: enfestoDeDemonstracao(),
    }),
  );
  const [projetos, setProjetos] = useState<readonly Projeto[]>([]);
  const [mostrarBiblioteca, setMostrarBiblioteca] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [mostrarNovoProjeto, setMostrarNovoProjeto] = useState(false);

  const problemasDeValidacao = useMemo(() => validarProjeto(pecas, enfesto), [pecas, enfesto]);
  const idsComErro = useMemo(
    () =>
      new Set(
        problemasDeValidacao.filter((p) => p.severidade === 'erro').flatMap((p) => p.pecasEnvolvidasIds),
      ),
    [problemasDeValidacao],
  );

  const persistirProjeto = useCallback((projeto: Projeto) => {
    void window.enfestoCad?.salvarProjeto(projeto).catch(() => {
      // Falha ao persistir (ex.: disco cheio) não deve travar a edição —
      // o usuário ainda tem o estado em memória e pode tentar salvar de novo.
    });
  }, []);

  const registrarEventoEPersistir = useCallback(
    (tipo: TipoDeEvento, estado: EstadoDoProjeto, descricao?: string) => {
      setProjetoAtual((atual) => {
        const atualizado = registrarEvento(atual, tipo, estado, new Date().toISOString(), descricao);
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );

  const carregarListaDeProjetos = useCallback(() => {
    void window.enfestoCad
      ?.listarProjetos()
      .then((lista) => setProjetos(lista))
      .catch(() => setProjetos([]));
  }, []);

  const aplicarMudanca = useCallback(
    (novasPecas: Molde[]) => {
      setPassado((p) => [...p, pecas]);
      setFuturo([]);
      setPecas(novasPecas);
    },
    [pecas],
  );

  const desfazer = useCallback(() => {
    const anterior = passado.at(-1);
    if (!anterior) return;
    setPassado((p) => p.slice(0, -1));
    setFuturo((f) => [...f, pecas]);
    setPecas(anterior);
  }, [pecas, passado]);

  const refazer = useCallback(() => {
    const proximo = futuro.at(-1);
    if (!proximo) return;
    setFuturo((f) => f.slice(0, -1));
    setPassado((p) => [...p, pecas]);
    setPecas(proximo);
  }, [pecas, futuro]);

  // Seleção única "de verdade" (limpa qualquer seleção em lote ativa) — usada
  // sempre que o usuário escolhe UMA peça de propósito (clique no canvas ou
  // na lista), para não deixar os dois modos de seleção coexistindo de forma
  // confusa.
  const selecionarUnico = useCallback((id: string | null) => {
    setSelecionadoId(id);
    setIdsSelecionadosEmLote(new Set());
  }, []);

  /** Duplo-clique numa peça (lista ou canvas): seleciona e abre o diálogo de Propriedades. */
  const abrirPropriedadesDaPeca = useCallback(
    (id: string) => {
      selecionarUnico(id);
      setMostrarPropriedadesDaPeca(true);
    },
    [selecionarUnico],
  );

  const selecionarTudo = useCallback(() => {
    if (pecas.length === 0) return;
    setIdsSelecionadosEmLote(new Set(pecas.map((p) => p.id)));
    setSelecionadoId(null);
  }, [pecas]);

  /** Caixa de seleção de cada item da lista: inclui/remove da seleção em lote, sem mexer na seleção única (`selecionadoId`). */
  const alternarSelecaoEmLote = useCallback((id: string) => {
    setIdsSelecionadosEmLote((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  const excluirSelecionado = useCallback(() => {
    if (idsSelecionadosEmLote.size > 0) {
      aplicarMudanca(pecas.filter((p) => !idsSelecionadosEmLote.has(p.id)));
      setIdsSelecionadosEmLote(new Set());
      return;
    }
    if (!selecionadoId) return;
    aplicarMudanca(pecas.filter((p) => p.id !== selecionadoId));
    setSelecionadoId(null);
  }, [pecas, selecionadoId, idsSelecionadosEmLote, aplicarMudanca]);

  const duplicarSelecionado = useCallback(() => {
    if (idsSelecionadosEmLote.size > 0) {
      const copias = pecas
        .filter((p) => idsSelecionadosEmLote.has(p.id))
        .map((p) => transladarMolde(p, ponto(30, 30), proximoId()));
      if (copias.length === 0) return;
      aplicarMudanca([...pecas, ...copias]);
      setIdsSelecionadosEmLote(new Set(copias.map((c) => c.id)));
      return;
    }
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    const copia = transladarMolde(original, ponto(30, 30), proximoId());
    aplicarMudanca([...pecas, copia]);
    setSelecionadoId(copia.id);
  }, [pecas, selecionadoId, idsSelecionadosEmLote, aplicarMudanca]);

  const copiarSelecionado = useCallback(() => {
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    setClipboard(original);
  }, [pecas, selecionadoId]);

  const recortarSelecionado = useCallback(() => {
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    setClipboard(original);
    aplicarMudanca(pecas.filter((p) => p.id !== selecionadoId));
    setSelecionadoId(null);
  }, [pecas, selecionadoId, aplicarMudanca]);

  const colar = useCallback(() => {
    if (!clipboard) return;
    const copia = transladarMolde(clipboard, ponto(30, 30), proximoId());
    aplicarMudanca([...pecas, copia]);
    setSelecionadoId(copia.id);
    setIdsSelecionadosEmLote(new Set());
  }, [pecas, clipboard, aplicarMudanca]);

  const novoProjeto = useCallback(() => {
    if (pecas.length > 0 && !window.confirm('Começar um novo projeto descarta as peças atuais não salvas da tela (o projeto anterior continua na biblioteca, se já foi salvo). Continuar?')) {
      return;
    }
    setMostrarNovoProjeto(true);
  }, [pecas]);

  const criarNovoProjetoComDados = useCallback((dados: DadosDeNovoProjeto) => {
    const enfestoInicial = criarConfiguracaoDeEnfesto({
      tipo: 'impar',
      larguraUtilMm: dados.larguraUtilMm,
      comprimentoMm: dados.comprimentoMm,
      quantidadeDeCamadas: 1,
      margemLateralMm: 0,
      margemDeExtremidadeMm: 0,
      distanciaMinimaEntrePecasMm: 5,
    } as ConfiguracaoDeEnfesto);
    const tecidoInicial = criarTecido(
      {
        nome: dados.tecidoNome,
        referencia: '',
        larguraTotalMm: dados.tecidoLarguraMm,
        larguraUtilMm: dados.tecidoLarguraMm,
        ...(dados.tecidoGramaturaGm2 !== undefined ? { gramaturaGm2: dados.tecidoGramaturaGm2 } : {}),
        ...(dados.tecidoQuantidadeDisponivelKg !== undefined
          ? { quantidadeDisponivelKg: dados.tecidoQuantidadeDisponivelKg }
          : {}),
        ...(dados.tecidoDescricao !== undefined ? { observacoes: dados.tecidoDescricao } : {}),
      },
      `tecido-${Date.now().toString(36)}`,
    );
    setPecas([]);
    setTecido(tecidoInicial);
    setEnfesto(enfestoInicial);
    setSelecionadoId(null);
    setPassado([]);
    setFuturo([]);
    setProjetoAtual(novoProjetoVazio({ pecas: [], tecido: tecidoInicial, enfesto: enfestoInicial }, dados.nome));
    setMostrarNovoProjeto(false);

    // Enquadra a mesa nova inteira na tela. Eixos trocados na tela (ver
    // comentário em ui/transformacaoDeTela.ts): comprimento ocupa a
    // horizontal, largura a vertical — a mesa sempre aparece deitada, sem
    // depender de qual das duas medidas o usuário informou maior.
    const margemPx = 60;
    const larguraDisponivel = 900 - margemPx * 2;
    const alturaDisponivel = 600 - margemPx * 2;
    const escala = Math.min(larguraDisponivel / enfestoInicial.comprimentoMm, alturaDisponivel / enfestoInicial.larguraUtilMm);
    setTransform({ escalaPxPorMm: escala, offsetXPx: margemPx, offsetYPx: margemPx });
  }, []);

  const salvarProjetoAtual = useCallback(() => {
    registrarEventoEPersistir('salvamento', { pecas, tecido, enfesto });
  }, [pecas, tecido, enfesto, registrarEventoEPersistir]);

  const salvarComo = useCallback(() => {
    const nome = window.prompt('Nome do novo projeto:', `${projetoAtual.nome} (cópia)`);
    if (!nome) return;
    const novo = novoProjetoVazio({ pecas, tecido, enfesto });
    const renomeado = renomearProjeto(novo, nome, new Date().toISOString());
    setProjetoAtual(renomeado);
    persistirProjeto(renomeado);
  }, [pecas, tecido, enfesto, projetoAtual.nome, persistirProjeto]);

  const abrirBiblioteca = useCallback(() => {
    carregarListaDeProjetos();
    setMostrarBiblioteca(true);
  }, [carregarListaDeProjetos]);

  const abrirProjeto = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      setPecas([...projeto.estadoAtual.pecas]);
      setTecido(projeto.estadoAtual.tecido);
      setEnfesto(projeto.estadoAtual.enfesto);
      setSelecionadoId(null);
      setPassado([]);
      setFuturo([]);
      setProjetoAtual(projeto);
      setMostrarBiblioteca(false);
    },
    [projetos],
  );

  const duplicarProjetoDaBiblioteca = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      const agora = new Date().toISOString();
      const copia = criarProjeto(`${projeto.nome} (cópia)`, `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, gerarCodigoDeProjeto(agora, 1), agora, projeto.estadoAtual);
      persistirProjeto(copia);
      carregarListaDeProjetos();
    },
    [projetos, persistirProjeto, carregarListaDeProjetos],
  );

  const renomearProjetoDaBiblioteca = useCallback(
    (id: string, novoNome: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto || !novoNome.trim()) return;
      const atualizado = renomearProjeto(projeto, novoNome.trim(), new Date().toISOString());
      persistirProjeto(atualizado);
      if (id === projetoAtual.id) setProjetoAtual(atualizado);
      carregarListaDeProjetos();
    },
    [projetos, projetoAtual.id, persistirProjeto, carregarListaDeProjetos],
  );

  const arquivarProjetoDaBiblioteca = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      const atualizado = alterarStatus(projeto, 'arquivado', new Date().toISOString());
      persistirProjeto(atualizado);
      if (id === projetoAtual.id) setProjetoAtual(atualizado);
      carregarListaDeProjetos();
    },
    [projetos, projetoAtual.id, persistirProjeto, carregarListaDeProjetos],
  );

  const excluirProjetoDaBiblioteca = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      if (!window.confirm(`Excluir permanentemente o projeto "${projeto.nome}"? Esta ação não pode ser desfeita.`)) {
        return;
      }
      void window.enfestoCad
        ?.excluirProjeto(id)
        .then(() => {
          carregarListaDeProjetos();
          if (id === projetoAtual.id) {
            setPecas([]);
            setTecido(null);
            setEnfesto(null);
            setProjetoAtual(novoProjetoVazio({ pecas: [], tecido: null, enfesto: null }));
          }
        })
        .catch(() => window.alert('Falha ao excluir o projeto.'));
    },
    [projetos, projetoAtual.id, carregarListaDeProjetos],
  );

  const restaurarVersaoDoHistorico = useCallback(
    (idDoEvento: string) => {
      const atualizado = restaurarVersao(projetoAtual, idDoEvento, new Date().toISOString());
      setPecas([...atualizado.estadoAtual.pecas]);
      setTecido(atualizado.estadoAtual.tecido);
      setEnfesto(atualizado.estadoAtual.enfesto);
      setPassado([]);
      setFuturo([]);
      setProjetoAtual(atualizado);
      persistirProjeto(atualizado);
    },
    [projetoAtual, persistirProjeto],
  );

  const zoom = useCallback((fator: number) => {
    setTransform((t) => aplicarZoom(t, fator, { x: 400, y: 300 }));
  }, []);

  const ajustarTela = useCallback(() => {
    // Sem peças nem enfesto configurados, não há nada real para enquadrar —
    // mantém o reset antigo. Com enfesto configurado, a mesa real (mesmo
    // vazia) é o retângulo de referência, para aparecer inteira e retangular
    // assim que o projeto é criado, sem precisar de "Ajustar" manual.
    const bboxes = pecas.map((p) => retanguloEnvolvente(p.contorno));
    let minX = enfesto ? 0 : Infinity;
    let minY = enfesto ? 0 : Infinity;
    let maxX = enfesto ? enfesto.larguraUtilMm : -Infinity;
    let maxY = enfesto ? enfesto.comprimentoMm : -Infinity;
    for (const b of bboxes) {
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      setTransform({ escalaPxPorMm: 1, offsetXPx: 80, offsetYPx: 80 });
      return;
    }
    // Eixos trocados na tela (ver comentário em ui/transformacaoDeTela.ts):
    // mundo.y (comprimento) ocupa a horizontal, mundo.x (largura) a vertical.
    const larguraNaTela = Math.max(1, maxY - minY);
    const alturaNaTela = Math.max(1, maxX - minX);
    const margemPx = 60;
    const larguraDisponivel = 900 - margemPx * 2;
    const alturaDisponivel = 600 - margemPx * 2;
    const escala = Math.min(larguraDisponivel / larguraNaTela, alturaDisponivel / alturaNaTela);
    setTransform({
      escalaPxPorMm: escala,
      offsetXPx: margemPx - minY * escala,
      offsetYPx: margemPx - minX * escala,
    });
  }, [pecas, enfesto]);

  const pecaSelecionada = useMemo(() => pecas.find((p) => p.id === selecionadoId) ?? null, [pecas, selecionadoId]);

  const cancelarModo = useCallback(() => {
    setModo('selecionar');
    setPontosEmEdicao([]);
    setContornoPendente(null);
  }, []);

  const entrarModoNovoMolde = useCallback(() => {
    setModo('novo-molde');
    setPontosEmEdicao([]);
    setContornoPendente(null);
  }, []);

  const entrarModoNovoFuro = useCallback(() => {
    if (!selecionadoId) return;
    setModo('novo-furo');
    setPontosEmEdicao([]);
  }, [selecionadoId]);

  const entrarModoPique = useCallback(() => {
    if (!selecionadoId) return;
    setModo('pique');
  }, [selecionadoId]);

  const entrarModoMarca = useCallback(() => {
    if (!selecionadoId) return;
    setModo('marca');
  }, [selecionadoId]);

  const entrarModoMoverPonto = useCallback(() => {
    if (!selecionadoId) return;
    setModo('mover-ponto');
  }, [selecionadoId]);

  const entrarModoInserirPonto = useCallback(() => {
    if (!selecionadoId) return;
    setModo('inserir-ponto');
  }, [selecionadoId]);

  const entrarModoExcluirPonto = useCallback(() => {
    if (!selecionadoId) return;
    setModo('excluir-ponto');
  }, [selecionadoId]);

  const entrarModoArredondarOuChanfrar = useCallback(() => {
    if (!selecionadoId) return;
    setModo('arredondar-ou-chanfrar');
  }, [selecionadoId]);

  const alterarPecaSelecionada = useCallback(
    (patch: PatchDeMolde) => {
      if (!selecionadoId) return;
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? { ...p, ...patch } : p)));
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /**
   * "Converter em costura": atalho real para o mesmo campo "Margem de
   * costura (mm)" das propriedades da peça (ADR 0005) — no Audaces é o
   * mesmo conceito (a costura é derivada do molde base + a margem), só
   * com outro nome/lugar na interface.
   */
  const converterEmCosturaDaSelecionada = useCallback(() => {
    const peca = pecas.find((p) => p.id === selecionadoId);
    if (!peca) return;
    const texto = window.prompt('Margem de costura (mm):', String(peca.margemDeCosturaMm || 10));
    if (texto === null) return;
    const margemMm = Number.parseFloat(texto);
    if (!Number.isFinite(margemMm) || margemMm < 0) {
      window.alert('Margem inválida — informe um número maior ou igual a zero.');
      return;
    }
    aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? { ...p, margemDeCosturaMm: margemMm } : p)));
  }, [pecas, selecionadoId, aplicarMudanca]);

  const girarPecaSelecionada = useCallback(
    (anguloGraus: number) => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      if (!peca) return;
      const anguloResultante = peca.anguloDeRotacaoGraus + anguloGraus;
      if (!rotacaoEhPermitida(peca.restricaoDeRotacao, anguloResultante)) {
        const permitidas = rotacoesPermitidas(peca.restricaoDeRotacao)
          .map((r) => `${r}°`)
          .join(', ');
        window.alert(
          `Rotação de ${anguloGraus}° não permitida para "${peca.nome}" — violaria o sentido do fio.\n` +
            `Rotações permitidas para esta peça: ${permitidas}.\n` +
            `Para permitir mais rotações, use as caixas "Permitir 180°"/"Permitir 90°/270°" nas propriedades da peça.`,
        );
        return;
      }
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? rotacionarMolde(p, anguloGraus) : p)));
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  // Ferramentas de edição de forma (aba "Manipulação", seção 5 continua
  // valendo: nada aqui reordena automaticamente sentido do fio — são ações
  // manuais e explícitas do usuário sobre a peça selecionada).
  const moverVariosPontosDaSelecionada = useCallback(
    (indices: readonly number[], delta: Ponto2D) => {
      if (!selecionadoId) return;
      aplicarMudanca(
        pecas.map((p) => (p.id === selecionadoId ? moverVariosPontosDoMolde(p, indices, delta) : p)),
      );
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const inserirPontoNaSelecionada = useCallback(
    (indiceAresta: number, novoPonto: Ponto2D) => {
      if (!selecionadoId) return;
      aplicarMudanca(
        pecas.map((p) => (p.id === selecionadoId ? inserirPontoNoMolde(p, indiceAresta, novoPonto) : p)),
      );
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const excluirPontoDaSelecionada = useCallback(
    (indice: number) => {
      if (!selecionadoId) return;
      try {
        aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? removerPontoDoMolde(p, indice) : p)));
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      }
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** "Arredondar ou chanfrar" (um único botão, como no Audaces): pergunta qual das duas operações, depois o valor em mm. */
  const arredondarOuChanfrarVerticeDaSelecionada = useCallback(
    (indice: number) => {
      if (!selecionadoId) return;
      const escolha = window.prompt('Arredondar ou chanfrar este canto? Digite "A" para arredondar ou "C" para chanfrar:', 'A');
      if (escolha === null) return;
      const normalizado = escolha.trim().toUpperCase();
      if (normalizado !== 'A' && normalizado !== 'C') {
        window.alert('Opção inválida — digite "A" (arredondar) ou "C" (chanfrar).');
        return;
      }
      const arredondando = normalizado === 'A';
      const texto = window.prompt(arredondando ? 'Raio do arredondamento (mm):' : 'Distância do chanfro (mm):', '10');
      if (texto === null) return;
      const valorMm = Number.parseFloat(texto);
      if (!Number.isFinite(valorMm) || valorMm <= 0) {
        window.alert('Valor inválido — informe um número maior que zero.');
        return;
      }
      try {
        aplicarMudanca(
          pecas.map((p) =>
            p.id === selecionadoId
              ? arredondando
                ? arredondarCantoDoMolde(p, indice, valorMm)
                : chanfrarCantoDoMolde(p, indice, valorMm)
              : p,
          ),
        );
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      }
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const dimensionarSelecionada = useCallback(
    (fatorX: number, fatorY: number, comoCopia: boolean) => {
      const original = pecas.find((p) => p.id === selecionadoId);
      if (!original) return;
      if (comoCopia) {
        const copia = dimensionarMolde({ ...original, id: proximoId() }, fatorX, fatorY);
        aplicarMudanca([...pecas, copia]);
        setSelecionadoId(copia.id);
        return;
      }
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? dimensionarMolde(p, fatorX, fatorY) : p)));
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const espelharSelecionadaManualmente = useCallback(() => {
    if (!selecionadoId) return;
    aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? espelharMolde(p, p.id) : p)));
  }, [pecas, selecionadoId, aplicarMudanca]);

  /**
   * Girar em ângulo livre (diferente dos botões 90°/180°/270°, que ficam
   * bloqueados pela restrição de sentido do fio): é uma ferramenta de
   * EDIÇÃO de forma, não uma decisão de encaixe — o usuário está ajustando
   * como a peça foi desenhada, então não faz sentido validar contra
   * `restricaoDeRotacao` (que é sobre quais orientações o MOTOR de nesting
   * pode tentar a partir de como a peça já está). Por isso avisa
   * explicitamente que isto redefine o ângulo de referência da peça, em vez
   * de bloquear ou de aplicar silenciosamente.
   */
  const girarLivreSelecionada = useCallback(() => {
    if (!selecionadoId) return;
    const texto = window.prompt(
      'Ângulo de rotação livre (graus, sentido anti-horário):\n' +
        'Isto redefine a orientação de referência desta peça — confira se a linha de fio (seta vermelha) continua alinhada ao sentido correto do tecido depois de girar.',
      '0',
    );
    if (texto === null) return;
    const anguloGraus = Number.parseFloat(texto);
    if (!Number.isFinite(anguloGraus) || anguloGraus === 0) {
      if (texto.trim() !== '' && texto.trim() !== '0') window.alert('Ângulo inválido.');
      return;
    }
    aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? rotacionarMolde(p, anguloGraus) : p)));
  }, [pecas, selecionadoId, aplicarMudanca]);

  /**
   * Alinha as peças selecionadas em lote pela borda esquerda (mínimo X do
   * retângulo envolvente — largura da mesa, eixo vertical na tela) comum,
   * útil para organizar peças manualmente antes do encaixe automático.
   */
  const alinharSelecionadas = useCallback(() => {
    if (idsSelecionadosEmLote.size < 2) return;
    const selecionadas = pecas.filter((p) => idsSelecionadosEmLote.has(p.id));
    const minXComum = Math.min(...selecionadas.map((p) => retanguloEnvolvente(p.contorno).minX));
    aplicarMudanca(
      pecas.map((p) => {
        if (!idsSelecionadosEmLote.has(p.id)) return p;
        const minXAtual = retanguloEnvolvente(p.contorno).minX;
        const deslocamento = { x: minXComum - minXAtual, y: 0 };
        return transladarMolde(p, deslocamento, p.id);
      }),
    );
  }, [pecas, idsSelecionadosEmLote, aplicarMudanca]);

  /**
   * "Elemento paralelo": cria uma NOVA peça com o contorno deslocado
   * uniformemente (reaproveita a mesma função de deslocamento da margem de
   * costura, `deslocarContornoParaFora` — distância negativa desloca para
   * dentro). Furos/piques/marcas não são copiados para a peça nova, porque
   * suas posições absolutas ficariam incoerentes com o contorno deslocado
   * (mesmo cuidado já documentado para `dimensionarMolde`/edição de pontos).
   */
  const criarElementoParaleloDaSelecionada = useCallback(() => {
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    const texto = window.prompt(
      'Distância do elemento paralelo (mm; positivo = para fora, negativo = para dentro):',
      '10',
    );
    if (texto === null) return;
    const distanciaMm = Number.parseFloat(texto);
    if (!Number.isFinite(distanciaMm) || distanciaMm === 0) {
      window.alert('Distância inválida — informe um número diferente de zero.');
      return;
    }
    try {
      const novoContorno = deslocarContornoParaFora(original.contorno, distanciaMm);
      const novaPeca = criarMolde(
        {
          nome: `${original.nome} (paralelo)`,
          referencia: original.referencia,
          tamanho: original.tamanho,
          contorno: novoContorno,
          linhaDeFio: original.linhaDeFio,
          quantidade: original.quantidade,
          margemDeCosturaMm: original.margemDeCosturaMm,
          restricaoDeRotacao: original.restricaoDeRotacao,
        },
        proximoId(),
      );
      aplicarMudanca([...pecas, novaPeca]);
      setSelecionadoId(novaPeca.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }, [pecas, selecionadoId, aplicarMudanca]);

  const moverPeca = useCallback(
    (id: string, deslocamento: Ponto2D) => {
      aplicarMudanca(pecas.map((p) => (p.id === id ? transladarMolde(p, deslocamento, p.id) : p)));
    },
    [pecas, aplicarMudanca],
  );

  const sugerirPosicaoParaSelecionada = useCallback(() => {
    const peca = pecas.find((p) => p.id === selecionadoId);
    if (!peca || !enfesto) return;
    const outras = pecas.filter((p) => p.id !== selecionadoId);
    const delta = sugerirPosicaoSemSobreposicao(peca, outras, enfesto);
    if (!delta) {
      window.alert(
        'Não foi possível encontrar uma posição sem sobreposição dentro da área útil do enfesto configurado. Tente posicionar manualmente ou revise as dimensões do enfesto.',
      );
      return;
    }
    aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? transladarMolde(p, delta, p.id) : p)));
  }, [pecas, selecionadoId, enfesto, aplicarMudanca]);

  const abrirConfiguracaoDeNesting = useCallback(() => {
    if (!enfesto || pecas.length === 0) return;
    setResultadoNesting(null);
    setNestingExecutando(false);
    setMostrarPainelDeNesting(true);
  }, [enfesto, pecas.length]);

  const calcularNestingAutomatico = useCallback(
    (opcoesAvancadas: { limiteDeTempoMinutos?: number; aproveitamentoDesejadoPercentual?: number }) => {
      if (!enfesto || pecas.length === 0) return;
      setResultadoNesting(null);
      setProgressoNesting({ colocadas: 0, total: pecas.reduce((soma, p) => soma + p.quantidade, 0) });
      setNestingExecutando(true);

      const worker = new Worker(new URL('./nesting.worker.ts', import.meta.url), { type: 'module' });
      workerDeNestingRef.current = worker;
      worker.onmessage = (evento: MessageEvent) => {
        const mensagem = evento.data;
        if (mensagem.tipo === 'progresso') {
          setProgressoNesting({ colocadas: mensagem.colocadas, total: mensagem.total });
        } else if (mensagem.tipo === 'concluido') {
          setResultadoNesting(mensagem.resultado);
          setNestingExecutando(false);
          worker.terminate();
          workerDeNestingRef.current = null;
        }
      };
      const mensagemIniciar: MensagemParaWorker = {
        tipo: 'iniciar',
        pecas,
        enfesto,
        ...(opcoesAvancadas.limiteDeTempoMinutos !== undefined
          ? { limiteDeTempoMs: opcoesAvancadas.limiteDeTempoMinutos * 60_000 }
          : {}),
        ...(opcoesAvancadas.aproveitamentoDesejadoPercentual !== undefined
          ? { aproveitamentoDesejadoPercentual: opcoesAvancadas.aproveitamentoDesejadoPercentual }
          : {}),
      };
      worker.postMessage(mensagemIniciar);
    },
    [pecas, enfesto],
  );

  const cancelarNestingAutomatico = useCallback(() => {
    const mensagemCancelar: MensagemParaWorker = { tipo: 'cancelar' };
    workerDeNestingRef.current?.postMessage(mensagemCancelar);
  }, []);

  const fecharPainelDeNesting = useCallback(() => {
    setMostrarPainelDeNesting(false);
    setResultadoNesting(null);
  }, []);

  const aplicarResultadoNesting = useCallback(() => {
    if (!resultadoNesting) return;
    const novasPecas = resultadoNesting.pecasColocadas.map((p) => p.molde);
    aplicarMudanca(novasPecas);
    setSelecionadoId(null);
    setMostrarPainelDeNesting(false);
    setResultadoNesting(null);
    registrarEventoEPersistir(
      'execucao-de-nesting',
      { pecas: novasPecas, tecido, enfesto },
      `${resultadoNesting.pecasColocadas.length} peça(s) colocada(s), ${resultadoNesting.aproveitamentoPercentual.toFixed(1)}% de aproveitamento`,
    );
  }, [resultadoNesting, aplicarMudanca, tecido, enfesto, registrarEventoEPersistir]);

  const exportarPdf = useCallback(
    async (opcoesEscolhidas: OpcoesDeExportacaoEscolhidas) => {
      const api = window.enfestoCad;
      if (!api) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return;
      }
      setGerandoPdf(true);
      try {
        const opcoesDePagina = {
          formato: opcoesEscolhidas.formato,
          orientacao: opcoesEscolhidas.orientacao,
          margemMm: opcoesEscolhidas.margemMm,
        };
        const blob =
          opcoesEscolhidas.tipo === 'encaixe-completo' && enfesto
            ? await gerarPdfDeEncaixe(pecas, enfesto, {
                ...opcoesDePagina,
                ...(tecido?.nome !== undefined ? { tecidoNome: tecido.nome } : {}),
              })
            : await gerarPdfDeMoldesIndividuais(pecas, opcoesDePagina);
        const buffer = await blob.arrayBuffer();
        const sugestaoDeNome =
          opcoesEscolhidas.tipo === 'encaixe-completo' ? 'encaixe.pdf' : 'moldes.pdf';
        const caminhoSalvo = await api.salvarArquivo(sugestaoDeNome, buffer);
        if (caminhoSalvo) {
          setMostrarExportacaoPdf(false);
          registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Salvo em ${caminhoSalvo}`);
        }
      } catch (e) {
        window.alert(`Falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setGerandoPdf(false);
      }
    },
    [pecas, enfesto, tecido, registrarEventoEPersistir],
  );

  const relatorioAtual = useMemo(
    () => gerarRelatorioDeProducao(projetoAtual, new Date().toISOString()),
    [projetoAtual, mostrarRelatorio],
  );

  const exportarRelatorio = useCallback(
    async (formato: 'pdf' | 'xlsx') => {
      const api = window.enfestoCad;
      if (!api) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return;
      }
      setGerandoRelatorio(true);
      try {
        const blob =
          formato === 'pdf'
            ? await gerarPdfDeRelatorio(relatorioAtual)
            : await gerarExcelDeRelatorio(relatorioAtual);
        const buffer = await blob.arrayBuffer();
        const sugestaoDeNome = `relatorio-${projetoAtual.codigo}.${formato}`;
        const caminhoSalvo = await api.salvarArquivo(sugestaoDeNome, buffer);
        if (caminhoSalvo) {
          setMostrarRelatorio(false);
          registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Relatório salvo em ${caminhoSalvo}`);
        }
      } catch (e) {
        window.alert(`Falha ao gerar o relatório: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setGerandoRelatorio(false);
      }
    },
    [relatorioAtual, projetoAtual.codigo, pecas, tecido, enfesto, registrarEventoEPersistir],
  );

  const estadoAoVivoRef = useRef<EstadoDoProjeto>({ pecas, tecido, enfesto });
  useEffect(() => {
    estadoAoVivoRef.current = { pecas, tecido, enfesto };
  }, [pecas, tecido, enfesto]);

  // Salvamento automático (seção 11): a cada 60s, se algo mudou desde o
  // último evento registrado, grava um novo "salvamento" — cobre queda de
  // energia/travamento sem exigir um fluxo de "recuperar rascunho" à parte:
  // o estado salvo mais recente já fica disponível na Biblioteca.
  useEffect(() => {
    const intervalo = setInterval(() => {
      setProjetoAtual((atual) => {
        const mudou =
          JSON.stringify(atual.estadoAtual) !== JSON.stringify(estadoAoVivoRef.current);
        if (!mudou) return atual;
        const atualizado = registrarEvento(atual, 'salvamento', estadoAoVivoRef.current, new Date().toISOString(), 'Salvamento automático');
        persistirProjeto(atualizado);
        return atualizado;
      });
    }, 60000);
    return () => clearInterval(intervalo);
  }, [persistirProjeto]);

  const finalizarContornoEmEdicao = useCallback(() => {
    if (pontosEmEdicao.length < 3) return;
    if (area(pontosEmEdicao) <= 0) {
      window.alert('O contorno desenhado é inválido (área zero ou pontos colineares). Continue clicando ou pressione Esc para cancelar.');
      return;
    }
    if (modo === 'novo-molde') {
      setContornoPendente(pontosEmEdicao);
      setPontosEmEdicao([]);
      setModo('definir-fio');
    } else if (modo === 'novo-furo' && selecionadoId) {
      const contornoFuro = pontosEmEdicao;
      aplicarMudanca(
        pecas.map((p) => (p.id === selecionadoId ? { ...p, furos: [...p.furos, contornoFuro] } : p)),
      );
      cancelarModo();
    }
  }, [pontosEmEdicao, modo, selecionadoId, pecas, aplicarMudanca, cancelarModo]);

  const onCliqueNoCanvas = useCallback(
    (mundo: Ponto2D) => {
      if (modo === 'novo-molde' || modo === 'novo-furo') {
        setPontosEmEdicao((prev) => [...prev, mundo]);
        return;
      }
      if (modo === 'definir-fio') {
        if (pontosEmEdicao.length === 0) {
          setPontosEmEdicao([mundo]);
          return;
        }
        if (!contornoPendente) return;
        const novoMolde = criarMolde(
          {
            nome: `Molde ${pecas.length + 1}`,
            referencia: '',
            tamanho: 'M',
            contorno: contornoPendente,
            linhaDeFio: { inicio: pontosEmEdicao[0]!, fim: mundo },
          },
          proximoId(),
        );
        aplicarMudanca([...pecas, novoMolde]);
        setSelecionadoId(novoMolde.id);
        cancelarModo();
        return;
      }
      if (modo === 'pique' && selecionadoId) {
        aplicarMudanca(
          pecas.map((p) => (p.id === selecionadoId ? adicionarPique(p, mundo, proximoId()) : p)),
        );
        return;
      }
      if (modo === 'marca' && selecionadoId) {
        aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? adicionarMarca(p, mundo, proximoId()) : p)));
      }
    },
    [modo, pontosEmEdicao, contornoPendente, pecas, selecionadoId, aplicarMudanca, cancelarModo],
  );

  const importarDxfHandler = useCallback(() => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Importação de arquivo só está disponível rodando dentro do aplicativo Electron (npm run dev / build), não num navegador comum.');
      return;
    }
    void api.abrirArquivoDxf().then((arquivo) => {
      if (!arquivo) return;
      const nomeBase = (arquivo.caminho.split(/[\\/]/).pop() ?? arquivo.caminho).replace(/\.dxf$/i, '');
      const resultado = importarDxf(arquivo.conteudo, nomeBase);
      const prontas = resultado.pecas.filter((p) => p.linhaDeFio !== null);
      const semFio = resultado.pecas.filter((p) => p.linhaDeFio === null);

      const novosMoldes = prontas.map((p) =>
        criarMolde(
          {
            nome: p.nome,
            referencia: '',
            tamanho: 'M',
            contorno: p.contorno,
            furos: p.furos,
            linhasInternas: p.linhasInternas,
            linhaDeFio: p.linhaDeFio!,
          },
          proximoId(),
        ),
      );

      if (novosMoldes.length > 0) {
        aplicarMudanca([...pecas, ...novosMoldes]);
      }

      const mensagens = [...resultado.avisos];
      if (semFio.length > 0) {
        mensagens.push(
          `${semFio.length} peça(s) do arquivo não foram adicionadas por não terem linha de fio reconhecível: ${semFio
            .map((p) => p.nome)
            .join(', ')}. Desenhe-as manualmente com "Novo Molde" definindo o fio correto.`,
        );
      }
      if (resultado.unidadeAssumida) {
        mensagens.push(`Unidade do arquivo: ${resultado.unidadeDetectada}.`);
      }
      setMensagensImportacao(mensagens.length > 0 ? mensagens : null);
    });
  }, [pecas, aplicarMudanca]);

  const importarPdfHandler = useCallback(() => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Importação de arquivo só está disponível rodando dentro do aplicativo Electron (npm run dev / build), não num navegador comum.');
      return;
    }
    void api.abrirArquivoPdf().then(async (arquivo) => {
      if (!arquivo) return;
      const resultado = importarPdf(arquivo.conteudo);
      const prontas = resultado.pecas.filter((p) => p.linhaDeFio !== null);
      const semFio = resultado.pecas.filter((p) => p.linhaDeFio === null);

      const novosMoldes = prontas.map((p) =>
        criarMolde(
          {
            nome: p.nome,
            referencia: p.referencia,
            tamanho: p.tamanho,
            contorno: p.contorno,
            furos: p.furos,
            linhasInternas: p.linhasInternas,
            linhaDeFio: p.linhaDeFio!,
            margemDeCosturaMm: p.margemDeCosturaMm,
            quantidade: p.quantidade,
            piques: p.piques.map((piq) => ({ id: proximoId(), posicao: piq.posicao, indiceAresta: piq.indiceAresta })),
            marcas: p.marcas.map((m) => ({ id: proximoId(), posicao: m })),
          },
          proximoId(),
        ),
      );

      if (novosMoldes.length > 0) {
        aplicarMudanca([...pecas, ...novosMoldes]);
      }

      const mensagens = [...resultado.avisos];
      if (semFio.length > 0) {
        mensagens.push(
          `${semFio.length} peça(s) do arquivo não foram adicionadas por não terem linha de fio reconhecível: ${semFio
            .map((p) => p.nome)
            .join(', ')}. Desenhe-as manualmente com "Novo Molde" definindo o fio correto.`,
        );
      }
      if (resultado.pecas.length === 0) {
        const diagnostico = await diagnosticarVetorPdf(arquivo.conteudo);
        if (diagnostico.subcaminhos > 0) {
          const indiceGenerico = mensagens.findIndex((m) => m.startsWith('Nenhuma peça reconhecível'));
          const textoDoDiagnostico = descreverDiagnosticoVetorial(diagnostico);
          if (indiceGenerico >= 0) mensagens.splice(indiceGenerico, 1, textoDoDiagnostico);
          else mensagens.push(textoDoDiagnostico);
        }
      }
      setMensagensImportacao(mensagens.length > 0 ? mensagens : null);
    });
  }, [pecas, aplicarMudanca]);

  const aoTeclar = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const alvoEhCampoDeTexto = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (alvoEhCampoDeTexto) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        cancelarModo();
      } else if (e.key === 'Enter' && (modo === 'novo-molde' || modo === 'novo-furo')) {
        e.preventDefault();
        finalizarContornoEmEdicao();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        desfazer();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        refazer();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicarSelecionado();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        excluirSelecionado();
      } else if (e.key === '+' || e.key === '=') {
        zoom(1.15);
      } else if (e.key === '-') {
        zoom(1 / 1.15);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        ajustarTela();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarComo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarProjetoAtual();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        abrirBiblioteca();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        novoProjeto();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        importarDxfHandler();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (pecas.length > 0) setMostrarExportacaoPdf(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setMostrarHistorico(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selecionarTudo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copiarSelecionado();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        recortarSelecionado();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        colar();
      }
    },
    [
      modo,
      cancelarModo,
      finalizarContornoEmEdicao,
      desfazer,
      refazer,
      duplicarSelecionado,
      excluirSelecionado,
      zoom,
      ajustarTela,
      salvarProjetoAtual,
      salvarComo,
      abrirBiblioteca,
      novoProjeto,
      importarDxfHandler,
      pecas.length,
      selecionarTudo,
      copiarSelecionado,
      recortarSelecionado,
      colar,
    ],
  );

  return (
    <div className="app-shell" onKeyDown={aoTeclar} tabIndex={-1}>
      <BarraDeFerramentas
        modo={modo}
        podeDesfazer={passado.length > 0}
        podeRefazer={futuro.length > 0}
        temSelecao={selecionadoId !== null || idsSelecionadosEmLote.size > 0}
        temSelecaoUnica={selecionadoId !== null}
        onNovoProjeto={novoProjeto}
        onDesfazer={desfazer}
        onRefazer={refazer}
        onDuplicar={duplicarSelecionado}
        onExcluir={excluirSelecionado}
        onSelecionarTudo={selecionarTudo}
        podeSelecionarTudo={pecas.length > 0}
        onCopiar={copiarSelecionado}
        onRecortar={recortarSelecionado}
        onColar={colar}
        podeColar={clipboard !== null}
        onZoomIn={() => zoom(1.15)}
        onZoomOut={() => zoom(1 / 1.15)}
        onAjustarTela={ajustarTela}
        onEntrarModoSelecionar={cancelarModo}
        onEntrarModoNovoMolde={entrarModoNovoMolde}
        onEntrarModoNovoFuro={entrarModoNovoFuro}
        onEntrarModoPique={entrarModoPique}
        onEntrarModoMarca={entrarModoMarca}
        onImportarDxf={importarDxfHandler}
        onImportarPdf={importarPdfHandler}
        onAbrirTecido={() => setPainelAberto('tecido')}
        onAbrirEnfesto={() => setPainelAberto('enfesto')}
        onSugerirPosicao={sugerirPosicaoParaSelecionada}
        podeSugerirPosicao={selecionadoId !== null && enfesto !== null}
        onNestingAutomatico={abrirConfiguracaoDeNesting}
        podeExecutarNesting={enfesto !== null && pecas.length > 0 && !nestingExecutando}
        onAbrirExportacaoPdf={() => setMostrarExportacaoPdf(true)}
        podeExportarPdf={pecas.length > 0}
        onSalvar={salvarProjetoAtual}
        onSalvarComo={salvarComo}
        onAbrirBiblioteca={abrirBiblioteca}
        onAbrirHistorico={() => setMostrarHistorico(true)}
        onAbrirRelatorio={() => setMostrarRelatorio(true)}
        onEntrarModoMoverPonto={entrarModoMoverPonto}
        onEntrarModoInserirPonto={entrarModoInserirPonto}
        onEntrarModoExcluirPonto={entrarModoExcluirPonto}
        onEntrarModoArredondarOuChanfrar={entrarModoArredondarOuChanfrar}
        onAbrirDimensionar={() => setMostrarDimensionar(true)}
        onEspelharManual={espelharSelecionadaManualmente}
        onGirarLivre={girarLivreSelecionada}
        onElementoParalelo={criarElementoParaleloDaSelecionada}
        onConverterEmCostura={converterEmCosturaDaSelecionada}
        onAlinhar={alinharSelecionadas}
        podeAlinhar={idsSelecionadosEmLote.size >= 2}
      />
      <div className="faixa-de-configuracao">
        <span>Tecido: {tecido ? `${tecido.nome} (${tecido.larguraUtilMm} mm úteis)` : 'não configurado'}</span>
        <span>
          Enfesto: {enfesto ? `${ROTULO_DO_TIPO[enfesto.tipo]}, ${enfesto.quantidadeDeCamadas} camadas` : 'não configurado'}
        </span>
      </div>
      {painelAberto === 'tecido' && (
        <PainelDeTecido
          tecidoAtual={tecido}
          onFechar={() => setPainelAberto(null)}
          onSalvar={(t) => {
            setTecido(t);
            setPainelAberto(null);
            registrarEventoEPersistir('mudanca-de-configuracao', { pecas, tecido: t, enfesto }, `Tecido: ${t.nome}`);
          }}
        />
      )}
      {painelAberto === 'enfesto' && (
        <PainelDeEnfesto
          configAtual={enfesto}
          onFechar={() => setPainelAberto(null)}
          onSalvar={(c) => {
            setEnfesto(c);
            setPainelAberto(null);
            registrarEventoEPersistir(
              'mudanca-de-configuracao',
              { pecas, tecido, enfesto: c },
              `Enfesto: ${ROTULO_DO_TIPO[c.tipo]}`,
            );
          }}
        />
      )}
      {mostrarPainelDeNesting && (
        <PainelDeNesting
          pecas={pecas}
          executando={nestingExecutando}
          progresso={progressoNesting}
          resultado={resultadoNesting}
          onCalcular={calcularNestingAutomatico}
          onCancelar={cancelarNestingAutomatico}
          onAplicar={aplicarResultadoNesting}
          onFechar={fecharPainelDeNesting}
        />
      )}
      {mostrarExportacaoPdf && (
        <PainelDeExportacaoPdf
          podeExportarEncaixeCompleto={enfesto !== null}
          gerando={gerandoPdf}
          onExportar={(opcoes) => void exportarPdf(opcoes)}
          onFechar={() => setMostrarExportacaoPdf(false)}
        />
      )}
      {mostrarDimensionar && pecaSelecionada && (
        <PainelDeDimensionar
          larguraAtualMm={dimensoesDoMolde(pecaSelecionada).larguraMm}
          alturaAtualMm={dimensoesDoMolde(pecaSelecionada).alturaMm}
          onAplicar={(fatorX, fatorY, comoCopia) => {
            dimensionarSelecionada(fatorX, fatorY, comoCopia);
            setMostrarDimensionar(false);
          }}
          onFechar={() => setMostrarDimensionar(false)}
        />
      )}
      {mostrarBiblioteca && (
        <PainelDeBiblioteca
          projetos={projetos}
          projetoAtualId={projetoAtual.id}
          onAbrir={abrirProjeto}
          onDuplicar={duplicarProjetoDaBiblioteca}
          onRenomear={renomearProjetoDaBiblioteca}
          onArquivar={arquivarProjetoDaBiblioteca}
          onExcluir={excluirProjetoDaBiblioteca}
          onFechar={() => setMostrarBiblioteca(false)}
        />
      )}
      {mostrarHistorico && (
        <PainelDeHistorico
          projeto={projetoAtual}
          onRestaurar={(idDoEvento) => {
            restaurarVersaoDoHistorico(idDoEvento);
            setMostrarHistorico(false);
          }}
          onFechar={() => setMostrarHistorico(false)}
        />
      )}
      {mostrarRelatorio && (
        <PainelDeRelatorio
          relatorio={relatorioAtual}
          gerando={gerandoRelatorio}
          onExportarPdf={() => void exportarRelatorio('pdf')}
          onExportarExcel={() => void exportarRelatorio('xlsx')}
          onFechar={() => setMostrarRelatorio(false)}
        />
      )}
      {mostrarNovoProjeto && (
        <PainelDeNovoProjeto onCriar={criarNovoProjetoComDados} onFechar={() => setMostrarNovoProjeto(false)} />
      )}
      {(modo === 'novo-molde' || modo === 'novo-furo' || modo === 'definir-fio') && (
        <div className="faixa-de-instrucao" role="status">
          {modo === 'novo-molde' && 'Clique para adicionar pontos do contorno. Enter para fechar, Esc para cancelar.'}
          {modo === 'novo-furo' && 'Clique para adicionar pontos do furo. Enter para fechar, Esc para cancelar.'}
          {modo === 'definir-fio' &&
            (pontosEmEdicao.length === 0
              ? 'Clique no início da linha de fio.'
              : 'Clique no fim da linha de fio (a seta aponta para lá).')}
        </div>
      )}
      {mensagensImportacao && (
        <div className="faixa-de-avisos" role="alert">
          <strong>Avisos da importação:</strong>
          <ul>
            {mensagensImportacao.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <button onClick={() => setMensagensImportacao(null)}>Dispensar</button>
        </div>
      )}
      <div className="corpo-principal">
        <PainelDePecas
          pecas={pecas}
          selecionadoId={selecionadoId}
          idsSelecionadosEmLote={idsSelecionadosEmLote}
          onSelecionar={selecionarUnico}
          onAlternarSelecaoEmLote={alternarSelecaoEmLote}
          onAbrirPropriedades={abrirPropriedadesDaPeca}
        />
        <AreaDeDesenho
          pecas={pecas}
          selecionadoId={selecionadoId}
          idsSelecionadosEmLote={idsSelecionadosEmLote}
          enfesto={enfesto}
          idsComErro={idsComErro}
          transform={transform}
          modo={modo}
          pontosEmEdicao={pontosEmEdicao}
          contornoFinalizado={contornoPendente}
          onTransformChange={setTransform}
          onSelecionar={selecionarUnico}
          onCursorMove={setCursorMundo}
          onCliqueNoCanvas={onCliqueNoCanvas}
          onMoverPeca={moverPeca}
          onAbrirPropriedades={abrirPropriedadesDaPeca}
          onMoverVariosPontos={moverVariosPontosDaSelecionada}
          onInserirPontoNoMolde={inserirPontoNaSelecionada}
          onExcluirPontoDoMolde={excluirPontoDaSelecionada}
          onArredondarOuChanfrarCanto={arredondarOuChanfrarVerticeDaSelecionada}
        />
      </div>
      {mostrarPropriedadesDaPeca && pecaSelecionada && (
        <Sobreposicao titulo="Propriedades da peça" onFechar={() => setMostrarPropriedadesDaPeca(false)}>
          <PainelDePropriedades peca={pecaSelecionada} onAlterar={alterarPecaSelecionada} onGirar={girarPecaSelecionada} />
        </Sobreposicao>
      )}
      {mostrarValidacao && (
        <div className="faixa-de-validacao" role="alert">
          <strong>Validação do projeto:</strong>
          {problemasDeValidacao.length === 0 ? (
            <p>Nenhum problema encontrado.</p>
          ) : (
            <ul>
              {problemasDeValidacao.map((p, i) => (
                <li
                  key={i}
                  className={`severidade-${p.severidade}`}
                  onClick={() => p.pecasEnvolvidasIds[0] && setSelecionadoId(p.pecasEnvolvidasIds[0])}
                >
                  [{p.severidade === 'erro' ? 'ERRO' : 'aviso'}] {p.mensagem}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <BarraDeStatus
        cursorMundo={cursorMundo}
        transform={transform}
        totalDePecas={pecas.length}
        temSelecao={selecionadoId !== null}
        problemas={problemasDeValidacao}
        onAlternarValidacao={() => setMostrarValidacao((v) => !v)}
        pontoReferencia={
          (modo === 'novo-molde' || modo === 'novo-furo') && pontosEmEdicao.length > 0
            ? pontosEmEdicao[pontosEmEdicao.length - 1]!
            : null
        }
      />
    </div>
  );
}
