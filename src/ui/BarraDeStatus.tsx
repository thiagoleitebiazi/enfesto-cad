import { distancia, anguloEmGraus, type Ponto2D } from '../core/geometria';
import { numeroComVirgula } from '../core/numeros';
import { valorDaReguaEmUnidade, type TransformacaoDeTela, type UnidadeDeRegua } from './transformacaoDeTela';
import type { ProblemaDeValidacao } from '../domain/validacao';
import type { EstadoDoSalvamento } from './salvamento';
import type { CampoDaBarra } from './visaoDasPecas';

interface BarraDeStatusProps {
  readonly cursorMundo: Ponto2D | null;
  readonly transform: TransformacaoDeTela;
  readonly totalDePecas: number;
  /** Quantas peças valem como seleção: as do lote marcado na lista ou, sem lote, a peça selecionada. */
  readonly pecasSelecionadas: number;
  readonly problemas: readonly ProblemaDeValidacao[];
  readonly onAlternarValidacao: () => void;
  /** Último ponto confirmado durante uma construção em andamento (Reta, Retângulo, Furo, Distância, Sentido do fio) — habilita a leitura de DX/DY/distância/ângulo relativa a ele. */
  readonly pontoReferencia?: Ponto2D | null;
  /** Aproveitamento físico da mesa em %, ou null quando não há enfesto ou peças. */
  readonly aproveitamentoPercentual?: number | null;
  /** Os outros campos do encaixe, os que a pessoa escolheu (ADR 0199). */
  readonly campos?: readonly CampoDaBarra[];
  readonly resumo?: {
    readonly encaixados: number;
    readonly comprimentoMm: number;
    readonly larguraMm: number;
    readonly areaMm2: number;
    readonly perimetroMm: number | null;
    readonly rendimentoConsumoM: number | null;
    readonly rendimentoPesoKg: number | null;
  } | null;
  /** Escondida pelo menu Visão (ADR 0205). */
  readonly oculta?: boolean;
  /** As casas decimais das medidas; ausente, as de sempre (ADR 0199). */
  readonly precisao?: number | null;
  /** Unidade escolhida no canto das réguas: as medidas da barra seguem a mesma. */
  readonly unidade: UnidadeDeRegua;
  /** O último salvamento; sem nenhum ainda, nada aparece. */
  readonly salvamento?: EstadoDoSalvamento | null;
  /** A fila de encaixes (ADR 0102): quantos calculando, aguardando e prontos para aplicar; sem nada, não aparece. */
  readonly fila?: { readonly calculando: number; readonly aguardando: number; readonly prontos: number } | null;
  readonly onAbrirFila?: () => void;
  /** Os prazos das coleções (ADR 0108): atrasados e nos próximos 7 dias; sem nenhum, não aparece. */
  readonly prazos?: { readonly atrasados: number; readonly naSemana: number } | null;
  readonly onAbrirPrazos?: () => void;
}

/** Medida em mm escrita na unidade das réguas, com vírgula; em cm, duas casas dão a mesma precisão de 0,1 mm. */
function medidaComCasas(mm: number, unidade: UnidadeDeRegua, casas: number | null | undefined): string {
  if (unidade === 'pol') return `${numeroComVirgula(valorDaReguaEmUnidade(mm, 'pol'), casas ?? 3)} pol`;
  return unidade === 'cm' ? `${numeroComVirgula(valorDaReguaEmUnidade(mm, 'cm'), casas ?? 2)} cm` : `${numeroComVirgula(mm, casas ?? 1)} mm`;
}

