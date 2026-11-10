"use client";

import { useState } from 'react';
import { Star, Plus, Users } from 'lucide-react';
import {
  MOCK_RH_INDICADORES,
  MOCK_RH_COLABORADORES,
  MOCK_RH_AVALIACOES,
} from '../../../mocks/crm2SistemaData';

export default function RHEquipePage() {
  const [activeTab, setActiveTab] = useState('avaliacoes');
  const [colaboradores] = useState(MOCK_RH_COLABORADORES);
  const [avaliacoes, setAvaliacoes] = useState(MOCK_RH_AVALIACOES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState({
    colaboradorId: MOCK_RH_COLABORADORES[0]?.id || '',
    mesReferencia: '2026-11-01',
    notaGeral: '5',
    feedbackTexto: '',
  });

  const handleCreateMockAvaliacao = (e) => {
    e.preventDefault();
    const colab = colaboradores.find((c) => c.id === formState.colaboradorId) || colaboradores[0];
    const nova = {
      id: `rh-ava-${Date.now()}`,
      colaborador: { id: colab.id, nome: colab.nome, cargo: colab.cargo },
      avaliador: { nome: 'Diretoria Grupo Costa' },
      mesReferencia: new Date(formState.mesReferencia).toISOString(),
      notaGeral: Number(formState.notaGeral),
      feedbackTexto: formState.feedbackTexto || 'Avaliação registrada (Mock).',
    };
    setAvaliacoes((prev) => [nova, ...prev]);
    setIsModalOpen(false);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Recursos Humanos</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 text-amber-800">
              CRM 2 · Mock
            </span>
          </div>
          <p className="text-text-subtle text-sm">
            Quadro de colaboradores e avaliações de desempenho mensais (dados mockados para o Sistema 2).
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus size={16} /> Nova Avaliação (Mock)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Colaboradores Ativos</span>
          <div className="text-2xl font-extrabold text-text-primary mt-1">{MOCK_RH_INDICADORES.totalColaboradores}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Média de Desempenho</span>
          <div className="text-2xl font-extrabold text-primary mt-1">{MOCK_RH_INDICADORES.mediaDesempenhoGeral} / 5.0</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Avaliações no Mês</span>
          <div className="text-2xl font-extrabold text-text-primary mt-1">{MOCK_RH_INDICADORES.avaliacoesNoMes}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">PDIs em Andamento</span>
          <div className="text-2xl font-extrabold text-green-600 mt-1">{MOCK_RH_INDICADORES.pdisAtivos}</div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('avaliacoes')}
          className={`px-4 py-2 font-bold text-sm rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'avaliacoes' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Star size={16} /> Avaliações de Desempenho
        </button>
        <button
          onClick={() => setActiveTab('equipe')}
          className={`px-4 py-2 font-bold text-sm rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'equipe' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Users size={16} /> Quadro de Colaboradores
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {activeTab === 'avaliacoes' ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Colaborador</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Avaliador</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Mês Ref.</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Nota (1-5)</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {avaliacoes.map((a) => (
                <tr key={a.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    <div className="flex items-center gap-2">
                      <Star size={16} className="text-primary" />
                      <div>
                        <div>{a.colaborador?.nome}</div>
                        <div className="text-xs font-normal text-text-subtle">{a.colaborador?.cargo}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{a.avaliador?.nome}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {new Date(a.mesReferencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-text-primary">{a.notaGeral}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{a.feedbackTexto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cargo / Setor</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Unidade</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Admissão</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((c) => (
                <tr key={c.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-text-primary">{c.nome}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    <div>{c.cargo}</div>
                    <div className="text-xs text-text-subtle">{c.setor}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{c.unidade}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{new Date(c.admissao).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-bold text-[10px]">{c.status}</span>
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
            <h2 className="text-lg font-bold mb-4">Registrar Avaliação (Mock)</h2>
            <form onSubmit={handleCreateMockAvaliacao} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-text-subtle uppercase">Colaborador</label>
                <select
                  value={formState.colaboradorId}
                  onChange={(e) => setFormState((s) => ({ ...s, colaboradorId: e.target.value }))}
                  className="input w-full mt-1 h-9 px-3 border border-border rounded-md bg-white"
                >
                  {colaboradores.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.cargo})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-subtle uppercase">Data / Mês de Referência</label>
                <input
                  type="date"
                  value={formState.mesReferencia}
                  onChange={(e) => setFormState((s) => ({ ...s, mesReferencia: e.target.value }))}
                  className="input w-full mt-1 h-9 px-3 border border-border rounded-md"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-subtle uppercase">Nota Geral (1 a 5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={formState.notaGeral}
                  onChange={(e) => setFormState((s) => ({ ...s, notaGeral: e.target.value }))}
                  className="input w-full mt-1 h-9 px-3 border border-border rounded-md"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-subtle uppercase">Feedback Escrito</label>
                <textarea
                  rows="3"
                  value={formState.feedbackTexto}
                  onChange={(e) => setFormState((s) => ({ ...s, feedbackTexto: e.target.value }))}
                  className="input w-full mt-1 p-3 border border-border rounded-md"
                  placeholder="Observações sobre o desempenho..."
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:bg-[#F9F9F9] rounded-md border border-border"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary px-4 py-2 text-sm">
                  Salvar Avaliação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
