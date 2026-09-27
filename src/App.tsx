import { useCallback, useMemo, useState } from 'react';
import { AreaDeDesenho, type ModoDeDesenho } from './ui/AreaDeDesenho';
import { BarraDeFerramentas } from './ui/BarraDeFerramentas';
import { PainelDePecas, PainelDePropriedades, type PatchDeMolde } from './ui/PainelLateral';
import { BarraDeStatus } from './ui/BarraDeStatus';
import { aplicarZoom, type TransformacaoDeTela } from './ui/transformacaoDeTela';
import { criarMolde, transladarMolde, adicionarPique, adicionarMarca, type Molde } from './domain/molde';
import { importarDxf } from './formats/dxf-importacao';
import { ponto, area, retanguloEnvolvente, type Ponto2D } from './core/geometria';
import type { Tecido } from './domain/tecido';
import type { ConfiguracaoDeEnfesto } from './domain/enfesto';
import { ROTULO_DO_TIPO } from './domain/enfesto';
import { PainelDeTecido } from './ui/PainelDeTecido';
import { PainelDeEnfesto } from './ui/PainelDeEnfesto';
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

export default function App(): React.JSX.Element {
  const [pecas, setPecas] = useState<Molde[]>(pecasDeDemonstracao);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
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

  const excluirSelecionado = useCallback(() => {
    if (!selecionadoId) return;
    aplicarMudanca(pecas.filter((p) => p.id !== selecionadoId));
    setSelecionadoId(null);
  }, [pecas, selecionadoId, aplicarMudanca]);

  const duplicarSelecionado = useCallback(() => {
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    const copia = transladarMolde(original, ponto(30, 30), proximoId());
    aplicarMudanca([...pecas, copia]);
    setSelecionadoId(copia.id);
  }, [pecas, selecionadoId, aplicarMudanca]);

  const novoProjeto = useCallback(() => {
    if (pecas.length > 0 && !window.confirm('Começar um novo projeto descarta as peças atuais (não salvas). Continuar?')) {
      return;
    }
    aplicarMudanca([]);
    setSelecionadoId(null);
  }, [pecas, aplicarMudanca]);

  const zoom = useCallback((fator: number) => {
    setTransform((t) => aplicarZoom(t, fator, { x: 400, y: 300 }));
  }, []);

  const ajustarTela = useCallback(() => {
    if (pecas.length === 0) {
      setTransform({ escalaPxPorMm: 1, offsetXPx: 80, offsetYPx: 80 });
      return;
    }
    const bboxes = pecas.map((p) => retanguloEnvolvente(p.contorno));
    const minX = Math.min(...bboxes.map((b) => b.minX));
    const minY = Math.min(...bboxes.map((b) => b.minY));
    const maxX = Math.max(...bboxes.map((b) => b.maxX));
    const maxY = Math.max(...bboxes.map((b) => b.maxY));
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
  }, [pecas]);

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
      }
    },
    [modo, cancelarModo, finalizarContornoEmEdicao, desfazer, refazer, duplicarSelecionado, excluirSelecionado, zoom, ajustarTela],
  );

  return (
    <div className="app-shell" onKeyDown={aoTeclar} tabIndex={-1}>
      <BarraDeFerramentas
        modo={modo}
        podeDesfazer={passado.length > 0}
        podeRefazer={futuro.length > 0}
        temSelecao={selecionadoId !== null}
        onNovoProjeto={novoProjeto}
        onDesfazer={desfazer}
        onRefazer={refazer}
        onDuplicar={duplicarSelecionado}
        onExcluir={excluirSelecionado}
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
          }}
        />
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
        <PainelDePecas pecas={pecas} selecionadoId={selecionadoId} onSelecionar={setSelecionadoId} />
        <AreaDeDesenho
          pecas={pecas}
          selecionadoId={selecionadoId}
          transform={transform}
          modo={modo}
          pontosEmEdicao={pontosEmEdicao}
          contornoFinalizado={contornoPendente}
          onTransformChange={setTransform}
          onSelecionar={setSelecionadoId}
          onCursorMove={setCursorMundo}
          onCliqueNoCanvas={onCliqueNoCanvas}
        />
        <PainelDePropriedades peca={pecaSelecionada} onAlterar={alterarPecaSelecionada} />
      </div>
      <BarraDeStatus
        cursorMundo={cursorMundo}
        transform={transform}
        totalDePecas={pecas.length}
        temSelecao={selecionadoId !== null}
      />
    </div>
  );
}