export function BarraDeStatus(props: BarraDeStatusProps): React.JSX.Element | null {
  if (props.oculta) return null;
  const medida = (mm: number, unidade: UnidadeDeRegua): string => medidaComCasas(mm, unidade, props.precisao);
  const r = props.resumo;
  const textoDoCampo = (c: CampoDaBarra): string | null => {
    if (!r) return null;
    if (c === 'encaixados') return `Encaixados: ${r.encaixados}`;
    if (c === 'comprimento') return `Comprimento: ${medida(r.comprimentoMm, props.unidade)}`;
    if (c === 'largura') return `Largura: ${medida(r.larguraMm, props.unidade)}`;
    if (c === 'area') return `Área: ${numeroComVirgula(r.areaMm2 / 1_000_000, 3)} m²`;
    if (c === 'perimetro') return r.perimetroMm === null ? null : `Perímetro: ${medida(r.perimetroMm, props.unidade)}`;
    if (c === 'rendimentoConsumo') return r.rendimentoConsumoM === null ? null : `Rendimento: ${numeroComVirgula(r.rendimentoConsumoM, 3)} m/peça`;
    return r.rendimentoPesoKg === null ? null : `Rendimento: ${numeroComVirgula(r.rendimentoPesoKg, 3)} kg/peça`;
  };
  const zoomPercentual = Math.round(props.transform.escalaPxPorMm * 100);
  const erros = props.problemas.filter((p) => p.severidade === 'erro').length;
  const avisos = props.problemas.filter((p) => p.severidade === 'aviso').length;
  const referencia =
    props.pontoReferencia && props.cursorMundo
      ? {
          dx: props.cursorMundo.x - props.pontoReferencia.x,
          dy: props.cursorMundo.y - props.pontoReferencia.y,
          distancia: distancia(props.pontoReferencia, props.cursorMundo),
          angulo: anguloEmGraus(props.pontoReferencia, props.cursorMundo),
        }
      : null;

  return (
    <div className="barra-de-status">
      <span>
        {props.cursorMundo
          ? `X: ${medida(props.cursorMundo.x, props.unidade)}  Y: ${medida(props.cursorMundo.y, props.unidade)}`
          : 'X: —  Y: —'}
      </span>
      {referencia && (
        <span>
          DX: {medida(referencia.dx, props.unidade)}  DY: {medida(referencia.dy, props.unidade)}  Dist:{' '}
          {medida(referencia.distancia, props.unidade)}  Âng: {numeroComVirgula(referencia.angulo, 1)}°
        </span>
      )}
      <span>Zoom: {zoomPercentual}%</span>
      <span>Peças: {props.totalDePecas}</span>
      <span>
        Seleção:{' '}
        {props.pecasSelecionadas === 0
          ? 'nenhuma'
          : props.pecasSelecionadas === 1
            ? '1 peça'
            : `${props.pecasSelecionadas} peças`}
      </span>
      <span title="Área das peças na mesa ÷ (largura útil × comprimento usado)">
        Aproveitamento da mesa:{' '}
        {props.aproveitamentoPercentual != null ? `${numeroComVirgula(props.aproveitamentoPercentual, 1)}%` : '—'}
      </span>
      {(props.campos ?? []).map((c) => {
        const texto = textoDoCampo(c);
        return texto === null ? null : <span key={c}>{texto}</span>;
      })}
      {props.salvamento &&
        (props.salvamento.ok ? (
          <span className="estado-do-salvamento">Salvo às {props.salvamento.hora}</span>
        ) : (
          <span className="estado-do-salvamento salvamento-falhou" title={props.salvamento.erro}>
            Não foi salvo
          </span>
        ))}
      {props.fila && props.fila.calculando + props.fila.aguardando + props.fila.prontos > 0 && (
        <button
          type="button"
          className={`indicador-da-fila ${props.fila.calculando > 0 ? 'fila-calculando' : props.fila.prontos > 0 ? 'fila-pronta' : ''}`}
          title="Abrir a fila de encaixes"
          onClick={props.onAbrirFila}
        >
          Fila:{' '}
          {[
            props.fila.calculando > 0 ? `${props.fila.calculando} calculando` : null,
            props.fila.aguardando > 0 ? `${props.fila.aguardando} aguardando` : null,
            props.fila.prontos > 0 ? `${props.fila.prontos} pronto(s) para aplicar` : null,
          ]
            .filter((x) => x !== null)
            .join(' · ')}
        </button>
      )}
      {props.prazos && props.prazos.atrasados + props.prazos.naSemana > 0 && (
        <button
          type="button"
          className={`indicador-de-prazos ${props.prazos.atrasados > 0 ? 'prazos-atrasados' : ''}`}
          title="Abrir os prazos e as tarefas das coleções"
          onClick={props.onAbrirPrazos}
        >
          Prazos:{' '}
          {[props.prazos.atrasados > 0 ? `${props.prazos.atrasados} atrasado(s)` : null, props.prazos.naSemana > 0 ? `${props.prazos.naSemana} na semana` : null]
            .filter((x) => x !== null)
            .join(' · ')}
        </button>
      )}
      <button
        className={`indicador-de-validacao ${erros > 0 ? 'tem-erro' : avisos > 0 ? 'tem-aviso' : ''}`}
        onClick={props.onAlternarValidacao}
      >
        Validação: {erros === 0 && avisos === 0 ? 'sem problemas' : `${erros} erro(s), ${avisos} aviso(s)`}
      </button>
    </div>
  );
}
