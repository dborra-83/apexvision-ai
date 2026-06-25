import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { Home } from './pages/Home';
import { Live } from './pages/Live';
import { Login } from './pages/Login';
import { Analysis } from './pages/Analysis';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Authenticator.Provider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/live"
            element={
              <ProtectedRoute>
                <Live />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analysis"
            element={
              <ProtectedRoute>
                <Analysis />
              </ProtectedRoute>
            }
          />
          {/* Redirect old routes */}
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/comparison" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Authenticator.Provider>
  );
}

export default App;
