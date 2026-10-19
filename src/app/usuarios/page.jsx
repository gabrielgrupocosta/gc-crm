"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useAuth } from '../../contexts/AuthContext';
import { UserCog, Plus, ShieldAlert, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const userSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Formato de e-mail inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.enum(['ADMIN', 'FINANCEIRO', 'GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER', 'COLABORADOR']),
  tipoVendedor: z.enum(['GC', 'TERCEIRIZADO', '']).optional().transform(v => v === '' ? null : v),
  metas: z.string().optional().nullable(),
  gestorId: z.string().uuid().optional().or(z.literal('')).transform(v => v === '' ? null : v),
  unidadeId: z.string().uuid().optional().or(z.literal('')).transform(v => v === '' ? null : v)
});

const MODULOS = [
  { id: 'dashboard', nome: 'Dashboard' },
  { id: 'dev', nome: 'DEV' },
  { id: 'design', nome: 'Design' },
  { id: 'administracao', nome: 'Administração' },
  { id: 'financeiro', nome: 'Financeiro' },
  { id: 'marketing', nome: 'Marketing' },
  { id: 'vendas', nome: 'Vendas' },
  { id: 'cs', nome: 'CS' },
  { id: 'rh', nome: 'RH' },
  { id: 'unidades', nome: 'Unidades' }
];

const ACOES = [
  { id: 'ler', nome: 'Visualizar' },
  { id: 'criar', nome: 'Criar' },
  { id: 'editar', nome: 'Editar' },
  { id: 'excluir', nome: 'Excluir' }
];

