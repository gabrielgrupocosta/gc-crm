"use client";

import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, ChevronRight, Trophy, Medal, Crown, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState({ lancamentosAtrasados: [], contratosVencendo: [] });
  const [financeiro, setFinanceiro] = useState([]);
  const [dashExtra, setDashExtra] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = Cookies.get('token');
      if (!token) return;
      
      const headers = { Authorization: `Bearer ${token}` };
      
      const [resAlertas, resFin, resDash] = await Promise.all([
        axios.get('http://localhost:3333/alertas', { headers }),
        axios.get('http://localhost:3333/financeiro', { headers }),
        axios.get('http://localhost:3333/dashboards', { headers })
      ]);
      
      setAlertas(resAlertas.data);
      setFinanceiro(resFin.data);
      setDashExtra(resDash.data);
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard', error);
    } finally {
      setLoading(false);
    }
  };

  // Preparar dados do gráfico
  const receitasPagas = financeiro.filter(f => f.statusPagamento === 'PAGO');
  const groupedReceitas = receitasPagas.reduce((acc, curr) => {
    const cat = curr.categoriaServico || 'OUTROS';
    acc[cat] = (acc[cat] || 0) + Number(curr.valor);
    return acc;
  }, {});

  const dataChart = Object.entries(groupedReceitas).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value
  }));

  const COLORS = ['#031E33', '#883123', '#9F7E50', '#007A5A', '#2563EB', '#666666'];

  const totalReceitaGlobal = financeiro.reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalReceitaPaga = receitasPagas.reduce((acc, curr) => acc + Number(curr.valor), 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Dashboard</h1>
        <p className="text-text-subtle text-sm">Visão geral e avisos importantes.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
          <p className="text-text-subtle text-[11px] font-bold uppercase tracking-wider mb-2">Faturamento Total</p>
          <h2 className="text-3xl font-extrabold text-text-primary">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceitaGlobal)}
          </h2>
        </div>
        
        {dashExtra?.tipo === 'GLOBAL' && (
          <>
            <div className="bg-surface border border-border p-6 rounded-xl shadow-sm border-l-4 border-l-primary">
              <p className="text-text-subtle text-[11px] font-bold uppercase tracking-wider mb-2">MRR (Recorrente)</p>
              <h2 className="text-3xl font-extrabold text-primary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashExtra.mrr)}
              </h2>
            </div>
            <div className="bg-surface border border-border p-6 rounded-xl shadow-sm border-l-4 border-l-negative">
              <p className="text-text-subtle text-[11px] font-bold uppercase tracking-wider mb-2">Churn Rate</p>
              <h2 className="text-3xl font-extrabold text-negative">
                {dashExtra.churn}%
              </h2>
            </div>
          </>
        )}

        {dashExtra?.tipo === 'VENDEDOR' && (
          <>
            <div className="bg-surface border border-border p-6 rounded-xl shadow-sm border-l-4 border-l-primary">
              <p className="text-text-subtle text-[11px] font-bold uppercase tracking-wider mb-2">Minhas Vendas (Mês)</p>
              <h2 className="text-3xl font-extrabold text-primary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashExtra.vendasMes)}
              </h2>
            </div>
            <div className="bg-surface border border-border p-6 rounded-xl shadow-sm border-l-4 border-l-positive">
              <p className="text-text-subtle text-[11px] font-bold uppercase tracking-wider mb-2">Atingimento de Meta</p>
              <h2 className="text-3xl font-extrabold text-positive">
                {dashExtra.metasAtingidas}
              </h2>
            </div>
          </>
        )}

        <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
          <p className="text-text-subtle text-[11px] font-bold uppercase tracking-wider mb-2">Inadimplência</p>
          <h2 className="text-3xl font-extrabold text-negative">
            {alertas.lancamentosAtrasados.length} <span className="text-sm font-normal">atrasos</span>
          </h2>
        </div>
      </div>

      {dashExtra?.rankingVendedores && dashExtra?.rankingUnidades && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* WIDGET 1: PÓDIO DE VENDEDORES */}
          <div className="bg-surface border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-[#F9F9F9] flex items-center gap-2">
              <Trophy size={18} className="text-[#EAB308]" />
              <h3 className="font-bold text-sm text-text-primary uppercase tracking-wider">Top Vendedores (Mês)</h3>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {dashExtra.rankingVendedores.length === 0 ? (
                <p className="text-text-subtle text-sm text-center">Nenhuma venda registrada neste mês.</p>
              ) : (
                dashExtra.rankingVendedores.map((v, index) => {
                  let badge = null;
                  let bgClass = "bg-white border-[#F3F3F3]";
                  if (index === 0) {
                    badge = <Crown size={18} className="text-[#EAB308]" />;
                    bgClass = "bg-[#FEF9C3]/30 border-[#EAB308]/30";
                  } else if (index === 1) {
                    badge = <Medal size={18} className="text-[#94A3B8]" />;
                    bgClass = "bg-[#F1F5F9]/50 border-[#94A3B8]/30";
                  } else if (index === 2) {
                    badge = <Medal size={18} className="text-[#B45309]" />;
                    bgClass = "bg-[#FFF7ED]/50 border-[#B45309]/30";
                  }

                  return (
                    <div key={v.id} className={`flex items-center justify-between p-3 border rounded-lg ${bgClass}`}>
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-lg text-text-muted w-6 text-center">{index + 1}º</div>
                        {badge}
                        <div>
                          <p className="font-bold text-sm text-text-primary">{v.nome}</p>
                          <p className="text-[11px] font-semibold text-text-subtle uppercase">{v.unidade}</p>
                        </div>
                      </div>
                      <div className="font-extrabold text-primary">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valor)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* WIDGET 2: BATALHA DAS UNIDADES */}
          <div className="bg-surface border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-[#F9F9F9] flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              <h3 className="font-bold text-sm text-text-primary uppercase tracking-wider">Batalha das Unidades</h3>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {dashExtra.rankingUnidades.length === 0 ? (
                <p className="text-text-subtle text-sm text-center">Nenhuma venda registrada neste mês.</p>
              ) : (
                dashExtra.rankingUnidades.map((u, index) => (
                  <div key={u.id} className="flex items-center justify-between p-3 border border-[#F3F3F3] rounded-lg bg-white">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-lg text-text-muted w-6 text-center">{index + 1}º</div>
                      <div>
                        <p className="font-bold text-sm text-text-primary">{u.nome}</p>
                        {u.mvp !== '-' && (
                          <span className="inline-flex items-center gap-1 mt-1 bg-[#F9F9F9] px-2 py-0.5 rounded text-[10px] font-bold text-text-muted border border-border">
                            🏆 MVP: {u.mvp}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="font-extrabold text-text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(u.valor)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO DE RECEITA POR SERVIÇO */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl shadow-sm p-6 flex flex-col">
          <h3 className="font-bold text-base mb-4 text-text-primary">Receita por Serviço (Pagos)</h3>
          {dataChart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-subtle text-sm">
              Nenhum dado financeiro pago para exibir.
            </div>
          ) : (
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {dataChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* REQUER ATENÇÃO */}
        <div className="bg-surface border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-[#F9F9F9] flex items-center gap-2 border-l-4 border-l-negative">
            <AlertTriangle size={18} className="text-negative" />
            <h3 className="font-bold text-sm text-text-primary uppercase tracking-wider">Requer Atenção</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            {alertas.lancamentosAtrasados.length === 0 && alertas.contratosVencendo.length === 0 ? (
              <p className="text-text-subtle text-sm text-center my-auto">Nenhuma urgência no momento.</p>
            ) : (
              <>
                {alertas.lancamentosAtrasados.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-text-subtle uppercase mb-3">Cobranças Pendentes</h4>
                    <div className="flex flex-col gap-2">
                      {alertas.lancamentosAtrasados.map(lanc => (
                        <Link href="/financeiro" key={lanc.id} className="flex items-center justify-between p-3 border border-[#F3F3F3] rounded-lg hover:border-[#DDDDDD] transition-colors">
                          <div>
                            <p className="font-semibold text-sm text-text-primary">{lanc.cliente?.nomeFantasia}</p>
                            <p className="text-xs font-bold text-negative">R$ {Number(lanc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <ChevronRight size={16} className="text-text-faint" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {alertas.contratosVencendo.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-text-subtle uppercase mb-3">Renovações Próximas</h4>
                    <div className="flex flex-col gap-2">
                      {alertas.contratosVencendo.map(cli => (
                        <Link href="/clientes" key={cli.id} className="flex items-center justify-between p-3 border border-[#F3F3F3] rounded-lg hover:border-[#DDDDDD] transition-colors">
                          <div>
                            <p className="font-semibold text-sm text-text-primary">{cli.nomeFantasia}</p>
                            <p className="text-xs text-warning-text">Vence em: {new Date(cli.dataVencimentoContrato).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <ChevronRight size={16} className="text-text-faint" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
