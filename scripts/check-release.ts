import process from 'node:process';
import { listarPendencias, temPendencias } from '../src/content/tcle.ts';

// Verifica se ainda existem pendências no TCLE antes da publicação final para a oficina
if (temPendencias()) {
  const pendencias = listarPendencias();
  console.error(
    `\n[ERRO check:release] O TCLE possui ${pendencias.length} pendência(s) não resolvida(s) em src/content/tcle.ts:`
  );
  for (const item of pendencias) {
    console.error(`  - ${item}`);
  }
  console.error(
    '\nPreencha os dados em PENDENCIAS e defina enquadramentoEticoConfirmado = true antes do release final.\n'
  );
  process.exit(1);
}

console.log('[OK check:release] Nenhuma pendência encontrada no TCLE. Pronto para publicação final.');
