/**
 * Chat Service — DataOps Assistant chat API.
 */
import { apiClient } from './apiClient'

export const chatService = {
  sendMessage: (message: string) =>
    apiClient.post<{ text: string; type?: string; data?: any }>('/api/chat', { message }),
}
