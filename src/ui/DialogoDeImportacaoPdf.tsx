import { useState } from 'react';
import type { ContornoCandidatoPdf, DescartesDePdf } from '../formats/pdf-pecas-vetoriais';
import { Sobreposicao } from './Sobreposicao';

export interface ItemConfirmadoDoPdf {
  readonly candidato: ContornoCandidatoPdf;
  readonly nome: string;
  readonly tamanho: string;
  readonly direcaoDoFio: 'vertical' | 'horizontal';
  readonly fatorDeEscala: number;
}

interface DialogoDeImportacaoPdfProps {
  readonly candidatos: readonly ContornoCandidatoPdf[];
  readonly descartados: DescartesDePdf;
  readonly curvasAproximadas: number;
  readonly onConfirmar: (itens: readonly ItemConfirmadoDoPdf[]) => void;
  readonly onCancelar: () => void;
}

interface EstadoDoItem {
  readonly selecionado: boolean;
  readonly nome: string;
  readonly tamanho: string;
  readonly direcao: '' | 'vertical' | 'horizontal';
}

export function DialogoDeImportacaoPdf(props: DialogoDeImportacaoPdfProps): React.JSX.Element {
  const [fatorTexto, setFatorTexto] = useState('1');
  const [itens, setItens] = useState<Record<string, EstadoDoItem>>(() =>
    Object.fromEntries(props.candidatos.map((c) => [c.id, { selecionado: true, nome: '', tamanho: '', direcao: '' as const }])),
  );

  const fator = Number(fatorTexto.replace(',', '.'));
  const fatorValido = Number.isFinite(fator) && fator > 0;
  const selecionados = props.candidatos.filter((c) => itens[c.id]?.selecionado);
  const podeConfirmar =
    fatorValido &&
    selecionados.length > 0 &&
    selecionados.every((c) => (itens[c.id]?.nome ?? '').trim() !== '' && (itens[c.id]?.direcao ?? '') !== '');

  const atualizar = (id: string, parcial: Partial<EstadoDoItem>) =>
    setItens((atual) => ({ ...atual, [id]: { ...atual[id]!, ...parcial } }));

  const confirmar = () => {
    if (!podeConfirmar) return;
    props.onConfirmar(
      selecionados.map((c) => ({
        candidato: c,
        nome: itens[c.id]!.nome.trim(),
        tamanho: itens[c.id]!.tamanho.trim(),
        direcaoDoFio: itens[c.id]!.direcao as 'vertical' | 'horizontal',
        fatorDeEscala: fator,
      })),
    );
  };

  const d = props.descartados;
  const resumoDosDescartes = `Descartados: ${d.borda} de borda da folha, ${d.poucosVertices} com poucos vértices, ${d.areaPequena} de área pequena, ${d.abertos} abertos (não fechados).`;

  return (
    <Sobreposicao titulo="Importar contornos do PDF" onFechar={props.onCancelar}>
      <div className="formulario-de-sobreposicao">
        <p className="legenda-do-diagrama">
          {props.candidatos.length} contorno(s) fechado(s) encontrado(s) no desenho. Nenhum nome, escala ou direção do fio é
          assumido pelo app: defina cada um abaixo antes de importar.
        </p>
        <p className="legenda-do-diagrama">
          {resumoDosDescartes} Curvas aproximadas por segmentos retos no arquivo: {props.curvasAproximadas}.
        </p>

        <label>
          Fator de escala (1 = tamanho do papel, em mm)
          <input type="text" inputMode="decimal" value={fatorTexto} onChange={(e) => setFatorTexto(e.target.value)} />
        </label>
        {!fatorValido && <p className="mensagem-de-erro">Informe um número maior que zero.</p>}

        {props.candidatos.map((c, indice) => {
          const estado = itens[c.id];
          return (
            <fieldset key={c.id} className="grupo-de-rotacao">
              <legend>Contorno {indice + 1} — {c.vertices} vértices</legend>
              <label className="opcao-em-linha">
                <input
                  type="checkbox"
                  checked={estado?.selecionado ?? false}
                  onChange={(e) => atualizar(c.id, { selecionado: e.target.checked })}
                />
                Importar este contorno
              </label>
              <label>
                Nome da peça
                <input
                  type="text"
                  value={estado?.nome ?? ''}
                  onChange={(e) => atualizar(c.id, { nome: e.target.value })}
                  placeholder="obrigatório"
                />
              </label>
              <label>
                Tamanho (opcional)
                <input
                  type="text"
                  value={estado?.tamanho ?? ''}
                  onChange={(e) => atualizar(c.id, { tamanho: e.target.value })}
                  placeholder="não está no arquivo"
                />
              </label>
              <label>
                Direção do fio
                <select
                  value={estado?.direcao ?? ''}
                  onChange={(e) => atualizar(c.id, { direcao: e.target.value as EstadoDoItem['direcao'] })}
                >
                  <option value="">escolha</option>
                  <option value="vertical">vertical na tela</option>
                  <option value="horizontal">horizontal na tela</option>
                </select>
              </label>
            </fieldset>
          );
        })}

        <div className="acoes-da-sobreposicao">
          <button onClick={props.onCancelar}>Cancelar</button>
          <button className="botao-primario" onClick={confirmar} disabled={!podeConfirmar}>
            Importar {selecionados.length} contorno(s)
          </button>
        </div>
      </div>
    </Sobreposicao>
  );
}
