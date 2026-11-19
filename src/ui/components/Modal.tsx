import { Button, ButtonVariant } from './Button';

export interface ModalProps {
  aberto: boolean;
  titulo?: string;
  mensagem: string;
  rotuloConfirmar: string;
  rotuloCancelar: string;
  varianteConfirmar?: ButtonVariant;
  onConfirmar: () => void;
  onCancelar: () => void;
}

// Modal de confirmação com fundo escurecido e dois botões grandes
export function Modal({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar,
  rotuloCancelar,
  varianteConfirmar = 'danger',
  onConfirmar,
  onCancelar,
}: ModalProps) {
  if (!aberto) return null;

  return (
    <div
      class="ui-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titulo ? 'ui-modal-title' : undefined}
    >
      <div class="ui-modal">
        {titulo && (
          <h2 id="ui-modal-title" class="ui-modal__title">
            {titulo}
          </h2>
        )}
        <p class="ui-modal__message">{mensagem}</p>
        <div class="ui-modal__actions">
          <Button variant="secondary" fullWidth onClick={onCancelar}>
            {rotuloCancelar}
          </Button>
          <Button variant={varianteConfirmar} fullWidth onClick={onConfirmar}>
            {rotuloConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
