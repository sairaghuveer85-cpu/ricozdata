import { useApp } from '../context/AppContext';

export function useDatasets() {
  const { datasets, addDataset, updateDataset, deleteDataset } = useApp();
  return {
    datasets,
    addDataset,
    updateDataset,
    deleteDataset
  };
}
