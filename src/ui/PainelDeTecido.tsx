import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import {
  criarTecido,
  lerCustoDoTecido,
  ROTULO_DA_UNIDADE_DO_CUSTO,
  ROTULO_DO_TIPO_DE_TECIDO,
  type Tecido,
  type PadraoDoTecido,
  type DadosDeNovoTecido,
  type TipoDeTecido,
  type UnidadeDoCusto,
} from '../domain/tecido';
import { lerMedida } from './medidas';

interface PainelDeTecidoProps {
  readonly tecidoAtual: Tecido | null;
  readonly onSalvar: (tecido: Tecido) => void;
  readonly onFechar: () => void;
}

function paraCampo(dados: DadosDeNovoTecido) {
  return {
    nome: dados.nome,
    referencia: dados.referencia,
    composicao: dados.composicao ?? '',
    larguraTotalMm: String(dados.larguraTotalMm),
    larguraUtilMm: String(dados.larguraUtilMm),
    direcional: dados.direcional ?? false,
    temPelo: dados.temPelo ?? false,
    sentidoNoEncaixe: (dados.sentidoNoEncaixe ?? '') as '' | 'por-tamanho' | 'por-pacote',
    padrao: dados.padrao ?? ('liso' as PadraoDoTecido),
    gramaturaGm2: dados.gramaturaGm2 !== undefined ? String(dados.gramaturaGm2) : '',
    quantidadeDisponivelKg: dados.quantidadeDisponivelKg !== undefined ? String(dados.quantidadeDisponivelKg) : '',
    observacoes: dados.observacoes ?? '',
    tipoDeTecido: dados.tipoDeTecido ?? ('' as TipoDeTecido | ''),
    custo: dados.custo ? dados.custo.valor.toFixed(2).replace('.', ',') : '',
    unidadeDoCusto: dados.custo?.unidade ?? ('' as UnidadeDoCusto | ''),
    rendimento: dados.rendimentoMmPorG !== undefined ? String(dados.rendimentoMmPorG).replace('.', ',') : '',
  };
}

