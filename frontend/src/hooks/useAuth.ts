import { createContext, useContext } from 'react';

export interface User {
  id: string;
  name: string;
  display_name: string | null;
  image_path: string | null;
}

export interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
});

export const useAuth = () => useContext(AuthContext);
