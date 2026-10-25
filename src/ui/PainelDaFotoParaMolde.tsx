import { useEffect, useMemo, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { CampoDeNumero } from './CampoDeNumero';
import type { Ponto2D } from '../core/geometria';
import type { ImagemDoModelo } from '../domain/imagens';
import {
  escalaDaRetificada,
  escalarReconhecido,
  limiarDeOtsu,
  medidasDoContorno,
  reconhecerMolde,
  retificar,
  tonsDeCinza,
  type ImagemDePixels,
  type MoldeReconhecido,
  type Quadrilatero,
} from '../domain/digitalizacao';
import { numeroComVirgula } from '../core/numeros';

type Clique = 'semente' | 'fio' | 'medida';

const REFERENCIAS: ReadonlyArray<readonly [string, number, number]> = [
  ['Folha A4 (297 × 210 mm)', 297, 210],
  ['Folha A3 (420 × 297 mm)', 420, 297],
  ['Placa de corte A2 (600 × 450 mm)', 600, 450],
  ['Placa de corte A1 (900 × 600 mm)', 900, 600],
];
const NOMES_DOS_CANTOS = ['em cima à esquerda', 'em cima à direita', 'embaixo à direita', 'embaixo à esquerda'];

/** O ponto da imagem (em pixels) de um clique na tela, com a imagem encaixada no quadro (sem distorcer). */
function pontoNaImagem(svg: SVGSVGElement, largura: number, altura: number, clienteX: number, clienteY: number): Ponto2D {
  const r = svg.getBoundingClientRect();
  const escala = Math.min(r.width / largura, r.height / altura) || 1;
  const sobraX = (r.width - largura * escala) / 2;
  const sobraY = (r.height - altura * escala) / 2;
  return { x: (clienteX - r.left - sobraX) / escala, y: (clienteY - r.top - sobraY) / escala };
}

const mm = (v: number, casas = 1): string => `${numeroComVirgula(v, casas)} mm`;

/**
 * Molde da foto (ADR 0109): a foto do molde de papel sobre uma referência de medida conhecida (uma folha, uma placa de
 * corte) vira peça. Os quatro cantos da referência corrigem a perspectiva e dão a escala; o clique dentro do molde o
 * separa do fundo; o contorno, os furos, os piques e o fio saem sozinhos, para revisar (o limiar, a tolerância, o fio
 * marcado à mão) e conferir com uma medida conhecida antes de criar a peça.
 */
export function PainelDaFotoParaMolde(props: {
  readonly imagens: readonly ImagemDoModelo[];
  readonly onTrazerFoto: () => void;
  /** Cria a peça com o molde reconhecido (em mm, nas coordenadas da foto corrigida); devolve o erro, ou `null`. */
  readonly onCriarPeca: (dados: { readonly nome: string; readonly tamanho: string; readonly quantidade: number; readonly molde: MoldeReconhecido }) => string | null;
  readonly lerPixels: (dados: string) => Promise<ImagemDePixels>;
  readonly paraDataUrl: (imagem: ImagemDePixels) => string;
  readonly onFechar: () => void;
}): React.JSX.Element {
  const [imagemId, setImagemId] = useState(props.imagens.at(-1)?.id ?? '');
  const imagem = props.imagens.find((i) => i.id === imagemId) ?? null;
  const [foto, setFoto] = useState<{ readonly id: string; readonly pixels: ImagemDePixels } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cantos, setCantos] = useState<readonly Ponto2D[]>([]);
  const [larguraMm, setLarguraMm] = useState<number | null>(297);
  const [alturaMm, setAlturaMm] = useState<number | null>(210);
  const [mmPorPxPedido, setMmPorPxPedido] = useState(0.5);
  const [semPerspectiva, setSemPerspectiva] = useState(false);
  const [plana, setPlana] = useState<{ readonly pixels: ImagemDePixels; readonly mmPorPx: number; readonly url: string } | null>(null);
  const [limiar, setLimiar] = useState(128);
  const [moldeEscuro, setMoldeEscuro] = useState(false);
  const [toleranciaMm, setToleranciaMm] = useState(1);
  const [procurarFuros, setProcurarFuros] = useState(true);
  const [procurarPiques, setProcurarPiques] = useState(true);
  const [sugerirFio, setSugerirFio] = useState(true);
  const [procurarLinhas, setProcurarLinhas] = useState(true);
  const [clique, setClique] = useState<Clique>('semente');
  const [semente, setSemente] = useState<Ponto2D | null>(null);
  const [fioManual, setFioManual] = useState<readonly Ponto2D[]>([]);
  const [medida, setMedida] = useState<readonly Ponto2D[]>([]);
  const [medidaReal, setMedidaReal] = useState<number | null>(null);
  const [fator, setFator] = useState(1);
  const [nome, setNome] = useState('Molde da foto');
  const [tamanho, setTamanho] = useState('');
  const [quantidade, setQuantidade] = useState<number | null>(1);
  /** As peças já criadas desta foto (uma foto pode ter vários moldes). */
  const [criadas, setCriadas] = useState<readonly string[]>([]);

  // A foto escolhida, lida em pixels (a cada troca, recomeça).
  const { lerPixels } = props;
  useEffect(() => {
    if (!imagem) return;
    let vivo = true;
    lerPixels(imagem.dados).then(
      (pixels) => vivo && setFoto({ id: imagem.id, pixels }),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [imagem, lerPixels]);
  const fotoPronta = foto && foto.id === imagemId ? foto.pixels : null;

  const corrigir = (): void => {
    if (!fotoPronta || !imagem) return;
    try {
      let pixels: ImagemDePixels;
      let escala: number;
      if (semPerspectiva) {
        pixels = fotoPronta;
        escala = imagem.mmPorPx;
      } else {
        if (cantos.length !== 4) throw new Error('Marque os quatro cantos da referência.');
        if (!larguraMm || !alturaMm) throw new Error('Diga a largura e a altura da referência (mm).');
        escala = escalaDaRetificada(larguraMm, alturaMm, mmPorPxPedido);
        pixels = retificar(fotoPronta, cantos as unknown as Quadrilatero, larguraMm, alturaMm, mmPorPxPedido);
      }
      setPlana({ pixels, mmPorPx: escala, url: props.paraDataUrl(pixels) });
      setLimiar(limiarDeOtsu(tonsDeCinza(pixels)));
      setSemente(null);
      setFioManual([]);
      setMedida([]);
      setFator(1);
      setClique('semente');
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  const reconhecido = useMemo(() => {
    if (!plana || !semente) return null;
    const r = reconhecerMolde(plana.pixels, semente, { mmPorPx: plana.mmPorPx, limiar, moldeEscuro, toleranciaMm, procurarFuros, procurarPiques, sugerirFio, procurarLinhas });
    return r;
  }, [plana, semente, limiar, moldeEscuro, toleranciaMm, procurarFuros, procurarPiques, sugerirFio, procurarLinhas]);
  const molde: MoldeReconhecido | null = useMemo(() => {
    if (!reconhecido || 'erro' in reconhecido || !plana) return null;
    const comFio: MoldeReconhecido =
      fioManual.length === 2
        ? { ...reconhecido, fio: { inicio: { x: fioManual[0]!.x * plana.mmPorPx, y: fioManual[0]!.y * plana.mmPorPx }, fim: { x: fioManual[1]!.x * plana.mmPorPx, y: fioManual[1]!.y * plana.mmPorPx } } }
        : reconhecido;
    return fator === 1 ? comFio : escalarReconhecido(comFio, fator);
  }, [reconhecido, fioManual, fator, plana]);
  const medidas = molde ? medidasDoContorno(molde.contorno) : null;
  const medidaNaFoto = medida.length === 2 && plana ? Math.hypot(medida[1]!.x - medida[0]!.x, medida[1]!.y - medida[0]!.y) * plana.mmPorPx * fator : null;

  const aoClicarNaFoto = (ev: React.MouseEvent<SVGSVGElement>): void => {
    if (!fotoPronta || plana) return;
    const p = pontoNaImagem(ev.currentTarget, fotoPronta.largura, fotoPronta.altura, ev.clientX, ev.clientY);
    setCantos(cantos.length >= 4 ? [p] : [...cantos, p]);
  };
  const aoClicarNaPlana = (ev: React.MouseEvent<SVGSVGElement>): void => {
    if (!plana) return;
    const p = pontoNaImagem(ev.currentTarget, plana.pixels.largura, plana.pixels.altura, ev.clientX, ev.clientY);
    if (clique === 'semente') setSemente(p);
    else if (clique === 'fio') setFioManual(fioManual.length >= 2 ? [p] : [...fioManual, p]);
    else setMedida(medida.length >= 2 ? [p] : [...medida, p]);
  };
  // As coordenadas em mm do molde reconhecido, de volta aos pixels da foto corrigida (para desenhar por cima).
  const emPx = (p: Ponto2D): string => (plana ? `${(p.x / fator / plana.mmPorPx).toFixed(1)},${(p.y / fator / plana.mmPorPx).toFixed(1)}` : '0,0');

  return (
    <Sobreposicao titulo="Molde da foto" onFechar={props.onFechar}>
      <div className="painel-da-foto-para-molde">
        {erro && (
          <p className="mensagem-de-erro" role="alert">
            {erro}
          </p>
        )}
        <div className="area-da-foto-para-molde">
          <aside className="ferramentas-do-desenho" aria-label="Passos">
            <p className="legenda-inline">1. A foto</p>
            {props.imagens.length === 0 ? (
              <p className="nota-do-formulario">
                Fotografe o molde de papel de cima, sobre uma referência de medida conhecida (uma folha A4, uma placa de corte), com os quatro cantos
                dela aparecendo.
              </p>
            ) : (
              <label>
                Foto
                <select
                  value={imagemId}
                  onChange={(e) => {
                    setImagemId(e.target.value);
                    setCantos([]);
                    setPlana(null);
                    setSemente(null);
                  }}
                >
                  {props.imagens.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" onClick={props.onTrazerFoto}>
              Trazer uma foto…
            </button>

            <p className="legenda-inline">2. A referência</p>
            <label className="opcao-em-linha" title="A foto foi tirada bem de cima e a escala já foi calibrada (Imagens › Calibrar escala)">
              <input type="checkbox" checked={semPerspectiva} disabled={!imagem?.calibrada || plana !== null} onChange={(e) => setSemPerspectiva(e.target.checked)} />
              Sem corrigir a perspectiva (a escala calibrada)
            </label>
            {!semPerspectiva && (
              <>
                <p className="nota-do-formulario">
                  {cantos.length < 4 ? `Clique o canto ${NOMES_DOS_CANTOS[cantos.length]} da referência (${cantos.length} de 4).` : 'Os quatro cantos estão marcados.'}
                </p>
                <label>
                  Referência
                  <select
                    disabled={plana !== null}
                    onChange={(e) => {
                      const r = REFERENCIAS[Number(e.target.value)];
                      if (r) {
                        setLarguraMm(r[1]);
                        setAlturaMm(r[2]);
                      }
                    }}
                    defaultValue="0"
                  >
                    {REFERENCIAS.map(([nomeDaReferencia], i) => (
                      <option key={nomeDaReferencia} value={String(i)}>
                        {nomeDaReferencia}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Largura (do canto 1 ao 2, mm)
                  <CampoDeNumero rotulo="Largura da referência" valor={larguraMm} vazioPermitido desabilitado={plana !== null} onMudar={setLarguraMm} />
                </label>
                <label>
                  Altura (do canto 1 ao 4, mm)
                  <CampoDeNumero rotulo="Altura da referência" valor={alturaMm} vazioPermitido desabilitado={plana !== null} onMudar={setAlturaMm} />
                </label>
                <label>
                  Escala da foto corrigida
                  <select value={String(mmPorPxPedido)} disabled={plana !== null} onChange={(e) => setMmPorPxPedido(Number(e.target.value))}>
                    <option value="0.5">0,5 mm por ponto (mais fino)</option>
                    <option value="1">1 mm por ponto</option>
                  </select>
                </label>
              </>
            )}
            {plana ? (
              <button
                type="button"
                onClick={() => {
                  setPlana(null);
                  setSemente(null);
                }}
              >
                Voltar à foto (refazer os cantos)
              </button>
            ) : (
              <span className="acoes-em-linha">
                <button type="button" className="botao-primario" disabled={!fotoPronta || (!semPerspectiva && cantos.length !== 4)} onClick={corrigir}>
                  {semPerspectiva ? 'Usar a foto' : 'Corrigir a perspectiva'}
                </button>
                {cantos.length > 0 && (
                  <button type="button" onClick={() => setCantos([])}>
                    Limpar os cantos
                  </button>
                )}
              </span>
            )}
          </aside>

          <div className="quadro-da-foto">
            {!plana && fotoPronta && imagem && (
              <svg
                className="foto-para-marcar"
                viewBox={`0 0 ${fotoPronta.largura} ${fotoPronta.altura}`}
                role="img"
                aria-label="Foto para marcar os cantos"
                onClick={aoClicarNaFoto}
              >
                <image href={imagem.dados} width={fotoPronta.largura} height={fotoPronta.altura} />
                {cantos.length > 1 && <polygon className="cantos-marcados" points={cantos.map((p) => `${p.x},${p.y}`).join(' ')} />}
                {cantos.map((p, i) => (
                  <g key={i}>
                    <circle className="canto-marcado" cx={p.x} cy={p.y} r={Math.max(4, fotoPronta.largura / 120)} />
                    <text className="numero-do-canto" x={p.x + 8} y={p.y - 8} fontSize={Math.max(12, fotoPronta.largura / 50)}>
                      {i + 1}
                    </text>
                  </g>
                ))}
              </svg>
            )}
            {!plana && !fotoPronta && imagem && <p className="nota-do-formulario">Lendo a foto…</p>}
            {plana && (
              <svg
                className={`foto-para-marcar clique-${clique}`}
                viewBox={`0 0 ${plana.pixels.largura} ${plana.pixels.altura}`}
                role="img"
                aria-label="Foto corrigida"
                onClick={aoClicarNaPlana}
              >
                <image href={plana.url} width={plana.pixels.largura} height={plana.pixels.altura} />
                {molde && (
                  <g className="molde-reconhecido">
                    <polygon className="contorno-reconhecido" points={molde.contorno.map(emPx).join(' ')} />
                    {molde.furos.map((f, i) => (
                      <polygon key={i} className="furo-reconhecido" points={f.map(emPx).join(' ')} />
                    ))}
                    {molde.piques.map((p, i) => {
                      const [x, y] = emPx(p.posicao).split(',').map(Number);
                      return <circle key={i} className="pique-reconhecido" cx={x} cy={y} r={Math.max(3, plana.pixels.largura / 150)} />;
                    })}
                    {molde.linhasInternas.map((l, i) => (
                      <polyline key={`l${i}`} className="linha-reconhecida" points={l.map(emPx).join(' ')} />
                    ))}
                    {molde.fio && <line className="fio-reconhecido" x1={Number(emPx(molde.fio.inicio).split(',')[0])} y1={Number(emPx(molde.fio.inicio).split(',')[1])} x2={Number(emPx(molde.fio.fim).split(',')[0])} y2={Number(emPx(molde.fio.fim).split(',')[1])} />}
                  </g>
                )}
                {semente && <circle className="semente-marcada" cx={semente.x} cy={semente.y} r={Math.max(3, plana.pixels.largura / 160)} />}
                {medida.length > 0 && <polyline className="medida-marcada" points={medida.map((p) => `${p.x},${p.y}`).join(' ')} />}
              </svg>
            )}
          </div>

          <aside className="propriedades-do-desenho" aria-label="Reconhecimento">
            {!plana ? (
              <p className="nota-do-formulario">Depois de corrigir a perspectiva, clique dentro do molde: o contorno, os furos, os piques, o fio e as linhas de caneta aparecem para revisar.</p>
            ) : (
              <>
                {criadas.length > 0 && (
                  <p className="nota-do-formulario" role="status">
                    Peça(s) criada(s) desta foto: {criadas.join(', ')}. Para outro molde da mesma foto, clique dentro dele.
                  </p>
                )}
                <p className="legenda-inline">3. O molde</p>
                <div className="grade-de-ferramentas-do-desenho" role="toolbar" aria-label="O que o clique marca">
                  {(
                    [
                      ['semente', 'Dentro do molde'],
                      ['fio', 'O fio (2 cliques)'],
                      ['medida', 'Uma medida (2 cliques)'],
                    ] as const
                  ).map(([c, rotulo]) => (
                    <button key={c} type="button" aria-pressed={clique === c} className={clique === c ? 'item-selecionado' : undefined} onClick={() => setClique(c)}>
                      {rotulo}
                    </button>
                  ))}
                </div>
                <label>
                  Limiar ({limiar})
                  <input type="range" min={0} max={255} value={limiar} aria-label="Limiar" onChange={(e) => setLimiar(Number(e.target.value))} />
                </label>
                <label className="opcao-em-linha">
                  <input type="checkbox" checked={moldeEscuro} onChange={(e) => setMoldeEscuro(e.target.checked)} />
                  O molde é mais escuro que o fundo
                </label>
                <label>
                  Tolerância do contorno
                  <select value={String(toleranciaMm)} onChange={(e) => setToleranciaMm(Number(e.target.value))}>
                    <option value="0.5">0,5 mm (mais pontos)</option>
                    <option value="1">1 mm</option>
                    <option value="2">2 mm (menos pontos)</option>
                  </select>
                </label>
                <label className="opcao-em-linha">
                  <input type="checkbox" checked={procurarFuros} onChange={(e) => setProcurarFuros(e.target.checked)} />
                  Procurar os furos
                </label>
                <label className="opcao-em-linha">
                  <input type="checkbox" checked={procurarPiques} onChange={(e) => setProcurarPiques(e.target.checked)} />
                  Procurar os piques (entalhes em V)
                </label>
                <label className="opcao-em-linha">
                  <input type="checkbox" checked={sugerirFio} onChange={(e) => setSugerirFio(e.target.checked)} />
                  Sugerir o fio (o traço comprido de dentro)
                </label>
                <label className="opcao-em-linha">
                  <input type="checkbox" checked={procurarLinhas} onChange={(e) => setProcurarLinhas(e.target.checked)} />
                  Os outros traços de caneta viram linhas internas (pence, bolso, dobra)
                </label>
                {!semente && <p className="nota-do-formulario">Clique dentro do molde, na foto corrigida.</p>}
                {reconhecido && 'erro' in reconhecido && <p className="mensagem-de-erro">{reconhecido.erro}</p>}
                {molde && medidas && (
                  <>
                    <dl className="medidas-reconhecidas" aria-label="Medidas do molde">
                      <dt>Largura × altura</dt>
                      <dd>
                        {mm(medidas.largura)} × {mm(medidas.altura)}
                      </dd>
                      <dt>Perímetro</dt>
                      <dd>{mm(medidas.perimetro)}</dd>
                      <dt>Área</dt>
                      <dd>{numeroComVirgula(medidas.area / 100, 1)} cm²</dd>
                      <dt>Achados</dt>
                      <dd>
                        {molde.contorno.length} pontos, {molde.furos.length} furo(s), {molde.piques.length} pique(s), {molde.linhasInternas.length} linha(s) interna(s), {molde.fio ? (fioManual.length === 2 ? 'fio marcado' : 'fio sugerido') : 'sem fio'}
                      </dd>
                    </dl>
                    {molde.avisos.map((a) => (
                      <p key={a} className="nota-do-formulario">
                        {a}
                      </p>
                    ))}
                    <p className="legenda-inline">4. Conferir</p>
                    {medidaNaFoto === null ? (
                      <p className="nota-do-formulario">Para conferir a escala: “Uma medida”, clique as duas pontas de uma medida que você conhece no molde.</p>
                    ) : (
                      <>
                        <label>
                          A medida de verdade (mm)
                          <CampoDeNumero rotulo="Medida de verdade" valor={medidaReal} vazioPermitido onMudar={setMedidaReal} />
                        </label>
                        <p className="nota-do-formulario" aria-label="Conferência da medida">
                          Na foto: {mm(medidaNaFoto)}
                          {medidaReal ? ` · diferença de ${numeroComVirgula(((medidaNaFoto - medidaReal) / medidaReal) * 100, 1)}%` : ''}
                        </p>
                        {medidaReal && Math.abs(medidaNaFoto - medidaReal) > 0.05 && (
                          <button type="button" onClick={() => setFator((f) => (f * medidaReal) / medidaNaFoto)}>
                            Corrigir a escala por esta medida
                          </button>
                        )}
                      </>
                    )}
                    <p className="legenda-inline">5. A peça</p>
                    <label>
                      Nome
                      <input value={nome} onChange={(e) => setNome(e.target.value)} />
                    </label>
                    <label>
                      Tamanho
                      <input value={tamanho} onChange={(e) => setTamanho(e.target.value)} />
                    </label>
                    <label>
                      Quantidade
                      <CampoDeNumero rotulo="Quantidade" valor={quantidade} onMudar={setQuantidade} />
                    </label>
                    <button
                      type="button"
                      className="botao-primario"
                      onClick={() => {
                        const nomeDaPeca = nome.trim() || 'Molde da foto';
                        const problema = props.onCriarPeca({ nome: nomeDaPeca, tamanho: tamanho.trim(), quantidade: Math.max(1, Math.round(quantidade ?? 1)), molde });
                        if (problema) {
                          setErro(problema);
                          return;
                        }
                        // Pronta para o próximo molde da mesma foto.
                        setCriadas([...criadas, nomeDaPeca]);
                        setSemente(null);
                        setFioManual([]);
                        setMedida([]);
                        setClique('semente');
                        setNome(`Molde da foto ${criadas.length + 2}`);
                        setErro(null);
                      }}
                    >
                      Criar a peça
                    </button>
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </Sobreposicao>
  );
}
