import { useState } from 'react';
import { MARGEM_DE_SEGURANCA_DA_MESA_MM } from '../domain/enfesto';
import type { Projeto } from '../domain/projeto';
import { Sobreposicao } from './Sobreposicao';

export interface DadosDeNovoProjeto {
  readonly nome: string;
  readonly larguraUtilMm: number;
  readonly comprimentoMm: number;
  readonly tecidoNome: string;
  readonly tecidoLarguraMm: number;
  readonly tecidoGramaturaGm2?: number;
  readonly tecidoQuantidadeDisponivelKg?: number;
  readonly tecidoDescricao?: string;
}

interface PainelDeNovoProjetoProps {
  readonly onCriar: (dados: DadosDeNovoProjeto) => void;
  readonly onFechar: () => void;
  /** As bases aprovadas da biblioteca (ADR 0126): o projeto pode começar de uma delas. */
  readonly bases?: readonly Projeto[];
  /** Cria o modelo da base com o nome dado; devolve o erro a mostrar, ou `null`. */
  readonly onCriarDaBase?: (baseId: string, nome: string) => string | null;
}

/**
 * Diálogo de "Novo projeto" (seção 2 do escopo) — pede nome, medidas da
 * mesa e a configuração do tecido de uma vez, como o "Novo Documento" de
 * qualquer programa de desenho. As medidas da mesa viram um enfesto inicial
 * (tipo Ímpar, sem margens adicionais: só a margem de segurança de 4 mm, que
 * vale sempre — ADR 0091); os dados do tecido viram um Tecido completo —
 * ambos editáveis depois pelos botões "Enfesto"/"Tecido" se precisar de
 * ajuste fino. Só os campos essenciais (nome do projeto, largura/
 * comprimento da mesa, tipo e largura do tecido) são obrigatórios; kilos,
 * gramatura e descrição ficam opcionais porque nem todo projeto começa com
 * esses números em mãos.
 */
