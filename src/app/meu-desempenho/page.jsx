"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useAuth } from '../../contexts/AuthContext';
import { Star, MessageSquare, TrendingUp } from 'lucide-react';

export default function MeuDesempenhoPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState('');

  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resFeedbacks, resClientes] = await Promise.all([
        axios.get('/api/avaliacoes/meus', { headers }),
        axios.get('/api/clientes', { headers })
      ]);
      setFeedbacks(resFeedbacks.data);
      // Filtra clientes vinculados a este vendedor que possuem notaOperador no mês atual
      // Como o endpoint /clientes só traz os dados do cliente, para a notaOperador precisaríamos
      // cruzar com as análises, mas podemos usar o endpoint /cs/analises.
      const resAnalises = await axios.get('/api/cs/analises', { headers }).catch(() => ({ data: [] }));
      
      const meusClientes = resClientes.data.filter(c => c.vendedorId === user?.id);
      
      const clientesComNota = meusClientes.map(c => {
        const analise = resAnalises.data.find(a => a.clienteId === c.id);
        return {
          ...c,
          notaOperador: analise?.notaOperador || null,
          mesReferenciaAnalise: analise?.mesReferencia
        };
      });

      setClientes(clientesComNota);
    } catch (error) {
      console.error('Erro ao buscar meu desempenho', error);
    } finally {
      setLoading(false);
    }
  };

  const feedbacksFiltrados = mesFiltro 
    ? feedbacks.filter(f => new Date(f.mesReferencia).toISOString().startsWith(mesFiltro))
    : feedbacks;

  return (
    <div className="p-8">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Feedback Avaliativo</h1>
          <p className="text-text-subtle text-sm">Visualize seus feedbacks e notas por cliente.</p>
        </div>
        <div>
          <input 
            type="month" 
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="input h-9 px-3 border border-border rounded-md text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* COLUNA 1: FEEDBACKS DO GESTOR */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <MessageSquare size={20} className="text-primary" /> Feedbacks do Gestor
          </h2>
          
          {loading ? (
            <p className="text-sm text-text-subtle">Carregando...</p>
          ) : feedbacksFiltrados.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-6 text-center shadow-sm">
              <p className="text-text-muted text-sm">Nenhum feedback encontrado para o período.</p>
            </div>
          ) : (
            feedbacksFiltrados.map(f => (
              <div key={f.id} className="bg-surface border border-border rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs font-bold text-text-subtle uppercase">
                      {new Date(f.mesReferencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-sm font-semibold text-text-primary">Avaliador: {f.avaliador?.nome}</p>
                  </div>
                  <div className="bg-[#FEF9C3]/40 border border-[#EAB308]/40 px-3 py-1 rounded-lg flex items-center gap-1">
                    <Star size={14} className="text-[#EAB308] fill-current" />
                    <span className="font-extrabold text-[#B45309]">Nota: {f.notaGeral ?? 'N/A'}</span>
                  </div>
                </div>
                
                <div className="bg-[#F9F9F9] p-4 rounded-lg border border-[#F3F3F3]">
                  <p className="text-sm text-text-primary whitespace-pre-wrap italic">
                    "{f.feedbackTexto || f.feedback || 'Sem comentários adicionais.'}"
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* COLUNA 2: PONTUAÇÃO POR CLIENTE */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <TrendingUp size={20} className="text-positive" /> Pontuação Operacional (Clientes)
          </h2>
          
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-border">
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#999999] uppercase tracking-wider">Nota Operador</th>
                </tr>
              </thead>
              <tbody>
                {clientes.length === 0 ? (
                  <tr><td colSpan="2" className="p-4 text-center text-text-muted text-sm">Nenhum cliente na carteira.</td></tr>
                ) : (
                  clientes.map(c => (
                    <tr key={c.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3 font-semibold text-text-primary text-sm">{c.nomeFantasia}</td>
                      <td className="px-4 py-3">
                        {c.notaOperador ? (
                          <div className="flex items-center gap-1">
                            {[...Array(c.notaOperador)].map((_, i) => (
                              <Star key={i} size={14} className="text-[#EAB308] fill-current" />
                            ))}
                            {[...Array(5 - c.notaOperador)].map((_, i) => (
                              <Star key={i} size={14} className="text-gray-200" />
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted font-semibold bg-gray-100 px-2 py-1 rounded">Sem Nota</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
