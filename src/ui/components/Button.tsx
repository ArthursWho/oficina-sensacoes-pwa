import { ComponentChildren } from 'preact';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  children: ComponentChildren;
  variant?: ButtonVariant;
  icon?: ComponentChildren;
  disabled?: boolean;
  pressed?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  ariaLabel?: string;
}

// Botão com altura mínima de 64px, variantes visuais e suporte a ícone opcional
export function Button({
  children,
  variant = 'primary',
  icon,
  disabled = false,
  pressed = false,
  fullWidth = false,
  type = 'button',
  onClick,
  ariaLabel,
}: ButtonProps) {
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    pressed ? 'ui-btn--pressed' : '',
    fullWidth ? 'ui-btn--full' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      class={classes}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={pressed ? true : undefined}
    >
      {icon && <span class="ui-btn__icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
