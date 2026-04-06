import { useEffect, useRef } from 'react'

export function useReveal() {
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('on')
          }
        })
      },
      { threshold: 0.06 }
    )

    const el = ref.current
    if (!el) return

    // Observe all .reveal* children inside this element
    const targets = el.querySelectorAll('.reveal, .reveal-l, .reveal-r')
    targets.forEach((t) => observer.observe(t))

    return () => observer.disconnect()
  }, [])

  return ref
}