import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import GlossaryFilters from '../components/glossary/GlossaryFilters';
import GlossaryTable from '../components/glossary/GlossaryTable';
import AddTermModal from '../components/glossary/AddTermModal';
import { useApp } from '../context/AppContext';

export default function BusinessGlossary() {
  const { glossaryTerms, addGlossaryTerm } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All Domains');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredTerms = useMemo(() => {
    return glossaryTerms.filter(item => {
      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTerm = item.term.toLowerCase().includes(q);
        const matchDef = item.definition.toLowerCase().includes(q);
        const matchOwner = item.owner.toLowerCase().includes(q);
        const matchSyn = item.synonyms?.some(s => s.toLowerCase().includes(q));
        if (!matchTerm && !matchDef && !matchOwner && !matchSyn) return false;
      }

      // Domain filter
      if (selectedDomain !== 'All Domains' && item.domain !== selectedDomain) {
        return false;
      }

      return true;
    });
  }, [glossaryTerms, searchTerm, selectedDomain]);

  return (
    <div className="space-y-6">
      {/* Header matching Screen 7 */}
      <PageHeader
        title="Business Glossary"
        subtitle="Explore and understand key business terms."
        actions={
          <Button
            size="md"
            icon={Plus}
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto"
          >
            Add Term
          </Button>
        }
      />

      {/* Search & Domain Filter Bar */}
      <GlossaryFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedDomain={selectedDomain}
        setSelectedDomain={setSelectedDomain}
      />

      {/* Table matching Screen 7 */}
      <GlossaryTable
        terms={filteredTerms}
        onReset={() => {
          setSearchTerm('');
          setSelectedDomain('All Domains');
        }}
      />

      {/* Add Term Modal */}
      <AddTermModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={addGlossaryTerm}
      />
    </div>
  );
}
