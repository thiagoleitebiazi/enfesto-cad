import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { DiagramaDeEnfesto } from './DiagramaDeEnfesto';
import {
  criarConfiguracaoDeEnfesto,
  ROTULO_DO_TIPO,
  type ConfiguracaoDeEnfesto,
  type TipoDeEnfesto,
} from '../domain/enfesto';

interface PainelDeEnfestoProps {
  readonly configAtual: ConfiguracaoDeEnfesto | null;
  readonly onSalvar: (config: ConfiguracaoDeEnfesto) => void;
  readonly onFechar: () => void;
}

interface CamposDeFormulario {
  tipo: TipoDeEnfesto;
  larguraUtilMm: string;
  comprimentoMm: string;
  quantidadeDeCamadas: string;
  margemLateralMm: string;
  margemDeExtremidadeMm: string;
  larguraDoTuboMm: string;
  alinhamentoDasBordas: 'alinhado' | 'escalonado';
  sentidoDeAlimentacao: 'unico' | 'alternado';
}

function camposIniciais(config: ConfiguracaoDeEnfesto | null): CamposDeFormulario {
  return {
    tipo: config?.tipo ?? 'impar',
    larguraUtilMm: String(config?.larguraUtilMm ?? 1500),
    comprimentoMm: String(config?.comprimentoMm ?? 3000),
    quantidadeDeCamadas: String(config?.quantidadeDeCamadas ?? 10),
    margemLateralMm: String(config?.margemLateralMm ?? 10),
    margemDeExtremidadeMm: String(config?.margemDeExtremidadeMm ?? 20),
    larguraDoTuboMm: String(config?.tipo === 'tubular' ? config.larguraDoTuboMm : 1500),
    alinhamentoDasBordas: config?.tipo === 'ramado' ? config.alinhamentoDasBordas : 'alinhado',
    sentidoDeAlimentacao: config?.tipo === 'ramado' ? config.sentidoDeAlimentacao : 'unico',
  };
}

function construirConfiguracao(c: CamposDeFormulario): ConfiguracaoDeEnfesto {
  const base = {
    larguraUtilMm: Number.parseFloat(c.larguraUtilMm),
    comprimentoMm: Number.parseFloat(c.comprimentoMm),
    quantidadeDeCamadas: Number.parseInt(c.quantidadeDeCamadas, 10),
    margemLateralMm: Number.parseFloat(c.margemLateralMm),
    margemDeExtremidadeMm: Number.parseFloat(c.margemDeExtremidadeMm),
  };
  if (c.tipo === 'tubular') {
    return { ...base, tipo: 'tubular', larguraDoTuboMm: Number.parseFloat(c.larguraDoTuboMm) };
  }
  if (c.tipo === 'ramado') {
    return {
      ...base,
      tipo: 'ramado',
      alinhamentoDasBordas: c.alinhamentoDasBordas,
      sentidoDeAlimentacao: c.sentidoDeAlimentacao,
    };
  }
  return { ...base, tipo: c.tipo };
}

export function PainelDeEnfesto(props: PainelDeEnfestoProps): React.JSX.Element {
  const [campos, setCampos] = useState<CamposDeFormulario>(() => camposIniciais(props.configAtual));
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<ConfiguracaoDeEnfesto | null>(null);

  function atualizarPreview(proximosCampos: CamposDeFormulario): void {
    try {
      setPreview(construirConfiguracao(proximosCampos));
    } catch {
      setPreview(null);
    }
  }

  function alterar(patch: Partial<CamposDeFormulario>): void {
    const proximos = { ...campos, ...patch };
    setCampos(proximos);
    atualizarPreview(proximos);
  }

  function salvar(): void {
    try {
      const config = criarConfiguracaoDeEnfesto(construirConfiguracao(campos));
      setErro(null);
      props.onSalvar(config);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  const diagrama = preview ?? (() => {
    try {
      return construirConfiguracao(campos);
    } catch {
      return null;
    }
  })();

  return (
    <Sobreposicao titulo="Configuração de enfesto" onFechar={props.onFechar}>
      <form className="formulario-de-sobreposicao" onSubmit={(e) => e.preventDefault()}>
        <label>
          Tipo de enfesto
          <select value={campos.tipo} onChange={(e) => alterar({ tipo: e.target.value as TipoDeEnfesto })}>
            {(Object.keys(ROTULO_DO_TIPO) as TipoDeEnfesto[]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULO_DO_TIPO[tipo]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Largura útil (mm)
          <input
            type="number"
            min={0}
            value={campos.larguraUtilMm}
            onChange={(e) => alterar({ larguraUtilMm: e.target.value })}
          />
        </label>
        <label>
          Comprimento (mm)
          <input
            type="number"
            min={0}
            value={campos.comprimentoMm}
            onChange={(e) => alterar({ comprimentoMm: e.target.value })}
          />
        </label>
        <label>
          Quantidade de camadas
          <input
            type="number"
            min={1}
            step={1}
            value={campos.quantidadeDeCamadas}
            onChange={(e) => alterar({ quantidadeDeCamadas: e.target.value })}
          />
        </label>
        <label>
          Margem lateral (mm)
          <input
            type="number"
            min={0}
            value={campos.margemLateralMm}
            onChange={(e) => alterar({ margemLateralMm: e.target.value })}
          />
        </label>
        <label>
          Margem de extremidade (mm)
          <input
            type="number"
            min={0}
            value={campos.margemDeExtremidadeMm}
            onChange={(e) => alterar({ margemDeExtremidadeMm: e.target.value })}
          />
        </label>

        {campos.tipo === 'tubular' && (
          <label>
            Largura do tubo (mm)
            <input
              type="number"
              min={0}
              value={campos.larguraDoTuboMm}
              onChange={(e) => alterar({ larguraDoTuboMm: e.target.value })}
            />
          </label>
        )}

        {campos.tipo === 'ramado' && (
          <>
            <label>
              Alinhamento das bordas
              <select
                value={campos.alinhamentoDasBordas}
                onChange={(e) =>
                  alterar({ alinhamentoDasBordas: e.target.value as 'alinhado' | 'escalonado' })
                }
              >
                <option value="alinhado">Alinhado</option>
                <option value="escalonado">Escalonado</option>
              </select>
            </label>
            <label>
              Sentido de alimentação
              <select
                value={campos.sentidoDeAlimentacao}
                onChange={(e) => alterar({ sentidoDeAlimentacao: e.target.value as 'unico' | 'alternado' })}
              >
                <option value="unico">Único</option>
                <option value="alternado">Alternado</option>
              </select>
            </label>
          </>
        )}

        {diagrama && <DiagramaDeEnfesto config={diagrama} />}

        {erro && <p className="mensagem-de-erro">{erro}</p>}
        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} className="botao-primario">
            Salvar enfesto
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
