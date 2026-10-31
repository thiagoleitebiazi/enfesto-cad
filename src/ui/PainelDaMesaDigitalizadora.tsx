import { useEffect, useRef, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import {
  botoesDaConfiguracao,
  botoesRepetidos,
  CONFIGURACAO_PADRAO_DA_MESA,
  lerRegistro,
  lerRegistros,
  MESA_VAZIA,
  tocar,
  type ConfiguracaoDaMesa,
  type EstadoDaMesa,
  type PecaDaMesa,
} from '../domain/mesaDigitalizadora';

/** O que a janela usa da porta serial do navegador (Web Serial). */
interface PortaSerial {
  open(opcoes: { readonly baudRate: number; readonly dataBits: 7 | 8; readonly parity: 'none' | 'even' | 'odd'; readonly stopBits: 1 | 2 }): Promise<void>;
  close(): Promise<void>;
  readonly readable: ReadableStream<Uint8Array> | null;
}

const serialDoNavegador = (): { requestPort(): Promise<PortaSerial> } | null =>
  (navigator as Navigator & { serial?: { requestPort(): Promise<PortaSerial> } }).serial ?? null;

/** A escolha da porta, que o processo principal pede quando a janela chama `requestPort`. */
export interface EscolhaDePortaSerial {
  readonly aoEscolher: (ouvir: (portas: ReadonlyArray<{ readonly id: string; readonly nome: string }>) => void) => () => void;
  readonly escolher: (id: string) => void;
}

interface PainelDaMesaDigitalizadoraProps {
  /** Põe as peças fechadas no desenho; devolve os nomes delas. */
  readonly onCriarPecas: (pecas: readonly PecaDaMesa[]) => readonly string[];
  readonly escolhaDePorta: EscolhaDePortaSerial | null;
  readonly onFechar: () => void;
}

const FORMATOS = {
  '8N1': { dataBits: 8, parity: 'none', stopBits: 1 },
  '7O1': { dataBits: 7, parity: 'odd', stopBits: 1 },
  '7E1': { dataBits: 7, parity: 'even', stopBits: 1 },
  '7N2': { dataBits: 7, parity: 'none', stopBits: 2 },
} as const;
type Formato = keyof typeof FORMATOS;
const VELOCIDADES = [1200, 2400, 4800, 9600, 19200, 38400] as const;

interface AjustesDaMesa extends ConfiguracaoDaMesa {
  readonly velocidade: number;
  readonly formato: Formato;
}

const CHAVE_DOS_AJUSTES = 'enfesto-cad:mesa-digitalizadora';
const AJUSTES_PADRAO: AjustesDaMesa = { ...CONFIGURACAO_PADRAO_DA_MESA, velocidade: 9600, formato: '8N1' };

function ajustesGuardados(): AjustesDaMesa {
  try {
    const bruto: unknown = JSON.parse(window.localStorage.getItem(CHAVE_DOS_AJUSTES) ?? 'null');
    if (typeof bruto !== 'object' || bruto === null) return AJUSTES_PADRAO;
    const a = bruto as Partial<AjustesDaMesa>;
    return {
      linhasPorPolegada: typeof a.linhasPorPolegada === 'number' && a.linhasPorPolegada > 0 ? a.linhasPorPolegada : AJUSTES_PADRAO.linhasPorPolegada,
      botaoNoComeco: a.botaoNoComeco === true,
      velocidade: VELOCIDADES.includes(a.velocidade as (typeof VELOCIDADES)[number]) ? (a.velocidade as number) : AJUSTES_PADRAO.velocidade,
      formato: a.formato && a.formato in FORMATOS ? a.formato : AJUSTES_PADRAO.formato,
      ...(typeof a.botaoDaAcao === 'object' && a.botaoDaAcao !== null ? { botaoDaAcao: a.botaoDaAcao } : {}),
    };
  } catch {
    return AJUSTES_PADRAO;
  }
}

/**
 * A mesa digitalizadora (ADR 0144): ligada pela porta serial, cada toque do cursor entra na peça que está sendo
 * copiada; fechar a peça a põe no desenho. O registro de uma mesa guardado por um programa de terminal também pode
 * ser colado aqui.
 */
export function PainelDaMesaDigitalizadora(props: PainelDaMesaDigitalizadoraProps): React.JSX.Element {
  const [ajustes, setAjustes] = useState<AjustesDaMesa>(ajustesGuardados);
  const [estado, setEstado] = useState<EstadoDaMesa>(MESA_VAZIA);
  const [recado, setRecado] = useState<string | null>(null);
  const [criadas, setCriadas] = useState<readonly string[]>([]);
  const [ligada, setLigada] = useState(false);
  const [portasParaEscolher, setPortasParaEscolher] = useState<ReadonlyArray<{ readonly id: string; readonly nome: string }> | null>(null);
  const [colado, setColado] = useState('');
  // O laço da porta lê o de agora (e não o da hora em que começou).
  const estadoRef = useRef<EstadoDaMesa>(MESA_VAZIA);
  const ajustesRef = useRef(ajustes);
  const criarRef = useRef(props.onCriarPecas);
  const portaRef = useRef<{ readonly porta: PortaSerial; readonly leitor: ReadableStreamDefaultReader<Uint8Array> } | null>(null);
  useEffect(() => {
    ajustesRef.current = ajustes;
    criarRef.current = props.onCriarPecas;
  }, [ajustes, props.onCriarPecas]);

  useEffect(() => props.escolhaDePorta?.aoEscolher((portas) => setPortasParaEscolher(portas)), [props.escolhaDePorta]);

  // Fechar a janela desliga a mesa.
  useEffect(
    () => () => {
      const ligacao = portaRef.current;
      portaRef.current = null;
      if (ligacao) void ligacao.leitor.cancel().finally(() => void ligacao.porta.close().catch(() => {}));
    },
    [],
  );

  const mudarAjustes = (mudanca: Partial<AjustesDaMesa>): void => {
    const novos = { ...ajustes, ...mudanca };
    setAjustes(novos);
    try {
      window.localStorage.setItem(CHAVE_DOS_AJUSTES, JSON.stringify(novos));
    } catch {
      // Sem o armazenamento do navegador, os ajustes valem até fechar.
    }
  };

  /** Os toques, um depois do outro; as peças fechadas vão juntas para o desenho. */
  const receber = (registros: ReturnType<typeof lerRegistros>['registros']): void => {
    let atual = estadoRef.current;
    let ultimo: string | null = null;
    const pecas: PecaDaMesa[] = [];
    for (const r of registros) {
      const t = tocar(atual, r, ajustesRef.current);
      atual = t.estado;
      ultimo = t.recado;
      if (t.peca) pecas.push(t.peca);
    }
    estadoRef.current = atual;
    setEstado(atual);
    if (pecas.length > 0) {
      const nomes = criarRef.current(pecas);
      setCriadas((lista) => [...lista, ...nomes]);
      ultimo = `${ultimo ?? ''} No desenho: ${nomes.join(', ')}.`.trim();
    }
    if (ultimo !== null) setRecado(ultimo);
  };

  const ligar = async (): Promise<void> => {
    const serial = serialDoNavegador();
    if (!serial) {
      setRecado('Este computador não dá acesso às portas seriais.');
      return;
    }
    let porta: PortaSerial;
    try {
      porta = await serial.requestPort();
    } catch {
      setPortasParaEscolher(null);
      setRecado('Nenhuma porta foi escolhida: a mesa não foi ligada.');
      return;
    }
    setPortasParaEscolher(null);
    try {
      await porta.open({ baudRate: ajustes.velocidade, ...FORMATOS[ajustes.formato] });
    } catch (e) {
      setRecado(`A porta não abriu: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (!porta.readable) {
      setRecado('A porta abriu, mas não manda dados.');
      return;
    }
    const leitor = porta.readable.getReader();
    portaRef.current = { porta, leitor };
    setLigada(true);
    setRecado('Mesa ligada: toque os pontos do molde com o cursor.');
    const texto = new TextDecoder();
    let resto = '';
    try {
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        resto += texto.decode(value, { stream: true });
        const linhas = resto.split(/\r\n|\r|\n/);
        resto = linhas.pop() ?? '';
        const registros = linhas.map((l) => lerRegistro(l, ajustesRef.current)).filter((r) => r !== null);
        if (registros.length > 0) receber(registros);
      }
    } catch (e) {
      if (portaRef.current) setRecado(`A leitura da mesa parou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      leitor.releaseLock();
    }
  };

  const desligar = async (): Promise<void> => {
    const ligacao = portaRef.current;
    portaRef.current = null;
    setLigada(false);
    if (!ligacao) return;
    await ligacao.leitor.cancel().catch(() => {});
    await ligacao.porta.close().catch(() => {});
    setRecado('Mesa desligada.');
  };

  const lerOColado = (): void => {
    const lido = lerRegistros(colado, ajustes);
    if (lido.registros.length === 0) {
      setRecado('Nenhuma linha do registro é um toque da mesa (confira a ordem dos campos).');
      return;
    }
    receber(lido.registros);
    setColado('');
    if (lido.ignoradas > 0) setRecado((r) => `${r ?? ''} ${lido.ignoradas} linha(s) que não são toques ficaram de fora.`.trim());
  };

  const curvas = estado.pontos.filter((p) => p.curva).length;
  const piques = estado.pontos.filter((p) => p.pique).length;

  return (
    <Sobreposicao titulo="Mesa digitalizadora" onFechar={props.onFechar}>
      <div className="painel-da-mesa-digitalizadora">
        <p className="nota-do-formulario">
          Prenda o molde de papel na mesa e toque cada ponto do contorno com o cursor, na ordem, com o botão de cada coisa (a tabela abaixo). “Fechar a peça” põe a peça
          no desenho, com as curvas, os piques e o fio. Não foi testado numa mesa de verdade: acerte a resolução, a ordem dos campos e a porta pelo manual da sua mesa, e
          confira as medidas da primeira peça.
        </p>
        <fieldset className="grupo-de-opcoes-do-formulario">
          <legend>A mesa</legend>
          <label>
            Resolução (linhas por polegada)
            <input type="number" min={1} step={1} value={ajustes.linhasPorPolegada} onChange={(e) => Number(e.target.value) > 0 && mudarAjustes({ linhasPorPolegada: Number(e.target.value) })} />
          </label>
          <label>
            Ordem dos campos
            <select value={ajustes.botaoNoComeco ? 'bxy' : 'xyb'} onChange={(e) => mudarAjustes({ botaoNoComeco: e.target.value === 'bxy' })}>
              <option value="xyb">X, Y, botão</option>
              <option value="bxy">Botão, X, Y</option>
            </select>
          </label>
          <label>
            Velocidade da porta
            <select value={ajustes.velocidade} disabled={ligada} onChange={(e) => mudarAjustes({ velocidade: Number(e.target.value) })}>
              {VELOCIDADES.map((v) => (
                <option key={v} value={v}>
                  {v} bps
                </option>
              ))}
            </select>
          </label>
          <label>
            Formato
            <select value={ajustes.formato} disabled={ligada} onChange={(e) => mudarAjustes({ formato: e.target.value as Formato })}>
              {(Object.keys(FORMATOS) as Formato[]).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <p className="acoes-da-fila">
            {ligada ? (
              <button type="button" onClick={() => void desligar()}>
                Desligar a mesa
              </button>
            ) : (
              <button type="button" className="botao-primario" onClick={() => void ligar()}>
                Ligar a mesa (porta serial)…
              </button>
            )}
          </p>
          {portasParaEscolher && (
            <div className="escolha-da-porta" role="group" aria-label="Portas seriais">
              {portasParaEscolher.length === 0 ? (
                <p className="nota-do-formulario">Nenhuma porta serial encontrada neste computador. Ligue a mesa (ou o adaptador USB-serial) e tente de novo.</p>
              ) : (
                <ul>
                  {portasParaEscolher.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => props.escolhaDePorta?.escolher(p.id)}>
                        Usar {p.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => props.escolhaDePorta?.escolher('')}>
                Cancelar
              </button>
            </div>
          )}
        </fieldset>

        <section className="estado-da-mesa" aria-label="A peça na mesa">
          <strong>
            Peça na mesa: {estado.pontos.length} ponto(s){curvas > 0 ? `, ${curvas} de curva` : ''}
            {piques > 0 ? `, ${piques} pique(s)` : ''}
            {(estado.furos?.length ?? 0) > 0 ? `, ${estado.furos!.length} furo(s)` : ''}
            {(estado.linhas?.length ?? 0) > 0 ? `, ${estado.linhas!.length} linha(s)` : ''}
            {(estado.marcas?.length ?? 0) > 0 ? `, ${estado.marcas!.length} marca(s)` : ''} · fio {estado.fio.length}/2
          </strong>
          {recado && <p role="status">{recado}</p>}
          {criadas.length > 0 && <p className="nota-do-formulario">Peças desta mesa: {criadas.join(', ')}.</p>}
        </section>

        <table className="tabela-de-relatorio botoes-da-mesa">
          <caption>Os botões do cursor</caption>
          <tbody>
            {botoesDaConfiguracao(ajustes).map((b) => (
              <tr key={b.acao}>
                <th scope="row">
                  <input
                    type="number"
                    min={0}
                    max={15}
                    aria-label={`Botão de: ${b.rotulo}`}
                    value={b.botao}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isInteger(v) && v >= 0 && v <= 15) mudarAjustes({ botaoDaAcao: { ...ajustes.botaoDaAcao, [b.acao]: v } });
                    }}
                  />
                </th>
                <td>{b.rotulo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="nota-do-formulario">Troque o número se o cursor da sua mesa for outro (10 a 15 são os botões A a F).</p>
        {botoesRepetidos(ajustes).length > 0 && (
          <p role="alert" className="mensagem-de-erro">
            Mais de uma ação no botão {botoesRepetidos(ajustes).join(', ')}: só a primeira da tabela vale.
          </p>
        )}

        <details>
          <summary>Colar o registro da mesa</summary>
          <p className="nota-do-formulario">O texto que a mesa mandou, guardado por um programa de terminal: uma linha por toque (“XXXXX,YYYYY,B”).</p>
          <textarea aria-label="Registro da mesa" rows={6} value={colado} onChange={(e) => setColado(e.target.value)} />
          <p className="acoes-da-fila">
            <button type="button" disabled={colado.trim() === ''} onClick={lerOColado}>
              Ler o registro
            </button>
          </p>
        </details>
      </div>
    </Sobreposicao>
  );
}
