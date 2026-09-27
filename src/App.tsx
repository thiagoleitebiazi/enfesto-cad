import { useCallback, useMemo, useState } from 'react';
import { AreaDeDesenho } from './ui/AreaDeDesenho';
import { BarraDeFerramentas } from './ui/BarraDeFerramentas';
import { PainelDePecas, PainelDePropriedades } from './ui/PainelLateral';
import { BarraDeStatus } from './ui/BarraDeStatus';
import { aplicarZoom, type TransformacaoDeTela } from './ui/transformacaoDeTela';
import { criarMolde, type Molde } from './domain/molde';
import { ponto, retanguloEnvolvente, type Ponto2D } from './core/geometria';
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
    const deslocamento = ponto(30, 30);
    const copia = criarMolde(
      {
        nome: original.nome,
        referencia: original.referencia,
        tamanho: original.tamanho,
        contorno: original.contorno.map((p) => ponto(p.x + deslocamento.x, p.y + deslocamento.y)),
        linhaDeFio: {
          inicio: ponto(original.linhaDeFio.inicio.x + deslocamento.x, original.linhaDeFio.inicio.y + deslocamento.y),
          fim: ponto(original.linhaDeFio.fim.x + deslocamento.x, original.linhaDeFio.fim.y + deslocamento.y),
        },
        quantidade: original.quantidade,
        linhasInternas: original.linhasInternas,
        restricaoDeRotacao: original.restricaoDeRotacao,
      },
      proximoId(),
    );
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

  const zoom = useCallback(
    (fator: number) => {
      setTransform((t) => aplicarZoom(t, fator, { x: 400, y: 300 }));
    },
    [],
  );

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

  const aoTeclar = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const alvoEhCampoDeTexto = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (alvoEhCampoDeTexto) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
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
    [desfazer, refazer, duplicarSelecionado, excluirSelecionado, zoom, ajustarTela],
  );

  return (
    <div className="app-shell" onKeyDown={aoTeclar} tabIndex={-1}>
      <BarraDeFerramentas
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
      />
      <div className="corpo-principal">
        <PainelDePecas pecas={pecas} selecionadoId={selecionadoId} onSelecionar={setSelecionadoId} />
        <AreaDeDesenho
          pecas={pecas}
          selecionadoId={selecionadoId}
          transform={transform}
          onTransformChange={setTransform}
          onSelecionar={setSelecionadoId}
          onCursorMove={setCursorMundo}
        />
        <PainelDePropriedades peca={pecaSelecionada} />
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
