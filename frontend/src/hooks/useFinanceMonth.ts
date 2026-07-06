import { useQuery, useQueryClient } from '@tanstack/react-query';
import { financialService } from '../services/financialService';
import {
  financeMonthQueryKey,
  financeMonthRefetchInterval,
  financeMonthStaleTime,
  isPastFinanceMonth,
  type FinanceMonthBundle,
} from '../utils/financeMonthQuery';

export function useFinanceMonth(month: string) {
  const isCurrent = !isPastFinanceMonth(month);

  return useQuery<FinanceMonthBundle>({
    queryKey: financeMonthQueryKey(month),
    queryFn: () => financialService.getFinanceMonth(month),
    enabled: !!month,
    staleTime: financeMonthStaleTime(month),
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: isCurrent,
    refetchOnWindowFocus: isCurrent,
    refetchInterval: financeMonthRefetchInterval(month),
  });
}

export function useInvalidateFinanceMonth() {
  const queryClient = useQueryClient();
  return (month: string) => {
    queryClient.invalidateQueries({ queryKey: financeMonthQueryKey(month) });
    queryClient.invalidateQueries({ queryKey: ['monthly-profit', month] });
    queryClient.invalidateQueries({ queryKey: ['financial-expenses', month] });
    queryClient.invalidateQueries({ queryKey: ['shipping-records', month] });
  };
}

export async function calculateFinanceMonth(
  queryClient: ReturnType<typeof useQueryClient>,
  month: string
): Promise<FinanceMonthBundle> {
  const bundle = await financialService.calculateFinanceMonth(month);
  queryClient.setQueryData(financeMonthQueryKey(month), bundle);
  if (bundle.profit) {
    queryClient.setQueryData(['monthly-profit', month], bundle.profit);
  }
  queryClient.setQueryData(['financial-expenses', month], bundle.expenses);
  queryClient.setQueryData(['shipping-records', month], bundle.shippingRecords);
  return bundle;
}
