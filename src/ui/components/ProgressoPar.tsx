export interface ProgressoParProps {
  atual: number;
  total?: number;
}

// Indicador discreto de progresso do ciclo ("n / 6")
export function ProgressoPar({ atual, total = 6 }: ProgressoParProps) {
  return (
    <span
      class="ui-progresso-par"
      aria-label={`Faixa ${atual} de ${total}`}
    >
      {atual} / {total}
    </span>
  );
}
