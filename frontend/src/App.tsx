import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AsistenteDJPage } from './pages/declaraciones-juradas/AsistenteDJPage';
import { DetalleDeclaracionJuradaPage } from './pages/declaraciones-juradas/DetalleDeclaracionJuradaPage';
import { DjLayout } from './pages/declaraciones-juradas/DjLayout';
import { ListaDeclaracionesJuradasPage } from './pages/declaraciones-juradas/ListaDeclaracionesJuradasPage';
import { NuevaDeclaracionJuradaPage } from './pages/declaraciones-juradas/NuevaDeclaracionJuradaPage';
import { LoginPage } from './pages/login/LoginPage';

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/declaraciones-juradas' : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/declaraciones-juradas"
            element={
              <RequireAuth>
                <DjLayout />
              </RequireAuth>
            }
          >
            <Route index element={<ListaDeclaracionesJuradasPage />} />
            <Route path="nueva" element={<NuevaDeclaracionJuradaPage />} />
            <Route path="asistente" element={<AsistenteDJPage />} />
            <Route path=":id" element={<DetalleDeclaracionJuradaPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
