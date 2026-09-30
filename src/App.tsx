import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AreaDeDesenho, type ModoDeDesenho } from './ui/AreaDeDesenho';
import { BarraDeFerramentas } from './ui/BarraDeFerramentas';
import { PainelDePecas, PainelDePropriedades, type PatchDeMolde } from './ui/PainelLateral';
import { BarraDeStatus } from './ui/BarraDeStatus';
import { aplicarZoom, type TransformacaoDeTela } from './ui/transformacaoDeTela';
import {
  criarMolde,
  transladarMolde,
  adicionarPique,
  adicionarMarca,
  rotacionarMolde,
  rotacaoEhPermitida,
  rotacoesPermitidas,
  type Molde,
} from './domain/molde';
import { importarDxf } from './formats/dxf-importacao';
import { gerarPdfDeEncaixe, gerarPdfDeMoldesIndividuais } from './formats/pdf-exportacao';
import { gerarPdfDeRelatorio, gerarExcelDeRelatorio } from './formats/relatorio-exportacao';
import { gerarRelatorioDeProducao } from './domain/relatorio';
import { ponto, area, retanguloEnvolvente, type Ponto2D } from './core/geometria';
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

function pecasDeDemonstracao(): Molde[] {
  return [
    criarMolde(
      {
        nome: 'Frente',
        referencia: 'REF-001',
        tamanho: 'M',
        contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 400), ponto(0, 400)],
        linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 350) },
        quantidade: 2,
      },
      'demo-frente',
    ),
    criarMolde(
      {
        nome: 'Costas',
        referencia: 'REF-002',
        tamanho: 'M',
        contorno: [ponto(400, 0), ponto(700, 0), ponto(700, 400), ponto(400, 400)],
        linhaDeFio: { inicio: ponto(550, 50), fim: ponto(550, 350) },
        quantidade: 2,
        restricaoDeRotacao: { permite180: true, permite90e270: false },
      },
      'demo-costas',
    ),
  ];
}

function proximoId(): string {
  return `peca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function novoProjetoVazio(estadoInicial: EstadoDoProjeto, nome = 'Projeto sem título'): Projeto {
  const agora = new Date().toISOString();
  const id = `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return criarProjeto(nome, id, gerarCodigoDeProjeto(agora, 1), agora, estadoInicial);
}

export default function App(): React.JSX.Element {
  const [pecas, setPecas] = useState<Molde[]>(pecasDeDemonstracao);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [idsSelecionadosEmLote, setIdsSelecionadosEmLote] = useState<ReadonlySet<string>>(new Set());
  const [clipboard, setClipboard] = useState<Molde | null>(null);
  const [transform, setTransform] = useState<TransformacaoDeTela>({
    escalaPxPorMm: 1,
    offsetXPx: 80,
    offsetYPx: 80,
  });
  const [cursorMundo, setCursorMundo] = useState<Ponto2D | null>(null);

  const [passado, setPassado] = useState<Molde[][]>([]);
  const [futuro, setFuturo] = useState<Molde[][]>([]);

  const [modo, setModo] = useState<ModoDeDesenho>('selecionar');
  const [pontosEmEdicao, setPontosEmEdicao] = useState<Ponto2D[]>([]);
  const [contornoPendente, setContornoPendente] = useState<Ponto2D[] | null>(null);
  const [mensagensImportacao, setMensagensImportacao] = useState<readonly string[] | null>(null);

  const [tecido, setTecido] = useState<Tecido | null>(null);
  const [enfesto, setEnfesto] = useState<ConfiguracaoDeEnfesto | null>(null);
  const [painelAberto, setPainelAberto] = useState<'tecido' | 'enfesto' | null>(null);
  const [mostrarValidacao, setMostrarValidacao] = useState(false);

  const workerDeNestingRef = useRef<Worker | null>(null);
  const [nestingExecutando, setNestingExecutando] = useState(false);
  const [progressoNesting, setProgressoNesting] = useState<{ colocadas: number; total: number } | null>(null);
  const [resultadoNesting, setResultadoNesting] = useState<ResultadoDeNesting | null>(null);
  const [mostrarPainelDeNesting, setMostrarPainelDeNesting] = useState(false);

  const [mostrarExportacaoPdf, setMostrarExportacaoPdf] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [projetoAtual, setProjetoAtual] = useState<Projeto>(() =>
    novoProjetoVazio({ pecas: pecasDeDemonstracao(), tecido: null, enfesto: null }),
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

  const selecionarTudo = useCallback(() => {
    if (pecas.length === 0) return;
    setIdsSelecionadosEmLote(new Set(pecas.map((p) => p.id)));
    setSelecionadoId(null);
  }, [pecas]);

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

    // Enquadra a mesa nova inteira na tela (retangular, horizontal quando a
    // mesa é mais larga que longa) — sem isso a visão continuaria no zoom/
    // offset antigos, possivelmente mostrando só um canto da mesa nova.
    const margemPx = 60;
    const larguraDisponivel = 900 - margemPx * 2;
    const alturaDisponivel = 600 - margemPx * 2;
    const escala = Math.min(larguraDisponivel / enfestoInicial.larguraUtilMm, alturaDisponivel / enfestoInicial.comprimentoMm);
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
    const largura = Math.max(1, maxX - minX);
    const altura = Math.max(1, maxY - minY);
    const margemPx = 60;
    const larguraDisponivel = 900 - margemPx * 2;
    const alturaDisponivel = 600 - margemPx * 2;
    const escala = Math.min(larguraDisponivel / largura, alturaDisponivel / altura);
    setTransform({
      escalaPxPorMm: escala,
      offsetXPx: margemPx - minX * escala,
      offsetYPx: margemPx - minY * escala,
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

  const alterarPecaSelecionada = useCallback(
    (patch: PatchDeMolde) => {
      if (!selecionadoId) return;
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? { ...p, ...patch } : p)));
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

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
        />
        <PainelDePropriedades peca={pecaSelecionada} onAlterar={alterarPecaSelecionada} onGirar={girarPecaSelecionada} />
      </div>
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
      />
    </div>
  );
}
