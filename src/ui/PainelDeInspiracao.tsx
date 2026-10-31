import { useEffect, useRef, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import {
  alternarCorDaPaleta,
  MAXIMO_DE_ITENS_DE_INSPIRACAO,
  mudarItemDeInspiracao,
  nomeDaCor,
  pedidoParaIa,
  type ModeloVirtual,
  removerItemDeInspiracao,
  ROTULO_DA_CATEGORIA_DA_INSPIRACAO,
  TIPOS_DE_GERACAO,
  type CategoriaDaInspiracao,
  type ContextoDoPedido,
  type ItemDeInspiracao,
  type PainelDeInspiracao as Painel,
  type TipoDeGeracao,
} from '../domain/inspiracao';
import { recortarPng } from './imagensDaInspiracao';

const PROPORCOES_DA_LOJA = [
  [1, 1],
  [3, 4],
  [9, 16],
] as const;
import { MODELO_PADRAO, MODELOS_DE_IMAGEM, problemasDoPedido, type FormatoDaImagem, type PedidoDeImagem, type ReferenciaParaIa, type RespostaDaIa } from '../domain/servicoDeIa';
import type { ImagemParaInspiracao } from './imagensDaInspiracao';

export type ParteDaInspiracao = 'painel' | 'ia';

/** O estado do serviço de IA como a tela o vê (nunca a chave). */
export interface EstadoDoServicoDeIa {
  readonly configurado: boolean;
  readonly servico: string;
  readonly modelo: string;
  readonly cofreDisponivel: boolean;
  readonly guardadaEmIso: string | null;
  readonly chaveIlegivel: boolean;
}

/** O que a janela precisa do serviço (no programa instalado; no navegador, não há). */
export interface AcessoAoServicoDeIa {
  readonly estado: () => Promise<EstadoDoServicoDeIa>;
  readonly guardarChave: (chave: string, modelo: string) => Promise<string | null>;
  readonly mudarModelo: (modelo: string) => Promise<string | null>;
  readonly esquecerChave: () => Promise<boolean>;
  readonly gerar: (pedido: PedidoDeImagem) => Promise<RespostaDaIa & { readonly modelo?: string }>;
}

interface ImagemGerada {
  readonly id: string;
  readonly base64: string;
  readonly pedido: string;
  readonly modelo: string;
  readonly geradoEmIso: string;
  readonly noPainel: boolean;
}

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * O painel de inspiração e a criação com IA (ADR 0112). O painel (as imagens por categoria, as notas, as cores, o
 * conceito, a paleta) é todo local e fica no projeto. A IA só funciona com o serviço e a chave de quem usa: sem isso,
 * a janela diz que não está configurada e nada sai do computador. O que a IA faz é rascunho.
 */
export function PainelDeInspiracao(props: {
  readonly painel: Painel;
  readonly parteInicial?: ParteDaInspiracao;
  readonly contexto: Omit<ContextoDoPedido, 'referencias'>;
  /** O desenho técnico da ficha em PNG (base64), quando há; `null`: não há desenho. */
  readonly desenhoComoPng: (() => Promise<string>) | null;
  readonly lerImagem: (arquivo: File) => Promise<ImagemParaInspiracao>;
  readonly reduzirImagem: (dados: string, nome: string) => Promise<ImagemParaInspiracao>;
  /** O serviço de IA; `null` fora do programa instalado. */
  readonly servico: AcessoAoServicoDeIa | null;
  readonly onGuardar: (painel: Painel) => void;
  readonly onSalvarArquivo: (nome: string, bytes: ArrayBuffer) => Promise<string | null>;
  readonly novoId: () => string;
  readonly agoraIso: () => string;
  readonly onFechar: () => void;
}): React.JSX.Element {
  const [painel, setPainel] = useState(props.painel);
  const guardadoRef = useRef(props.painel);
  const [parte, setParte] = useState<ParteDaInspiracao>(props.parteInicial ?? 'painel');
  const [mensagem, setMensagem] = useState<string | null>(null);

  const { onGuardar } = props;
  useEffect(() => {
    if (painel === guardadoRef.current) return;
    const t = setTimeout(() => {
      guardadoRef.current = painel;
      onGuardar(painel);
    }, 500);
    return () => clearTimeout(t);
  }, [painel, onGuardar]);
  const fechar = (): void => {
    if (painel !== guardadoRef.current) props.onGuardar(painel);
    props.onFechar();
  };
  const mudar = (fazer: (p: Painel) => Painel): void => {
    try {
      setPainel(fazer(painel));
      setMensagem(null);
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
    }
  };
  /** Põe imagens prontas no painel (as dos arquivos, ou a da IA como rascunho), até o painel encher. */
  const porNoPainel = (imagens: readonly ImagemParaInspiracao[], extra: Partial<ItemDeInspiracao> = {}): boolean => {
    if (painel.itens.length >= MAXIMO_DE_ITENS_DE_INSPIRACAO) {
      setMensagem(`O painel já tem ${MAXIMO_DE_ITENS_DE_INSPIRACAO} imagens: tire uma antes de pôr outra.`);
      return false;
    }
    const itens = imagens.map(
      (imagem): ItemDeInspiracao => ({
        id: props.novoId(),
        categoria: 'outro',
        nome: imagem.nome,
        dados: imagem.dados,
        larguraPx: imagem.larguraPx,
        alturaPx: imagem.alturaPx,
        nota: '',
        cores: imagem.cores,
        criadoEmIso: props.agoraIso(),
        ...extra,
      }),
    );
    // Pelo painel mais novo (outra imagem pode ter entrado enquanto esta carregava), sem passar do máximo.
    setPainel((p) => ({ ...p, itens: [...p.itens, ...itens].slice(0, MAXIMO_DE_ITENS_DE_INSPIRACAO) }));
    return true;
  };

  return (
    <Sobreposicao titulo="Inspiração e IA" onFechar={fechar}>
      <div className="painel-de-inspiracao">
        <div className="partes-da-sala-de-corte" role="tablist" aria-label="Partes da inspiração">
          {(
            [
              ['painel', `Painel de inspiração (${painel.itens.length})`],
              ['ia', 'Criar com IA'],
            ] as const
          ).map(([id, rotulo]) => (
            <button key={id} type="button" role="tab" aria-selected={parte === id} className={parte === id ? 'item-selecionado' : undefined} onClick={() => setParte(id)}>
              {rotulo}
            </button>
          ))}
        </div>
        {mensagem && (
          <p className="nota-do-formulario" role="alert">
            {mensagem}
          </p>
        )}
        {parte === 'painel' ? (
          <PartePainel
            painel={painel}
            mudar={mudar}
            onArquivos={async (arquivos) => {
              const cabem = MAXIMO_DE_ITENS_DE_INSPIRACAO - painel.itens.length;
              const erros: string[] = arquivos.length > cabem ? [`Cabem mais ${cabem} imagem(ns) no painel: as outras ficaram de fora.`] : [];
              const lidas: ImagemParaInspiracao[] = [];
              for (const f of arquivos.slice(0, cabem)) {
                try {
                  lidas.push(await props.lerImagem(f));
                } catch (e) {
                  erros.push(e instanceof Error ? e.message : String(e));
                }
              }
              if (lidas.length > 0) porNoPainel(lidas);
              if (erros.length > 0) setMensagem(erros.join(' '));
            }}
          />
        ) : (
          <ParteIa
            painel={painel}
            contexto={props.contexto}
            desenhoComoPng={props.desenhoComoPng}
            servico={props.servico}
            novoId={props.novoId}
            agoraIso={props.agoraIso}
            onSalvarArquivo={props.onSalvarArquivo}
            onPorNoPainel={async (g) => {
              const imagem = await props.reduzirImagem(`data:image/png;base64,${g.base64}`, `Rascunho da IA ${DATA.format(new Date(g.geradoEmIso))}`);
              return porNoPainel([imagem], { rascunhoDaIa: { servico: 'IA', modelo: g.modelo, pedido: g.pedido, geradoEmIso: g.geradoEmIso } });
            }}
          />
        )}
      </div>
    </Sobreposicao>
  );
}

// ---- O painel

function PartePainel(props: { readonly painel: Painel; readonly mudar: (f: (p: Painel) => Painel) => void; readonly onArquivos: (arquivos: File[]) => Promise<void> }): React.JSX.Element {
  const { painel } = props;
  const [filtro, setFiltro] = useState<CategoriaDaInspiracao | 'todas'>('todas');
  const arquivoRef = useRef<HTMLInputElement>(null);
  const coresDasImagens = [...new Set(painel.itens.flatMap((i) => i.cores))].filter((c) => !painel.paleta.includes(c)).slice(0, 24);
  const visiveis = painel.itens.filter((i) => filtro === 'todas' || i.categoria === filtro);
  return (
    <section aria-label="Painel de inspiração" className="secao-da-inspiracao">
      <label className="conceito-da-inspiracao">
        Conceito do modelo (o público, a ocasião, o clima)
        <textarea rows={2} value={painel.conceito} onChange={(e) => props.mudar((p) => ({ ...p, conceito: e.target.value }))} placeholder="Ex.: verão urbano, leve, para trabalhar e sair à noite" />
      </label>
      <div className="paleta-da-inspiracao">
        <strong>Paleta do modelo</strong>
        <div className="amostras" role="list" aria-label="Paleta do modelo">
          {painel.paleta.length === 0 && <small>Clique nas cores das imagens para montar a paleta.</small>}
          {painel.paleta.map((c) => (
            <button key={c} type="button" role="listitem" className="amostra-de-cor amostra-escolhida" style={{ background: c }} title={`${nomeDaCor(c)} (${c}) — clique para tirar`} aria-label={`Tirar ${nomeDaCor(c)} da paleta`} onClick={() => props.mudar((p) => alternarCorDaPaleta(p, c))} />
          ))}
        </div>
        {coresDasImagens.length > 0 && (
          <>
            <small>Das imagens:</small>
            <div className="amostras">
              {coresDasImagens.map((c) => (
                <button key={c} type="button" className="amostra-de-cor" style={{ background: c }} title={`${nomeDaCor(c)} (${c}) — clique para pôr na paleta`} aria-label={`Pôr ${nomeDaCor(c)} (${c}) na paleta`} onClick={() => props.mudar((p) => alternarCorDaPaleta(p, c))} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="barra-da-inspiracao">
        <div className="filtros-da-inspiracao" role="group" aria-label="Categorias">
          {(['todas', ...Object.keys(ROTULO_DA_CATEGORIA_DA_INSPIRACAO)] as (CategoriaDaInspiracao | 'todas')[]).map((c) => (
            <button key={c} type="button" className={filtro === c ? 'item-selecionado' : undefined} aria-pressed={filtro === c} onClick={() => setFiltro(c)}>
              {c === 'todas' ? 'Todas' : ROTULO_DA_CATEGORIA_DA_INSPIRACAO[c]} ({c === 'todas' ? painel.itens.length : painel.itens.filter((i) => i.categoria === c).length})
            </button>
          ))}
        </div>
        <button type="button" className="botao-primario" disabled={painel.itens.length >= MAXIMO_DE_ITENS_DE_INSPIRACAO} onClick={() => arquivoRef.current?.click()}>
          Trazer imagens…
        </button>
        <input
          ref={arquivoRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Arquivos de imagem da inspiração"
          onChange={(e) => {
            const arquivos = [...(e.target.files ?? [])];
            e.target.value = '';
            void props.onArquivos(arquivos);
          }}
        />
      </div>
      {painel.itens.length === 0 ? (
        <p className="nota-do-formulario">O painel está vazio. Traga fotos de modelagem, tecido, cor, aviamento e estampa (até {MAXIMO_DE_ITENS_DE_INSPIRACAO}).</p>
      ) : (
        <div className="grade-da-inspiracao">
          {visiveis.map((i) => (
            <figure key={i.id} className={`cartao-da-inspiracao categoria-${i.categoria}`}>
              <div className="imagem-da-inspiracao">
                <img src={i.dados} alt={i.nome || 'Imagem de inspiração'} />
                {i.rascunhoDaIa && <span className="selo-de-rascunho">Rascunho da IA</span>}
              </div>
              <figcaption>
                <select aria-label={`Categoria de ${i.nome}`} value={i.categoria} onChange={(e) => props.mudar((p) => mudarItemDeInspiracao(p, i.id, { categoria: e.target.value as CategoriaDaInspiracao }))}>
                  {(Object.keys(ROTULO_DA_CATEGORIA_DA_INSPIRACAO) as CategoriaDaInspiracao[]).map((c) => (
                    <option key={c} value={c}>
                      {ROTULO_DA_CATEGORIA_DA_INSPIRACAO[c]}
                    </option>
                  ))}
                </select>
                <input aria-label={`Nome de ${i.nome}`} value={i.nome} onChange={(e) => props.mudar((p) => mudarItemDeInspiracao(p, i.id, { nome: e.target.value }))} />
                <textarea rows={2} aria-label={`Nota de ${i.nome}`} placeholder="O que interessa nesta imagem" value={i.nota} onChange={(e) => props.mudar((p) => mudarItemDeInspiracao(p, i.id, { nota: e.target.value }))} />
                <div className="amostras pequenas">
                  {i.cores.map((c) => (
                    <span key={c} className="amostra-de-cor" style={{ background: c }} title={`${nomeDaCor(c)} (${c})`} />
                  ))}
                </div>
                {i.rascunhoDaIa && <small title={i.rascunhoDaIa.pedido}>Feita por {i.rascunhoDaIa.modelo} em {i.rascunhoDaIa.geradoEmIso ? DATA.format(new Date(i.rascunhoDaIa.geradoEmIso)) : '—'}</small>}
                <button type="button" onClick={() => props.mudar((p) => removerItemDeInspiracao(p, i.id))}>
                  Tirar
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- A IA

function ParteIa(props: {
  readonly painel: Painel;
  readonly contexto: Omit<ContextoDoPedido, 'referencias'>;
  readonly desenhoComoPng: (() => Promise<string>) | null;
  readonly servico: AcessoAoServicoDeIa | null;
  readonly novoId: () => string;
  readonly agoraIso: () => string;
  readonly onSalvarArquivo: (nome: string, bytes: ArrayBuffer) => Promise<string | null>;
  readonly onPorNoPainel: (g: ImagemGerada) => Promise<boolean>;
}): React.JSX.Element {
  const { servico, painel } = props;
  const [estado, setEstado] = useState<EstadoDoServicoDeIa | null>(null);
  const [configurando, setConfigurando] = useState(false);
  const [chave, setChave] = useState('');
  const [modelo, setModelo] = useState(MODELO_PADRAO);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoDeGeracao>('peca');
  const [referencias, setReferencias] = useState<ReadonlySet<string>>(new Set());
  const [quantidade, setQuantidade] = useState(2);
  const [formato, setFormato] = useState<FormatoDaImagem>('retrato');
  const [pedido, setPedido] = useState(() => pedidoParaIa('peca', painel, { ...props.contexto, referencias: 0 }));
  const [gerando, setGerando] = useState(false);
  const [geradas, setGeradas] = useState<ImagemGerada[]>([]);
  const [modeloVirtual, setModeloVirtual] = useState<ModeloVirtual>({});
  const usarDesenho = referencias.has('desenho');
  const quantasReferencias = referencias.size;

  useEffect(() => {
    if (!servico) return;
    let vivo = true;
    void servico.estado().then((e) => {
      if (!vivo) return;
      setEstado(e);
      setModelo(e.modelo);
      setConfigurando(!e.configurado);
    });
    return () => {
      vivo = false;
    };
  }, [servico]);

  const refazerPedido = (t: TipoDeGeracao, n: number): void => setPedido(pedidoParaIa(t, painel, { ...props.contexto, referencias: n }));
  const alternarReferencia = (id: string): void => {
    const nova = new Set(referencias);
    if (nova.has(id)) nova.delete(id);
    else nova.add(id);
    setReferencias(nova);
    refazerPedido(tipo, nova.size);
  };

  const guardar = async (): Promise<void> => {
    if (!servico) return;
    const erro = await servico.guardarChave(chave, modelo);
    if (erro) {
      setAviso(erro);
      return;
    }
    setChave('');
    setAviso('A chave foi guardada, cifrada, neste computador.');
    setEstado(await servico.estado());
    setConfigurando(false);
  };

  const precisaDeReferencia = TIPOS_DE_GERACAO[tipo].precisaDeReferencia && quantasReferencias === 0;
  const gerar = async (): Promise<void> => {
    if (!servico) return;
    setGerando(true);
    setAviso(null);
    try {
      const refs: ReferenciaParaIa[] = [];
      if (usarDesenho && props.desenhoComoPng) refs.push({ nome: 'desenho-tecnico.png', base64: await props.desenhoComoPng(), tipo: 'image/png' });
      for (const item of painel.itens) {
        if (!referencias.has(item.id)) continue;
        const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(item.dados);
        if (m) refs.push({ nome: item.nome || item.id, base64: m[2]!, tipo: m[1] as ReferenciaParaIa['tipo'] });
      }
      const p: PedidoDeImagem = { pedido, quantidade, formato, referencias: refs };
      const problemas = problemasDoPedido(p);
      if (problemas.length > 0) {
        setAviso(problemas.join(' '));
        return;
      }
      const r = await servico.gerar(p);
      if (!r.ok) {
        setAviso(r.erro);
        return;
      }
      const quando = props.agoraIso();
      setGeradas((g) => [...r.imagens.map((b) => ({ id: props.novoId(), base64: b, pedido, modelo: r.modelo ?? modelo, geradoEmIso: quando, noPainel: false })), ...g]);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      setGerando(false);
    }
  };

  if (!servico) {
    return (
      <section aria-label="Criar com IA" className="secao-da-inspiracao">
        <p className="faixa-da-ficha-fechada">A criação com IA só funciona no programa instalado (a chave fica guardada no cofre do computador).</p>
      </section>
    );
  }
  const configurado = estado?.configurado === true;
  return (
    <section aria-label="Criar com IA" className="secao-da-inspiracao">
      <div className={`cartao-do-servico ${configurado ? 'servico-configurado' : 'servico-sem-chave'}`} role="status">
        <div>
          <strong>{estado === null ? 'Conferindo o serviço…' : configurado ? `IA configurada: ${estado.servico}` : 'IA não configurada'}</strong>
          <p>
            {estado === null
              ? ''
              : configurado
                ? `Modelo ${estado.modelo}. A chave está guardada, cifrada, neste computador${estado.guardadaEmIso ? ` (desde ${DATA.format(new Date(estado.guardadaEmIso))})` : ''}.`
                : estado.chaveIlegivel
                  ? 'A chave guardada não abre nesta conta ou neste computador: ponha a chave de novo.'
                  : 'Para criar imagens, ponha a chave da sua conta no serviço de imagens. Sem chave, nada sai deste computador.'}
          </p>
        </div>
        <div className="acoes-da-fila">
          <button type="button" onClick={() => setConfigurando((c) => !c)}>
            {configurando ? 'Fechar' : configurado ? 'Trocar a chave ou o modelo' : 'Configurar…'}
          </button>
          {configurado && (
            <button
              type="button"
              onClick={async () => {
                await servico.esquecerChave();
                setEstado(await servico.estado());
                setAviso('A chave foi apagada deste computador.');
              }}
            >
              Esquecer a chave
            </button>
          )}
        </div>
      </div>
      {configurando && (
        <form
          className="formulario-de-sobreposicao configuracao-da-ia"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <p className="nota-do-formulario">
            O serviço é o de imagens da OpenAI: a conta e a chave são suas, e cada pedido é cobrado na sua conta. A chave fica cifrada pelo cofre do sistema (só esta conta deste computador a abre) e só é
            usada quando você clicar em Gerar. O pedido e as imagens marcadas como referência vão ao serviço.
          </p>
          <label>
            Chave do serviço
            <input type="password" autoComplete="off" spellCheck={false} value={chave} onChange={(e) => setChave(e.target.value)} placeholder={configurado ? 'Deixe em branco para manter a chave' : 'sk-…'} />
          </label>
          <label>
            Modelo de imagem
            <select value={MODELOS_DE_IMAGEM.some((m) => m.id === modelo) ? modelo : 'outro'} onChange={(e) => setModelo(e.target.value === 'outro' ? '' : e.target.value)}>
              {MODELOS_DE_IMAGEM.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
              <option value="outro">Outro (digitar)</option>
            </select>
          </label>
          {!MODELOS_DE_IMAGEM.some((m) => m.id === modelo) && (
            <label>
              Nome do modelo
              <input value={modelo} onChange={(e) => setModelo(e.target.value)} />
            </label>
          )}
          <p className="acoes-da-fila">
            {chave.trim() !== '' || !configurado ? (
              <button type="submit" className="botao-primario">
                Guardar a chave
              </button>
            ) : (
              <button
                type="button"
                className="botao-primario"
                onClick={async () => {
                  const erro = await servico.mudarModelo(modelo);
                  setAviso(erro ?? `O modelo agora é ${modelo}.`);
                  setEstado(await servico.estado());
                }}
              >
                Usar este modelo
              </button>
            )}
          </p>
          {estado && !estado.cofreDisponivel && <p className="faixa-do-custo-parcial">O cofre de senhas do sistema não está funcionando neste computador: a chave não pode ser guardada.</p>}
        </form>
      )}
      {aviso && (
        <p className="nota-do-formulario aviso-da-ia" role="alert">
          {aviso}
        </p>
      )}

      <div className="tipos-de-geracao" role="radiogroup" aria-label="O que criar">
        {(Object.keys(TIPOS_DE_GERACAO) as TipoDeGeracao[]).map((t) => (
          <label key={t} className={`tipo-de-geracao ${tipo === t ? 'tipo-escolhido' : ''}`}>
            <input
              type="radio"
              name="tipo-de-geracao"
              checked={tipo === t}
              onChange={() => {
                setTipo(t);
                refazerPedido(t, quantasReferencias);
              }}
            />
            <strong>{TIPOS_DE_GERACAO[t].nome}</strong>
            <small>{TIPOS_DE_GERACAO[t].explicacao}</small>
          </label>
        ))}
      </div>

      <fieldset className="referencias-da-ia">
        <legend>Imagens que vão como referência {TIPOS_DE_GERACAO[tipo].precisaDeReferencia ? '(escolha ao menos uma)' : '(opcional)'}</legend>
        {props.desenhoComoPng && (
          <label className="referencia-da-ia">
            <input type="checkbox" checked={usarDesenho} onChange={() => alternarReferencia('desenho')} />
            <span className="miniatura-do-desenho">Desenho técnico</span>
          </label>
        )}
        {painel.itens.map((i) => (
          <label key={i.id} className="referencia-da-ia" title={i.nome}>
            <input type="checkbox" aria-label={`Referência: ${i.nome}`} checked={referencias.has(i.id)} onChange={() => alternarReferencia(i.id)} />
            <img src={i.dados} alt="" />
          </label>
        ))}
        {!props.desenhoComoPng && painel.itens.length === 0 && <small>Sem imagens no painel e sem desenho técnico.</small>}
      </fieldset>

      <div className="opcoes-da-ia">
        <label>
          Quantas
          <select value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Formato
          <select value={formato} onChange={(e) => setFormato(e.target.value as FormatoDaImagem)}>
            <option value="retrato">Retrato (1024 × 1536)</option>
            <option value="quadrado">Quadrado (1024 × 1024)</option>
            <option value="paisagem">Paisagem (1536 × 1024)</option>
          </select>
        </label>
        <button type="button" onClick={() => refazerPedido(tipo, quantasReferencias)}>
          Refazer o pedido pelo painel
        </button>
      </div>
      <label className="pedido-da-ia">
        O pedido (pode mudar antes de mandar)
        <textarea rows={6} value={pedido} onChange={(e) => setPedido(e.target.value)} />
      </label>
      <p className="acoes-da-fila">
        <button type="button" className="botao-primario" disabled={!configurado || gerando || precisaDeReferencia} onClick={() => void gerar()}>
          {gerando ? 'Gerando… (pode levar um minuto)' : `Gerar ${quantidade} imagem(ns)`}
        </button>
        <small>{!configurado ? 'Configure o serviço primeiro.' : precisaDeReferencia ? 'Escolha a imagem de referência.' : 'Cada pedido é cobrado na sua conta do serviço.'}</small>
      </p>

      {tipo === 'foto' && (
        <fieldset className="grupo-de-opcoes-do-formulario">
          <legend>Modelo virtual</legend>
          {(
            [
              ['corpo', 'Corpo', 'magro, plus size'],
              ['idade', 'Idade', '30 anos'],
              ['cabelo', 'Cabelo', 'curto, cacheado'],
              ['pose', 'Pose', 'de frente, de lado'],
            ] as const
          ).map(([campo, rotulo, exemplo]) => (
            <label key={campo}>
              {rotulo}
              <input
                type="text"
                placeholder={exemplo}
                value={modeloVirtual[campo] ?? ''}
                onChange={(e) => {
                  const novo = { ...modeloVirtual, [campo]: e.target.value };
                  setModeloVirtual(novo);
                  setPedido(pedidoParaIa(tipo, painel, { ...props.contexto, referencias: quantasReferencias, modeloVirtual: novo }));
                }}
              />
            </label>
          ))}
        </fieldset>
      )}
      {geradas.length > 0 && (
        <div className="grade-da-inspiracao resultados-da-ia" aria-label="Imagens geradas">
          {geradas.map((g, k) => (
            <figure key={g.id} className="cartao-da-inspiracao">
              <div className="imagem-da-inspiracao">
                <img src={`data:image/png;base64,${g.base64}`} alt={`Imagem gerada ${k + 1}`} />
                <span className="selo-de-rascunho">Rascunho da IA</span>
              </div>
              <figcaption>
                <small>
                  {g.modelo} · {DATA.format(new Date(g.geradoEmIso))}
                </small>
                <button
                  type="button"
                  disabled={g.noPainel}
                  onClick={async () => {
                    if (await props.onPorNoPainel(g)) setGeradas((lista) => lista.map((x) => (x.id === g.id ? { ...x, noPainel: true } : x)));
                  }}
                >
                  {g.noPainel ? 'No painel (rascunho)' : 'Pôr no painel'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const binario = atob(g.base64);
                    const bytes = new Uint8Array(binario.length);
                    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
                    const caminho = await props.onSalvarArquivo(`rascunho-da-ia-${k + 1}.png`, bytes.buffer);
                    if (caminho) setAviso(`Imagem salva em ${caminho}`);
                  }}
                >
                  Salvar PNG
                </button>
                {PROPORCOES_DA_LOJA.map(([a, b]) => (
                  <button
                    key={`${a}:${b}`}
                    type="button"
                    title="Salva um recorte central nesta proporção, para a loja ou as redes"
                    onClick={async () => {
                      const buffer = await recortarPng(`data:image/png;base64,${g.base64}`, a, b);
                      const caminho = await props.onSalvarArquivo(`rascunho-da-ia-${k + 1}-${a}x${b}.png`, buffer);
                      if (caminho) setAviso(`Imagem salva em ${caminho}`);
                    }}
                  >
                    {a}:{b}
                  </button>
                ))}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
