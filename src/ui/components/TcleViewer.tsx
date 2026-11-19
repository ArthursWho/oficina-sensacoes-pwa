import { ComponentChildren } from 'preact';
import { DocumentoTcle, TCLE_DOCUMENTO } from '../../content/tcle';
import { ScrollArea } from './ScrollArea';

export interface TcleViewerProps {
  documento?: DocumentoTcle;
  maxHeight?: string;
  destacarPendencias?: boolean;
  onChegouAoFim?: () => void;
}

// Renderiza um texto destacando trechos entre colchetes [...] quando em modo DEV
function renderizarComDestaque(
  texto: string,
  destacar: boolean
): ComponentChildren {
  if (!destacar || !/\[[^\]]+\]/.test(texto)) {
    return texto;
  }

  const partes = texto.split(/(\[[^\]]+\])/g);
  return partes.map((parte, idx) =>
    /^\[[^\]]+\]$/.test(parte) ? (
      <mark key={idx} class="ui-tcle__pending" title="Pendência do TCLE">
        {parte}
      </mark>
    ) : (
      parte
    )
  );
}

// Visualizador completo do TCLE dentro da ScrollArea estilizada
export function TcleViewer({
  documento = TCLE_DOCUMENTO,
  maxHeight = '440px',
  destacarPendencias = import.meta.env.DEV,
  onChegouAoFim,
}: TcleViewerProps) {
  return (
    <ScrollArea maxHeight={maxHeight} onChegouAoFim={onChegouAoFim}>
      <article class="ui-tcle">
        <header class="ui-tcle__header">
          <h2 class="ui-tcle__title">{documento.titulo}</h2>
          {documento.subtitulos.map((sub, idx) => (
            <p key={idx} class="ui-tcle__subtitle">
              {sub}
            </p>
          ))}
        </header>

        {documento.secoes.map((secao) => (
          <section key={secao.numero} class="ui-tcle__section">
            <h3 class="ui-tcle__section-title">
              {secao.numero}. {secao.titulo}
            </h3>

            {secao.paragrafos?.map((p, idx) => (
              <p key={`p-${idx}`} class="ui-tcle__paragraph">
                {renderizarComDestaque(p, destacarPendencias)}
              </p>
            ))}

            {secao.itensNumerados && (
              <ol class="ui-tcle__list">
                {secao.itensNumerados.map((item, idx) => (
                  <li key={`li-${idx}`} class="ui-tcle__list-item">
                    {renderizarComDestaque(item, destacarPendencias)}
                  </li>
                ))}
              </ol>
            )}

            {secao.paragrafosPosLista?.map((p, idx) => (
              <p key={`pos-${idx}`} class="ui-tcle__paragraph">
                {renderizarComDestaque(p, destacarPendencias)}
              </p>
            ))}

            {secao.nota && (
              <p class="ui-tcle__note">
                {renderizarComDestaque(secao.nota, destacarPendencias)}
              </p>
            )}
          </section>
        ))}
      </article>
    </ScrollArea>
  );
}
