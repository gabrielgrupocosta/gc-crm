import { Hono } from 'npm:hono@4.10.7';
import { getAccessibleUnitIds, scopedClientIds } from '../access.ts';
import { authMiddleware, databaseError } from '../platform.ts';
import type { AppEnv } from '../types.ts';

type RankingSeller = { id: string; nome: string; unidade: string; valor: number };
type RankingUnit = { id: string; nome: string; valor: number; vendedores: Record<string, { nome: string; valor: number }> };

export const dashboardsRoutes = new Hono<AppEnv>();
dashboardsRoutes.use('*', authMiddleware);

dashboardsRoutes.get('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const scopedIds = await scopedClientIds(db, profile, ['ADMIN', 'FINANCEIRO']);

  let proposalQuery = db
    .from('Proposta')
    .select('id,valor,vendedorId,clienteId,vendedor:User!Proposta_vendedorId_fkey(id,nome,unidadeId,unidade:Unidade!User_unidadeId_fkey(nome))')
    .in('status', ['ATIVO', 'ASSINADO'])
    .gte('createdAt', monthStart)
    .lt('createdAt', nextMonth)
    .is('deletedAt', null);
  if (scopedIds?.length === 0) {
    proposalQuery = proposalQuery.in('clienteId', ['00000000-0000-0000-0000-000000000000']);
  } else if (scopedIds) {
    proposalQuery = proposalQuery.in('clienteId', scopedIds);
  }
  const { data: proposals, error: proposalError } = await proposalQuery;
  if (proposalError) return databaseError(c, proposalError, 'Erro ao gerar dashboard');

  const sellers: Record<string, RankingSeller> = {};
  const units: Record<string, RankingUnit> = {};
  for (const proposal of proposals || []) {
    const seller = proposal.vendedor;
    if (!seller) continue;
    const unitId = seller.unidadeId || 'MATRIZ';
    const unitName = seller.unidade?.nome || 'Matriz Global';
    const value = Number(proposal.valor || 0);
    sellers[seller.id] ||= { id: seller.id, nome: seller.nome, unidade: unitName, valor: 0 };
    sellers[seller.id].valor += value;
    units[unitId] ||= { id: unitId, nome: unitName, valor: 0, vendedores: {} };
    units[unitId].valor += value;
    units[unitId].vendedores[seller.id] ||= { nome: seller.nome, valor: 0 };
    units[unitId].vendedores[seller.id].valor += value;
  }
  const rankingVendedores = Object.values(sellers).sort((a, b) => b.valor - a.valor);
  const rankingUnidades = Object.values(units).map((unit) => {
    const ordered = Object.values(unit.vendedores).sort((a, b) => b.valor - a.valor);
    return { id: unit.id, nome: unit.nome, valor: unit.valor, mvp: ordered[0]?.nome || '-' };
  }).sort((a, b) => b.valor - a.valor);

  if (profile.role === 'ADMIN' || profile.role === 'FINANCEIRO') {
    const [financeResult, cancellationResult] = await Promise.all([
      db.from('Financeiro')
        .select('valor')
        .eq('tipo', 'MENSALIDADE')
        .eq('statusPagamento', 'PAGO')
        .gte('dataCompetencia', monthStart)
        .lt('dataCompetencia', nextMonth)
        .is('deletedAt', null),
      db.from('Cancelamento')
        .select('receitaPerdida')
        .gte('dataCancelamento', monthStart)
        .lt('dataCancelamento', nextMonth)
        .is('deletedAt', null),
    ]);
    if (financeResult.error || cancellationResult.error) {
      return databaseError(c, financeResult.error || cancellationResult.error, 'Erro ao gerar dashboard');
    }
    const mrr = (financeResult.data || []).reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const lost = (cancellationResult.data || []).reduce((sum, item) => sum + Number(item.receitaPerdida || 0), 0);
    const base = mrr + lost;
    const churn = base > 0 ? (lost / base) * 100 : 0;
    return c.json({
      tipo: 'GLOBAL',
      mrr,
      churn: churn.toFixed(2),
      novosClientes: 0,
      rankingVendedores,
      rankingUnidades,
    });
  }

  if (profile.role === 'GESTOR_PL') {
    const unitIds = await getAccessibleUnitIds(db, profile);
    if (unitIds.length === 0 || scopedIds?.length === 0) {
      return c.json({ tipo: 'UNIDADE', mrr: 0, churn: 0, notaUnidade: 0, rankingVendedores, rankingUnidades });
    }
    const clientIds = scopedIds || [];
    const { data: finance, error: financeError } = await db
      .from('Financeiro')
      .select('valor')
      .in('clienteId', clientIds)
      .eq('tipo', 'MENSALIDADE')
      .eq('statusPagamento', 'PAGO')
      .gte('dataCompetencia', monthStart)
      .lt('dataCompetencia', nextMonth)
      .is('deletedAt', null);
    if (financeError) return databaseError(c, financeError, 'Erro ao gerar dashboard');
    const mrr = (finance || []).reduce((sum, item) => sum + Number(item.valor || 0), 0);

    const [{ data: analyses, error: analysisError }, { data: collaborators, error: userError }] = await Promise.all([
      db.from('AnaliseCliente').select('notaCSAT').in('clienteId', clientIds).is('deletedAt', null),
      db.from('User').select('id').in('unidadeId', unitIds).is('deletedAt', null),
    ]);
    if (analysisError || userError) return databaseError(c, analysisError || userError, 'Erro ao gerar dashboard');
    const collaboratorIds = (collaborators || []).map((item) => item.id);
    let evaluations: any[] = [];
    if (collaboratorIds.length) {
      const result = await db
        .from('AvaliacaoDesempenho')
        .select('notas,notaGeral')
        .in('colaboradorId', collaboratorIds)
        .is('deletedAt', null);
      if (result.error) return databaseError(c, result.error, 'Erro ao gerar dashboard');
      evaluations = result.data || [];
    }
    const csatValues = (analyses || []).map((item) => Number(item.notaCSAT)).filter(Number.isFinite);
    const csat = csatValues.length ? csatValues.reduce((sum, value) => sum + value, 0) / csatValues.length : 0;
    const evaluationValues = evaluations.map((item) => {
      if (item.notaGeral !== null && item.notaGeral !== undefined) return Number(item.notaGeral);
      const notes = item.notas || {};
      const values = [notes.comunicacao, notes.tecnica, notes.prazos].map(Number).filter(Number.isFinite);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
    }).filter(Number.isFinite);
    const teamScore = evaluationValues.length
      ? evaluationValues.reduce((sum, value) => sum + value, 0) / evaluationValues.length
      : 0;
    const unitScore = csat > 0 && teamScore > 0 ? (csat + teamScore) / 2 : csat || teamScore;
    return c.json({
      tipo: 'UNIDADE',
      mrr,
      notaUnidade: unitScore.toFixed(1),
      rankingVendedores,
      rankingUnidades,
    });
  }

  if (profile.role === 'VENDEDOR') {
    const sales = (proposals || [])
      .filter((proposal) => proposal.vendedorId === profile.id)
      .reduce((sum, proposal) => sum + Number(proposal.valor || 0), 0);
    const target = Number(profile.metas || 0);
    return c.json({
      tipo: 'VENDEDOR',
      vendasMes: sales,
      metasAtingidas: target > 0 ? `${((sales / target) * 100).toFixed(0)}%` : '0%',
      rankingVendedores,
      rankingUnidades,
    });
  }

  return c.json({ tipo: 'COMUM', message: 'Visao padrao' });
});

