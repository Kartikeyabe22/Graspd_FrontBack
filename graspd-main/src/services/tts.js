/**
 * TTS Service - Handles text-to-speech conversion via ElevenLabs
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export const generateSpeech = async (text) => {
  try {
    const response = await fetch(`${BACKEND_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error(`TTS Error: ${response.statusText}`)
    }

    const audioBlob = await response.blob()
    return new Blob([audioBlob], { type: 'audio/mpeg' })
  } catch (error) {
    console.error('Generate speech error:', error)
    throw error
  }
}

export const playSpeechFromBlob = async (audioBlob, options = {}) => {
  const { playbackRate = 1.5 } = options
  const audioUrl = URL.createObjectURL(audioBlob)
  const audio = new Audio(audioUrl)
  audio.playbackRate = playbackRate

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      resolve()
    }
    audio.onerror = (error) => {
      URL.revokeObjectURL(audioUrl)
      reject(error)
    }
    audio.play().catch(reject)
  })
}

export const playSpeech = async (text, options = {}) => {
  try {
    const audioBlob = await generateSpeech(text)
    return await playSpeechFromBlob(audioBlob, options)
  } catch (error) {
    console.error('Play speech error:', error)
    throw error
  }
}
