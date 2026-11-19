export interface TextFieldProps {
  label: string;
  note?: string;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

// Campo de texto grande para digitação do nome do participante no tablet
export function TextField({
  label,
  note,
  value,
  onInput,
  placeholder,
  disabled = false,
  id = 'campo-nome-participante',
}: TextFieldProps) {
  return (
    <div class="ui-textfield">
      <label class="ui-textfield__label" for={id}>
        {label}
      </label>
      {note && <p class="ui-textfield__note">{note}</p>}
      <input
        id={id}
        type="text"
        class="ui-textfield__input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autocomplete="off"
        onInput={(e) => onInput(e.currentTarget.value)}
      />
    </div>
  );
}
