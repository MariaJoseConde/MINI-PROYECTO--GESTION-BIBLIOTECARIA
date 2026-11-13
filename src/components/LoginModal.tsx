import React, { useState } from 'react';
import { Lock, LogIn, X } from 'lucide-react';
import type { Usuario } from '../types/sgbi.ts';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: Usuario) => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Bibliotecario (ADMIN)',
    email: 'admin@sgbi.edu',
    desc: 'Mostrador, inventario CRUD, usuarios y auditoría',
  },
  {
    label: 'Docente (DOCENTE)',
    email: 'docente@sgbi.edu',
    desc: 'Generar pruebas de lectura con IA y claves docentes',
  },
  {
    label: 'Lectora Activa (LECTOR)',
    email: 'lector@sgbi.edu',
    desc: 'Consulta de catálogo e historial personal de préstamos',
  },
  {
    label: 'Lector Sancionado (MORA)',
    email: 'mateo.mora@sgbi.edu',
    desc: 'Perfil bloqueado en mostrador para probar mora activa',
  },
];

export const LoginModal: React.FC<LoginModalProps> = ({ open, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { user?: Usuario; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error || 'No se pudo iniciar sesión.');
        return;
      }
      onSuccess(data.user);
      onClose();
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('sgbi2026');
    setError(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E7E2D8] px-6 py-4 bg-[#FBF9F5]">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#1E3A8A]" />
            <h2 id="login-modal-title" className="font-serif text-lg font-semibold text-[#1C1917]">
              Acceso al Sistema Bibliotecario
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#57534E] hover:bg-[#F3EFE7] transition-colors"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-md border border-[#B91C1C]/30 bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#991B1B]">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-[#44403C] mb-1.5">
              Correo institucional
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@sgbi.edu"
              className="w-full rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
            />
          </div>

          <div>
            <label htmlFor="login-pass" className="block text-xs font-semibold text-[#44403C] mb-1.5">
              Contraseña
            </label>
            <input
              id="login-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#172554] disabled:opacity-60 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Verificando credenciales...' : 'Iniciar Sesión'}
          </button>

          <div className="pt-4 border-t border-[#E7E2D8]">
            <p className="text-xs font-semibold text-[#57534E] mb-2.5">
              Cuentas de prueba por rol (contraseña: <span className="font-mono">sgbi2026</span>)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="text-left rounded-md border border-[#E7E2D8] bg-[#FBF9F5] p-2.5 hover:border-[#1E3A8A]/50 hover:bg-[#F3EFE7] transition-colors"
                >
                  <div className="text-xs font-semibold text-[#1C1917]">{acc.label}</div>
                  <div className="text-[11px] font-mono text-[#1E3A8A] mt-0.5 truncate">{acc.email}</div>
                  <div className="text-[11px] text-[#57534E] mt-0.5 line-clamp-1">{acc.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
