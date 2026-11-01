import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { DiagramaDeEnfesto } from './DiagramaDeEnfesto';
import {
  criarConfiguracaoDeEnfesto,
  lerZonasBloqueadas,
  textoDasZonas,
  DISTANCIA_PADRAO_ENTRE_PECAS_MM,
  MARGEM_DE_SEGURANCA_DA_MESA_MM,
  margensDaMesa,
  ROTULO_DO_TIPO,
  type ConfiguracaoDeEnfesto,
  type TipoDeEnfesto, lerPontosDeEmenda, lerLinhasDeReferencia, textoDasLinhasDeReferencia } from '../domain/enfesto';

interface PainelDeEnfestoProps {
  readonly configAtual: ConfiguracaoDeEnfesto | null;
  readonly onSalvar: (config: ConfiguracaoDeEnfesto) => void;
  readonly onFechar: () => void;
  /** O método que combina com as peças e o tecido (ADR 0204). */
  readonly sugestao?: { readonly tipo: string; readonly motivo: string };
}

interface CamposDeFormulario {
  tipo: TipoDeEnfesto;
  larguraUtilMm: string;
  comprimentoMm: string;
  quantidadeDeCamadas: string;
  margemLateralMm: string;
  margemDeExtremidadeMm: string;
  distanciaMinimaEntrePecasMm: string;
  larguraDoTuboMm: string;
  alinhamentoDasBordas: 'alinhado' | 'escalonado';
  sentidoDeAlimentacao: 'unico' | 'alternado';
  zonasBloqueadas: string;
  emendas: string;
  linhas: string;
  perdaPercentual: string;
  perdaCm: string;
  mostraPadronagem: boolean;
  imagemDaPadronagem: string;
  comprimentoDaPadronagemMm: string;
  corDoTecido: string;
}

const TAMANHO_MAXIMO_DO_PADRAO = 2_000_000;
const CHAVE_DO_PADRAO_DO_ENFESTO = 'enfesto-cad:padrao-do-enfesto';

/** "Ao criar novo encaixe" (ADR 0200): o que a mesa nova já traz. */
function padraoGuardado(): Partial<CamposDeFormulario> {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_DO_PADRAO_DO_ENFESTO) ?? '{}') as Partial<CamposDeFormulario>;
  } catch {
    return {};
  }
}

function camposIniciais(config: ConfiguracaoDeEnfesto | null): CamposDeFormulario {
  // As margens que valem: o projeto de antes, gravado com margem zero, já mostra a de segurança.
  const margens = config ? margensDaMesa(config) : null;
  return {
    tipo: config?.tipo ?? 'impar',
    larguraUtilMm: String(config?.larguraUtilMm ?? 1500),
    comprimentoMm: String(config?.comprimentoMm ?? 3000),
    quantidadeDeCamadas: String(config?.quantidadeDeCamadas ?? 10),
    margemLateralMm: String(margens?.lateralMm ?? MARGEM_DE_SEGURANCA_DA_MESA_MM),
    margemDeExtremidadeMm: String(margens?.extremidadeMm ?? MARGEM_DE_SEGURANCA_DA_MESA_MM),
    distanciaMinimaEntrePecasMm: String(config?.distanciaMinimaEntrePecasMm ?? DISTANCIA_PADRAO_ENTRE_PECAS_MM),
    larguraDoTuboMm: String(config?.tipo === 'tubular' ? config.larguraDoTuboMm : 1500),
    alinhamentoDasBordas: config?.tipo === 'ramado' ? config.alinhamentoDasBordas : 'alinhado',
    sentidoDeAlimentacao: config?.tipo === 'ramado' ? config.sentidoDeAlimentacao : 'unico',
    zonasBloqueadas: textoDasZonas(config?.zonasBloqueadas ?? []),
    emendas: (config?.emendasMm ?? []).join(' '),
    linhas: textoDasLinhasDeReferencia(config?.linhasDeReferencia ?? []),
    perdaPercentual: config?.perdaPercentual !== undefined ? String(config.perdaPercentual) : '',
    perdaCm: config?.perdaMm !== undefined ? String(config.perdaMm / 10) : '',
    mostraPadronagem: config?.padronagem !== undefined,
    imagemDaPadronagem: config?.padronagem?.imagem ?? '',
    comprimentoDaPadronagemMm: String(config?.padronagem?.comprimentoMm ?? 100),
    corDoTecido: config?.corDoTecido ?? '',
  };
}

