import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const storedToken = localStorage.getItem('bk_token');
const storedUserRaw = localStorage.getItem('bk_user');
let storedUser: User | null = null;
try {
  storedUser = storedUserRaw ? (JSON.parse(storedUserRaw) as User) : null;
} catch {
  storedUser = null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  token: storedToken,
  isAuthenticated: Boolean(storedToken && storedUser),
  setAuth: (user, token) => {
    localStorage.setItem('bk_token', token);
    localStorage.setItem('bk_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('bk_token');
    localStorage.removeItem('bk_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
  updateUser: (user) => {
    localStorage.setItem('bk_user', JSON.stringify(user));
    set({ user });
  },
}));
