import axios from 'axios'

let csrfToken: string | null = null

export function setCsrfToken(token: string) {
  csrfToken = token
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (config.method && !['get', 'head', 'options'].includes(config.method)) {
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken
    }
  }
  return config
})

api.interceptors.response.use((res) => res)

export default api
