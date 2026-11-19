export interface RadioOption<T extends string = string> {
  value: T;
  label: string;
}

export interface RadioGroupProps<T extends string = string> {
  name: string;
  legend?: string;
  options: readonly RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}

// Grupo de opções de rádio grandes; suporta value = null para nenhuma opção pré-selecionada
export function RadioGroup<T extends string = string>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled = false,
}: RadioGroupProps<T>) {
  return (
    <fieldset class="ui-radiogroup" disabled={disabled}>
      {legend && <legend class="ui-radiogroup__legend">{legend}</legend>}
      {options.map((option) => {
        const selected = value === option.value;
        const classes = [
          'ui-radio',
          selected ? 'ui-radio--selected' : '',
          disabled ? 'ui-radio--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <label key={option.value} class={classes}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              disabled={disabled}
              class="ui-radio__input"
              onChange={() => onChange(option.value)}
            />
            <span class="ui-radio__circle" aria-hidden="true">
              <span class="ui-radio__dot" />
            </span>
            <span class="ui-radio__label">{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
