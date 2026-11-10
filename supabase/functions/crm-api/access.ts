import type { DatabaseClient, Profile, Action } from './types.ts';

const MODULE_ALIASES: Record<string, readonly string[]> = {
  clientes: ['clientes', 'vendas'],
  contratos: ['contratos', 'vendas'],
  interacoes: ['interacoes', 'vendas'],
  documentos: ['documentos', 'vendas', 'cs'],
  avaliacoes: ['avaliacoes', 'rh'],
  alertas: ['alertas', 'dashboard', 'vendas', 'financeiro'],
};

export const hasPermission = (
  profile: Profile,
  module: string,
  action: Action,
  defaultRoles: readonly string[] = [],
): boolean => {
  if (profile.role === 'ADMIN') return true;
  const candidates = MODULE_ALIASES[module] || [module];
  for (const key of candidates) {
    const explicit = profile.permissoes?.[key]?.[action];
    if (explicit === true) return true;
    if (explicit === false && key === module) return false;
  }
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
  } else if (profile.role === 'VENDEDOR') {
    allowed = data.vendedorId === profile.id;
  } else if (profile.role === 'SDR_CLOSER') {
    allowed = data.status === 'PROSPECCAO'
      && await canAccessUnit(db, profile, data.unidadeId, []);
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
  let query = db.from('Cliente').select('id').is('deletedAt', null);
  if (profile.role === 'VENDEDOR') {
    query = query.eq('vendedorId', profile.id);
  } else {
    const unitIds = await getAccessibleUnitIds(db, profile);
    if (unitIds.length === 0) return [];
    query = query.in('unidadeId', unitIds);
    if (profile.role === 'SDR_CLOSER') query = query.eq('status', 'PROSPECCAO');
  }
  const { data, error } = await query;
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
