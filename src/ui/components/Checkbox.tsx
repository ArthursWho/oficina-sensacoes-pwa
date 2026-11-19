export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

// Checkbox grande com área de toque inteira clicável (>= 64px de altura)
export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  id,
}: CheckboxProps) {
  const classes = [
    'ui-checkbox',
    checked ? 'ui-checkbox--checked' : '',
    disabled ? 'ui-checkbox--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label class={classes} for={id}>
      <input
        id={id}
        type="checkbox"
        class="ui-checkbox__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span class="ui-checkbox__box" aria-hidden="true">
        {checked && (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span class="ui-checkbox__label">{label}</span>
    </label>
  );
}
