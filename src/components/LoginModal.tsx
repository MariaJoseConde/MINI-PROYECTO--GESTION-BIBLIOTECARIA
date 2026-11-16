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
    label: 'Bibliotecario',
    role: 'ADMIN',
    email: 'admin@sgbi.edu',
    desc: 'Mostrador, inventario CRUD, usuarios y auditoría',
    badgeBg: 'bg-[#dbdbff] text-[#6161ff]',
  },
  {
    label: 'Docente',
    role: 'DOCENTE',
    email: 'docente@sgbi.edu',
    desc: 'Generar pruebas de lectura con IA y claves docentes',
    badgeBg: 'bg-[#eddff7] text-[#6161ff]',
  },
  {
    label: 'Lectora Activa',
    role: 'LECTOR',
    email: 'lector@sgbi.edu',
    desc: 'Consulta de catálogo e historial personal de préstamos',
    badgeBg: 'bg-[#bcfe90] text-[#1c1917]',
  },
  {
    label: 'Lector Sancionado',
    role: 'MORA',
    email: 'mateo.mora@sgbi.edu',
    desc: 'Perfil bloqueado en mostrador para probar mora activa',
    badgeBg: 'bg-[#fcd0f8] text-[#991b1b]',
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-lg rounded-[24px] border border-[#d0d4e4] bg-[#ffffff] shadow-[0px_5px_45px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#d0d4e4] px-6 py-4.5 bg-[#ffffff]">
          <div className="flex items-center gap-3">
            <div className="prism-mark-circle w-7 h-7 flex items-center justify-center shrink-0">
              <Lock className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 id="login-modal-title" className="text-base font-semibold text-[#333333] tracking-tight">
                Acceso al Sistema Bibliotecario
              </h2>
              <p className="text-[11px] text-[#535768]">Ingresa con tus credenciales institucionales</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#535768] hover:bg-[#e7ecff] hover:text-[#333333] transition-colors cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-[6px] border border-[#ff8940]/40 bg-[#fff5f0] px-3.5 py-2.5 text-xs font-medium text-[#c2410c]">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-[#333333] mb-1.5">
              Correo institucional
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@sgbi.edu"
              className="input-monday"
            />
          </div>

          <div>
            <label htmlFor="login-pass" className="block text-xs font-semibold text-[#333333] mb-1.5">
              Contraseña
            </label>
            <input
              id="login-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-monday"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary-pill w-full justify-center py-2.5 text-sm cursor-pointer shadow-sm disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Verificando credenciales...' : 'Iniciar Sesión'}
          </button>

          <div className="pt-4 border-t border-[#d0d4e4]">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold text-[#333333]">
                Cuentas demo por rol <span className="font-normal text-[#535768]">(contraseña: <code className="font-mono text-[#6161ff]">sgbi2026</code>)</span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="text-left rounded-[12px] border border-[#d0d4e4] bg-[#ffffff] p-2.5 hover:border-[#6161ff] hover:bg-[#e7ecff]/40 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-[#333333] group-hover:text-[#6161ff] transition-colors">{acc.label}</span>
                    <span className={`badge-monday text-[9px] font-semibold ${acc.badgeBg}`}>
                      {acc.role}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#6161ff] mt-0.5 truncate">{acc.email}</div>
                  <div className="text-[10px] text-[#535768] mt-0.5 line-clamp-1">{acc.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
