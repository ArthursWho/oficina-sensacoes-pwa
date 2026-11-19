export interface TextFieldProps {
  label: string;
  note?: string;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  autocapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  spellcheck?: boolean;
  autocorrect?: 'on' | 'off';
  enterkeyhint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  onFocus?: (e: FocusEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
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
  name = 'campo_formalizacao_neutro',
  autocapitalize = 'words',
  spellcheck = false,
  autocorrect = 'off',
  enterkeyhint = 'done',
  onFocus,
  onKeyDown,
}: TextFieldProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
    }
    onKeyDown?.(e);
  };

  const handleFocus = (e: FocusEvent) => {
    const el = e.currentTarget as HTMLInputElement;
    // Garante que o campo continue visível quando o teclado virtual do Android abrir
    if (typeof el.scrollIntoView === 'function') {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
    onFocus?.(e);
  };

  return (
    <div class="ui-textfield">
      <label class="ui-textfield__label" for={id}>
        {label}
      </label>
      {note && <p class="ui-textfield__note">{note}</p>}
      <input
        id={id}
        name={name}
        type="text"
        class="ui-textfield__input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autocomplete="off"
        autocapitalize={autocapitalize}
        spellcheck={spellcheck}
        autocorrect={autocorrect}
        enterkeyhint={enterkeyhint}
        onInput={(e) => onInput(e.currentTarget.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
