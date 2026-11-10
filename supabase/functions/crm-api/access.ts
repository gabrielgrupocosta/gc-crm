import type { DatabaseClient, Profile, Action } from './types.ts';

const MODULE_ALIASES: Record<string, readonly string[]> = {
  clientes: ['clientes', 'vendas'],
  contratos: ['contratos', 'vendas'],
  interacoes: ['interacoes', 'vendas'],
  documentos: ['documentos', 'vendas', 'cs'],
  avaliacoes: ['avaliacoes', 'rh'],
  alertas: ['alertas', 'dashboard', 'vendas', 'financeiro'],
};

export const ROLE_DEFAULT_PERMISSIONS: Record<string, Record<string, Record<Action, boolean>>> = {
  ADMIN: {
    dashboard: { ler: true, criar: true, editar: true, excluir: true },
    vendas: { ler: true, criar: true, editar: true, excluir: true },
    financeiro: { ler: true, criar: true, editar: true, excluir: true },
    unidades: { ler: true, criar: true, editar: true, excluir: true },
  },
  FINANCEIRO: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: true, criar: false, editar: true, excluir: false },
    financeiro: { ler: true, criar: true, editar: true, excluir: true },
    unidades: { ler: true, criar: false, editar: false, excluir: false },
  },
  GESTOR_PL: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: true, criar: true, editar: true, excluir: true },
    financeiro: { ler: true, criar: true, editar: true, excluir: true },
    unidades: { ler: true, criar: false, editar: false, excluir: false },
  },
  VENDEDOR: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: true, criar: true, editar: true, excluir: false },
    financeiro: { ler: false, criar: false, editar: false, excluir: false },
    unidades: { ler: false, criar: false, editar: false, excluir: false },
  },
  SDR_CLOSER: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: true, criar: true, editar: true, excluir: false },
    financeiro: { ler: false, criar: false, editar: false, excluir: false },
    unidades: { ler: false, criar: false, editar: false, excluir: false },
  },
  COLABORADOR: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: false, criar: false, editar: false, excluir: false },
    financeiro: { ler: false, criar: false, editar: false, excluir: false },
    unidades: { ler: false, criar: false, editar: false, excluir: false },
  },
};

export const hasPermission = (
  profile: Profile,
  module: string,
  action: Action,
  defaultRoles: readonly string[] = [],
): boolean => {
  if (profile.role === 'ADMIN') return true;
  const candidates = MODULE_ALIASES[module] || [module];
  let sawExplicitFalse = false;

  for (const key of candidates) {
    const modPerms = profile.permissoes?.[key];
    if (!modPerms) continue;

    // If checking 'ler' (view), having ANY action enabled (ler, criar, editar, excluir) grants view access
    if (action === 'ler') {
      if (modPerms.ler === true || modPerms.criar === true || modPerms.editar === true || modPerms.excluir === true) {
        return true;
      }
      if (modPerms.ler === false) {
        sawExplicitFalse = true;
      }
    } else {
      if (modPerms[action] === true) return true;
      if (modPerms[action] === false) sawExplicitFalse = true;
    }
  }

  if (sawExplicitFalse) return false;
  return defaultRoles.includes(profile.role);
};

export const getAccessibleUnitIds = async (
  db: DatabaseClient,
  profile: Profile,
): Promise<string[]> => {
  const ids = new Set<string>();
  if (profile.unidadeId) ids.add(profile.unidadeId);

  const { data, error } = await db
    .from('Unidade')
    .select('id')
    .eq('responsavelId', profile.id)
    .is('deletedAt', null);

  if (error) throw error;
  for (const unit of data || []) ids.add(unit.id);
  return [...ids];
};

export const canAccessUnit = async (
  db: DatabaseClient,
  profile: Profile,
  unidadeId: string,
  globalRoles: readonly string[] = ['ADMIN'],
): Promise<boolean> => {
  if (globalRoles.includes(profile.role)) return true;
  const ids = await getAccessibleUnitIds(db, profile);
  if (ids.length === 0 && (profile.role === 'VENDEDOR' || profile.role === 'SDR_CLOSER')) {
    return true;
  }
  return ids.includes(unidadeId);
};

export const loadClientInScope = async (
  db: DatabaseClient,
  profile: Profile,
  clienteId: string,
  globalRoles: readonly string[] = ['ADMIN'],
) => {
  const { data, error } = await db
    .from('Cliente')
    .select('*,unidade:Unidade(id,nome,responsavelId)')
    .eq('id', clienteId)
    .is('deletedAt', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { client: null, allowed: false };
  let allowed: boolean;
  if (globalRoles.includes(profile.role)) {
    allowed = true;
  } else if (profile.role === 'VENDEDOR' || profile.role === 'SDR_CLOSER') {
    if (data.vendedorId === profile.id) {
      allowed = true;
    } else {
      const { data: ownProposal } = await db
        .from('Proposta')
        .select('id')
        .eq('clienteId', clienteId)
        .eq('vendedorId', profile.id)
        .is('deletedAt', null)
        .limit(1)
        .maybeSingle();
      allowed = Boolean(ownProposal);
    }
  } else {
    allowed = await canAccessUnit(db, profile, data.unidadeId, []);
  }
  return { client: data, allowed };
};

export const scopedClientIds = async (
  db: DatabaseClient,
  profile: Profile,
  globalRoles: readonly string[] = ['ADMIN'],
): Promise<string[] | null> => {
  if (globalRoles.includes(profile.role)) return null;

  // Sellers (VENDEDOR and SDR_CLOSER) must ONLY see their own clients/sales, never other sellers' clients
  if (profile.role === 'VENDEDOR' || profile.role === 'SDR_CLOSER') {
    const [{ data: ownClients, error: errCli }, { data: ownProposals, error: errProp }] = await Promise.all([
      db.from('Cliente').select('id').eq('vendedorId', profile.id).is('deletedAt', null),
      db.from('Proposta').select('clienteId').eq('vendedorId', profile.id).is('deletedAt', null),
    ]);
    if (errCli) throw errCli;
    if (errProp) throw errProp;
    const ids = new Set<string>();
    for (const c of ownClients || []) if (c.id) ids.add(c.id);
    for (const p of ownProposals || []) if (p.clienteId) ids.add(p.clienteId);
    return [...ids];
  }

  const unitIds = await getAccessibleUnitIds(db, profile);
  if (unitIds.length === 0) return [];
  const { data, error } = await db
    .from('Cliente')
    .select('id')
    .in('unidadeId', unitIds)
    .is('deletedAt', null);
  if (error) throw error;
  return (data || []).map((item) => item.id);
};

export const ensureProposalAccess = async (
  db: DatabaseClient,
  profile: Profile,
  propostaId: string,
) => {
  const { data, error } = await db
    .from('Proposta')
    .select('*,cliente:Cliente(id,nomeFantasia,unidadeId)')
    .eq('id', propostaId)
    .is('deletedAt', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { proposal: null, allowed: false };

  if (profile.role === 'ADMIN' || profile.role === 'FINANCEIRO') {
    return { proposal: data, allowed: true };
  }
  if (profile.role === 'VENDEDOR' || profile.role === 'SDR_CLOSER') {
    return { proposal: data, allowed: data.vendedorId === profile.id };
  }
  return {
    proposal: data,
    allowed: await canAccessUnit(db, profile, data.cliente.unidadeId),
  };
};
