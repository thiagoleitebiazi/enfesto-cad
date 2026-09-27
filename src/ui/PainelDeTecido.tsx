import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { criarTecido, type Tecido, type PadraoDoTecido, type DadosDeNovoTecido } from '../domain/tecido';

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
    padrao: dados.padrao ?? ('liso' as PadraoDoTecido),
    observacoes: dados.observacoes ?? '',
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
          padrao: campos.padrao,
          ...(campos.observacoes ? { observacoes: campos.observacoes } : {}),
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
        <label>
          Observações (opcional)
          <textarea
            value={campos.observacoes}
            onChange={(e) => setCampos({ ...campos, observacoes: e.target.value })}
          />
        </label>
        {erro && <p className="mensagem-de-erro">{erro}</p>}
        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} className="botao-primario">
            Salvar tecido
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
