"use client";

import { useState } from 'react';
import { Briefcase, Building2, Plus } from 'lucide-react';
import {
  MOCK_ADM_INDICADORES,
  MOCK_ADM_DEMANDAS,
  MOCK_ADM_FORNECEDORES,
} from '../../../mocks/crm2SistemaData';

export default function AdministracaoPage() {
  const [activeTab, setActiveTab] = useState('demandas');
  const [demandas, setDemandas] = useState(MOCK_ADM_DEMANDAS);
  const [fornecedores] = useState(MOCK_ADM_FORNECEDORES);

  const handleNovaSolicitacaoMock = () => {
    const nova = {
      id: `adm-dem-${Date.now()}`,
      protocolo: `ADM-2026-${Math.floor(110 + Math.random() * 80)}`,
      titulo: 'Nova Solicitação Administrativa (Mock)',
      categoria: 'Compras & Patrimônio',
      unidade: 'Matriz Curitiba',
      solicitante: 'Fernanda Lima',
      prioridade: 'MEDIA',
      prazo: '2026-11-25',
      valorEstimado: 950.0,
      status: 'ABERTO',
    };
    setDemandas((prev) => [nova, ...prev]);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Administração (ADM)</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 text-amber-800">
              CRM 2 · Mock
            </span>
          </div>
          <p className="text-text-subtle text-sm">
            Gestão de compras, contratos de fornecedores, infraestrutura e demandas internas (dados mockados para o Sistema 2).
          </p>
        </div>
        <button onClick={handleNovaSolicitacaoMock} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus size={16} /> Nova Solicitação (Mock)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Solicitações em Aberto</span>
          <div className="text-2xl font-extrabold text-text-primary mt-1">{MOCK_ADM_INDICADORES.solicitacoesAbertas}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Fornecedores Ativos</span>
          <div className="text-2xl font-extrabold text-text-primary mt-1">{MOCK_ADM_INDICADORES.contratosFornecedoresAtivos}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Custo Operacional Fixo</span>
          <div className="text-2xl font-extrabold text-primary mt-1">
            R$ {MOCK_ADM_INDICADORES.custoOperacionalMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-text-subtle">Compliance / Alvarás</span>
          <div className="text-2xl font-extrabold text-green-600 mt-1">{MOCK_ADM_INDICADORES.complianceUnidades}</div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('demandas')}
          className={`px-4 py-2 font-bold text-sm rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'demandas' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Briefcase size={16} /> Demandas & Compras
        </button>
        <button
          onClick={() => setActiveTab('fornecedores')}
          className={`px-4 py-2 font-bold text-sm rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'fornecedores' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Building2 size={16} /> Contratos & Fornecedores
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {activeTab === 'demandas' ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Protocolo / Demanda</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Categoria / Unidade</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Solicitante</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Custo Est.</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {demandas.map((d) => (
                <tr key={d.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3">
                    <div className="text-xs font-mono text-primary font-bold">{d.protocolo}</div>
                    <div className="font-semibold text-text-primary text-sm">{d.titulo}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    <div>{d.categoria}</div>
                    <div className="text-xs text-text-subtle">{d.unidade}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{d.solicitante}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                    {d.valorEstimado > 0
                      ? `R$ ${d.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded font-bold text-[10px]">
                      {d.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Fornecedor</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Serviço</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Unidade</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Valor Mensal</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((f) => (
                <tr key={f.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-text-primary">{f.fornecedor}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{f.servico}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{f.unidade}</td>
                  <td className="px-4 py-3 text-sm font-bold text-text-primary">
                    R$ {f.valorMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">Todo dia {f.vencimentoDia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