export function PainelDeTecido(props: PainelDeTecidoProps): React.JSX.Element {
  const [campos, setCampos] = useState(() =>
    paraCampo(
      props.tecidoAtual ?? {
        nome: '',
        referencia: '',
        larguraTotalMm: 1600,
        larguraUtilMm: 1500,
      },
    ),
  );
  const [erro, setErro] = useState<string | null>(null);

  function salvar(): void {
    // Os opcionais novos: vazio fica sem informar; o que não é número não é convertido por conta própria.
    const custo = lerCustoDoTecido(campos.custo, campos.unidadeDoCusto);
    if (custo.erro) {
      setErro(custo.erro);
      return;
    }
    const rendimento = campos.rendimento.trim() === '' ? undefined : lerMedida(campos.rendimento);
    if (rendimento === null) {
      setErro('O rendimento precisa ser um número (m/kg), com vírgula nas casas decimais.');
      return;
    }
    try {
      const tecido = criarTecido(
        {
          nome: campos.nome,
          referencia: campos.referencia,
          ...(campos.composicao ? { composicao: campos.composicao } : {}),
          larguraTotalMm: Number.parseFloat(campos.larguraTotalMm),
          larguraUtilMm: Number.parseFloat(campos.larguraUtilMm),
          direcional: campos.direcional,
          temPelo: campos.temPelo,
          ...(campos.sentidoNoEncaixe ? { sentidoNoEncaixe: campos.sentidoNoEncaixe } : {}),
          padrao: campos.padrao,
          ...(campos.gramaturaGm2 ? { gramaturaGm2: Number.parseFloat(campos.gramaturaGm2) } : {}),
          ...(campos.quantidadeDisponivelKg
            ? { quantidadeDisponivelKg: Number.parseFloat(campos.quantidadeDisponivelKg) }
            : {}),
          ...(campos.observacoes ? { observacoes: campos.observacoes } : {}),
          ...(campos.tipoDeTecido !== '' ? { tipoDeTecido: campos.tipoDeTecido } : {}),
          ...(custo.custo ? { custo: custo.custo } : {}),
          ...(rendimento !== undefined ? { rendimentoMmPorG: rendimento } : {}),
        },
        props.tecidoAtual?.id ?? `tecido-${Date.now().toString(36)}`,
      );
      setErro(null);
      props.onSalvar(tecido);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Sobreposicao titulo="Configuração de tecido" onFechar={props.onFechar}>
      <form className="formulario-de-sobreposicao" onSubmit={(e) => e.preventDefault()}>
        <label>
          Nome
          <input type="text" value={campos.nome} onChange={(e) => setCampos({ ...campos, nome: e.target.value })} />
        </label>
        <label>
          Referência
          <input
            type="text"
            value={campos.referencia}
            onChange={(e) => setCampos({ ...campos, referencia: e.target.value })}
          />
        </label>
        <label>
          Composição (opcional)
          <input
            type="text"
            value={campos.composicao}
            onChange={(e) => setCampos({ ...campos, composicao: e.target.value })}
          />
        </label>
        <label>
          Largura total (mm)
          <input
            type="number"
            min={0}
            value={campos.larguraTotalMm}
            onChange={(e) => setCampos({ ...campos, larguraTotalMm: e.target.value })}
          />
        </label>
        <label>
          Largura útil (mm)
          <input
            type="number"
            min={0}
            value={campos.larguraUtilMm}
            onChange={(e) => setCampos({ ...campos, larguraUtilMm: e.target.value })}
          />
        </label>
        <label>
          Gramatura (g/m², opcional)
          <input
            type="number"
            min={0}
            value={campos.gramaturaGm2}
            onChange={(e) => setCampos({ ...campos, gramaturaGm2: e.target.value })}
          />
        </label>
        <label>
          Quantidade em estoque (kg, opcional)
          <input
            type="number"
            min={0}
            value={campos.quantidadeDisponivelKg}
            onChange={(e) => setCampos({ ...campos, quantidadeDisponivelKg: e.target.value })}
          />
        </label>
        <label>
          Tipo de tecido
          <select
            value={campos.tipoDeTecido}
            onChange={(e) => setCampos({ ...campos, tipoDeTecido: e.target.value as TipoDeTecido | '' })}
          >
            <option value="">Não informado</option>
            {(Object.keys(ROTULO_DO_TIPO_DE_TECIDO) as TipoDeTecido[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_DO_TIPO_DE_TECIDO[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Custo do tecido (R$, opcional)
          <input
            type="text"
            inputMode="decimal"
            value={campos.custo}
            onChange={(e) => setCampos({ ...campos, custo: e.target.value })}
          />
        </label>
        <label>
          Unidade do custo
          <select
            value={campos.unidadeDoCusto}
            onChange={(e) => setCampos({ ...campos, unidadeDoCusto: e.target.value as UnidadeDoCusto | '' })}
          >
            <option value="">(escolha)</option>
            {(Object.keys(ROTULO_DA_UNIDADE_DO_CUSTO) as UnidadeDoCusto[]).map((u) => (
              <option key={u} value={u}>
                {ROTULO_DA_UNIDADE_DO_CUSTO[u]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rendimento (m/kg, opcional)
          <input
            type="text"
            inputMode="decimal"
            value={campos.rendimento}
            onChange={(e) => setCampos({ ...campos, rendimento: e.target.value })}
          />
        </label>
        <p className="nota-do-formulario">
          O tipo, o custo e o rendimento são opcionais: em branco, nada muda. O custo entra só na estimativa de custo
          do Planejamento de corte.
        </p>
        <label>
          Padrão
          <select
            value={campos.padrao}
            onChange={(e) => setCampos({ ...campos, padrao: e.target.value as PadraoDoTecido })}
          >
            <option value="liso">Liso</option>
            <option value="listrado">Listrado</option>
            <option value="xadrez">Xadrez</option>
          </select>
        </label>
        <label className="opcao-em-linha">
          <input
            type="checkbox"
            checked={campos.direcional}
            onChange={(e) => setCampos({ ...campos, direcional: e.target.checked })}
          />
          Estampa/textura direcional (sentido único)
        </label>
        <label className="opcao-em-linha">
          <input
            type="checkbox"
            checked={campos.temPelo}
            onChange={(e) => setCampos({ ...campos, temPelo: e.target.checked })}
          />
          Tem pelo
        </label>
        {(campos.direcional || campos.temPelo) && (
          <label>
            Sentido no encaixe
            <select value={campos.sentidoNoEncaixe} onChange={(e) => setCampos({ ...campos, sentidoNoEncaixe: e.target.value as typeof campos.sentidoNoEncaixe })}>
              <option value="">Sentido único: todas as peças iguais</option>
              <option value="por-tamanho">Sentido por tamanho</option>
              <option value="por-pacote">Sentido por pacote</option>
            </select>
          </label>
        )}
        <label>
          Observações (opcional)
          <textarea
            value={campos.observacoes}
            onChange={(e) => setCampos({ ...campos, observacoes: e.target.value })}
          />
        </label>
        <div className="rodape-do-formulario">
          {erro && <p className="mensagem-de-erro">{erro}</p>}
          <div className="acoes-da-sobreposicao">
            <button type="button" onClick={props.onFechar}>
              Cancelar
            </button>
            <button type="button" onClick={salvar} className="botao-primario">
              Salvar tecido
            </button>
          </div>
        </div>
      </form>
    </Sobreposicao>
  );
}
