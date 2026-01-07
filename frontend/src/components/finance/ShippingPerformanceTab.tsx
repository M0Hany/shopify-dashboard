import ShippingLedgerTab from './ShippingLedgerTab';

interface ShippingPerformanceTabProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onBack: () => void;
}

export default function ShippingPerformanceTab({ selectedMonth, setSelectedMonth, onBack }: ShippingPerformanceTabProps) {
  return (
    <ShippingLedgerTab 
      selectedMonth={selectedMonth}
      setSelectedMonth={setSelectedMonth}
      onBack={onBack}
    />
  );
}

