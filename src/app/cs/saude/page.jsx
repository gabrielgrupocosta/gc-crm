"use client";

import { useState } from 'react';
import { HeartHandshake, UserMinus, Star, Plus, AlertTriangle } from 'lucide-react';
import {
  MOCK_CS_INDICADORES,
  MOCK_CS_ANALISES,
  MOCK_CS_CANCELAMENTOS,
  MOCK_CS_PONTUACAO_HANDOFF,
} from '../../../mocks/crm2SistemaData';

export default function CSSaudePage() {
  const [analises, setAnalises] = useState(MOCK_CS_ANALISES);
  const [cancelamentos] = useState(MOCK_CS_CANCELAMENTOS);
  const [handoffs, setHandoffs] = useState(MOCK_CS_PONTUACAO_HANDOFF);
  const [activeTab, setActiveTab] = useState('saude');

  const handlePontuarOperador = (id, nota) => {
    setHandoffs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notaOperador: nota } : item))
    );
  };

  const handleNovaAnaliseMock = () => {
    const nova = {
      id: `cs-ana-${Date.now()}`,
      cliente: { nomeFantasia: 'Novo Cliente Monitorado (Mock)', unidade: 'Matriz Curitiba' },
      csResponsavel: 'Camila Rocha',
      mesReferencia: new Date().toISOString(),
      notaCSAT: 9,
      classificacao: 'SAUDAVEL',
      ultimoContato: new Date().toISOString().slice(0, 10),
      riscos: 'Sem riscos identificados.',
      planoAcao: 'Acompanhamento quinzenal padrão.',
    };
    setAnalises((prev) => [nova, ...prev]);
  };

  const getSaudeBadge = (classificacao) => {
    switch (classificacao) {
      case 'SAUDAVEL':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-bold text-[10px]">Saudável</span>;
      case 'ATENCAO':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-bold text-[10px]">Atenção</span>;
      case 'CRITICO':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold text-[10px]">Crítico</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">CS & Retenção</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 text-amber-800">
              CRM 2 · Mock
            </span>
          </div>
          <p className="text-text-subtle text-sm">
            Saúde da carteira (CSAT), planos de ação anti-churn e repasse comercial (dados mockados para o Sistema 2).
          </p>
        </div>
        {activeTab === 'saude' && (
          <button onClick={handleNovaAnaliseMock} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus size={16} /> Nova Análise (Mock)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Health Score Médio</span>
          <div className="text-2xl font-extrabold text-text-primary mt-1">{MOCK_CS_INDICADORES.healthScoreMedio} / 10</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Taxa de Retenção</span>
          <div className="text-2xl font-extrabold text-green-600 mt-1">{MOCK_CS_INDICADORES.taxaRetencaoMensal}%</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Contas em Atenção / Críticas</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1 flex items-center gap-2">
            <AlertTriangle size={18} />
            {MOCK_CS_INDICADORES.clientesEmAtencao + MOCK_CS_INDICADORES.clientesCriticos} contas
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">MRR em Risco</span>
          <div className="text-2xl font-extrabold text-negative mt-1">
            R$ {MOCK_CS_INDICADORES.mrrEmRisco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('saude')}
          className={`px-4 py-2 font-bold text-sm rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'saude' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <HeartHandshake size={16} /> Radar de Saúde (CSAT)
        </button>
        <button
          onClick={() => setActiveTab('churn')}
          className={`px-4 py-2 font-bold text-sm rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'churn' ? 'bg-negative text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <UserMinus size={16} /> Histórico de Churn
        </button>
        <button
          onClick={() => setActiveTab('pontuacao')}
          className={`px-4 py-2 font-bold text-sm rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'pontuacao' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Star size={16} /> Hand-off & Pontuação Comercial
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {activeTab === 'saude' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cliente / Unidade</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">CS Responsável</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Nota CSAT</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Classificação</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Riscos & Plano de Ação</th>
              </tr>
            </thead>
            <tbody>
              {analises.map((a) => (
                <tr key={a.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-text-primary">{a.cliente?.nomeFantasia}</div>
                    <div className="text-xs text-text-subtle">{a.cliente?.unidade}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{a.csResponsavel}</td>
                  <td className="px-4 py-3 text-sm font-bold text-text-primary">{a.notaCSAT} / 10</td>
                  <td className="px-4 py-3">{getSaudeBadge(a.classificacao)}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    <div><strong>Risco:</strong> {a.riscos}</div>
                    <div className="text-text-subtle mt-0.5"><strong>Ação:</strong> {a.planoAcao}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'churn' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FFF5F5] border-b border-red-100">
                <th className="px-4 py-3 text-[11px] font-semibold text-red-600 uppercase tracking-wider">Cliente (Cancelado)</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-red-600 uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-red-600 uppercase tracking-wider">Receita Perdida</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-red-600 uppercase tracking-wider">Motivo & Tentativa de Retenção</th>
              </tr>
            </thead>
            <tbody>
              {cancelamentos.map((c) => (
                <tr key={c.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    <div>{c.cliente?.nomeFantasia}</div>
                    <div className="text-xs text-text-subtle">{c.cliente?.unidade}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {new Date(c.dataCancelamento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-negative">
                    - R$ {Number(c.receitaPerdida).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    <div><strong>Motivo:</strong> {c.motivo}</div>
                    <div className="text-text-subtle mt-0.5"><strong>Retenção:</strong> {c.tentativasRetencao}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'pontuacao' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Vendedor Responsável</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Observações do Onboarding</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Nota Operacional (1 a 5)</th>
              </tr>
            </thead>
            <tbody>
              {handoffs.map((c) => (
                <tr key={c.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-text-primary">{c.nomeFantasia}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{c.vendedor?.nome}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{c.observacao}</td>
                  <td className="px-4 py-3">
                    <select
                      value={c.notaOperador}
                      onChange={(e) => handlePontuarOperador(c.id, parseInt(e.target.value, 10))}
                      className="input w-32 h-8 px-2 border border-border rounded-md text-sm bg-white"
                    >
                      {[1, 2, 3, 4, 5].map((nota) => (
                        <option key={nota} value={nota}>
                          {nota} Estrela{nota > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
