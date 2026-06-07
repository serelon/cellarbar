import { createContext, useContext } from 'react';

export interface User {
  id: string;
  name: string;
  display_name: string | null;
  email: string | null;
  image_path: string | null;
}

export interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  oidc: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  oidc: false,
});

export const useAuth = () => useContext(AuthContext);
