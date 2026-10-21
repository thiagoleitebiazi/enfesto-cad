import { useState } from 'react';
import {
  darBaixaDoPlano,
  estadoDoRolo,
  estornarMovimento,
  movimentosDoPlano,
  reservarPlano,
  type CadastroDeProducao,
  type ResultadoDoMovimento,
} from '../domain/cadastroDeProducao';
import { escreverKg, escreverM } from '../domain/planoDeCorte';
import type { PlanoDeCorteV2 } from '../domain/planejamento';

/**
 * O estoque de um plano confirmado: o que ele usa de cada rolo, os movimentos já feitos (reserva, baixa, estorno) e
 * os botões para fazê-los. Nada acontece sem o clique de quem opera; repetir não reserva nem baixa duas vezes; o
 * estorno pede o motivo e fica no histórico.
 */
export function EstoqueDoPlano(props: {
  readonly plano: PlanoDeCorteV2;
  readonly cadastro: CadastroDeProducao;
  readonly responsavelSugerido: string;
  readonly agoraIso: () => string;
  readonly novoId: (prefixo: string) => string;
  /** Faz a mudança no cadastro e grava; devolve se deu certo (a mensagem aparece na janela). */
  readonly onMudar: (mudar: () => CadastroDeProducao, sucesso: string) => Promise<boolean>;
}): React.JSX.Element {
  const { plano, cadastro } = props;
  const [responsavel, setResponsavel] = useState(props.responsavelSugerido);
  const [estornando, setEstornando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const rolos = plano.resultado.rolos;
  if (plano.situacao !== 'confirmado') return <p className="nota-do-formulario">O estoque só se movimenta depois que o plano é confirmado.</p>;
  if (!rolos || rolos.length === 0) return <p className="nota-do-formulario">Este plano usa um peso de malha, sem rolos: não há estoque por rolo para movimentar.</p>;
  const usos = rolos.filter((r) => r.usadoMm > 0).map((r) => ({ roloId: r.id, comprimentoMm: r.usadoMm }));
  const movimentos = movimentosDoPlano(cadastro, plano.id);
  const dados = () => ({ planoId: plano.id, projetoId: plano.entrada.molde.projetoId, responsavel, agoraIso: props.agoraIso(), novoId: () => props.novoId('mov') });
  const resumo = (r: ResultadoDoMovimento, verbo: string): string =>
    `${verbo}: ${r.feitos.length > 0 ? r.feitos.join(', ') : 'nenhum rolo novo'}${r.jaFeitos.length > 0 ? ` (já estava feito em ${r.jaFeitos.join(', ')}: não repetido)` : ''}.`;
  const rotulo = { reserva: 'Reserva', baixa: 'Baixa', estorno: 'Estorno' } as const;
  /** Faz a operação uma vez (o que ela fez e o que já estava feito vão na mensagem); o erro aparece na janela. */
  const movimentar = (operacao: typeof reservarPlano, verbo: string): void => {
    let r: ResultadoDoMovimento;
    try {
      r = operacao(cadastro, usos, dados());
    } catch (e) {
      void props.onMudar(() => {
        throw e;
      }, '');
      return;
    }
    void props.onMudar(() => r.cadastro, resumo(r, verbo));
  };
  return (
    <div className="estoque-do-plano">
      <table className="tabela-de-relatorio">
        <caption>Estoque dos rolos do plano</caption>
        <thead>
          <tr>
            <th scope="col">Rolo</th>
            <th scope="col">O plano usa</th>
            <th scope="col">Saldo físico</th>
            <th scope="col">Reservado</th>
            <th scope="col">Consumido</th>
            <th scope="col">Disponível</th>
          </tr>
        </thead>
        <tbody>
          {rolos.map((r) => {
            const rolo = cadastro.rolos.find((x) => x.id === r.id);
            const estado = rolo ? estadoDoRolo(cadastro, rolo) : null;
            const m = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : escreverM(v));
            return (
              <tr key={r.id}>
                <td>{r.identificacao}</td>
                <td>{escreverM(r.usadoMm)}</td>
                <td>{rolo ? m(estado?.saldoFisicoMm) : 'fora do cadastro'}</td>
                <td>{m(estado?.reservadoMm)}</td>
                <td>{m(estado?.consumidoMm)}</td>
                <td>{m(estado?.disponivelMm)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <label>
        Quem faz o movimento (informado — o programa não tem login)
        <input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
      </label>
      <div className="acoes-em-linha">
        <button type="button" onClick={() => movimentar(reservarPlano, 'Reservado')}>
          Reservar os rolos do plano
        </button>
        <button type="button" onClick={() => movimentar(darBaixaDoPlano, 'Baixa dada')}>
          Dar baixa (o corte foi feito)
        </button>
      </div>
      {movimentos.length === 0 ? (
        <p className="nota-do-formulario">Nenhum movimento de estoque deste plano ainda.</p>
      ) : (
        <table className="tabela-de-relatorio">
          <caption>Movimentos de estoque do plano (nada é apagado)</caption>
          <thead>
            <tr>
              <th scope="col">Quando</th>
              <th scope="col">Movimento</th>
              <th scope="col">Rolo</th>
              <th scope="col">Quantidade</th>
              <th scope="col">Quem (informado)</th>
              <th scope="col">Situação</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {movimentos.map((mv) => (
              <tr key={mv.id}>
                <td>{new Date(mv.dataIso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>
                  {rotulo[mv.tipo]}
                  {mv.motivo ? ` — ${mv.motivo}` : ''}
                </td>
                <td>{cadastro.rolos.find((r) => r.id === mv.roloId)?.identificacao ?? mv.roloId}</td>
                <td>
                  {escreverM(mv.comprimentoMm)}
                  {mv.pesoG !== undefined ? ` (${escreverKg(mv.pesoG)})` : ''}
                </td>
                <td>{mv.responsavel}</td>
                <td>{mv.tipo === 'estorno' ? 'desfaz outro' : mv.estornado ? 'estornado' : mv.ativo ? 'vale' : 'trocado pela baixa'}</td>
                <td>
                  {mv.tipo !== 'estorno' && !mv.estornado && (
                    estornando === mv.id ? (
                      <>
                        <input aria-label="Motivo do estorno" placeholder="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />{' '}
                        <button
                          type="button"
                          onClick={() => {
                            void props
                              .onMudar(
                                () => estornarMovimento(cadastro, mv.id, { responsavel, motivo, agoraIso: props.agoraIso(), novoId: () => props.novoId('mov') }),
                                `${rotulo[mv.tipo]} estornada (o movimento fica no histórico).`,
                              )
                              .then((ok) => {
                                if (ok) {
                                  setEstornando(null);
                                  setMotivo('');
                                }
                              });
                          }}
                        >
                          Estornar mesmo
                        </button>{' '}
                        <button type="button" onClick={() => setEstornando(null)}>
                          Não
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setEstornando(mv.id)}>
                        Estornar
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
