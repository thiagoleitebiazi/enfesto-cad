import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';

export interface DadosDeNovoProjeto {
  readonly nome: string;
  readonly larguraUtilMm: number;
  readonly comprimentoMm: number;
}

interface PainelDeNovoProjetoProps {
  readonly onCriar: (dados: DadosDeNovoProjeto) => void;
  readonly onFechar: () => void;
}

/**
 * Diálogo de "Novo projeto" (seção 2 do escopo) — pede nome e as medidas
 * reais da mesa antes de criar a área de trabalho, como o "Novo Documento"
 * de qualquer programa de desenho. As medidas viram um enfesto inicial
 * (tipo Ímpar, sem margens) que o usuário pode ajustar depois pelo botão
 * "Enfesto" — este diálogo só evita começar com uma mesa de tamanho
 * arbitrário sem nenhuma relação com o trabalho real.
 */
export function PainelDeNovoProjeto(props: PainelDeNovoProjetoProps): React.JSX.Element {
  const [nome, setNome] = useState('Projeto sem título');
  const [larguraUtilMm, setLarguraUtilMm] = useState('1500');
  const [comprimentoMm, setComprimentoMm] = useState('3000');
  const [erro, setErro] = useState<string | null>(null);

  function criar(): void {
    const larguraNumero = Number.parseFloat(larguraUtilMm);
    const comprimentoNumero = Number.parseFloat(comprimentoMm);
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
    setErro(null);
    props.onCriar({ nome: nome.trim(), larguraUtilMm: larguraNumero, comprimentoMm: comprimentoNumero });
  }

  return (
    <Sobreposicao titulo="Novo projeto" onFechar={props.onFechar}>
      <form className="formulario-de-sobreposicao" onSubmit={(e) => e.preventDefault()}>
        <label>
          Nome do projeto
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        <label>
          Largura útil da mesa (mm)
          <input
            type="number"
            min={0}
            value={larguraUtilMm}
            onChange={(e) => setLarguraUtilMm(e.target.value)}
          />
        </label>
        <label>
          Comprimento da mesa (mm)
          <input
            type="number"
            min={0}
            value={comprimentoMm}
            onChange={(e) => setComprimentoMm(e.target.value)}
          />
        </label>
        <p className="legenda-inline">
          As medidas definem o enfesto inicial (tipo Ímpar, sem margens) — ajuste depois pelo botão "Enfesto" se
          precisar de outro tipo ou de margens.
        </p>
        {erro && <p className="mensagem-de-erro">{erro}</p>}
        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="button" onClick={criar} className="botao-primario">
            Criar projeto
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
