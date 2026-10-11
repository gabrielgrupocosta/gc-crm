"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useAuth } from '../../../contexts/AuthContext';
import { Star, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function RHEquipePage() {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { can } = useAuth();

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [resAvaliacoes, resUsers] = await Promise.all([
        axios.get('http://localhost:3333/avaliacoes', { headers }),
        axios.get('http://localhost:3333/users', { headers })
      ]);
      setAvaliacoes(resAvaliacoes.data);
      setColaboradores(resUsers.data);
    } catch (error) {
      console.error('Erro ao buscar dados', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const payload = {
        colaboradorId: data.colaboradorId,
        mesReferencia: data.mesReferencia,
        notaGeral: parseInt(data.notaGeral),
        feedbackTexto: data.feedbackTexto
      };

      await axios.post('http://localhost:3333/avaliacoes', payload, { headers });
      setIsModalOpen(false);
      reset();
      fetchData();
    } catch (error) {
      alert('Erro ao salvar avaliação: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Recursos Humanos</h1>
          <p className="text-text-subtle text-sm">Avaliações de desempenho mensais da equipe.</p>
        </div>
        {can('rh', 'criar') && (
          <button onClick={() => { reset(); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2">
            <Plus size={16} /> Nova Avaliação
          </button>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-subtle">Carregando avaliações...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Colaborador</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Avaliador (Gestor)</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Mês Ref.</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Média (1-5)</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {avaliacoes.map(a => {
                const media = a.notaGeral ?? ((a.notas?.comunicacao + a.notas?.tecnica + a.notas?.prazos) / 3).toFixed(1);
                return (
                  <tr key={a.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      <div className="flex items-center gap-2">
                        <Star size={16} className="text-primary" />
                        {a.colaborador?.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted">{a.avaliador?.nome}</td>
                    <td className="px-4 py-3 text-sm text-text-muted">{new Date(a.mesReferencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
                    <td className="px-4 py-3 text-sm font-bold text-text-primary">{!isNaN(media) ? media : 'N/A'}</td>
                    <td className="px-4 py-3 text-xs text-text-muted max-w-[200px] truncate">{a.feedbackTexto || a.feedback || '-'}</td>
                  </tr>
                );
              })}
              {avaliacoes.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-text-muted">Nenhuma avaliação encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-2xl border border-border">
            <h2 className="text-lg font-bold mb-4">Avaliação de Desempenho</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Liderado (Colaborador)</label>
                <select {...register('colaboradorId', { required: true })} className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white">
                  <option value="">Selecione...</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.role})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Mês de Referência</label>
                <input type="month" {...register('mesReferencia', { required: true })} className="input w-full mt-1 h-9 px-3 border border-border rounded-md" />
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-text-subtle uppercase">Nota Geral do Mês (1-5)</label>
                  <input type="number" min="1" max="5" {...register('notaGeral', { required: true })} className="input w-full mt-1 h-9 px-2 border border-border rounded-md" placeholder="Ex: 4" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-subtle uppercase">Feedback Detalhado</label>
                <textarea {...register('feedbackTexto', { required: true })} className="input w-full mt-1 p-3 border border-border rounded-md h-24 resize-none" placeholder="Escreva o feedback motivacional ou corretivo..."></textarea>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border">Cancelar</button>
                <button type="submit" className="btn-primary px-4 py-2 h-9 text-sm">Salvar Avaliação</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
