import { IntensidadeVisual } from '../../session/visao';

export interface VisualOrganicoProps {
  intensidade: IntensidadeVisual;
}

// Visual orgânico simples em CSS puro (2-3 camadas de gradientes radiais com respiração suave)
// TODO etapa 9: refinar animação orgânica e sincronia sensorial
export function VisualOrganico({ intensidade }: VisualOrganicoProps) {
  return (
    <div
      class={`ui-visual-organico ui-visual-organico--${intensidade}`}
      aria-hidden="true"
    >
      <div class="ui-visual-organico__camada ui-visual-organico__camada--externa" />
      <div class="ui-visual-organico__camada ui-visual-organico__camada--media" />
      <div class="ui-visual-organico__camada ui-visual-organico__camada--nucleo" />
    </div>
  );
}