export function PainelDeNovoProjeto(props: PainelDeNovoProjetoProps): React.JSX.Element {
  const [nome, setNome] = useState('Projeto sem título');
  const [larguraUtilMm, setLarguraUtilMm] = useState('1500');
  const [comprimentoMm, setComprimentoMm] = useState('3000');
  const [tecidoNome, setTecidoNome] = useState('');
  const [tecidoLarguraMm, setTecidoLarguraMm] = useState('1500');
  const [tecidoGramaturaGm2, setTecidoGramaturaGm2] = useState('');
  const [tecidoQuantidadeDisponivelKg, setTecidoQuantidadeDisponivelKg] = useState('');
  const [tecidoDescricao, setTecidoDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  // De onde começa: '' é a mesa vazia; senão, o id da base.
  const [daBase, setDaBase] = useState('');
  const bases = props.bases ?? [];
  const baseEscolhida = bases.find((b) => b.id === daBase) ?? null;

  function criar(): void {
    if (baseEscolhida && props.onCriarDaBase) {
      if (nome.trim() === '') {
        setErro('Informe um nome para o projeto.');
        return;
      }
      setErro(props.onCriarDaBase(baseEscolhida.id, nome));
      return;
    }
    const larguraNumero = Number.parseFloat(larguraUtilMm);
    const comprimentoNumero = Number.parseFloat(comprimentoMm);
    const tecidoLarguraNumero = Number.parseFloat(tecidoLarguraMm);
    if (nome.trim() === '') {
      setErro('Informe um nome para o projeto.');
      return;
    }
    if (!Number.isFinite(larguraNumero) || larguraNumero <= 0) {
      setErro('Largura útil da mesa precisa ser maior que zero.');
      return;
    }
    if (!Number.isFinite(comprimentoNumero) || comprimentoNumero <= 0) {
      setErro('Comprimento da mesa precisa ser maior que zero.');
      return;
    }
    if (tecidoNome.trim() === '') {
      setErro('Informe o tipo/nome do tecido.');
      return;
    }
    if (!Number.isFinite(tecidoLarguraNumero) || tecidoLarguraNumero <= 0) {
      setErro('Largura do tecido precisa ser maior que zero.');
      return;
    }
    if (tecidoGramaturaGm2.trim() !== '' && (!Number.isFinite(Number.parseFloat(tecidoGramaturaGm2)) || Number.parseFloat(tecidoGramaturaGm2) <= 0)) {
      setErro('Gramatura precisa ser maior que zero quando informada.');
      return;
    }
    if (
      tecidoQuantidadeDisponivelKg.trim() !== '' &&
      (!Number.isFinite(Number.parseFloat(tecidoQuantidadeDisponivelKg)) || Number.parseFloat(tecidoQuantidadeDisponivelKg) <= 0)
    ) {
      setErro('Quantidade em estoque precisa ser maior que zero quando informada.');
      return;
    }
    setErro(null);
    props.onCriar({
      nome: nome.trim(),
      larguraUtilMm: larguraNumero,
      comprimentoMm: comprimentoNumero,
      tecidoNome: tecidoNome.trim(),
      tecidoLarguraMm: tecidoLarguraNumero,
      ...(tecidoGramaturaGm2.trim() !== '' ? { tecidoGramaturaGm2: Number.parseFloat(tecidoGramaturaGm2) } : {}),
      ...(tecidoQuantidadeDisponivelKg.trim() !== ''
        ? { tecidoQuantidadeDisponivelKg: Number.parseFloat(tecidoQuantidadeDisponivelKg) }
        : {}),
      ...(tecidoDescricao.trim() !== '' ? { tecidoDescricao: tecidoDescricao.trim() } : {}),
    });
  }

  return (
    <Sobreposicao titulo="Novo projeto" onFechar={props.onFechar}>
      <form className="formulario-de-sobreposicao" onSubmit={(e) => e.preventDefault()}>
        <label>
          Nome do projeto
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        {bases.length > 0 && props.onCriarDaBase && (
          <fieldset className="escolha-do-comeco">
            <legend>Começar de</legend>
            <label>
              <input type="radio" name="comeco-do-projeto" checked={daBase === ''} onChange={() => setDaBase('')} />
              Uma mesa vazia
            </label>
            {bases.map((b) => (
              <label key={b.id} className="opcao-de-base">
                <input
                  type="radio"
                  name="comeco-do-projeto"
                  checked={daBase === b.id}
                  onChange={() => {
                    setDaBase(b.id);
                    // O nome que ninguém escreveu vira o da base.
                    if (nome === 'Projeto sem título' || bases.some((x) => nome === `${x.nome} — modelo novo`)) setNome(`${b.nome} — modelo novo`);
                  }}
                />
                Da base “{b.nome}” ({b.codigo}, {b.estadoAtual.pecas.length} peça(s)){b.base?.nota ? ` — ${b.base.nota}` : ''}
              </label>
            ))}
          </fieldset>
        )}
        {baseEscolhida ? (
          <p className="nota-do-formulario">
            As peças, o tecido e a mesa vêm da base “{baseEscolhida.nome}”, e também as regras de caimento e a montagem do
            provador 3D. A base não muda: o modelo novo é um projeto à parte, que diz de que base veio.
          </p>
        ) : (
          <>
            <label>
              Largura útil da mesa (mm)
              <input type="number" min={0} value={larguraUtilMm} onChange={(e) => setLarguraUtilMm(e.target.value)} />
            </label>
            <label>
              Comprimento da mesa (mm)
              <input type="number" min={0} value={comprimentoMm} onChange={(e) => setComprimentoMm(e.target.value)} />
            </label>
            <p className="nota-do-formulario">
              As medidas da mesa definem o enfesto inicial (tipo Ímpar). Não há margens adicionais, mas a margem de segurança
              de {MARGEM_DE_SEGURANCA_DA_MESA_MM} mm vale sempre: nenhuma peça chega mais perto que isso das bordas da mesa.
              Ajuste depois pelo botão "Enfesto" se precisar de outro tipo ou de margens maiores.
            </p>

            <p className="legenda-inline">Tecido</p>
            <label>
              Tipo/nome do tecido
              <input type="text" value={tecidoNome} onChange={(e) => setTecidoNome(e.target.value)} />
            </label>
            <label>
              Largura do tecido (mm)
              <input
                type="number"
                min={0}
                value={tecidoLarguraMm}
                onChange={(e) => setTecidoLarguraMm(e.target.value)}
              />
            </label>
            <label>
              Gramatura (g/m², opcional)
              <input
                type="number"
                min={0}
                value={tecidoGramaturaGm2}
                onChange={(e) => setTecidoGramaturaGm2(e.target.value)}
              />
            </label>
            <label>
              Quantidade em estoque (kg, opcional)
              <input
                type="number"
                min={0}
                value={tecidoQuantidadeDisponivelKg}
                onChange={(e) => setTecidoQuantidadeDisponivelKg(e.target.value)}
              />
            </label>
            <label>
              Descrição (opcional)
              <textarea
                value={tecidoDescricao}
                onChange={(e) => setTecidoDescricao(e.target.value)}
                placeholder="Observações sobre este tecido — composição, lote, fornecedor..."
              />
            </label>
          </>
        )}

        <div className="rodape-do-formulario">
          {erro && <p className="mensagem-de-erro">{erro}</p>}
          <div className="acoes-da-sobreposicao">
            <button type="button" onClick={props.onFechar}>
              Cancelar
            </button>
            <button type="button" onClick={criar} className="botao-primario">
              {baseEscolhida ? 'Criar da base' : 'Criar projeto'}
            </button>
          </div>
        </div>
      </form>
    </Sobreposicao>
  );
}
