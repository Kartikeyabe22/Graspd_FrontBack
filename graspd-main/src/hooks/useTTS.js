import { useState, useCallback } from 'react'
import { generateSpeech, playSpeech } from '../services/tts'

/**
 * Hook for text-to-speech functionality
 * Provides methods to generate audio and manage playback state
 */
export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const speak = useCallback(async (text) => {
    if (!text) {
      setError('No text provided')
      return
    }
    
    try {
      setIsLoading(true)
      setError(null)
      setIsPlaying(true)
      
      await playSpeech(text)
    } catch (err) {
      setError(err.message || 'Failed to play audio')
      console.error('TTS Error:', err)
    } finally {
      setIsPlaying(false)
      setIsLoading(false)
    }
  }, [])
  
  const getAudioBlob = useCallback(async (text) => {
    try {
      setIsLoading(true)
      setError(null)
      return await generateSpeech(text)
    } catch (err) {
      setError(err.message || 'Failed to generate audio')
      console.error('TTS Error:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  return {
    speak,
    getAudioBlob,
    isPlaying,
    isLoading,
    error,
  }
}
