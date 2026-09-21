export const api = {
  async get<T>(url: string): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  },
}