function construirConfiguracao(c: CamposDeFormulario): ConfiguracaoDeEnfesto {
  const zonasBloqueadas = lerZonasBloqueadas(c.zonasBloqueadas);
  const emendasMm = lerPontosDeEmenda(c.emendas);
  const linhasDeReferencia = lerLinhasDeReferencia(c.linhas);
  const perdaPercentual = Number.parseFloat(c.perdaPercentual.replace(',', '.'));
  const perdaCm = Number.parseFloat(c.perdaCm.replace(',', '.'));
  const base = {
    ...(linhasDeReferencia.length > 0 ? { linhasDeReferencia } : {}),
    ...(perdaPercentual > 0 ? { perdaPercentual } : {}),
    ...(perdaCm > 0 ? { perdaMm: perdaCm * 10 } : {}),
    ...(zonasBloqueadas.length > 0 ? { zonasBloqueadas } : {}),
    ...(emendasMm.length > 0 ? { emendasMm } : {}),
    ...(c.mostraPadronagem && c.imagemDaPadronagem !== '' ? { padronagem: { imagem: c.imagemDaPadronagem, comprimentoMm: Math.max(1, Number.parseFloat(c.comprimentoDaPadronagemMm) || 100) } } : {}),
    ...(c.corDoTecido !== '' ? { corDoTecido: c.corDoTecido } : {}),
    larguraUtilMm: Number.parseFloat(c.larguraUtilMm),
    comprimentoMm: Number.parseFloat(c.comprimentoMm),
    quantidadeDeCamadas: Number.parseInt(c.quantidadeDeCamadas, 10),
    margemLateralMm: Number.parseFloat(c.margemLateralMm),
    margemDeExtremidadeMm: Number.parseFloat(c.margemDeExtremidadeMm),
    distanciaMinimaEntrePecasMm: Number.parseFloat(c.distanciaMinimaEntrePecasMm),
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
  const [campos, setCampos] = useState<CamposDeFormulario>(() => ({ ...camposIniciais(props.configAtual), ...(props.configAtual ? {} : padraoGuardado()) }));
  const [erro, setErro] = useState<string | null>(null);
  const [erroDoPadrao, setErroDoPadrao] = useState<string | null>(null);
  const [preview, setPreview] = useState<ConfiguracaoDeEnfesto | null>(null);

  function atualizarPreview(proximosCampos: CamposDeFormulario): void {
    try {
      setPreview(construirConfiguracao(proximosCampos));
    } catch {
      setPreview(null);
    }
  }

  /** A imagem do padrão entra no projeto: por isso o limite. */
  function lerPadrao(arquivo: File | undefined): void {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/') || arquivo.size > TAMANHO_MAXIMO_DO_PADRAO) {
      setErroDoPadrao('Escolha uma imagem de até 2 MB.');
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      setErroDoPadrao(null);
      alterar({ imagemDaPadronagem: String(leitor.result) });
    };
    leitor.readAsDataURL(arquivo);
  }

  function alterar(patch: Partial<CamposDeFormulario>): void {
    const proximos = { ...campos, ...patch };
    setCampos(proximos);
    atualizarPreview(proximos);
  }

  function salvar(): void {
    try {
      const pedida = construirConfiguracao(campos);
      if (!(pedida.margemLateralMm >= MARGEM_DE_SEGURANCA_DA_MESA_MM) || !(pedida.margemDeExtremidadeMm >= MARGEM_DE_SEGURANCA_DA_MESA_MM)) {
        throw new Error(`As margens da mesa vão de ${MARGEM_DE_SEGURANCA_DA_MESA_MM} mm para cima: é a margem de segurança, nenhuma peça chega mais perto da borda que isso.`);
      }
      const config = criarConfiguracaoDeEnfesto(pedida);
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
        {props.sugestao && (
          <p className="nota-do-formulario">
            Sugestão: {props.sugestao.tipo}, porque {props.sugestao.motivo}.
          </p>
        )}
        <label>
          Áreas bloqueadas da mesa (enfesto em escada, emenda, defeito): uma por linha, em mm — comprimento de, até, largura de, até
          <textarea rows={2} value={campos.zonasBloqueadas} placeholder="0 800 900 1500" onChange={(e) => alterar({ zonasBloqueadas: e.target.value })} />
        </label>
        <label>
          Pontos de emenda: no comprimento, em mm, separados por espaço
          <input type="text" value={campos.emendas} placeholder="1200 2400" onChange={(e) => alterar({ emendas: e.target.value })} />
        </label>
        <label>
          Linhas de referência: uma por linha — nome, distância (mm) e a borda (esquerda, direita, superior, inferior); depois, se quiser, evitar, limite, valor
          <textarea rows={2} value={campos.linhas} placeholder="Meio 750 superior evitar valor" onChange={(e) => alterar({ linhas: e.target.value })} />
        </label>
        <label>
          Perdas: porcentagem
          <input type="text" inputMode="decimal" value={campos.perdaPercentual} placeholder="0" onChange={(e) => alterar({ perdaPercentual: e.target.value })} />
        </label>
        <label>
          Perdas: comprimento (cm)
          <input type="text" inputMode="decimal" value={campos.perdaCm} placeholder="0" onChange={(e) => alterar({ perdaCm: e.target.value })} />
        </label>
        <label className="opcao-em-linha">
          <input type="checkbox" checked={campos.corDoTecido !== ''} onChange={(e) => alterar({ corDoTecido: e.target.checked ? '#cfe2ff' : '' })} />
          Cor do tecido nas peças
          {campos.corDoTecido !== '' && <input type="color" aria-label="Cor do tecido" value={campos.corDoTecido} onChange={(e) => alterar({ corDoTecido: e.target.value })} />}
        </label>
        <label className="opcao-em-linha">
          <input type="checkbox" checked={campos.mostraPadronagem} onChange={(e) => alterar({ mostraPadronagem: e.target.checked })} />
          Mostra padronagem
        </label>
        {campos.mostraPadronagem && (
          <>
            <label>
              Padrão (imagem da estampa, até 2 MB)
              <input type="file" accept="image/*" onChange={(e) => lerPadrao(e.target.files?.[0])} />
            </label>
            <label>
              Comprimento do padrão (mm)
              <input type="number" min={1} value={campos.comprimentoDaPadronagemMm} onChange={(e) => alterar({ comprimentoDaPadronagemMm: e.target.value })} />
            </label>
            {erroDoPadrao && (
              <p className="mensagem-de-erro" role="alert">
                {erroDoPadrao}
              </p>
            )}
          </>
        )}
        <label>
          Margem lateral (mm, a partir de {MARGEM_DE_SEGURANCA_DA_MESA_MM})
          <input
            type="number"
            min={MARGEM_DE_SEGURANCA_DA_MESA_MM}
            value={campos.margemLateralMm}
            onChange={(e) => alterar({ margemLateralMm: e.target.value })}
          />
        </label>
        <label>
          Margem de extremidade (mm, a partir de {MARGEM_DE_SEGURANCA_DA_MESA_MM})
          <input
            type="number"
            min={MARGEM_DE_SEGURANCA_DA_MESA_MM}
            value={campos.margemDeExtremidadeMm}
            onChange={(e) => alterar({ margemDeExtremidadeMm: e.target.value })}
          />
        </label>
        <label>
          Distância entre os moldes (mm), de linha de corte a linha de corte
          <input
            type="number"
            min={0}
            value={campos.distanciaMinimaEntrePecasMm}
            onChange={(e) => alterar({ distanciaMinimaEntrePecasMm: e.target.value })}
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

        <div className="rodape-do-formulario">
          {erro && <p className="mensagem-de-erro">{erro}</p>}
          <div className="acoes-da-sobreposicao">
            <button type="button" onClick={props.onFechar}>
              Cancelar
            </button>
            <button
              type="button"
              title="A largura, o comprimento, o tipo, as margens e a distância viram o começo de todo enfesto novo, neste computador"
              onClick={() => {
                const { tipo, larguraUtilMm, comprimentoMm, margemLateralMm, margemDeExtremidadeMm, distanciaMinimaEntrePecasMm, linhas } = campos;
                try {
                  window.localStorage.setItem(CHAVE_DO_PADRAO_DO_ENFESTO, JSON.stringify({ tipo, larguraUtilMm, comprimentoMm, margemLateralMm, margemDeExtremidadeMm, distanciaMinimaEntrePecasMm, linhas }));
                } catch {
                  // Sem o armazenamento do navegador, não há o que guardar.
                }
              }}
            >
              Usar como padrão
            </button>
            <button type="button" onClick={salvar} className="botao-primario">
              Salvar enfesto
            </button>
          </div>
        </div>
      </form>
    </Sobreposicao>
  );
}
