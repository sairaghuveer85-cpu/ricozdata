import { useApp } from '../context/AppContext';

export function useUsers() {
  const { users, addUser } = useApp();
  return {
    users,
    addUser
  };
}
