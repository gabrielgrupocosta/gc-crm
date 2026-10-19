"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Plus, FileText, Phone, Users, MessageCircle, Calendar, ChevronRight, X, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const clienteSchema = z.object({
  razaoSocial: z.string().min(1, 'Razão social é obrigatória'),
  nomeFantasia: z.string().min(1, 'Nome fantasia é obrigatório'),
  cnpjCpf: z.string().min(11, 'Documento inválido (Mínimo 11 caracteres)'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  unidadeId: z.string().uuid('ID da unidade é obrigatório').optional().or(z.literal('')),
  dataVencimentoContrato: z.string().optional().or(z.literal(''))
});

export default function ClientesPage() {
  const { user, isAdmin } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState(null);
  const [deletingCliente, setDeletingCliente] = useState(null);

  // Detalhes do Cliente e Interações
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [activeTab, setActiveTab] = useState('INTERACOES'); // DOCUMENTOS ou INTERACOES
  const [interacoes, setInteracoes] = useState([]);
  const [loadingInteracoes, setLoadingInteracoes] = useState(false);

  const [tipoInteracao, setTipoInteracao] = useState('WHATSAPP');
  const [descricaoInteracao, setDescricaoInteracao] = useState('');
  const [isSubmittingInteracao, setIsSubmittingInteracao] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      razaoSocial: '',
      nomeFantasia: '',
      cnpjCpf: '',
      email: '',
      telefone: '',
      unidadeId: '',
      dataVencimentoContrato: ''
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const resClientes = await axios.get('/api/clientes', { headers });
      setClientes(resClientes.data);

      const resUnidades = await axios.get('/api/unidades', { headers });
      setUnidades(resUnidades.data);
      
      if (user?.role !== 'ADMIN' && resUnidades.data.length > 0) {
        setValue('unidadeId', resUnidades.data[0].id);
      }
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
      
      if (!isAdmin && unidades.length > 0 && !data.unidadeId) {
        data.unidadeId = unidades[0].id;
      }
      
      if (editingClienteId) {
        await axios.put(`/api/clientes/${editingClienteId}`, data, { headers });
      } else {
        await axios.post('/api/clientes', data, { headers });
      }
      
      setIsModalOpen(false);
      setEditingClienteId(null);
      reset();
      
      if (!isAdmin && unidades.length > 0) {
        setValue('unidadeId', unidades[0].id);
      }
      
      fetchData();
    } catch (error) {
      alert('Erro ao salvar cliente: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (c) => {
    setEditingClienteId(c.id);
    setValue('razaoSocial', c.razaoSocial);
    setValue('nomeFantasia', c.nomeFantasia);
    setValue('cnpjCpf', c.cnpjCpf);
    setValue('email', c.email || '');
    setValue('telefone', c.telefone || '');
    setValue('unidadeId', c.unidadeId || '');
    setValue('dataVencimentoContrato', c.dataVencimentoContrato ? c.dataVencimentoContrato.split('T')[0] : '');
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingCliente) return;
    try {
      const token = Cookies.get('token');
      await axios.delete(`/api/clientes/${deletingCliente.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeletingCliente(null);
      fetchData();
    } catch (error) {
      alert('Erro ao remover cliente.');
    }
  };

  const openDetails = async (cliente) => {
    setSelectedCliente(cliente);
    setIsDetailsOpen(true);
    setActiveTab('INTERACOES');
    fetchInteracoes(cliente.id);
  };

  const fetchInteracoes = async (clienteId) => {
    setLoadingInteracoes(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`/api/interacoes/${clienteId}`, { headers });
      setInteracoes(res.data);
    } catch (error) {
      console.error('Erro ao buscar interações', error);
    } finally {
      setLoadingInteracoes(false);
    }
  };

  const handleCreateInteracao = async (e) => {
    e.preventDefault();
    if (!descricaoInteracao.trim()) return;

    setIsSubmittingInteracao(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.post('/api/interacoes', {
        clienteId: selectedCliente.id,
        tipo: tipoInteracao,
        descricao: descricaoInteracao
      }, { headers });
      
      setDescricaoInteracao('');
      fetchInteracoes(selectedCliente.id);
    } catch (error) {
      alert('Erro ao registrar interação: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmittingInteracao(false);
    }
  };

  const getIconForInteracao = (tipo) => {
    if (tipo === 'CALL') return <Phone size={14} className="text-white" />;
    if (tipo === 'REUNIAO') return <Users size={14} className="text-white" />;
    return <MessageCircle size={14} className="text-white" />;
  };
  
  const getColorForInteracao = (tipo) => {
    if (tipo === 'CALL') return 'bg-brand-blue';
    if (tipo === 'REUNIAO') return 'bg-primary';
    return 'bg-positive'; // WhatsApp
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Clientes (CRM)</h1>
          <p className="text-text-subtle text-sm">Gerencie os clientes da sua agência.</p>
        </div>
        <button onClick={() => { setEditingClienteId(null); reset({ razaoSocial: '', nomeFantasia: '', cnpjCpf: '', email: '', telefone: '', unidadeId: '', dataVencimentoContrato: '' }); if(!isAdmin && unidades.length > 0) setValue('unidadeId', unidades[0].id); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2">
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-subtle">Carregando...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">CNPJ/CPF</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Unidade</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(cliente => (
                <tr key={cliente.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-text-primary">{cliente.nomeFantasia}</div>
                    <div className="text-xs text-text-subtle">{cliente.razaoSocial}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{cliente.cnpjCpf}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{cliente.unidade?.nome}</td>
                  <td className="px-4 py-3">
                    <span className="bg-[#00C896]/10 text-[#00C896] text-[11px] font-semibold px-2 py-1 rounded uppercase tracking-wider">
                      {cliente.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <button onClick={() => openDetails(cliente)} className="text-text-subtle hover:text-primary transition-colors p-1" title="Ver Detalhes e Interações">
                        <FileText size={16} />
                      </button>
                      <button onClick={() => handleEditClick(cliente)} className="p-1 text-text-subtle hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setDeletingCliente(cliente)} className="p-1 text-text-subtle hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded transition-colors" title="Excluir">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-text-subtle">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Novo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-4 text-primary">{editingClienteId ? 'Editar Cliente' : 'Novo Cliente'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Razão Social</label>
                <input {...register('razaoSocial')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                {errors.razaoSocial && <p className="text-xs text-negative mt-1">{errors.razaoSocial.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Nome Fantasia</label>
                  <input {...register('nomeFantasia')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                  {errors.nomeFantasia && <p className="text-xs text-negative mt-1">{errors.nomeFantasia.message}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">CNPJ / CPF</label>
                  <input {...register('cnpjCpf')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                  {errors.cnpjCpf && <p className="text-xs text-negative mt-1">{errors.cnpjCpf.message}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">E-mail</label>
                  <input type="email" {...register('email')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                  {errors.email && <p className="text-xs text-negative mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Telefone</label>
                  <input {...register('telefone')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
                  {errors.telefone && <p className="text-xs text-negative mt-1">{errors.telefone.message}</p>}
                </div>
              </div>
              
              {isAdmin && (
                <div>
                  <label className="text-[11px] font-bold text-text-subtle uppercase">Unidade da Agência</label>
                  <select {...register('unidadeId')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                    <option value="">Selecione...</option>
                    {unidades.map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                  {errors.unidadeId && <p className="text-xs text-negative mt-1">{errors.unidadeId.message}</p>}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Vencimento do Contrato (Opcional)</label>
                <input type="date" {...register('dataVencimentoContrato')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingClienteId(null); }} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary px-4 py-2 h-9 text-sm disabled:opacity-50">
                  {isSubmitting ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Deletar */}
      {deletingCliente && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-2 text-[#DC2626]">Excluir Cliente</h2>
            <p className="text-sm text-text-muted mb-6">
              Tem certeza que deseja excluir <strong>{deletingCliente.nomeFantasia}</strong>? Essa ação fará um soft delete e manterá o histórico financeiro, mas ocultará o cliente.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingCliente(null)} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-md font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes e Interações */}
      {isDetailsOpen && selectedCliente && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-2xl border border-border flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-start bg-primary text-white">
              <div>
                <h2 className="text-xl font-bold">{selectedCliente.nomeFantasia}</h2>
                <p className="text-sm text-white/70">{selectedCliente.razaoSocial} • {selectedCliente.cnpjCpf}</p>
              </div>
              <button onClick={() => setIsDetailsOpen(false)} className="text-white/70 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex border-b border-border bg-[#F9F9F9]">
              <button
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider text-center border-b-2 transition-colors ${activeTab === 'INTERACOES' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-primary'}`}
                onClick={() => setActiveTab('INTERACOES')}
              >
                Histórico de Interações
              </button>
              <button
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider text-center border-b-2 transition-colors ${activeTab === 'DOCUMENTOS' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-primary'}`}
                onClick={() => setActiveTab('DOCUMENTOS')}
              >
                Documentos
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-bg">
              {activeTab === 'DOCUMENTOS' && (
                <div className="text-center text-text-subtle py-8">
                  Módulo de documentos em breve.
                </div>
              )}

              {activeTab === 'INTERACOES' && (
                <div className="flex flex-col gap-6">
                  {/* Form de Nova Interação */}
                  <form onSubmit={handleCreateInteracao} className="bg-surface p-4 rounded-xl border border-border shadow-sm flex flex-col gap-3">
                    <h3 className="text-[13px] font-bold uppercase tracking-wider text-text-subtle mb-1">Registrar Contato</h3>
                    
                    <div className="flex gap-3">
                      <div className="w-1/3">
                        <select 
                          value={tipoInteracao} 
                          onChange={(e) => setTipoInteracao(e.target.value)}
                          className="input w-full bg-white h-9"
                        >
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="CALL">Call / Ligação</option>
                          <option value="REUNIAO">Reunião Presencial</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <input
                          placeholder="Resumo da conversa..."
                          value={descricaoInteracao}
                          onChange={(e) => setDescricaoInteracao(e.target.value)}
                          className="input w-full h-9"
                          required
                        />
                      </div>
                      <button disabled={isSubmittingInteracao} type="submit" className="btn-primary whitespace-nowrap h-9 px-6">
                        Adicionar
                      </button>
                    </div>
                  </form>

                  {/* Linha do Tempo */}
                  <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                    {loadingInteracoes ? (
                      <p className="text-text-subtle text-sm">Carregando interações...</p>
                    ) : interacoes.length === 0 ? (
                      <p className="text-text-subtle text-sm text-center py-4">Nenhum histórico registrado para este cliente.</p>
                    ) : (
                      <div className="relative border-l-2 border-border ml-3 flex flex-col gap-6 py-2">
                        {interacoes.map((int) => (
                          <div key={int.id} className="relative pl-6">
                            {/* Bolinha com Ícone */}
                            <div className={`absolute -left-[15px] top-0.5 h-[28px] w-[28px] rounded-full flex items-center justify-center border-2 border-white ${getColorForInteracao(int.tipo)} shadow-sm`}>
                              {getIconForInteracao(int.tipo)}
                            </div>
                            
                            {/* Conteúdo */}
                            <div className="bg-[#F9F9F9] border border-[#F0F0F0] rounded-lg p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[11px] font-bold text-text-subtle uppercase tracking-wider flex items-center gap-1">
                                  {int.responsavel?.nome} • {int.tipo}
                                </span>
                                <span className="text-[11px] text-text-muted font-medium flex items-center gap-1">
                                  <Calendar size={12}/>
                                  {new Date(int.dataInteracao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                              <p className="text-sm text-text-primary leading-relaxed">
                                {int.descricao}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
