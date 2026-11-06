const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const WS_URL =
  import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

export { API_URL, WS_URL }