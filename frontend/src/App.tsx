import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Orders from './pages/Orders';
import Finance from './pages/Finance';
import { Layout } from './components/layout/Layout';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/orders" replace />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/finance" element={<Finance />} />
          </Routes>
        </Layout>
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;