export default function UsuariosPage() {
  const { isAdmin, user: loggedUser } = useAuth();
  const router = useRouter();
  
  const [usuarios, setUsuarios] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [permissionsState, setPermissionsState] = useState({});

  const { register, handleSubmit, reset, watch, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      nome: '', email: '', senha: '', role: 'COLABORADOR',
      tipoVendedor: '', metas: '', gestorId: '', unidadeId: ''
    }
  });

  const selectedRole = watch('role');

  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [isAdmin, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [resUsers, resUnits] = await Promise.all([
        axios.get('/api/users', { headers }),
        axios.get('/api/unidades', { headers })
      ]);
      
      setUsuarios(resUsers.data);
      setUnidades(resUnits.data);
    } catch (error) {
      console.error('Erro ao buscar dados', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      if (editingUserId) {
        await axios.put(`/api/users/${editingUserId}`, data, { headers });
      } else {
        await axios.post('/api/users', data, { headers });
      }

      setIsModalOpen(false);
      setEditingUserId(null);
      reset();
      fetchData();
    } catch (error) {
      alert('Erro ao salvar usuário: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setValue('nome', u.nome);
    setValue('email', u.email);
    setValue('role', u.role);
    setValue('tipoVendedor', u.tipoVendedor || '');
    setValue('metas', u.metas ? String(u.metas) : '');
    setValue('gestorId', u.gestor?.id || '');
    setValue('unidadeId', u.unidade?.id || '');
    // Senha opcional na edição
    setValue('senha', '********'); // dummy
    setIsModalOpen(true);
  };

  const handlePermissionsClick = (u) => {
    setPermissionsUser(u);
    const initialPerms = u.permissoes || {};
    const formattedPerms = {};
    MODULOS.forEach(m => {
      formattedPerms[m.id] = {
        ler: initialPerms[m.id]?.ler || false,
        criar: initialPerms[m.id]?.criar || false,
        editar: initialPerms[m.id]?.editar || false,
        excluir: initialPerms[m.id]?.excluir || false,
      };
    });
    setPermissionsState(formattedPerms);
    setIsPermissionsModalOpen(true);
  };

  const togglePermission = (moduloId, acaoId) => {
    setPermissionsState(prev => ({
      ...prev,
      [moduloId]: {
        ...prev[moduloId],
        [acaoId]: !prev[moduloId][acaoId]
      }
    }));
  };

  const setAllPermissions = (value) => {
    const newState = {};
    MODULOS.forEach(m => {
      newState[m.id] = {
        ler: value,
        criar: value,
        editar: value,
        excluir: value
      };
    });
    setPermissionsState(newState);
  };

  const savePermissions = async () => {
    try {
      const token = Cookies.get('token');
      await axios.put(`/api/users/${permissionsUser.id}/permissoes`,
        { permissoes: permissionsState },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsPermissionsModalOpen(false);
      setPermissionsUser(null);
      fetchData();
    } catch (error) {
      alert('Erro ao salvar permissões');
    }
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    try {
      const token = Cookies.get('token');
      await axios.delete(`/api/users/${deletingUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeletingUser(null);
      fetchData();
    } catch (error) {
      alert('Erro ao remover usuário.');
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Gestão de Acessos</h1>
          <p className="text-text-subtle text-sm">Controle quem pode acessar o CRM da Agência.</p>
        </div>
        <button onClick={() => { setEditingUserId(null); reset({ nome: '', email: '', senha: '', role: 'COLABORADOR', tipoVendedor: '', metas: '', gestorId: '', unidadeId: '' }); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2">
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-subtle">Carregando acessos...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Contato / Unidade</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Gestor Direto</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Perfil (Role)</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Acesso</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#00C896]/10 p-2 rounded-lg text-[#00C896]">
                        <UserCog size={18} />
                      </div>
                      <div className="font-semibold text-text-primary">
                        {u.nome} {loggedUser?.id === u.id && <span className="text-xs font-normal text-text-subtle ml-1">(Você)</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    <div>{u.email}</div>
                    <div className="text-xs text-primary font-medium mt-0.5">{u.unidade?.nome || 'Matriz / Global'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{u.gestor?.nome || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${u.role === 'ADMIN' ? 'bg-[#FF4B2E]/10 text-[#FF4B2E]' : 'bg-[#E8E8E8] text-[#666666]'}`}>
                      {u.role === 'ADMIN' && <ShieldAlert size={10} className="inline mr-1" />}
                      {u.role.replace('_', ' ')}
                    </span>
                    {u.tipoVendedor && <div className="text-[10px] text-text-subtle mt-1 uppercase">{u.tipoVendedor}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handlePermissionsClick(u)} title="Permissões" className="p-1.5 text-text-muted hover:text-[#CA8A04] hover:bg-[#CA8A04]/10 rounded-md transition-colors">
                        <ShieldCheck size={16} />
                      </button>
                      <button onClick={() => handleEditClick(u)} title="Editar" className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setDeletingUser(u)} title="Excluir" className="p-1.5 text-text-muted hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded-md transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-4">{editingUserId ? 'Editar Acesso' : 'Novo Acesso'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Nome Completo</label>
                <input {...register('nome')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                {errors.nome && <p className="text-xs text-negative mt-1">{errors.nome.message}</p>}
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">E-mail Corporativo</label>
                <input type="email" {...register('email')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                {errors.email && <p className="text-xs text-negative mt-1">{errors.email.message}</p>}
              </div>
              {!editingUserId && (
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Senha Inicial</label>
                  <input type="password" {...register('senha')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                  {errors.senha && <p className="text-xs text-negative mt-1">{errors.senha.message}</p>}
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Perfil de Acesso</label>
                <select {...register('role')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                  <option value="COLABORADOR">Colaborador Comum</option>
                  <option value="SDR_CLOSER">SDR / Closer</option>
                  <option value="VENDEDOR">Vendedor</option>
                  <option value="GESTOR_PL">Gestor / PL (Líder de Unidade)</option>
                  <option value="FINANCEIRO">Financeiro</option>
                  <option value="ADMIN">Administrador Global</option>
                </select>
                {errors.role && <p className="text-xs text-negative mt-1">{errors.role.message}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Unidade Base</label>
                  <select {...register('unidadeId')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                    <option value="">Matriz / Global</option>
                    {unidades.map(un => <option key={un.id} value={un.id}>{un.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Gestor Direto</label>
                  <select {...register('gestorId')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                    <option value="">Nenhum (Subordinação Direta)</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>)}
                  </select>
                </div>
              </div>

              {selectedRole === 'VENDEDOR' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-text-subtle uppercase">Tipo de Vendedor</label>
                    <select {...register('tipoVendedor')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                      <option value="">Selecione...</option>
                      <option value="GC">Grupo Costa (Interno)</option>
                      <option value="TERCEIRIZADO">Terceirizado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-text-subtle uppercase">Meta Mensal (R$)</label>
                    <input type="number" step="0.01" {...register('metas')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" placeholder="Ex: 50000.00" />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingUserId(null); }} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary px-4 py-2 h-9 text-sm disabled:opacity-50">
                  {isSubmitting ? 'Salvando...' : 'Salvar Acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-2 text-[#DC2626]">Excluir Usuário</h2>
            <p className="text-sm text-text-muted mb-6">
              Tem certeza que deseja excluir <strong>{deletingUser.nome}</strong>? Essa ação fará um soft delete.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingUser(null)} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-md font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {isPermissionsModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-border">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold mb-1">Matriz de Permissões</h2>
                <p className="text-sm text-text-muted">Parametrizar acessos para <strong>{permissionsUser?.nome}</strong></p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAllPermissions(false)} className="px-3 py-1.5 text-xs text-text-muted hover:bg-[#F9F9F9] rounded border border-border transition-colors">
                  Desmarcar Todos
                </button>
                <button type="button" onClick={() => setAllPermissions(true)} className="px-3 py-1.5 text-xs text-primary bg-primary/10 hover:bg-primary/20 rounded font-semibold transition-colors">
                  Ativar Todos
                </button>
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto mb-4 border border-border rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#F9F9F9] border-b border-border z-10">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Módulo</th>
                    {ACOES.map(a => (
                      <th key={a.id} className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider text-center">{a.nome}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULOS.map(m => (
                    <tr key={m.id} className="border-b border-[#F3F3F3]">
                      <td className="px-4 py-3 font-semibold text-text-primary text-sm">{m.nome}</td>
                      {ACOES.map(a => (
                        <td key={`${m.id}-${a.id}`} className="px-4 py-3 text-center">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={permissionsState[m.id]?.[a.id] || false}
                              onChange={() => togglePermission(m.id, a.id)}
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => { setIsPermissionsModalOpen(false); setPermissionsUser(null); }} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
              <button onClick={savePermissions} className="btn-primary px-4 py-2 text-sm">Salvar Permissões</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
