"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const unidadeSchema = z.object({
  nome: z.string().min(1, 'Nome da unidade é obrigatório'),
  cnpj: z.string().optional().or(z.literal('')),
  endereco: z.string().optional().or(z.literal('')),
  responsavelId: z.string().uuid('Selecione um gestor válido'),
});

export default function UnidadesPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(unidadeSchema),
    defaultValues: {
      nome: '',
      cnpj: '',
      endereco: '',
      responsavelId: '',
    }
  });

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
      
      const resUnidades = await axios.get('/api/unidades', { headers });
      setUnidades(resUnidades.data);

      const resUsers = await axios.get('/api/users', { headers });
      setUsuarios(resUsers.data);
    } catch (error) {
      console.error('Erro ao buscar unidades', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.post('/api/unidades', data, { headers });
      setIsModalOpen(false);
      reset();
      fetchData();
    } catch (error) {
      alert('Erro ao salvar unidade: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Unidades da Agência</h1>
          <p className="text-text-subtle text-sm">Gerencie filiais e vincule gestores responsáveis.</p>
        </div>
        <button onClick={() => { reset(); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2">
          <Plus size={16} /> Nova Unidade
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-subtle">Carregando unidades...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Unidade</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">CNPJ</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Gestor Responsável</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider text-right">Clientes Ativos</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map(unidade => (
                <tr key={unidade.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#FF4B2E]/10 p-2 rounded-lg text-[#FF4B2E]">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-text-primary">{unidade.nome}</div>
                        <div className="text-[11px] text-text-subtle">{unidade.endereco || 'Sem endereço'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{unidade.cnpj || 'Não informado'}</td>
                  <td className="px-4 py-3 text-sm text-text-primary font-medium">{unidade.responsavel?.nome}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="bg-[#111111] text-white text-[11px] font-bold px-3 py-1 rounded-full">
                      {unidade._count?.clientes || 0}
                    </span>
                  </td>
                </tr>
              ))}
              {unidades.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-text-subtle">
                    Nenhuma unidade cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-4">Nova Unidade</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Nome da Unidade</label>
                <input {...register('nome')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                {errors.nome && <p className="text-xs text-negative mt-1">{errors.nome.message}</p>}
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">CNPJ (Opcional)</label>
                <input {...register('cnpj')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                {errors.cnpj && <p className="text-xs text-negative mt-1">{errors.cnpj.message}</p>}
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Endereço (Opcional)</label>
                <input {...register('endereco')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                {errors.endereco && <p className="text-xs text-negative mt-1">{errors.endereco.message}</p>}
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Gestor Responsável</label>
                <select {...register('responsavelId')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                  <option value="">Selecione um gestor...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>
                  ))}
                </select>
                {errors.responsavelId && <p className="text-xs text-negative mt-1">{errors.responsavelId.message}</p>}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary px-4 py-2 h-9 text-sm disabled:opacity-50">
                  {isSubmitting ? 'Criando...' : 'Criar Unidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
