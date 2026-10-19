import { Fragment, useMemo, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { lerMedida } from './medidas';
import type { MalhaCadastrada } from './malhasCadastradas';
import type { Tecido } from '../domain/tecido';
import { ROTULO_DO_TIPO, type TipoDeEnfesto } from '../domain/enfesto';
import {
  calcularPlanoDeCorte,
  escreverKg,
  escreverM,
  escreverM2,
  escreverRendimento,
  TAMANHO_UNICO,
  type AjustesDoPlano,
  type AlertaDoPlano,
  type CalculoDoPlano,
  type ConfiguracaoDoPlano,
  type EntradaDoPlano,
  type MalhaDoPlano,
  type MoldeDoPlano,
  type PlanoDeCorte,
  type RendimentoPrincipal,
  type ResultadoDoPlano,
  type RiscoDoPlano,
  type RoloDeMalha,
} from '../domain/planoDeCorte';

/** O que o painel entrega ao confirmar: o programa calcula de novo com isto, guarda o plano e (se pedido) ajusta o enfesto. */
export interface PlanoAConfirmar {
  readonly entrada: EntradaDoPlano;
  readonly configuracao: ConfiguracaoDoPlano;
  readonly ajustes: AjustesDoPlano;
  readonly responsavel: string;
  readonly aplicarAoEnfesto: boolean;
}

interface PainelDePlanoDeCorteProps {
  readonly molde: MoldeDoPlano;
  /** Os tamanhos que o molde conhece (das peças e da graduação). */
  readonly tamanhosDoMolde: readonly string[];
  /** O risco das peças posicionadas na mesa, ou `null` sem peças. */
  readonly riscoDaMesa: RiscoDoPlano | null;
  readonly tecidoDoProjeto: Tecido | null;
  readonly tipoDoEnfesto: TipoDeEnfesto;
  readonly responsavelSugerido: string;
  readonly planosSalvos: readonly PlanoDeCorte[];
  readonly malhasCadastradas: readonly MalhaCadastrada[];
  readonly configuracaoGuardada: ConfiguracaoDoPlano;
  /** Guarda a malha no cadastro; devolve a mensagem do que impediu, ou `null`. */
  readonly onCadastrarMalha: (malha: Omit<MalhaCadastrada, 'id'>) => string | null;
  /** Confirma o plano; devolve a mensagem do que impediu, ou `null` (e o painel fecha). */
  readonly onConfirmar: (plano: PlanoAConfirmar) => string | null;
  readonly onFechar: () => void;
}

interface RoloNoFormulario {
  readonly id: string;
  readonly lote: string;
  readonly comprimentoM: string;
  readonly pesoKg: string;
  readonly larguraM: string;
}

const NOVA = 'nova';
const DO_PROJETO = 'projeto';

/** O texto do campo com vírgula. */
const noCampo = (valor: number | undefined, casas = 3): string =>
  valor === undefined ? '' : String(Number(valor.toFixed(casas))).replace('.', ',');

/** Lê um campo numérico opcional: vazio é ausente; o que não é número vira um erro com o nome do campo. */
function opcional(texto: string, nome: string, erros: string[]): number | undefined {
  if (texto.trim() === '') return undefined;
  const lido = lerMedida(texto);
  if (lido === null) {
    erros.push(`"${nome}" precisa ser um número.`);
    return undefined;
  }
  return lido;
}

function obrigatorio(texto: string, nome: string, erros: string[]): number {
  const lido = opcional(texto, nome, erros);
  if (lido === undefined && texto.trim() === '') erros.push(`Preencha "${nome}".`);
  return lido ?? Number.NaN;
}

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** A proposta: o resultado do plano, como se mostra — o calculado agora ou o de um plano guardado. */
export function PropostaDoPlano(props: {
  readonly entrada: EntradaDoPlano;
  readonly configuracao: ConfiguracaoDoPlano;
  readonly resultado: ResultadoDoPlano;
  readonly alertas: readonly AlertaDoPlano[];
  readonly premissas: readonly string[];
}): React.JSX.Element {
  const { entrada, configuracao: c, resultado: r } = props;
  const tamanhos = Object.keys(r.producaoPorTamanho);
  const rendimento = r.rendimentoUsadoMmPorG;
  const porEnfesto = r.enfestos.length > 0 && r.enfestos.every((n) => n === r.enfestos[0]) ? `${r.enfestos[0]} camadas` : r.enfestos.join(' + ') + ' camadas';
  return (
    <div className="proposta-do-plano">
      <p className="resumo-do-plano">
        Malha: {entrada.malha.descricao || '(sem descrição)'}
        {entrada.malha.gramaturaGm2 !== undefined && ` — gramatura ${String(entrada.malha.gramaturaGm2).replace('.', ',')} g/m²`}
        {r.rendimentoInformadoMmPorG !== null && ` — rendimento informado ${escreverRendimento(r.rendimentoInformadoMmPorG)}`}.
        <br />
        Molde: {entrada.molde.nome} ({entrada.molde.codigo}, revisão {entrada.molde.revisao}) — largura útil: {escreverM(entrada.malha.larguraUtilMm)}.
        <br />
        Risco: {escreverM(entrada.risco.comprimentoMm)} ({entrada.risco.origem === 'mesa' ? 'medido na mesa' : 'informado'}).
        <br />
        Mesa sugerida: {escreverM(r.comprimentoDaMesaMm)} × {escreverM(r.larguraDaMesaMm)} = {escreverM2(r.areaDaMesaMm2)}.
        <br />
        Enfesto sugerido: {porEnfesto} por enfesto, em {r.enfestos.length} enfesto(s) — {r.camadas} camada(s) no total.
        <br />
        Consumo estimado: {escreverM(r.consumoMm)}
        {r.consumoG !== null && ` (${escreverKg(r.consumoG)})`}. Sobra estimada: {escreverM(r.sobraMm)}
        {r.sobraG !== null && ` (${escreverKg(r.sobraG)})`}.
      </p>

      <dl className="lista-de-propriedades">
        <dt>Comprimento do risco</dt>
        <dd>
          {escreverM(entrada.risco.comprimentoMm)} × {escreverM(entrada.risco.larguraMm)} de largura
        </dd>
        <dt>Margens da mesa</dt>
        <dd>
          {escreverM(c.margemInicialDaMesaMm, 3)} no começo e {escreverM(c.margemFinalDaMesaMm, 3)} no fim
        </dd>
        <dt>Mesa</dt>
        <dd>
          {escreverM(r.comprimentoDaMesaMm)} × {escreverM(r.larguraDaMesaMm)} = {escreverM2(r.areaDaMesaMm2)}
          {r.comprimentoDaMesaMm !== r.comprimentoDaMesaSugeridoMm && ` (sugerida: ${escreverM(r.comprimentoDaMesaSugeridoMm)})`}
        </dd>
        <dt>Enfesto</dt>
        <dd>
          {ROTULO_DO_TIPO[entrada.tipoDeEnfesto]}, {r.folhasPorCamada} folha(s) por camada; até {r.camadasPorEnfestoMax} camadas por enfesto
        </dd>
        <dt>Camadas</dt>
        <dd>
          {r.camadas} (fecham a ordem: {r.camadasNecessarias}; o material dá: {r.camadasPossiveis})
        </dd>
        <dt>Enfestos</dt>
        <dd>
          {r.enfestos.length}: {r.enfestos.join(', ')} camadas
        </dd>
        <dt>Consumo por camada</dt>
        <dd>
          {escreverM(r.consumoPorCamadaMm, 3)} (risco + {escreverM(c.sobraPorCamadaMm, 3)} de pontas)
        </dd>
        <dt>Consumo estimado</dt>
        <dd>
          {escreverM(r.consumoMm)}
          {r.consumoG !== null && ` = ${escreverKg(r.consumoG)}`}
        </dd>
        <dt>Perda nas pontas</dt>
        <dd>{escreverM(r.perdaDePontasMm)} (dentro do consumo)</dd>
        <dt>Material disponível</dt>
        <dd>
          {escreverM(r.disponivelMm)}
          {r.disponivelG !== null && ` = ${escreverKg(r.disponivelG)}`}
        </dd>
        <dt>Sobra estimada</dt>
        <dd>
          {escreverM(r.sobraMm)}
          {r.sobraG !== null && ` = ${escreverKg(r.sobraG)}`}
          {r.rolos && ` (das quais ${escreverM(r.rolos.filter((x) => x.compativel).reduce((s, x) => s + x.pontaMm, 0))} em pontas de rolo)`}
        </dd>
        {r.deficitMm > 0 && (
          <>
            <dt>Falta de material</dt>
            <dd>
              {escreverM(r.deficitMm)}
              {r.deficitG !== null && ` = ${escreverKg(r.deficitG)}`}
            </dd>
          </>
        )}
        <dt>Rendimento usado</dt>
        <dd>
          {rendimento !== null ? `${escreverRendimento(rendimento)} (${r.origemDoRendimento === 'informado' ? 'informado' : 'calculado pela largura e gramatura'})` : '—'}
          {r.rendimentoInformadoMmPorG !== null && r.rendimentoCalculadoMmPorG !== null &&
            ` — informado ${escreverRendimento(r.rendimentoInformadoMmPorG)}, calculado ${escreverRendimento(r.rendimentoCalculadoMmPorG)}`}
        </dd>
        <dt>Eficiência do encaixe</dt>
        <dd>{r.eficienciaPercentual !== null ? `${r.eficienciaPercentual.toFixed(1).replace('.', ',')}%` : '— (só com o risco medido na mesa)'}</dd>
      </dl>

      <table className="tabela-de-relatorio">
        <thead>
          <tr>
            <th>Tamanho</th>
            <th>Ordem</th>
            <th>Por camada</th>
            <th>Produção prevista</th>
            <th>Falta</th>
            <th>A mais</th>
          </tr>
        </thead>
        <tbody>
          {tamanhos.map((t) => (
            <tr key={t}>
              <td>{t}</td>
              <td>{entrada.ordem.quantidadesPorTamanho[t] ?? 0}</td>
              <td>{(entrada.risco.gradePorTamanho[t] ?? 0) * r.folhasPorCamada}</td>
              <td>{r.producaoPorTamanho[t]}</td>
              <td>{r.faltaPorTamanho[t]}</td>
              <td>{r.excedentePorTamanho[t]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {r.rolos && (
        <table className="tabela-de-relatorio">
          <thead>
            <tr>
              <th>Rolo (lote)</th>
              <th>Comprimento</th>
              <th>Camadas</th>
              <th>Ponta que sobra</th>
            </tr>
          </thead>
          <tbody>
            {r.rolos.map((x) => (
              <tr key={x.id}>
                <td>{x.lote || '(sem lote)'}</td>
                <td>{escreverM(x.comprimentoMm)}</td>
                <td>{x.compativel ? x.camadas : 'não serve (estreito)'}</td>
                <td>{escreverM(x.pontaMm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {props.alertas.length > 0 && (
        <ul className="alertas-do-plano">
          {props.alertas.map((a, i) => (
            <li key={i} className={`alerta-do-plano alerta-${a.nivel}`}>
              {a.texto}
            </li>
          ))}
        </ul>
      )}
      <details className="premissas-do-plano">
        <summary>Premissas</summary>
        <ul>
          {props.premissas.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/**
 * O planejamento de corte: o risco, a ordem e a malha entram; a mesa, as camadas, os enfestos, o consumo e a
 * sobra saem, calculados a cada mudança, com os alertas e as premissas. Quem planeja revisa, ajusta e confirma.
 */
export function PainelDePlanoDeCorte(props: PainelDePlanoDeCorteProps): React.JSX.Element {
  const [origemDoRisco, setOrigemDoRisco] = useState<'mesa' | 'informado'>(props.riscoDaMesa ? 'mesa' : 'informado');
  const tamanhosIniciais = useMemo(() => {
    const todos = [...new Set([...Object.keys(props.riscoDaMesa?.gradePorTamanho ?? {}), ...props.tamanhosDoMolde])];
    return todos.length > 0 ? todos : [TAMANHO_UNICO];
  }, [props.riscoDaMesa, props.tamanhosDoMolde]);
  const [tamanhosTexto, setTamanhosTexto] = useState(tamanhosIniciais.join(', '));
  const tamanhos = useMemo(() => {
    const lidos = [...new Set(tamanhosTexto.split(',').map((t) => t.trim()).filter((t) => t !== ''))];
    return lidos.length > 0 ? lidos : [TAMANHO_UNICO];
  }, [tamanhosTexto]);
  const [riscoComprimento, setRiscoComprimento] = useState('');
  const [riscoLargura, setRiscoLargura] = useState('');
  const [grade, setGrade] = useState<Record<string, string>>(() =>
    Object.fromEntries(tamanhosIniciais.map((t) => [t, String(props.riscoDaMesa?.gradePorTamanho[t] ?? '')])),
  );
  const [ordemCodigo, setOrdemCodigo] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});

  // A malha: a do projeto, uma do cadastro ou uma nova.
  const deTecido = (t: Tecido | null) => ({
    descricao: t ? [t.nome, t.composicao].filter(Boolean).join(' — ') : '',
    gramatura: noCampo(t?.gramaturaGm2),
    rendimento: '',
    largura: t ? noCampo(t.larguraUtilMm / 1000) : '',
    peso: noCampo(t?.quantidadeDisponivelKg),
    tubular: props.tipoDoEnfesto === 'tubular',
    sentidoUnico: t ? t.direcional || t.temPelo : false,
    encolhimento: '',
  });
  const [escolhaDaMalha, setEscolhaDaMalha] = useState(props.tecidoDoProjeto ? DO_PROJETO : NOVA);
  const [malha, setMalha] = useState(() => deTecido(props.tecidoDoProjeto));
  const [unidadeDaLargura, setUnidadeDaLargura] = useState<'m' | 'cm'>('m');
  const [rolos, setRolos] = useState<readonly RoloNoFormulario[]>([]);
  const [rendimentoPrincipal, setRendimentoPrincipal] = useState<RendimentoPrincipal>('informado');
  const [tipoDeEnfesto, setTipoDeEnfesto] = useState<TipoDeEnfesto>(props.tipoDoEnfesto);
  const [configuracao, setConfiguracao] = useState(() => ({
    margemInicial: noCampo(props.configuracaoGuardada.margemInicialDaMesaMm / 10),
    margemFinal: noCampo(props.configuracaoGuardada.margemFinalDaMesaMm / 10),
    sobra: noCampo(props.configuracaoGuardada.sobraPorCamadaMm / 10),
    folhas: String(props.configuracaoGuardada.folhasPorEnfestoMax),
    tolerancia: noCampo(props.configuracaoGuardada.toleranciaDeRendimentoPercentual),
  }));
  const [ajuste, setAjuste] = useState({ mesa: '', camadas: '', porEnfesto: '' });
  const [responsavel, setResponsavel] = useState(props.responsavelSugerido);
  const [aplicarAoEnfesto, setAplicarAoEnfesto] = useState(true);
  const [mensagem, setMensagem] = useState<{ readonly tipo: 'erro' | 'ok'; readonly texto: string } | null>(null);
  const [planoAberto, setPlanoAberto] = useState<string | null>(null);

  const escolherMalha = (valor: string): void => {
    setEscolhaDaMalha(valor);
    setMensagem(null);
    if (valor === DO_PROJETO) {
      setMalha(deTecido(props.tecidoDoProjeto));
      setUnidadeDaLargura('m');
      return;
    }
    const cadastrada = props.malhasCadastradas.find((m) => m.id === valor);
    if (cadastrada) {
      setMalha({
        descricao: cadastrada.descricao,
        gramatura: noCampo(cadastrada.gramaturaGm2),
        rendimento: noCampo(cadastrada.rendimentoMmPorG),
        largura: noCampo(cadastrada.larguraUtilMm / 1000),
        peso: malha.peso,
        tubular: cadastrada.tubular,
        sentidoUnico: cadastrada.sentidoUnico,
        encolhimento: noCampo(cadastrada.encolhimentoPercentual),
      });
      setUnidadeDaLargura('m');
    }
  };

  // Do formulário para a entrada do cálculo (mm, g), com os erros de digitação.
  const montado = useMemo(() => {
    const erros: string[] = [];
    const larguraLida = obrigatorio(malha.largura, `Largura útil (${unidadeDaLargura})`, erros);
    const larguraUtilMm = unidadeDaLargura === 'm' ? larguraLida * 1000 : larguraLida * 10;
    const gramatura = opcional(malha.gramatura, 'Gramatura (g/m²)', erros);
    const rendimento = opcional(malha.rendimento, 'Rendimento (m/kg)', erros);
    const pesoKg = opcional(malha.peso, 'Peso disponível (kg)', erros);
    const encolhimento = opcional(malha.encolhimento, 'Encolhimento (%)', erros);
    const rolosLidos: RoloDeMalha[] = rolos.map((r, i) => {
      const comprimento = opcional(r.comprimentoM, `Comprimento do rolo ${i + 1} (m)`, erros);
      const peso = opcional(r.pesoKg, `Peso do rolo ${i + 1} (kg)`, erros);
      const largura = opcional(r.larguraM, `Largura do rolo ${i + 1} (m)`, erros);
      return {
        id: r.id,
        lote: r.lote,
        ...(comprimento !== undefined ? { comprimentoMm: comprimento * 1000 } : {}),
        ...(peso !== undefined ? { pesoG: peso * 1000 } : {}),
        ...(largura !== undefined ? { larguraUtilMm: largura * 1000 } : {}),
      };
    });
    const malhaDoPlano: MalhaDoPlano = {
      descricao: malha.descricao.trim(),
      larguraUtilMm,
      tubular: malha.tubular,
      sentidoUnico: malha.sentidoUnico,
      ...(gramatura !== undefined ? { gramaturaGm2: gramatura } : {}),
      ...(rendimento !== undefined ? { rendimentoMmPorG: rendimento } : {}),
      ...(pesoKg !== undefined ? { pesoDisponivelG: pesoKg * 1000 } : {}),
      ...(encolhimento !== undefined ? { encolhimentoPercentual: encolhimento } : {}),
      ...(rolosLidos.length > 0 ? { rolos: rolosLidos } : {}),
    };
    const gradeLida: Record<string, number> = {};
    const quantidadesLidas: Record<string, number> = {};
    for (const t of tamanhos) {
      gradeLida[t] = opcional(grade[t] ?? '', `Peças do ${t} por folha`, erros) ?? 0;
      quantidadesLidas[t] = opcional(quantidades[t] ?? '', `Ordem: quantidade do ${t}`, erros) ?? 0;
    }
    const daMesa = origemDoRisco === 'mesa' && props.riscoDaMesa;
    const risco: RiscoDoPlano = daMesa
      ? { ...props.riscoDaMesa!, gradePorTamanho: gradeLida }
      : {
          origem: 'informado',
          comprimentoMm: obrigatorio(riscoComprimento, 'Comprimento do risco (m)', erros) * 1000,
          larguraMm: obrigatorio(riscoLargura, 'Largura do risco (m)', erros) * 1000,
          gradePorTamanho: gradeLida,
        };
    const conf: ConfiguracaoDoPlano = {
      margemInicialDaMesaMm: obrigatorio(configuracao.margemInicial, 'Margem no começo da mesa (cm)', erros) * 10,
      margemFinalDaMesaMm: obrigatorio(configuracao.margemFinal, 'Margem no fim da mesa (cm)', erros) * 10,
      sobraPorCamadaMm: obrigatorio(configuracao.sobra, 'Sobra de pontas por camada (cm)', erros) * 10,
      folhasPorEnfestoMax: obrigatorio(configuracao.folhas, 'Folhas por enfesto (máximo)', erros),
      toleranciaDeRendimentoPercentual: obrigatorio(configuracao.tolerancia, 'Tolerância de rendimento (%)', erros),
    };
    const mesa = opcional(ajuste.mesa, 'Ajuste: comprimento da mesa (m)', erros);
    const camadas = opcional(ajuste.camadas, 'Ajuste: camadas', erros);
    const porEnfesto = opcional(ajuste.porEnfesto, 'Ajuste: camadas por enfesto', erros);
    const ajustes: AjustesDoPlano = {
      ...(mesa !== undefined ? { comprimentoDaMesaMm: mesa * 1000 } : {}),
      ...(camadas !== undefined ? { camadas } : {}),
      ...(porEnfesto !== undefined ? { camadasPorEnfesto: porEnfesto } : {}),
    };
    const entrada: EntradaDoPlano = {
      molde: props.molde,
      ordem: { codigo: ordemCodigo.trim(), quantidadesPorTamanho: quantidadesLidas },
      malha: malhaDoPlano,
      rendimentoPrincipal,
      risco,
      tipoDeEnfesto,
    };
    return { erros, entrada, configuracao: conf, ajustes };
  }, [malha, unidadeDaLargura, rolos, tamanhos, grade, quantidades, origemDoRisco, props.riscoDaMesa, props.molde, riscoComprimento, riscoLargura, configuracao, ajuste, ordemCodigo, rendimentoPrincipal, tipoDeEnfesto]);

  const calculo: CalculoDoPlano | null = useMemo(
    () => (montado.erros.length > 0 ? null : calcularPlanoDeCorte(montado.entrada, montado.configuracao, montado.ajustes)),
    [montado],
  );
  const doisRendimentos = malha.rendimento.trim() !== '' && malha.gramatura.trim() !== '';

  function confirmar(): void {
    if (!calculo || !calculo.ok) return;
    if (responsavel.trim() === '') {
      setMensagem({ tipo: 'erro', texto: 'Informe o responsável pelo plano.' });
      return;
    }
    const erro = props.onConfirmar({ ...montado, responsavel: responsavel.trim(), aplicarAoEnfesto });
    if (erro) setMensagem({ tipo: 'erro', texto: erro });
  }

  function guardarMalha(): void {
    const lido = montado.entrada.malha;
    const erro = props.onCadastrarMalha({
      descricao: lido.descricao,
      larguraUtilMm: lido.larguraUtilMm,
      tubular: lido.tubular,
      sentidoUnico: lido.sentidoUnico,
      ...(lido.gramaturaGm2 !== undefined ? { gramaturaGm2: lido.gramaturaGm2 } : {}),
      ...(lido.rendimentoMmPorG !== undefined ? { rendimentoMmPorG: lido.rendimentoMmPorG } : {}),
      ...(lido.encolhimentoPercentual !== undefined ? { encolhimentoPercentual: lido.encolhimentoPercentual } : {}),
    });
    setMensagem(erro ? { tipo: 'erro', texto: erro } : { tipo: 'ok', texto: `Malha “${lido.descricao}” guardada no cadastro deste computador.` });
  }

  const campo = (rotulo: string, valor: string, mudar: (v: string) => void, extras: { readonly id?: string; readonly dica?: string } = {}) => (
    <label title={extras.dica}>
      {rotulo}
      <input type="text" inputMode="decimal" value={valor} onChange={(e) => mudar(e.target.value)} {...(extras.id ? { id: extras.id } : {})} />
    </label>
  );

  const planoVisto = props.planosSalvos.find((p) => p.id === planoAberto) ?? null;

  return (
    <Sobreposicao titulo="Planejamento de corte" onFechar={props.onFechar}>
      <div className="painel-de-plano-de-corte">
        <form className="formulario-de-sobreposicao formulario-do-plano" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="grupo-de-opcoes-do-formulario">
            <legend>Molde e risco</legend>
            <p className="nota-do-formulario">
              {props.molde.nome} ({props.molde.codigo}, revisão {props.molde.revisao})
            </p>
            <label className="opcao-em-linha">
              <input type="radio" name="origem-do-risco" checked={origemDoRisco === 'mesa'} disabled={!props.riscoDaMesa} onChange={() => setOrigemDoRisco('mesa')} />
              As peças na mesa{props.riscoDaMesa ? `: ${escreverM(props.riscoDaMesa.comprimentoMm)} × ${escreverM(props.riscoDaMesa.larguraMm)}` : ' (não há peças)'}
            </label>
            <label className="opcao-em-linha">
              <input type="radio" name="origem-do-risco" checked={origemDoRisco === 'informado'} onChange={() => setOrigemDoRisco('informado')} />
              Um risco informado (feito fora, ou ainda por encaixar)
            </label>
            {origemDoRisco === 'informado' && (
              <>
                {campo('Comprimento do risco (m)', riscoComprimento, setRiscoComprimento)}
                {campo('Largura do risco (m)', riscoLargura, setRiscoLargura)}
              </>
            )}
            <label>
              Tamanhos (separados por vírgula)
              <input type="text" value={tamanhosTexto} onChange={(e) => setTamanhosTexto(e.target.value)} />
            </label>
            <p className="nota-do-formulario">
              Peças de roupa de cada tamanho que uma folha do risco dá
              {origemDoRisco === 'mesa' ? ' (deduzidas das peças da mesa: confira)' : ''}:
            </p>
            <div className="grade-do-plano">
              {tamanhos.map((t) => (
                <Fragment key={t}>{campo(t, grade[t] ?? '', (v) => setGrade((g) => ({ ...g, [t]: v })))}</Fragment>
              ))}
            </div>
          </fieldset>

          <fieldset className="grupo-de-opcoes-do-formulario">
            <legend>Ordem de produção</legend>
            <label>
              Código da ordem
              <input type="text" value={ordemCodigo} onChange={(e) => setOrdemCodigo(e.target.value)} placeholder="por exemplo, OP-0172" />
            </label>
            <p className="nota-do-formulario">Quantidade de cada tamanho:</p>
            <div className="grade-do-plano">
              {tamanhos.map((t) => (
                <Fragment key={t}>{campo(t, quantidades[t] ?? '', (v) => setQuantidades((q) => ({ ...q, [t]: v })))}</Fragment>
              ))}
            </div>
          </fieldset>

          <fieldset className="grupo-de-opcoes-do-formulario">
            <legend>Malha</legend>
            <label>
              Malha
              <select value={escolhaDaMalha} onChange={(e) => escolherMalha(e.target.value)}>
                {props.tecidoDoProjeto && <option value={DO_PROJETO}>O tecido do projeto ({props.tecidoDoProjeto.nome})</option>}
                {props.malhasCadastradas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.descricao}
                  </option>
                ))}
                <option value={NOVA}>Outra (informar abaixo)</option>
              </select>
            </label>
            <label>
              Descrição / composição
              <input type="text" value={malha.descricao} onChange={(e) => setMalha({ ...malha, descricao: e.target.value })} placeholder="por exemplo, Malha algodão 30/1" />
            </label>
            {campo('Gramatura (g/m²)', malha.gramatura, (v) => setMalha({ ...malha, gramatura: v }))}
            {campo('Rendimento (m/kg)', malha.rendimento, (v) => setMalha({ ...malha, rendimento: v }))}
            <div className="linha-de-campo-com-unidade">
              {campo(`Largura útil (${unidadeDaLargura})`, malha.largura, (v) => setMalha({ ...malha, largura: v }))}
              <select aria-label="Unidade da largura útil" value={unidadeDaLargura} onChange={(e) => setUnidadeDaLargura(e.target.value as 'm' | 'cm')}>
                <option value="m">m</option>
                <option value="cm">cm</option>
              </select>
            </div>
            {campo('Peso disponível (kg)', malha.peso, (v) => setMalha({ ...malha, peso: v }), { dica: 'Sem rolos detalhados abaixo, é o material do plano' })}
            {campo('Encolhimento no comprimento (%)', malha.encolhimento, (v) => setMalha({ ...malha, encolhimento: v }))}
            <label className="opcao-em-linha">
              <input type="checkbox" checked={malha.tubular} onChange={(e) => setMalha({ ...malha, tubular: e.target.checked })} />
              Malha tubular (desmarcada: aberta)
            </label>
            <label className="opcao-em-linha">
              <input type="checkbox" checked={malha.sentidoUnico} onChange={(e) => setMalha({ ...malha, sentidoUnico: e.target.checked })} />
              Sentido único (pelo ou estampa direcional)
            </label>
            {doisRendimentos && (
              <div role="radiogroup" aria-label="Rendimento principal">
                <p className="nota-do-formulario">Com o rendimento e a gramatura informados, o plano usa:</p>
                <label className="opcao-em-linha">
                  <input type="radio" name="rendimento-principal" checked={rendimentoPrincipal === 'informado'} onChange={() => setRendimentoPrincipal('informado')} />
                  O rendimento informado
                </label>
                <label className="opcao-em-linha">
                  <input type="radio" name="rendimento-principal" checked={rendimentoPrincipal === 'calculado'} onChange={() => setRendimentoPrincipal('calculado')} />
                  O calculado pela largura e gramatura
                </label>
              </div>
            )}
            <p className="nota-do-formulario">Rolos (opcional: com eles, o material é o dos rolos, e cada um dá só camadas inteiras):</p>
            {rolos.map((r, i) => (
              <div key={r.id} className="linha-do-rolo">
                <label>
                  Lote
                  <input type="text" value={r.lote} onChange={(e) => setRolos(rolos.map((x, j) => (j === i ? { ...x, lote: e.target.value } : x)))} />
                </label>
                {campo('Comprimento (m)', r.comprimentoM, (v) => setRolos(rolos.map((x, j) => (j === i ? { ...x, comprimentoM: v } : x))))}
                {campo('ou peso (kg)', r.pesoKg, (v) => setRolos(rolos.map((x, j) => (j === i ? { ...x, pesoKg: v } : x))))}
                {campo('Largura (m)', r.larguraM, (v) => setRolos(rolos.map((x, j) => (j === i ? { ...x, larguraM: v } : x))))}
                <button type="button" onClick={() => setRolos(rolos.filter((_, j) => j !== i))}>
                  Tirar
                </button>
              </div>
            ))}
            <div className="acoes-em-linha">
              <button type="button" onClick={() => setRolos([...rolos, { id: `rolo-${Date.now().toString(36)}-${rolos.length}`, lote: '', comprimentoM: '', pesoKg: '', larguraM: '' }])}>
                Acrescentar rolo
              </button>
              <button type="button" onClick={guardarMalha} disabled={montado.entrada.malha.descricao === '' || !(montado.entrada.malha.larguraUtilMm > 0)}>
                Guardar a malha no cadastro
              </button>
            </div>
          </fieldset>

          <fieldset className="grupo-de-opcoes-do-formulario">
            <legend>Enfesto e configurações</legend>
            <label>
              Tipo de enfesto
              <select value={tipoDeEnfesto} onChange={(e) => setTipoDeEnfesto(e.target.value as TipoDeEnfesto)}>
                {(Object.keys(ROTULO_DO_TIPO) as TipoDeEnfesto[]).map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_DO_TIPO[t]}
                  </option>
                ))}
              </select>
            </label>
            <p className="nota-do-formulario">Configurações do sistema (ajuste à sua mesa e à sua faca; ficam guardadas neste computador):</p>
            {campo('Margem no começo da mesa (cm)', configuracao.margemInicial, (v) => setConfiguracao({ ...configuracao, margemInicial: v }))}
            {campo('Margem no fim da mesa (cm)', configuracao.margemFinal, (v) => setConfiguracao({ ...configuracao, margemFinal: v }))}
            {campo('Sobra de pontas por camada (cm)', configuracao.sobra, (v) => setConfiguracao({ ...configuracao, sobra: v }))}
            {campo('Folhas por enfesto (máximo)', configuracao.folhas, (v) => setConfiguracao({ ...configuracao, folhas: v }))}
            {campo('Tolerância de rendimento (%)', configuracao.tolerancia, (v) => setConfiguracao({ ...configuracao, tolerancia: v }))}
          </fieldset>

          <fieldset className="grupo-de-opcoes-do-formulario">
            <legend>Ajustes (em branco, vale a sugestão)</legend>
            {campo('Comprimento da mesa (m)', ajuste.mesa, (v) => setAjuste({ ...ajuste, mesa: v }))}
            {campo('Camadas', ajuste.camadas, (v) => setAjuste({ ...ajuste, camadas: v }))}
            {campo('Camadas por enfesto', ajuste.porEnfesto, (v) => setAjuste({ ...ajuste, porEnfesto: v }))}
          </fieldset>
        </form>

        <section className="resultado-do-plano" aria-label="Proposta">
          <h3>Proposta</h3>
          {montado.erros.length > 0 || (calculo && !calculo.ok) ? (
            <div role="alert" className="faltas-do-plano">
              <p>Ainda não dá para calcular:</p>
              <ul>
                {[...montado.erros, ...(calculo && !calculo.ok ? calculo.erros : [])].map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {calculo && !calculo.ok && calculo.alertas.length > 0 && (
                <ul className="alertas-do-plano">
                  {calculo.alertas.map((a, i) => (
                    <li key={i} className={`alerta-do-plano alerta-${a.nivel}`}>
                      {a.texto}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : calculo && calculo.ok ? (
            <PropostaDoPlano entrada={montado.entrada} configuracao={montado.configuracao} resultado={calculo.resultado} alertas={calculo.alertas} premissas={calculo.premissas} />
          ) : null}

          <div className="confirmacao-do-plano">
            <label>
              Responsável
              <input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </label>
            <label className="opcao-em-linha">
              <input type="checkbox" checked={aplicarAoEnfesto} onChange={(e) => setAplicarAoEnfesto(e.target.checked)} />
              Ajustar o enfesto do projeto ao plano (tipo, largura e comprimento da mesa, camadas)
            </label>
            {mensagem && (
              <p className={mensagem.tipo === 'erro' ? 'mensagem-de-erro' : 'nota-do-formulario'} role={mensagem.tipo === 'erro' ? 'alert' : 'status'}>
                {mensagem.texto}
              </p>
            )}
            <div className="acoes-da-sobreposicao">
              <button type="button" onClick={props.onFechar}>
                Fechar
              </button>
              <button type="button" className="botao-primario" onClick={confirmar} disabled={!calculo || !calculo.ok}>
                Confirmar o plano
              </button>
            </div>
          </div>

          <h3>Planos salvos deste projeto</h3>
          {props.planosSalvos.length === 0 ? (
            <p className="nota-do-formulario">Nenhum plano ainda.</p>
          ) : (
            <ul className="lista-de-planos">
              {[...props.planosSalvos].reverse().map((p) => (
                <li key={p.id}>
                  <button type="button" aria-expanded={planoAberto === p.id} onClick={() => setPlanoAberto(planoAberto === p.id ? null : p.id)}>
                    {DATA.format(new Date(p.criadoEmIso))} — ordem {p.entrada.ordem.codigo} — {p.resultado.camadas} camadas em {p.resultado.enfestos.length} enfesto(s) — {p.responsavel}
                    {p.substituiPlanoId ? ' (substitui um plano anterior)' : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {planoVisto && (
            <div className="plano-salvo">
              <p className="nota-do-formulario">
                Plano de {DATA.format(new Date(planoVisto.criadoEmIso))}, por {planoVisto.responsavel}: os valores são os de então, sem recalcular.
                {planoVisto.ajustes.length > 0 &&
                  ` Ajustes feitos: ${planoVisto.ajustes
                    .map((a) => `${a.campo === 'comprimentoDaMesaMm' ? `mesa ${escreverM(a.sugerido)} → ${escreverM(a.escolhido)}` : `${a.campo === 'camadas' ? 'camadas' : 'camadas por enfesto'} ${a.sugerido} → ${a.escolhido}`}`)
                    .join('; ')}.`}
              </p>
              {planoVisto.entrada.molde.impressaoDigital !== props.molde.impressaoDigital && (
                <p className="alerta-do-plano alerta-aviso" role="status">
                  O molde mudou depois deste plano (revisão {planoVisto.entrada.molde.revisao} → {props.molde.revisao}): os valores dele não valem mais para as peças de agora.
                </p>
              )}
              <PropostaDoPlano entrada={planoVisto.entrada} configuracao={planoVisto.configuracao} resultado={planoVisto.resultado} alertas={planoVisto.alertas} premissas={planoVisto.premissas} />
            </div>
          )}
        </section>
      </div>
    </Sobreposicao>
  );
}
