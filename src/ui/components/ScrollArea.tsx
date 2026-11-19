import { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface ScrollAreaProps {
  children: ComponentChildren;
  maxHeight?: string;
  onChegouAoFim?: () => void;
}

// Área de rolagem estilizada em tons vinho/âmbar com indicação sutil de conteúdo abaixo
export function ScrollArea({
  children,
  maxHeight = '420px',
  onChegouAoFim,
}: ScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState<boolean>(true);
  const notificouFimRef = useRef<boolean>(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const restamMais = distanceToBottom > 12;
    setHasMoreBelow(restamMais);

    if (!restamMais && !notificouFimRef.current) {
      notificouFimRef.current = true;
      onChegouAoFim?.();
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  return (
    <div class="ui-scrollarea-wrapper">
      <div
        ref={scrollRef}
        class="ui-scrollarea"
        style={{ maxHeight }}
        onScroll={checkScroll}
        tabIndex={0}
        role="region"
        aria-label="Texto do Termo de Consentimento Livre e Esclarecido"
      >
        {children}
      </div>
      <div
        class={`ui-scrollarea__more ${
          hasMoreBelow ? '' : 'ui-scrollarea__more--hidden'
        }`}
        aria-hidden="true"
      >
        ↓ Role para ler o restante do termo
      </div>
    </div>
  );
}
