import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';

/** Um contorno candidato a peça, vindo de PDF ou DXF. `direcaoSugerida` só existe quando o próprio arquivo traz a linha de fio. */
export interface CandidatoDeContorno {
  readonly id: string;
  readonly vertices: number;
  readonly direcaoSugerida?: 'vertical' | 'horizontal' | undefined;
}

export interface ItemConfirmadoDeContorno {
  readonly candidatoId: string;
  readonly nome: string;
  readonly tamanho: string;
  readonly direcaoDoFio: 'vertical' | 'horizontal';
  readonly fatorDeEscala: number;
}

interface DialogoDeImportacaoDeContornosProps {
  readonly titulo: string;
  readonly descricao: string;
  readonly resumoDeDescartes: string;
  readonly candidatos: readonly CandidatoDeContorno[];
  /** PDF não traz unidade confiável, então o usuário escolhe a escala. DXF já declara a unidade. */
  readonly mostrarEscala: boolean;
  readonly onConfirmar: (itens: readonly ItemConfirmadoDeContorno[]) => void;
  readonly onCancelar: () => void;
}

interface EstadoDoItem {
  readonly selecionado: boolean;
  readonly nome: string;
  readonly tamanho: string;
  readonly direcao: '' | 'vertical' | 'horizontal';
}

export function DialogoDeImportacaoDeContornos(props: DialogoDeImportacaoDeContornosProps): React.JSX.Element {
  const [fatorTexto, setFatorTexto] = useState('1');
  const [itens, setItens] = useState<Record<string, EstadoDoItem>>(() =>
    Object.fromEntries(
      props.candidatos.map((c) => [
        c.id,
        { selecionado: true, nome: '', tamanho: '', direcao: c.direcaoSugerida ?? ('' as const) },
      ]),
    ),
  );

  const fator = props.mostrarEscala ? Number(fatorTexto.replace(',', '.')) : 1;
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
        candidatoId: c.id,
        nome: itens[c.id]!.nome.trim(),
        tamanho: itens[c.id]!.tamanho.trim(),
        direcaoDoFio: itens[c.id]!.direcao as 'vertical' | 'horizontal',
        fatorDeEscala: fator,
      })),
    );
  };

  return (
    <Sobreposicao titulo={props.titulo} onFechar={props.onCancelar}>
      <div className="formulario-de-sobreposicao">
        <p className="legenda-do-diagrama">
          {props.candidatos.length} contorno(s) fechado(s) encontrado(s). {props.descricao} Nenhum nome ou direção do fio é
          assumido pelo app: defina cada um abaixo antes de importar. Desmarque o que não for peça.
        </p>
        <p className="legenda-do-diagrama">{props.resumoDeDescartes}</p>

        {props.mostrarEscala && (
          <>
            <label>
              Fator de escala (1 = tamanho do papel, em mm)
              <input type="text" inputMode="decimal" value={fatorTexto} onChange={(e) => setFatorTexto(e.target.value)} />
            </label>
            {!fatorValido && <p className="mensagem-de-erro">Informe um número maior que zero.</p>}
          </>
        )}

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
