import '../index.css';
import Sidebar from '../components/Layout/Sidebar';
import MainContent from '../components/Layout/MainContent';
import { Providers } from './Providers';

export const metadata = {
  title: 'CRM Agência de Marketing',
  description: 'Sistema de gestão para agências de marketing',
};

export default function RootLayout({ children }) {
  // A classe do body baseada nas variáveis de CSS definidas no index.css
  return (
    <html lang="pt-BR">
      <body className="bg-bg text-text-primary antialiased font-sans">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            {/* O Sidebar já gerencia seu estado collapsed via SidebarContext */}
            <Sidebar />
            
            <MainContent>
              {children}
            </MainContent>
          </div>
        </Providers>
      </body>
    </html>
  );
}
