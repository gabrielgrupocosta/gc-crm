"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const COLUMNS = {
  LEAD: { name: 'Lead', items: [] },
  REUNIAO: { name: 'Reunião', items: [] },
  PROPOSTA: { name: 'Proposta', items: [] },
  FECHAMENTO: { name: 'Fechamento', items: [] }
};

export default function FunilPage() {
  const [columns, setColumns] = useState(COLUMNS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFunil();
  }, []);

  const fetchFunil = async () => {
    try {
      const token = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get('/api/clientes', { headers });
      
      // Filtrar apenas prospectos
      const prospectos = res.data.filter(c => c.status === 'PROSPECCAO');
      
      // Agrupar por fase
      const newCols = {
        LEAD: { name: 'Lead', items: [] },
        REUNIAO: { name: 'Reunião', items: [] },
        PROPOSTA: { name: 'Proposta', items: [] },
        FECHAMENTO: { name: 'Fechamento', items: [] }
      };

      prospectos.forEach(c => {
        const fase = c.faseFunil || 'LEAD';
        if (newCols[fase]) {
          newCols[fase].items.push(c);
        }
      });

      setColumns(newCols);
    } catch (error) {
      console.error('Erro ao buscar clientes do funil', error);
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = async (result, columns, setColumns) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId !== destination.droppableId) {
      const sourceColumn = columns[source.droppableId];
      const destColumn = columns[destination.droppableId];
      const sourceItems = [...sourceColumn.items];
      const destItems = [...destColumn.items];
      
      const [removed] = sourceItems.splice(source.index, 1);
      
      // Atualizar a fase no state para evitar flicker
      removed.faseFunil = destination.droppableId;
      destItems.splice(destination.index, 0, removed);
      
      setColumns({
        ...columns,
        [source.droppableId]: { ...sourceColumn, items: sourceItems },
        [destination.droppableId]: { ...destColumn, items: destItems }
      });

      // API Call
      try {
        const token = Cookies.get('token');
        const headers = { Authorization: `Bearer ${token}` };
        await axios.put(`/api/clientes/${removed.id}/fase`, {
          faseFunil: destination.droppableId
        }, { headers });
      } catch (error) {
        console.error('Erro ao mover lead', error);
        alert('Erro ao mover lead.');
        fetchFunil(); // Reverte state
      }
    } else {
      const column = columns[source.droppableId];
      const copiedItems = [...column.items];
      const [removed] = copiedItems.splice(source.index, 1);
      copiedItems.splice(destination.index, 0, removed);
      
      setColumns({
        ...columns,
        [source.droppableId]: { ...column, items: copiedItems }
      });
    }
  };

  return (
    <div className="p-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Funil de Vendas</h1>
        <p className="text-text-subtle text-sm">Gerencie o fluxo de prospecção da sua agência.</p>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {loading ? (
          <div className="text-text-subtle">Carregando funil...</div>
        ) : (
          <DragDropContext onDragEnd={result => onDragEnd(result, columns, setColumns)}>
            {Object.entries(columns).map(([columnId, column]) => (
              <div key={columnId} className="flex flex-col w-[300px] min-w-[300px] bg-surface border border-border rounded-xl">
                <div className="p-4 border-b border-border bg-[#F9F9F9] rounded-t-xl flex justify-between items-center">
                  <h2 className="font-bold text-sm uppercase text-[#666]">{column.name}</h2>
                  <span className="bg-[#EAEAEA] text-[#666] text-xs px-2 py-1 rounded-full font-semibold">
                    {column.items.length}
                  </span>
                </div>
                
                <div className="flex-1 p-3 overflow-y-auto">
                  <Droppable droppableId={columnId}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`min-h-[150px] transition-colors rounded-lg ${snapshot.isDraggingOver ? 'bg-[#FAFAFA]' : ''}`}
                      >
                        {column.items.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-4 mb-3 rounded-lg shadow-sm border ${
                                  snapshot.isDragging ? 'bg-white border-brand-primary/50' : 'bg-white border-border'
                                }`}
                                style={{ ...provided.draggableProps.style }}
                              >
                                <div className="font-bold text-sm text-text-primary mb-1">{item.nomeFantasia}</div>
                                <div className="text-xs text-text-subtle line-clamp-1">{item.razaoSocial}</div>
                                {item.telefone && <div className="text-[10px] mt-2 text-text-muted">📞 {item.telefone}</div>}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            ))}
          </DragDropContext>
        )}
      </div>
    </div>
  );
}
