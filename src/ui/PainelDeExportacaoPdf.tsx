import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import type { FormatoDePagina, OrientacaoDePagina } from '../formats/pdf-exportacao';

export type TipoDeExportacaoPdf = 'encaixe-completo' | 'moldes-individuais';

export interface OpcoesDeExportacaoEscolhidas {
  readonly tipo: TipoDeExportacaoPdf;
  readonly formato: FormatoDePagina;
  readonly orientacao: OrientacaoDePagina;
  readonly margemMm: number;
}

interface PainelDeExportacaoPdfProps {
  readonly podeExportarEncaixeCompleto: boolean;
  readonly gerando: boolean;
  readonly onExportar: (opcoes: OpcoesDeExportacaoEscolhidas) => void;
  readonly onFechar: () => void;
}

export function PainelDeExportacaoPdf(props: PainelDeExportacaoPdfProps): React.JSX.Element {
  const [tipo, setTipo] = useState<TipoDeExportacaoPdf>(
    props.podeExportarEncaixeCompleto ? 'encaixe-completo' : 'moldes-individuais',
  );
  const [formato, setFormato] = useState<FormatoDePagina>('A4');
  const [orientacao, setOrientacao] = useState<OrientacaoDePagina>('retrato');
  const [margemMm, setMargemMm] = useState('10');

  return (
    <Sobreposicao titulo="Exportar PDF vetorial (escala 1:1)" onFechar={props.onFechar}>
      <form className="formulario-de-sobreposicao" onSubmit={(e) => e.preventDefault()}>
        <label>
          Tipo de exportação
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeExportacaoPdf)}>
            <option value="encaixe-completo" disabled={!props.podeExportarEncaixeCompleto}>
              Encaixe completo (tecido + moldes posicionados)
              {!props.podeExportarEncaixeCompleto ? ' — configure o enfesto primeiro' : ''}
            </option>
            <option value="moldes-individuais">Moldes individuais (uma peça por página, escala real)</option>
          </select>
        </label>
        <label>
          Formato de página
          <select value={formato} onChange={(e) => setFormato(e.target.value as FormatoDePagina)}>
            <option value="A4">A4 (210 × 297 mm)</option>
            <option value="A3">A3 (297 × 420 mm)</option>
            <option value="Letter">Letter (215,9 × 279,4 mm)</option>
          </select>
        </label>
        <label>
          Orientação
          <select value={orientacao} onChange={(e) => setOrientacao(e.target.value as OrientacaoDePagina)}>
            <option value="retrato">Retrato</option>
            <option value="paisagem">Paisagem</option>
          </select>
        </label>
        <label>
          Margem (mm)
          <input type="number" min={0} value={margemMm} onChange={(e) => setMargemMm(e.target.value)} />
        </label>
        <p className="legenda-do-diagrama">
          Escala real 1:1. Áreas maiores que uma folha saem em várias páginas (ladrilhadas, com etiqueta de posição
          para remontagem). Uma régua de referência de 100 mm é incluída para conferir a escala após imprimir.
        </p>
        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar} disabled={props.gerando}>
            Cancelar
          </button>
          <button
            type="button"
            className="botao-primario"
            disabled={props.gerando}
            onClick={() =>
              props.onExportar({ tipo, formato, orientacao, margemMm: Number.parseFloat(margemMm) || 0 })
            }
          >
            {props.gerando ? 'Gerando...' : 'Exportar'}
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
