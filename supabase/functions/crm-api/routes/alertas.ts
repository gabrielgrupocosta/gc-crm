import { Hono } from 'npm:hono@4.10.7';
import { hasPermission, scopedClientIds } from '../access.ts';
import { authMiddleware, databaseError } from '../platform.ts';
import type { AppEnv } from '../types.ts';

export const alertasRoutes = new Hono<AppEnv>();
alertasRoutes.use('*', authMiddleware);

alertasRoutes.get('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'alertas', 'ler', ['FINANCEIRO', 'GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const clientIds = await scopedClientIds(db, profile, ['ADMIN', 'FINANCEIRO']);
  if (clientIds?.length === 0) {
    return c.json({ lancamentosAtrasados: [], contratosVencendo: [] });
  }

  const today = new Date();
  const thirtyDays = new Date(today);
  thirtyDays.setUTCDate(thirtyDays.getUTCDate() + 30);

  let financeQuery = db
    .from('Financeiro')
    .select('*,cliente:Cliente(nomeFantasia)')
    .lt('dataCompetencia', today.toISOString())
    .in('statusPagamento', ['PENDENTE', 'ATRASADO'])
    .is('deletedAt', null);
  let clientQuery = db
    .from('Cliente')
    .select('id,nomeFantasia,dataVencimentoContrato')
    .gte('dataVencimentoContrato', today.toISOString())
    .lte('dataVencimentoContrato', thirtyDays.toISOString())
    .is('deletedAt', null);
  if (clientIds) {
    financeQuery = financeQuery.in('clienteId', clientIds);
    clientQuery = clientQuery.in('id', clientIds);
  }

  const [financeResult, clientResult] = await Promise.all([financeQuery, clientQuery]);
  if (financeResult.error) return databaseError(c, financeResult.error, 'Erro ao buscar alertas');
  if (clientResult.error) return databaseError(c, clientResult.error, 'Erro ao buscar alertas');
  return c.json({
    lancamentosAtrasados: financeResult.data || [],
    contratosVencendo: clientResult.data || [],
  });
});

