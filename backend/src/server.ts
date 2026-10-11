import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/authRoutes';
import usersRoutes from './routes/usersRoutes';
import unidadesRoutes from './routes/unidadesRoutes';
import clientesRoutes from './routes/clientesRoutes';
import financeiroRoutes from './routes/financeiroRoutes';
import documentosRoutes from './routes/documentosRoutes';
import interacoesRoutes from './routes/interacoesRoutes';
import alertasRoutes from './routes/alertasRoutes';
import contratosRoutes from './routes/contratosRoutes';
import avaliacoesRoutes from './routes/avaliacoesRoutes';
import csRoutes from './routes/csRoutes';
import dashboardsRoutes from './routes/dashboardsRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos Estáticos (Uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rotas
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/unidades', unidadesRoutes);
app.use('/clientes', clientesRoutes);
app.use('/financeiro', financeiroRoutes);
app.use('/documentos', documentosRoutes);
app.use('/interacoes', interacoesRoutes);
app.use('/alertas', alertasRoutes);
app.use('/contratos', contratosRoutes);
app.use('/avaliacoes', avaliacoesRoutes);
app.use('/cs', csRoutes);
app.use('/dashboards', dashboardsRoutes);

// Rota de teste
app.get('/', (req, res) => {
  res.json({ message: 'API CRM Agência de Marketing está rodando!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
