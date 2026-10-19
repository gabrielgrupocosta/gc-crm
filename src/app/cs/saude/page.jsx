"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ShieldAlert, TrendingUp, UserMinus, Star } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../../contexts/AuthContext';

export default function CSSaudePage() {
  const [analises, setAnalises] = useState([]);
  const [cancelamentos, setCancelamentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [activeTab, setActiveTab] = useState('saude'); // 'saude' ou 'churn' ou 'pontuacao'
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [resAnalises, resCancelamentos, resClientes] = await Promise.all([
        axios.get('/api/cs/analises', { headers }),
        axios.get('/api/cs/cancelamentos', { headers }),
        axios.get('/api/clientes', { headers })
      ]);
      setAnalises(resAnalises.data);
      setCancelamentos(resCancelamentos.data);
      setClientes(resClientes.data);
    } catch (error) {
      console.error('Erro ao buscar dados de CS', error);
    }
  };

  const handlePontuarOperador = async (clienteId, nota) => {
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`/api/clientes/${clienteId}/pontuar-operador`, { notaOperador: nota }, { headers });
      alert('Nota atribuída com sucesso!');
    } catch (error) {
      alert('Erro ao pontuar: ' + (error.response?.data?.error || error.message));
    }
  };

  const getSaudeBadge = (classificacao) => {
    switch (classificacao) {
      case 'SAUDAVEL': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-bold text-[10px]">Saudável</span>;
      case 'ATENCAO': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-bold text-[10px]">Atenção</span>;
      case 'CRITICO': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold text-[10px]">Crítico</span>;
      default: return null;
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Customer Success</h1>
          <p className="text-text-subtle text-sm">Saúde dos clientes e controle de Churn (retenção).</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('saude')} className={`px-4 py-2 font-bold text-sm rounded-md transition-colors ${activeTab === 'saude' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
          Radar de Saúde (CSAT)
        </button>
        <button onClick={() => setActiveTab('churn')} className={`px-4 py-2 font-bold text-sm rounded-md transition-colors ${activeTab === 'churn' ? 'bg-negative text-white' : 'bg-gray-100 text-gray-500'}`}>
          Histórico de Churn
        </button>
        {(user?.role === 'GESTOR_PL' || user?.role === 'ADMIN') && (
          <button onClick={() => setActiveTab('pontuacao')} className={`px-4 py-2 font-bold text-sm rounded-md transition-colors ${activeTab === 'pontuacao' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
            Pontuação de Vendedores
          </button>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {activeTab === 'saude' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Mês Ref.</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Nota CSAT</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Classificação</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Riscos</th>
              </tr>
            </thead>
            <tbody>
              {analises.map(a => (
                <tr key={a.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-text-primary">{a.cliente?.nomeFantasia}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{new Date(a.mesReferencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-sm font-bold text-text-primary">{a.notaCSAT || '-'} / 10</td>
                  <td className="px-4 py-3">{getSaudeBadge(a.classificacao)}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{a.riscos || 'Nenhum'}</td>
                </tr>
              ))}
              {analises.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-400">Nenhuma análise cadastrada.</td></tr>}
            </tbody>
          </table>
        )}

        {activeTab === 'churn' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FFF5F5] border-b border-red-100">
                <th className="px-4 py-3 text-[11px] font-semibold text-red-600 uppercase tracking-wider">Cliente (Cancelado)</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-red-600 uppercase tracking-wider">Data Cancelamento</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-red-600 uppercase tracking-wider">Receita Perdida</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-red-600 uppercase tracking-wider">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {cancelamentos.map(c => (
                <tr key={c.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-text-primary flex items-center gap-2">
                    <UserMinus size={16} className="text-negative" /> {c.cliente?.nomeFantasia}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{new Date(c.dataCancelamento).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-sm font-bold text-negative">
                    - R$ {Number(c.receitaPerdida).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{c.motivo}</td>
                </tr>
              ))}
              {cancelamentos.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-gray-400">Nenhum cancelamento registrado (Que bom!).</td></tr>}
            </tbody>
          </table>
        )}

        {activeTab === 'pontuacao' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Vendedor Responsável</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Nota Operacional (1 a 5)</th>
              </tr>
            </thead>
            <tbody>
              {clientes.filter(c => c.vendedorId).map(c => (
                <tr key={c.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-semibold text-text-primary">{c.nomeFantasia}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{c.vendedor?.nome || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <select 
                      defaultValue=""
                      onChange={(e) => handlePontuarOperador(c.id, parseInt(e.target.value))}
                      className="input w-32 h-8 px-2 border border-border rounded-md text-sm"
                    >
                      <option value="" disabled>Avaliar...</option>
                      {[1, 2, 3, 4, 5].map(nota => (
                        <option key={nota} value={nota}>{nota} Estrela{nota > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {clientes.filter(c => c.vendedorId).length === 0 && <tr><td colSpan="3" className="p-4 text-center text-gray-400">Nenhum cliente com vendedor atribuído.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
