import { espessurasFisicasPorCamada, orientacaoDaCamada, type ConfiguracaoDeEnfesto } from '../domain/enfesto';

const MAX_CAMADAS_DESENHADAS = 24;
const ALTURA_POR_ESPESSURA = 6;
const LARGURA_CAMADA = 140;

/** Corte lateral esquemático do enfesto: uma camada por linha, mostrando espessura dobrada (Par/Tubular) e inversão de face (Zigue-zague). */
export function DiagramaDeEnfesto(props: { readonly config: ConfiguracaoDeEnfesto }): React.JSX.Element {
  const { config } = props;
  const espessura = espessurasFisicasPorCamada(config.tipo);
  const totalDesenhado = Math.min(config.quantidadeDeCamadas, MAX_CAMADAS_DESENHADAS);
  const restantes = config.quantidadeDeCamadas - totalDesenhado;

  let y = 4;
  const retangulos: React.JSX.Element[] = [];
  for (let i = 0; i < totalDesenhado; i++) {
    const orientacao = orientacaoDaCamada(config.tipo, i);
    const altura = ALTURA_POR_ESPESSURA * espessura;
    retangulos.push(
      <rect
        key={i}
        x={4}
        y={y}
        width={LARGURA_CAMADA}
        height={altura - 1}
        fill={orientacao === 'normal' ? '#cfd8dc' : '#78909c'}
        stroke="#455a64"
        strokeWidth={0.5}
      />,
    );
    y += altura;
  }

  return (
    <div className="diagrama-de-enfesto">
      <svg width={LARGURA_CAMADA + 8} height={y + 4} role="img" aria-label={`Corte lateral do enfesto tipo ${config.tipo}, ${config.quantidadeDeCamadas} camadas`}>
        {retangulos}
      </svg>
      <p className="legenda-do-diagrama">
        {espessura === 2 && 'Tecido dobrado: cada camada = 2 espessuras físicas. '}
        {config.tipo === 'zigue-zague' && 'Camadas escuras: face invertida (vaivém contínuo). '}
        {restantes > 0 && `+${restantes} camada(s) não desenhada(s) (diagrama limitado a ${MAX_CAMADAS_DESENHADAS}).`}
      </p>
    </div>
  );
}
