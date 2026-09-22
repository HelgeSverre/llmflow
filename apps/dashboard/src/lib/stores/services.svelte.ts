import { api } from '$lib/api/client'
export const services = $state<{ values: string[] }>({ values: [] })
export async function loadServices() {
  try {
    services.values = await api.get<string[]>('/api/services')
  } catch {
    /* Existing selections remain usable when discovery fails. */
  }
}
