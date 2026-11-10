"use client";

import { useState } from 'react';
import { PenTool, Plus } from 'lucide-react';
import {
  MOCK_DESIGN_INDICADORES,
  MOCK_DESIGN_DEMANDAS,
} from '../../../mocks/crm2SistemaData';

export default function DesignPage() {
  const [demandas, setDemandas] = useState(MOCK_DESIGN_DEMANDAS);
  const [filtroStatus, setFiltroStatus] = useState('TODOS');

  const handleNovoBriefingMock = () => {
    const nova = {
      id: `des-${Date.now()}`,
      codigo: `CRI-${Math.floor(410 + Math.random() * 80)}`,
      titulo: 'Novo Criativo de Campanha (Mock)',
      cliente: 'Rede Supermercados Paraná',
      unidade: 'Matriz Curitiba',
      formato: 'Pack Social Media (Feed + Stories)',
      designer: 'Matheus Oliveira',
      prioridade: 'ALTA',
      prazo: '2026-11-18',
      status: 'BRIEFING',
      revisoes: 0,
    };
    setDemandas((prev) => [nova, ...prev]);
  };

  const handleStatusChange = (id, novoStatus) => {
    setDemandas((prev) => prev.map((d) => (d.id === id ? { ...d, status: novoStatus } : d)));
  };

  const filtradas = filtroStatus === 'TODOS' ? demandas : demandas.filter((d) => d.status === filtroStatus);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Designer & Criação</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 text-amber-800">
              CRM 2 · Mock
            </span>
          </div>
          <p className="text-text-subtle text-sm">
            Fila de produção criativa, aprovações de peças e controle de SLA (dados mockados para o Sistema 2).
          </p>
        </div>
        <button onClick={handleNovoBriefingMock} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus size={16} /> Novo Briefing (Mock)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Peças Entregues no Mês</span>
          <div className="text-2xl font-extrabold text-text-primary mt-1">{MOCK_DESIGN_INDICADORES.pecasEntreguesMes}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Em Produção Agora</span>
          <div className="text-2xl font-extrabold text-primary mt-1">{MOCK_DESIGN_INDICADORES.emProducao}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">SLA Médio de Entrega</span>
          <div className="text-2xl font-extrabold text-text-primary mt-1">{MOCK_DESIGN_INDICADORES.slaMedioHoras}h</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Aprovação de 1ª</span>
          <div className="text-2xl font-extrabold text-green-600 mt-1">{MOCK_DESIGN_INDICADORES.taxaAprovacaoPrimeira}%</div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['TODOS', 'BRIEFING', 'EM_PRODUCAO', 'APROVACAO_CLIENTE', 'APROVADO'].map((st) => (
          <button
            key={st}
            onClick={() => setFiltroStatus(st)}
            className={`px-3 py-1.5 font-bold text-xs rounded-md transition-colors ${
              filtroStatus === st ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F9F9F9] border-b border-border">
              <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Código / Peça</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cliente / Formato</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Designer</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Prazo</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((d) => (
              <tr key={d.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PenTool size={14} className="text-primary shrink-0" />
                    <div>
                      <span className="text-xs font-mono font-bold text-primary mr-2">{d.codigo}</span>
                      <span className="font-semibold text-text-primary text-sm">{d.titulo}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-muted">
                  <div className="font-medium text-text-primary">{d.cliente}</div>
                  <div className="text-xs text-text-subtle">{d.formato}</div>
                </td>
                <td className="px-4 py-3 text-sm text-text-muted">{d.designer}</td>
                <td className="px-4 py-3 text-sm text-text-muted">{new Date(d.prazo).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">
                  <select
                    value={d.status}
                    onChange={(e) => handleStatusChange(d.id, e.target.value)}
                    className="input h-8 px-2 border border-border rounded-md text-xs font-bold bg-white"
                  >
                    <option value="BRIEFING">BRIEFING</option>
                    <option value="EM_PRODUCAO">EM PRODUÇÃO</option>
                    <option value="APROVACAO_CLIENTE">APROVAÇÃO CLIENTE</option>
                    <option value="APROVADO">APROVADO</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
