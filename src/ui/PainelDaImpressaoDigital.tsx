import { useEffect, useRef, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { CampoDeNumero } from './CampoDeNumero';
import type { Molde } from '../domain/molde';
import { linhaDeCorteDaPeca } from '../domain/molde';
import { retanguloEnvolvente } from '../core/geometria';
import { numeroComVirgula } from '../core/numeros';
import { colocacaoNaPeca, compor, estampaDaPeca, trechosDoComprimento, type EstampaNoEncaixe, type ImpressaoDigital, type Matriz } from '../domain/impressaoDigital';

/** Uma imagem que pode virar estampa (das imagens do modelo ou do painel de inspiração). */
export interface ImagemDeEstampa {
  readonly id: string;
  readonly nome: string;
  readonly dados: string;
  readonly larguraPx: number;
  readonly alturaPx: number;
}

const COMO_TODAS = '__como-todas__';
const SEM_ESTAMPA = '__sem__';
/** Do mundo para a prévia (como a tela: o comprimento na horizontal, a largura descendo). */
const MUNDO_PARA_PREVIA: Matriz = [0, 1, 1, 0, 0, 0];
const matrizSvg = (m: Matriz): string => `matrix(${m.map((v) => +v.toFixed(6)).join(' ')})`;

/**
 * A estampa no encaixe (ADR 0113): cada molde do encaixe preenchido com a imagem, para imprimir o tecido já com a
 * estampa no lugar de cada peça (sublimação, impressão digital). A prévia mostra o tecido como a tela; o PDF sai na
 * escala 1:1, uma página por trecho de até 5 m. A configuração fica no projeto.
 */
export function PainelDaImpressaoDigital(props: {
  readonly pecas: readonly Molde[];
  /** A largura útil e o comprimento usado do encaixe (mm); `null`: a mesa não está configurada. */
  readonly mesa: { readonly larguraMm: number; readonly comprimentoMm: number } | null;
  readonly imagens: readonly ImagemDeEstampa[];
  readonly config: ImpressaoDigital;
  readonly onGuardar: (config: ImpressaoDigital) => void;
  readonly onExportar: (config: ImpressaoDigital) => Promise<string | null>;
  readonly onFechar: () => void;
}): React.JSX.Element {
  const [config, setConfig] = useState(props.config);
  const guardadaRef = useRef(props.config);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const { onGuardar } = props;
  useEffect(() => {
    if (config === guardadaRef.current) return;
    const t = setTimeout(() => {
      guardadaRef.current = config;
      onGuardar(config);
    }, 500);
    return () => clearTimeout(t);
  }, [config, onGuardar]);
  const fechar = (): void => {
    if (config !== guardadaRef.current) props.onGuardar(config);
    props.onFechar();
  };

  const imagem = (id: string): ImagemDeEstampa | undefined => props.imagens.find((i) => i.id === id);
  const novaEstampa = (id: string, base: EstampaNoEncaixe | null): EstampaNoEncaixe => ({ imagemId: id, modo: base?.modo ?? 'corrida', larguraMm: base?.larguraMm ?? 200, alturaMm: base?.alturaMm ?? 0 });
  const comEstampa = props.pecas.filter((p) => {
    const e = estampaDaPeca(config, p.id);
    return e !== null && imagem(e.imagemId) !== undefined;
  }).length;
  const paginas = props.mesa ? trechosDoComprimento(props.mesa.comprimentoMm).length : 0;

  return (
    <Sobreposicao titulo="Estampa no encaixe" onFechar={fechar}>
      <div className="painel-da-impressao">
        {props.mesa === null ? (
          <p className="faixa-da-ficha-fechada">Configure a mesa (Encaixe › Configuração › Enfesto) para ter a largura do tecido.</p>
        ) : (
          <>
            <Previa pecas={props.pecas} mesa={props.mesa} config={config} imagem={imagem} />
            <p className="resumo-da-impressao" role="status">
              {comEstampa} de {props.pecas.length} peça(s) com estampa · tecido de {numeroComVirgula(props.mesa.larguraMm, 0)} mm × {numeroComVirgula(props.mesa.comprimentoMm, 0)} mm · {paginas} página(s) de até 5 m, na escala
              1:1
            </p>
          </>
        )}
        {props.imagens.length === 0 && <p className="faixa-do-custo-parcial">Sem imagens: traga a estampa em Modelo › Imagens ou no painel de inspiração (Modelo › Criação).</p>}
        <div className="controles-da-impressao">
          <fieldset className="estampa-de-todas">
            <legend>A estampa de todas as peças</legend>
            <CamposDaEstampa
              rotulo="todas as peças"
              estampa={config.padrao}
              imagens={props.imagens}
              semValor="Nenhuma"
              onEscolher={(id) => setConfig((c) => ({ ...c, padrao: id === null ? null : novaEstampa(id, c.padrao) }))}
              onMudar={(e) => setConfig((c) => ({ ...c, padrao: e }))}
            />
            <label>
              Sangria (mm)
              <CampoDeNumero rotulo="Sangria" valor={config.sangriaMm} casas={0} onMudar={(v) => v !== null && v <= 30 && setConfig((c) => ({ ...c, sangriaMm: v }))} />
            </label>
            <label className="opcao-em-linha">
              <input type="checkbox" checked={config.linhaDeCorte} onChange={(e) => setConfig((c) => ({ ...c, linhaDeCorte: e.target.checked }))} />
              Imprimir a linha de corte (traço fino)
            </label>
          </fieldset>
          <div className="estampa-por-peca">
            <h4>Cada peça</h4>
            <table className="tabela-de-relatorio tabela-da-ficha">
              <thead>
                <tr>
                  <th scope="col">Peça</th>
                  <th scope="col">Estampa</th>
                  <th scope="col">Como</th>
                  <th scope="col">Largura (mm)</th>
                </tr>
              </thead>
              <tbody>
                {props.pecas.map((p) => {
                  const propria = p.id in config.porPeca;
                  const e = config.porPeca[p.id];
                  const valor = !propria ? COMO_TODAS : e === null || e === undefined ? SEM_ESTAMPA : e.imagemId;
                  return (
                    <tr key={p.id}>
                      <td>{p.nome}</td>
                      <td>
                        <select
                          aria-label={`Estampa de ${p.nome}`}
                          value={valor}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            setConfig((c) => {
                              const porPeca = { ...c.porPeca };
                              if (v === COMO_TODAS) delete porPeca[p.id];
                              else porPeca[p.id] = v === SEM_ESTAMPA ? null : novaEstampa(v, c.porPeca[p.id] ?? c.padrao);
                              return { ...c, porPeca };
                            });
                          }}
                        >
                          <option value={COMO_TODAS}>Como todas</option>
                          <option value={SEM_ESTAMPA}>Sem estampa</option>
                          {props.imagens.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {propria && e ? (
                          <select aria-label={`Como vai a estampa de ${p.nome}`} value={e.modo} onChange={(ev) => setConfig((c) => ({ ...c, porPeca: { ...c.porPeca, [p.id]: { ...e, modo: ev.target.value === 'localizada' ? 'localizada' : 'corrida' } } }))}>
                            <option value="corrida">Corrida</option>
                            <option value="localizada">Localizada</option>
                          </select>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {propria && e ? (
                          <CampoDeNumero rotulo={`Largura da estampa de ${p.nome}`} valor={e.larguraMm} casas={0} className="campo-curto" onMudar={(v) => v !== null && v >= 5 && setConfig((c) => ({ ...c, porPeca: { ...c.porPeca, [p.id]: { ...e, larguraMm: v } } }))} />
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {mensagem && (
          <p className="nota-do-formulario" role="alert">
            {mensagem}
          </p>
        )}
        <p className="acoes-da-fila">
          <button
            type="button"
            className="botao-primario"
            disabled={props.mesa === null || comEstampa === 0 || exportando}
            onClick={async () => {
              setExportando(true);
              try {
                const caminho = await props.onExportar(config);
                if (caminho) setMensagem(`PDF para impressão salvo em ${caminho}`);
              } catch (e) {
                setMensagem(`Falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}`);
              } finally {
                setExportando(false);
              }
            }}
          >
            {exportando ? 'Gerando o PDF…' : 'Exportar PDF para impressão (1:1)'}
          </button>
          <small>Só a área das peças leva tinta; a estampa fica de pé no fio de cada peça.</small>
        </p>
      </div>
    </Sobreposicao>
  );
}

function CamposDaEstampa(props: {
  readonly rotulo: string;
  readonly estampa: EstampaNoEncaixe | null;
  readonly imagens: readonly ImagemDeEstampa[];
  readonly semValor: string;
  readonly onEscolher: (id: string | null) => void;
  readonly onMudar: (e: EstampaNoEncaixe) => void;
}): React.JSX.Element {
  const e = props.estampa;
  return (
    <>
      <label>
        Imagem
        <select aria-label={`Imagem de ${props.rotulo}`} value={e?.imagemId ?? ''} onChange={(ev) => props.onEscolher(ev.target.value === '' ? null : ev.target.value)}>
          <option value="">{props.semValor}</option>
          {props.imagens.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
      </label>
      {e && (
        <>
          <label>
            Como
            <select aria-label={`Como vai a estampa de ${props.rotulo}`} value={e.modo} onChange={(ev) => props.onMudar({ ...e, modo: ev.target.value === 'localizada' ? 'localizada' : 'corrida' })}>
              <option value="corrida">Corrida (repete pela peça)</option>
              <option value="localizada">Localizada (uma vez, no meio)</option>
            </select>
          </label>
          <label>
            Largura da imagem (mm)
            <CampoDeNumero rotulo={`Largura da estampa de ${props.rotulo}`} valor={e.larguraMm} casas={0} onMudar={(v) => v !== null && v >= 5 && props.onMudar({ ...e, larguraMm: v })} />
          </label>
          {e.modo === 'localizada' && (
            <label>
              Sobe (mm)
              <input type="number" step={10} aria-label={`Altura da estampa de ${props.rotulo}`} value={e.alturaMm} onChange={(ev) => props.onMudar({ ...e, alturaMm: Number(ev.target.value) || 0 })} />
            </label>
          )}
        </>
      )}
    </>
  );
}

/** A prévia do tecido: as peças no lugar do encaixe, cada uma com a estampa (como sai na impressão). */
function Previa(props: {
  readonly pecas: readonly Molde[];
  readonly mesa: { readonly larguraMm: number; readonly comprimentoMm: number };
  readonly config: ImpressaoDigital;
  readonly imagem: (id: string) => ImagemDeEstampa | undefined;
}): React.JSX.Element {
  const { mesa } = props;
  return (
    <svg className="previa-da-impressao" viewBox={`0 0 ${mesa.comprimentoMm} ${mesa.larguraMm}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Prévia do tecido estampado">
      <rect x={0} y={0} width={mesa.comprimentoMm} height={mesa.larguraMm} fill="#ffffff" stroke="#9aa3ae" strokeWidth={2} />
      {props.pecas.map((p, k) => {
        const corte = linhaDeCorteDaPeca(p);
        if (corte.length < 3) return null;
        const pontos = corte.map((q) => `${q.y},${q.x}`).join(' ');
        const e = estampaDaPeca(props.config, p.id);
        const img = e ? props.imagem(e.imagemId) : undefined;
        const caixa = retanguloEnvolvente(corte);
        const rotulo = (
          <text x={(caixa.minY + caixa.maxY) / 2} y={(caixa.minX + caixa.maxX) / 2} fontSize={Math.max(14, mesa.larguraMm / 40)} textAnchor="middle" className="nome-na-previa">
            {p.nome}
          </text>
        );
        if (!e || !img) {
          return (
            <g key={p.id}>
              <polygon points={pontos} fill="#eef0f3" stroke="#7f8894" strokeWidth={1.5} strokeDasharray="6 4" />
              {rotulo}
            </g>
          );
        }
        const c = colocacaoNaPeca(p, e, img.larguraPx, img.alturaPx, props.config.sangriaMm);
        const m = compor(MUNDO_PARA_PREVIA, c.imagemParaMundo);
        const id = `estampa-${k}`;
        return (
          <g key={p.id}>
            <defs>
              {e.modo === 'corrida' ? (
                <pattern id={id} patternUnits="userSpaceOnUse" width={img.larguraPx} height={img.alturaPx} patternTransform={matrizSvg(m)}>
                  <image href={img.dados} width={img.larguraPx} height={img.alturaPx} />
                </pattern>
              ) : (
                <clipPath id={id}>
                  <polygon points={pontos} />
                </clipPath>
              )}
            </defs>
            {e.modo === 'corrida' ? (
              <polygon points={pontos} fill={`url(#${id})`} />
            ) : (
              <g clipPath={`url(#${id})`}>
                <polygon points={pontos} fill="#ffffff" />
                <image href={img.dados} width={img.larguraPx} height={img.alturaPx} transform={matrizSvg(m)} />
              </g>
            )}
            <polygon points={pontos} fill="none" stroke="#1b3866" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}
