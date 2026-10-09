import type { FerramentaDeVista } from './AreaDeDesenho';
import { Icone, type NomeDoIcone } from './Icone';
import { valorDaReguaEmUnidade, type UnidadeDeRegua } from './transformacaoDeTela';

interface BarraDeVisualizacaoProps {
  readonly ferramentaDeVista: FerramentaDeVista | null;
  readonly onAlternarFerramentaDeVista: (ferramenta: FerramentaDeVista) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onAjustarTela: () => void;
  readonly onVistaAnterior: () => void;
  readonly onProximaVista: () => void;
  readonly podeVistaAnterior: boolean;
  readonly podeProximaVista: boolean;
  readonly mostrarGrade: boolean;
  readonly onAlternarGrade: () => void;
  readonly imaAtivo: boolean;
  readonly onAlternarIma: () => void;
  /** Espaço entre os pontos da grade na escala atual, em mm (o mesmo passo em que o ímã prende). */
  readonly passoDaGradeMm: number;
  readonly unidadeDaRegua: UnidadeDeRegua;
}

interface BotaoDaBarraProps {
  readonly icone: NomeDoIcone;
  readonly rotulo: string;
  readonly titulo: string;
  readonly onClick: () => void;
  readonly pressionado?: boolean;
  readonly desabilitado?: boolean;
}

function BotaoDaBarra(props: BotaoDaBarraProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={props.rotulo}
      aria-pressed={props.pressionado}
      title={props.titulo}
      disabled={props.desabilitado}
      onClick={props.onClick}
    >
      <Icone nome={props.icone} />
    </button>
  );
}

/** "10 mm", "0,5 cm" — o passo da grade na unidade da régua, com vírgula decimal. */
function textoDoPasso(passoMm: number, unidade: UnidadeDeRegua): string {
  return `${String(valorDaReguaEmUnidade(passoMm, unidade)).replace('.', ',')} ${unidade}`;
}

/**
 * Barra de visualização embaixo do desenho: mão, zoom por janela, zoom,
 * ajustar, vista anterior/próxima, e os auxílios de desenho (grade e ímã).
 * Só ícones, cada um com nome acessível e dica — os mesmos comandos também
 * estão no menu Visão (e o ímã em Opções).
 */
export function BarraDeVisualizacao(props: BarraDeVisualizacaoProps): React.JSX.Element {
  return (
    <div className="barra-de-visualizacao" role="toolbar" aria-label="Visualização">
      <BotaoDaBarra
        icone="mao"
        rotulo="Mão"
        titulo="Mão: arraste para mover a vista (também: segurar Espaço ou o botão do meio do mouse). Esc desliga."
        pressionado={props.ferramentaDeVista === 'mao'}
        onClick={() => props.onAlternarFerramentaDeVista('mao')}
      />
      <BotaoDaBarra
        icone="zoom-janela"
        rotulo="Zoom por janela"
        titulo="Zoom por janela: arraste um retângulo sobre a área a ampliar. Esc cancela."
        pressionado={props.ferramentaDeVista === 'zoom-janela'}
        onClick={() => props.onAlternarFerramentaDeVista('zoom-janela')}
      />
      <BotaoDaBarra icone="zoom-in" rotulo="Aumentar zoom" titulo="Aumentar zoom (+)" onClick={props.onZoomIn} />
      <BotaoDaBarra icone="zoom-out" rotulo="Diminuir zoom" titulo="Diminuir zoom (-)" onClick={props.onZoomOut} />
      <BotaoDaBarra
        icone="ajustar"
        rotulo="Ajustar à tela"
        titulo="Ajustar à tela: mostra a mesa e todas as peças (Ctrl+0)"
        onClick={props.onAjustarTela}
      />
      <BotaoDaBarra
        icone="vista-anterior"
        rotulo="Vista anterior"
        titulo={props.podeVistaAnterior ? 'Vista anterior: volta ao enquadramento de antes' : 'Vista anterior: nenhuma vista guardada ainda'}
        desabilitado={!props.podeVistaAnterior}
        onClick={props.onVistaAnterior}
      />
      <BotaoDaBarra
        icone="vista-proxima"
        rotulo="Próxima vista"
        titulo={props.podeProximaVista ? 'Próxima vista: refaz o enquadramento desfeito por Vista anterior' : 'Próxima vista: nada para refazer'}
        desabilitado={!props.podeProximaVista}
        onClick={props.onProximaVista}
      />
      <span className="separador-da-barra-de-visualizacao" aria-hidden="true" />
      <BotaoDaBarra
        icone="grade"
        rotulo="Grade"
        titulo="Grade de pontos: o espaço entre os pontos acompanha o zoom (passos redondos de mm)"
        pressionado={props.mostrarGrade}
        onClick={props.onAlternarGrade}
      />
      <BotaoDaBarra
        icone="ima"
        rotulo="Ímã"
        titulo="Ímã: ao clicar para criar pontos (contorno, furo, linha de fio, marca, cerca), prende no vértice mais próximo ou, com a grade visível, no ponto da grade. Não age ao arrastar."
        pressionado={props.imaAtivo}
        onClick={props.onAlternarIma}
      />
      {props.mostrarGrade && (
        <span className="texto-da-barra-de-visualizacao">Grade: {textoDoPasso(props.passoDaGradeMm, props.unidadeDaRegua)}</span>
      )}
    </div>
  );
}
