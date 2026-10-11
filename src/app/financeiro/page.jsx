"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const financeiroSchema = z.object({
  tipo: z.enum(['MENSALIDADE', 'VENDA_AVULSA']),
  categoriaServico: z.enum(['TRAFEGO', 'SOCIAL_MEDIA', 'SITES', 'SEO', 'BRANDING', 'OUTROS']).optional().or(z.literal('')),
  descricao: z.string().optional().or(z.literal('')),
  valor: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, 'O valor deve ser maior que zero'),
  dataCompetencia: z.string().min(1, 'Data é obrigatória'),
  statusPagamento: z.enum(['PAGO', 'PENDENTE', 'ATRASADO']).default('PENDENTE'),
  unidadeId: z.string().uuid('Selecione uma unidade').optional().or(z.literal('')),
  clienteId: z.string().uuid('Selecione um cliente'),
});

export default function FinanceiroPage() {
  const { user, isAdmin } = useAuth();
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLancamentoId, setEditingLancamentoId] = useState(null);
  const [deletingLancamento, setDeletingLancamento] = useState(null);

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(financeiroSchema),
    defaultValues: {
      tipo: 'MENSALIDADE',
      statusPagamento: 'PENDENTE',
      unidadeId: '',
      clienteId: '',
      valor: '',
      descricao: '',
      dataCompetencia: ''
    }
  });

  const selectedUnidade = watch('unidadeId');

  useEffect(() => {
    fetchData();
  }, []);

  // Filtra clientes dependendo da unidade selecionada (ou todas se for responsável)
  useEffect(() => {
    if (isAdmin) {
      if (selectedUnidade) {
        setFilteredClientes(clientes.filter(c => c.unidadeId === selectedUnidade));
      } else {
        setFilteredClientes([]);
      }
      // Reseta cliente ao mudar de unidade
      setValue('clienteId', '');
    } else {
      setFilteredClientes(clientes);
    }
  }, [selectedUnidade, clientes, isAdmin, setValue]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const resFin = await axios.get('http://localhost:3333/financeiro', { headers });
      setLancamentos(resFin.data);

      const resCli = await axios.get('http://localhost:3333/clientes', { headers });
      setClientes(resCli.data);

      if (user?.role === 'ADMIN') {
        const resUni = await axios.get('http://localhost:3333/unidades', { headers });
        setUnidades(resUni.data);
      }
    } catch (error) {
      console.error('Erro ao buscar dados financeiros', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // O backend espera o valor como number
      const payload = {
        ...data,
        valor: Number(data.valor),
      };

      if (editingLancamentoId) {
        await axios.put(`http://localhost:3333/financeiro/${editingLancamentoId}`, payload, { headers });
      } else {
        await axios.post('http://localhost:3333/financeiro', payload, { headers });
      }
      setIsModalOpen(false);
      setEditingLancamentoId(null);
      reset();
      fetchData();
    } catch (error) {
      alert('Erro ao salvar lançamento: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (lanc) => {
    setEditingLancamentoId(lanc.id);
    setValue('tipo', lanc.tipo);
    setValue('categoriaServico', lanc.categoriaServico || '');
    setValue('descricao', lanc.descricao || '');
    setValue('valor', String(lanc.valor));
    setValue('dataCompetencia', lanc.dataCompetencia.split('T')[0]);
    setValue('statusPagamento', lanc.statusPagamento);
    setValue('unidadeId', lanc.cliente?.unidade?.id || '');
    setValue('clienteId', lanc.cliente?.id || '');
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingLancamento) return;
    try {
      const token = Cookies.get('token');
      await axios.delete(`http://localhost:3333/financeiro/${deletingLancamento.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeletingLancamento(null);
      fetchData();
    } catch (error) {
      alert('Erro ao remover lançamento.');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Financeiro</h1>
          <p className="text-text-subtle text-sm">Lançamentos de mensalidades e vendas avulsas de projetos.</p>
        </div>
        <button onClick={() => { setEditingLancamentoId(null); reset({ tipo: 'MENSALIDADE', statusPagamento: 'PENDENTE', unidadeId: '', clienteId: '', valor: '', descricao: '', dataCompetencia: '' }); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2">
          <Plus size={16} /> Novo Lançamento
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-subtle">Carregando lançamentos...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Unidade</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Descrição / Tipo</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Valor (R$)</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map(lanc => (
                <tr key={lanc.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-text-primary">
                    {new Date(lanc.dataCompetencia).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary font-semibold">
                    {lanc.cliente?.nomeFantasia}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {lanc.cliente?.unidade?.nome}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-text-primary">{lanc.descricao || 'Referente ao contrato'}</div>
                    <div className="text-[11px] text-text-subtle font-bold uppercase tracking-wider">{lanc.tipo.replace('_', ' ')}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-text-primary">
                    R$ {Number(lanc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded uppercase tracking-wider ${
                      lanc.statusPagamento === 'PAGO' ? 'bg-[#00C896]/10 text-[#00C896]' :
                      lanc.statusPagamento === 'PENDENTE' ? 'bg-[#CA8A04]/10 text-[#B45309]' :
                      'bg-[#DC2626]/10 text-[#DC2626]'
                    }`}>
                      {lanc.statusPagamento}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEditClick(lanc)} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setDeletingLancamento(lanc)} className="p-1.5 text-text-muted hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded transition-colors" title="Excluir">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {lancamentos.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-text-subtle">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-4">{editingLancamentoId ? 'Editar Lançamento' : 'Lançamento Financeiro'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Tipo de Receita</label>
                  <select {...register('tipo')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                    <option value="MENSALIDADE">Mensalidade (Fee Mensal)</option>
                    <option value="VENDA_AVULSA">Venda Avulsa (Projeto)</option>
                  </select>
                  {errors.tipo && <p className="text-xs text-negative mt-1">{errors.tipo.message}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Categoria</label>
                  <select {...register('categoriaServico')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                    <option value="">Selecione...</option>
                    <option value="TRAFEGO">Tráfego Pago</option>
                    <option value="SOCIAL_MEDIA">Social Media</option>
                    <option value="SITES">Sites e LPs</option>
                    <option value="SEO">SEO</option>
                    <option value="BRANDING">Branding</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                  {errors.categoriaServico && <p className="text-xs text-negative mt-1">{errors.categoriaServico.message}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Data de Competência</label>
                  <input type="date" {...register('dataCompetencia')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                  {errors.dataCompetencia && <p className="text-xs text-negative mt-1">{errors.dataCompetencia.message}</p>}
                </div>
              </div>

              {isAdmin && (
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Unidade</label>
                  <select {...register('unidadeId')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                    <option value="">Selecione a Unidade primeiro...</option>
                    {unidades.map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                  {errors.unidadeId && <p className="text-xs text-negative mt-1">{errors.unidadeId.message}</p>}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Cliente Vinculado</label>
                <select {...register('clienteId')} disabled={isAdmin && !selectedUnidade} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white disabled:bg-gray-100 disabled:cursor-not-allowed">
                  <option value="">{isAdmin && !selectedUnidade ? 'Selecione uma unidade acima' : 'Selecione o Cliente...'}</option>
                  {filteredClientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nomeFantasia}</option>
                  ))}
                </select>
                {errors.clienteId && <p className="text-xs text-negative mt-1">{errors.clienteId.message}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Descrição do Lançamento</label>
                <input {...register('descricao')} placeholder="Ex: Campanha de Black Friday" className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                {errors.descricao && <p className="text-xs text-negative mt-1">{errors.descricao.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Valor (R$)</label>
                  <input type="number" step="0.01" {...register('valor')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                  {errors.valor && <p className="text-xs text-negative mt-1">{errors.valor.message}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Status do Pagamento</label>
                  <select {...register('statusPagamento')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                    <option value="PENDENTE">Pendente</option>
                    <option value="PAGO">Pago</option>
                    <option value="ATRASADO">Atrasado</option>
                  </select>
                  {errors.statusPagamento && <p className="text-xs text-negative mt-1">{errors.statusPagamento.message}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingLancamentoId(null); }} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary px-4 py-2 h-9 text-sm disabled:opacity-50">
                  {isSubmitting ? 'Salvando...' : 'Salvar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingLancamento && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-2 text-[#DC2626]">Excluir Lançamento</h2>
            <p className="text-sm text-text-muted mb-6">
              Tem certeza que deseja excluir o lançamento de <strong>R$ {Number(deletingLancamento.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingLancamento(null)} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-md font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
