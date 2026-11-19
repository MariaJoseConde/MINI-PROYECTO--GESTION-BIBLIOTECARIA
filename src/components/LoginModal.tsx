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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/65 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-lg rounded-[24px] glass-modal overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 px-6 py-4.5 bg-transparent">
          <div className="flex items-center gap-3">
            <div className="prism-mark-circle w-7 h-7 flex items-center justify-center shrink-0">
              <Lock className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 id="login-modal-title" className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
                Acceso al Sistema Bibliotecario
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">Ingresa con tus credenciales institucionales</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-300/60 bg-rose-50/70 dark:bg-rose-950/40 backdrop-blur-xs px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Correo institucional
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@sgbi.edu"
              className="input-monday w-full"
            />
          </div>

          <div>
            <label htmlFor="login-pass" className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Contraseña
            </label>
            <input
              id="login-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-monday w-full"
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

          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Cuentas demo por rol <span className="font-normal text-slate-600 dark:text-slate-400">(contraseña: <code className="font-mono text-indigo-600 dark:text-indigo-400">sgbi2026</code>)</span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="text-left rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/50 dark:bg-slate-800/40 backdrop-blur-xs p-2.5 hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-all group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{acc.label}</span>
                    <span className={`badge-monday text-[9px] font-semibold ${acc.badgeBg}`}>
                      {acc.role}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">{acc.email}</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">{acc.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
