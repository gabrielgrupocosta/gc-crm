"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { Bell, AlertTriangle, AlertCircle, FileText } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  const [alertas, setAlertas] = useState({ lancamentosAtrasados: [], contratosVencendo: [] });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef(null);

  const fetchAlertas = async () => {
    try {
      const token = Cookies.get('token');
      if (!token) return;
      const res = await axios.get('/api/alertas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlertas(res.data);
    } catch (error) {
      console.error('Erro ao buscar alertas no header', error);
    }
  };

  useEffect(() => {
    fetchAlertas();
    const interval = setInterval(fetchAlertas, 60000); // 1 min
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalAlertas = alertas.lancamentosAtrasados.length + alertas.contratosVencendo.length;

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-end px-6 sticky top-0 z-40">
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          className="relative p-2 text-text-subtle hover:text-text-primary transition-colors focus:outline-none"
        >
          <Bell size={20} />
          {totalAlertas > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-negative text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
              {totalAlertas > 9 ? '9+' : totalAlertas}
            </span>
          )}
        </button>

        {isPopoverOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-surface border border-border shadow-modal rounded-xl overflow-hidden z-50">
            <div className="p-4 border-b border-border bg-[#F9F9F9]">
              <h3 className="font-bold text-sm text-text-primary">Central de Alertas</h3>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto p-2">
              {totalAlertas === 0 ? (
                <div className="p-4 text-center text-sm text-text-subtle">
                  Tudo em ordem! Nenhum alerta.
                </div>
              ) : (
                <>
                  {alertas.lancamentosAtrasados.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 py-1 text-[11px] font-bold text-text-subtle uppercase tracking-wider">
                        Cobranças Pendentes ({alertas.lancamentosAtrasados.length})
                      </div>
                      {alertas.lancamentosAtrasados.map(lanc => (
                        <Link href="/financeiro" key={lanc.id} className="flex items-start gap-3 p-2 hover:bg-[#F9F9F9] rounded-md transition-colors">
                          <div className="mt-0.5 text-negative"><AlertCircle size={16} /></div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{lanc.cliente?.nomeFantasia}</p>
                            <p className="text-xs text-negative">Atrasado: R$ {Number(lanc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {alertas.contratosVencendo.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[11px] font-bold text-text-subtle uppercase tracking-wider">
                        Renovações ({alertas.contratosVencendo.length})
                      </div>
                      {alertas.contratosVencendo.map(cli => (
                        <Link href="/clientes" key={cli.id} className="flex items-start gap-3 p-2 hover:bg-[#F9F9F9] rounded-md transition-colors">
                          <div className="mt-0.5 text-warning"><AlertTriangle size={16} /></div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{cli.nomeFantasia}</p>
                            <p className="text-xs text-text-muted">Vence em {new Date(cli.dataVencimentoContrato).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
