"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Plus, CheckCircle, Clock, Upload, Paperclip, Eye, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function ContratosPage() {
  const { user } = useAuth();
  const [propostas, setPropostas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPropostaId, setUploadingPropostaId] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [newDocName, setNewDocName] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { status: 'RASCUNHO' }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [resPropostas, resClientes] = await Promise.all([
        axios.get('http://localhost:3333/contratos', { headers }),
        axios.get('http://localhost:3333/clientes', { headers })
      ]);
      setPropostas(resPropostas.data);
      setClientes(resClientes.data);
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
      data.vendedorId = user.id; // Assign to self for now
      data.valor = parseFloat(data.valor);
      
      await axios.post('http://localhost:3333/contratos', data, { headers });
      setIsModalOpen(false);
      reset();
      fetchData();
    } catch (error) {
      alert('Erro ao salvar contrato: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RASCUNHO': return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold">RASCUNHO</span>;
      case 'ENVIADO': return <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-[10px] font-bold">ENVIADO</span>;
      case 'ASSINADO': return <span className="px-2 py-1 bg-green-100 text-green-600 rounded text-[10px] font-bold">ASSINADO</span>;
      case 'ATIVO': return <span className="px-2 py-1 bg-primary/10 text-primary rounded text-[10px] font-bold">ATIVO</span>;
      default: return null;
    }
  };

  const handleFileChange = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingPropostaId(id);
    try {
      const token = Cookies.get('token');
      await axios.post(`http://localhost:3333/contratos/${id}/upload`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('Contrato anexado com sucesso!');
      fetchData();
    } catch (error) {
      alert('Erro ao anexar o contrato.');
    } finally {
      setUploadingPropostaId(null);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const token = Cookies.get('token');
      await axios.patch(`http://localhost:3333/contratos/${id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      alert('Erro ao atualizar status.');
    }
  };

  const handleViewPDF = (url) => {
    window.open(`http://localhost:3333${url}`, '_blank');
  };

  const handleEditDoc = (doc) => {
    setEditingDoc(doc);
    setNewDocName(doc.nomeArquivo);
  };

  const submitEditDoc = async () => {
    try {
      const token = Cookies.get('token');
      await axios.put(`http://localhost:3333/documentos/${editingDoc.id}`, { nomeArquivo: newDocName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingDoc(null);
      fetchData();
    } catch (error) {
      alert('Erro ao renomear documento.');
    }
  };

  const confirmDeleteDoc = async () => {
    try {
      const token = Cookies.get('token');
      await axios.delete(`http://localhost:3333/documentos/${deletingDoc.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeletingDoc(null);
      fetchData();
    } catch (error) {
      alert('Erro ao excluir documento.');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Gestão de Contratos</h1>
          <p className="text-text-subtle text-sm">Visualize o fluxo de propostas comerciais.</p>
        </div>
        <button onClick={() => { reset(); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2">
          <Plus size={16} /> Nova Proposta
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-subtle">Carregando contratos...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Vendedor</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Valor (R$)</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Criação</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map(p => (
                <tr key={p.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-primary" />
                      {p.cliente?.nomeFantasia}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{p.vendedor?.nome}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                    R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.status}
                      onChange={(e) => handleStatusChange(p.id, e.target.value)}
                      className={`px-2 py-1 rounded text-[10px] font-bold border-none outline-none cursor-pointer ${
                        p.status === 'RASCUNHO' ? 'bg-gray-100 text-gray-600' :
                        p.status === 'ENVIADO' ? 'bg-blue-100 text-blue-600' :
                        p.status === 'ASSINADO' ? 'bg-green-100 text-green-600' :
                        p.status === 'ATIVO' ? 'bg-primary/10 text-primary' : ''
                      }`}
                    >
                      <option value="RASCUNHO">RASCUNHO</option>
                      <option value="ENVIADO">ENVIADO</option>
                      <option value="ASSINADO">ASSINADO</option>
                      <option value="ATIVO">ATIVO</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.documentos && p.documentos.length > 0 ? (
                      <div className="flex justify-end gap-2 items-center">
                        <button
                          onClick={() => handleViewPDF(p.documentos[0].urlCaminho)}
                          title="Visualizar Contrato Anexado"
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEditDoc(p.documentos[0])}
                          title="Renomear Arquivo"
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <label className="p-1.5 text-text-muted hover:text-[#CA8A04] hover:bg-[#CA8A04]/10 rounded-md transition-colors cursor-pointer" title="Substituir Anexo">
                          <Upload size={16} />
                          <input type="file" className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e, p.id)} disabled={uploadingPropostaId === p.id} />
                        </label>
                        <button
                          onClick={() => setDeletingDoc(p.documentos[0])}
                          title="Excluir Anexo"
                          className="p-1.5 text-text-muted hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded-md transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface text-text-muted hover:text-primary hover:bg-primary/10 border border-border rounded-md text-xs font-semibold cursor-pointer transition-colors">
                        {uploadingPropostaId === p.id ? (
                          <span className="animate-pulse">Enviando...</span>
                        ) : (
                          <>
                            <Paperclip size={14} /> Anexar
                            <input type="file" className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e, p.id)} disabled={uploadingPropostaId === p.id} />
                          </>
                        )}
                      </label>
                    )}
                  </td>
                </tr>
              ))}
              {propostas.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-text-muted">Nenhuma proposta encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-4">Nova Proposta</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Cliente</label>
                <select {...register('clienteId', { required: true })} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                  <option value="">Selecione o Cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Valor Bruto (R$)</label>
                <input type="number" step="0.01" {...register('valor', { required: true })} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Status Inicial</label>
                <select {...register('status')} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="ENVIADO">Enviado</option>
                  <option value="ASSINADO">Assinado</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Descrição (Opcional)</label>
                <textarea {...register('descricao')} className="input w-full mt-1 p-3 border border-border rounded-md h-20 resize-none"></textarea>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary px-4 py-2 h-9 text-sm disabled:opacity-50">
                  {isSubmitting ? 'Salvando...' : 'Salvar Proposta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingDoc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-4">Renomear Documento</h2>
            <input 
              value={newDocName} 
              onChange={e => setNewDocName(e.target.value)} 
              className="input w-full h-9 px-3 border border-border rounded-md mb-4" 
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingDoc(null)} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
              <button onClick={submitEditDoc} className="btn-primary px-4 py-2 text-sm h-9">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {deletingDoc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-2 text-[#DC2626]">Excluir Anexo</h2>
            <p className="text-sm text-text-muted mb-6">
              Tem certeza que deseja excluir o anexo <strong>{deletingDoc.nomeArquivo}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingDoc(null)} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
              <button onClick={confirmDeleteDoc} className="px-4 py-2 text-sm text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-md font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
