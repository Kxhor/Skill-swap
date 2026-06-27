import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export function useSwaps(tab: string = 'all') {
  return useQuery({
    queryKey: ['swaps', tab],
    queryFn: () =>
      api.get(`/api/swaps?tab=${tab}`).then((r) => r.data),
  })
}

export function useSwap(id: string | undefined) {
  return useQuery({
    queryKey: ['swap', id],
    queryFn: () => api.get(`/api/swaps/${id}`).then((r) => r.data.swap),
    enabled: !!id,
  })
}

export function useCreateSwap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { receiver_id: string; offered_skill_id: string; wanted_skill_id: string }) =>
      api.post('/api/swaps', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }) },
  })
}

export function useAcceptSwap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (swapId: string) => api.post(`/api/swaps/${swapId}/accept`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }) },
  })
}

export function useRejectSwap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (swapId: string) => api.post(`/api/swaps/${swapId}/reject`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }) },
  })
}

export function useCancelSwap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (swapId: string) => api.post(`/api/swaps/${swapId}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }) },
  })
}

export function useCompleteSwap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (swapId: string) => api.post(`/api/swaps/${swapId}/complete`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }) },
  })
}

export function useMessages(swapId: string | undefined) {
  return useQuery({
    queryKey: ['messages', swapId],
    queryFn: () => api.get(`/api/swaps/${swapId}/messages`).then((r) => r.data.messages),
    enabled: !!swapId,
    refetchInterval: 5000,
  })
}

export function useSendMessage(swapId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      api.post(`/api/swaps/${swapId}/messages`, { content }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages', swapId] }) },
  })
}
