import { fatoresDaImpressao, pecasNaEscala, type EscalaDaImpressao, type ProporcaoDaImpressao } from '../formats/escalaDaImpressao';
import type { Molde } from '../domain/molde';
import { PreviaDaImpressao } from './PreviaDaImpressao';
import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { margemMaximaMm, type FormatoDePagina, type OrientacaoDePagina, areaImprimivelMm } from '../formats/pdf-exportacao';
import { lerMedida } from './medidas';
import { numeroComVirgula } from '../core/numeros';

export type TipoDeExportacaoPdf = 'encaixe-completo' | 'moldes-individuais';

export interface OpcoesDeExportacaoEscolhidas {
  readonly tipo: TipoDeExportacaoPdf;
  readonly formato: FormatoDePagina;
  readonly orientacao: OrientacaoDePagina;
  readonly margemMm: number;
  /** A proporção e as cores (ADR 0185). */
  readonly escala?: EscalaDaImpressao;
  readonly emCores?: boolean;
}

interface PainelDeExportacaoPdfProps {
  readonly podeExportarEncaixeCompleto: boolean;
  readonly gerando: boolean;
  /** O que a prévia mostra (ADR 0185): sem isto, não há botão Visualizar. */
  readonly pecas?: readonly Molde[];
  readonly desenho?: { readonly larguraMm: number; readonly comprimentoMm: number };
  readonly onExportar: (opcoes: OpcoesDeExportacaoEscolhidas) => void;
  readonly onFechar: () => void;
}

export function PainelDeExportacaoPdf(props: PainelDeExportacaoPdfProps): React.JSX.Element {
  const [tipo, setTipo] = useState<TipoDeExportacaoPdf>(
    props.podeExportarEncaixeCompleto ? 'encaixe-completo' : 'moldes-individuais',
  );
  const [formato, setFormato] = useState<FormatoDePagina>('A4');
  // Paisagem: a folha mostra a peça como a tela, com o comprimento na horizontal (ADR 0090) — deitada, ela gasta as
  // mesmas folhas que antes gastava em retrato.
  const [orientacao, setOrientacao] = useState<OrientacaoDePagina>('paisagem');
  const [margemMm, setMargemMm] = useState('10');
  const [proporcao, setProporcao] = useState<ProporcaoDaImpressao>('real');
  const [porcentagem, setPorcentagem] = useState('100');
  const [fatorX, setFatorX] = useState('100');
  const [fatorY, setFatorY] = useState('100');
  const [emCores, setEmCores] = useState(true);
  const [visualizar, setVisualizar] = useState(false);
  // A margem que não deixa espaço na folha travava o programa ao gerar; agora é recusada aqui.
  const margem = lerMedida(margemMm);
  const maxima = margemMaximaMm({ formato, orientacao });
  const erroDaMargem =
    margem === null || margemMm.trim() === '' || margem < 0
      ? 'A margem precisa ser um número de 0 mm para cima.'
      : margem > maxima
        ? `Nesta folha, a margem vai até ${numeroComVirgula(maxima)} mm.`
        : null;
  const lidos = { porcentagem: lerMedida(porcentagem), fatorXPorcento: lerMedida(fatorX), fatorYPorcento: lerMedida(fatorY) };
  const usados = proporcao === 'porcentagem' ? [lidos.porcentagem] : proporcao === 'fatores' ? [lidos.fatorXPorcento, lidos.fatorYPorcento] : [];
  const erroDaEscala = usados.some((v) => v === null || !(v > 0)) ? 'A porcentagem e os fatores precisam ser números maiores que zero.' : null;
  const escala: EscalaDaImpressao = { proporcao, porcentagem: lidos.porcentagem ?? 100, fatorXPorcento: lidos.fatorXPorcento ?? 100, fatorYPorcento: lidos.fatorYPorcento ?? 100 };
  const fatoresDaPrevia = props.desenho && erroDaEscala === null && margem !== null && erroDaMargem === null ? fatoresDaImpressao(escala, props.desenho, areaImprimivelMm({ formato, orientacao, margemMm: margem })) : null;

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
          <input
            type="text"
            inputMode="decimal"
            value={margemMm}
            aria-invalid={erroDaMargem !== null}
            onChange={(e) => setMargemMm(e.target.value)}
          />
        </label>
        {erroDaMargem && (
          <p className="mensagem-de-erro" role="alert">
            {erroDaMargem}
          </p>
        )}
        <label>
          Proporção
          <select value={proporcao} onChange={(e) => setProporcao(e.target.value as ProporcaoDaImpressao)}>
            <option value="real">Escala real (1:1)</option>
            <option value="folha">Do tamanho da folha</option>
            <option value="largura">Ajustar à largura da folha</option>
            <option value="comprimento">Ajustar ao comprimento da folha</option>
            <option value="porcentagem">Por porcentagem</option>
            <option value="fatores">Fatores de escala X e Y</option>
          </select>
        </label>
        {proporcao === 'porcentagem' && (
          <label>
            Porcentagem (%)
            <input type="text" inputMode="decimal" value={porcentagem} onChange={(e) => setPorcentagem(e.target.value)} />
          </label>
        )}
        {proporcao === 'fatores' && (
          <>
            <label>
              Fator X (%)
              <input type="text" inputMode="decimal" value={fatorX} onChange={(e) => setFatorX(e.target.value)} />
            </label>
            <label>
              Fator Y (%)
              <input type="text" inputMode="decimal" value={fatorY} onChange={(e) => setFatorY(e.target.value)} />
            </label>
          </>
        )}
        {erroDaEscala && (
          <p className="mensagem-de-erro" role="alert">
            {erroDaEscala}
          </p>
        )}
        <label className="opcao-em-linha">
          <input type="checkbox" checked={emCores} onChange={(e) => setEmCores(e.target.checked)} />
          Em cores
        </label>
        {visualizar && props.pecas && props.desenho && fatoresDaPrevia && margem !== null && (
          <PreviaDaImpressao
            pecas={pecasNaEscala(props.pecas, fatoresDaPrevia)}
            larguraMm={props.desenho.larguraMm * fatoresDaPrevia.vertical}
            comprimentoMm={props.desenho.comprimentoMm * fatoresDaPrevia.horizontal}
            folhaHorizontalMm={areaImprimivelMm({ formato, orientacao, margemMm: margem }).largura}
            folhaVerticalMm={areaImprimivelMm({ formato, orientacao, margemMm: margem }).altura}
          />
        )}
        <p className="legenda-do-diagrama">
          {proporcao === 'real'
            ? 'Escala real 1:1. Áreas maiores que uma folha saem em várias páginas (ladrilhadas, com etiqueta de posição para remontagem). Uma régua de referência de 100 mm é incluída para conferir a escala após imprimir.'
            : 'Fora da escala real, o papel serve para conferir, não para cortar: a régua de 100 mm não acompanha a escala.'}
        </p>
        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar} disabled={props.gerando}>
            Cancelar
          </button>
          {props.pecas && props.desenho && (
            <button type="button" onClick={() => setVisualizar((v) => !v)}>
              Visualizar
            </button>
          )}
          <button
            type="button"
            className="botao-primario"
            disabled={props.gerando || erroDaMargem !== null || margem === null || erroDaEscala !== null}
            onClick={() => {
              if (erroDaMargem === null && margem !== null) props.onExportar({ tipo, formato, orientacao, margemMm: margem, escala, emCores });
            }}
          >
            {props.gerando ? 'Gerando...' : 'Exportar'}
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
