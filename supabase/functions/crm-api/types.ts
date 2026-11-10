import type { SupabaseClient, User as SupabaseAuthUser } from 'npm:@supabase/supabase-js@2.118.0';

export const ROLES = [
  'ADMIN',
  'FINANCEIRO',
  'GESTOR_PL',
  'VENDEDOR',
  'SDR_CLOSER',
  'COLABORADOR',
] as const;

export type Role = (typeof ROLES)[number];
export type Action = 'ler' | 'criar' | 'editar' | 'excluir';

export interface Profile {
  id: string;
  nome: string;
  email: string;
  role: Role;
  tipoVendedor: 'GC' | 'TERCEIRIZADO' | null;
  metas: string | number | null;
  gestorId: string | null;
  unidadeId: string | null;
  permissoes: Record<string, Record<string, boolean>> | null;
  deletedAt: string | null;
}

export type DatabaseClient = SupabaseClient<any, 'public', any>;

export type AppEnv = {
  Variables: {
    authUser: SupabaseAuthUser;
    profile: Profile;
    userClient: DatabaseClient;
    db: DatabaseClient;
    accessToken: string;
  };
};

export type JsonRecord = Record<string, unknown>;

