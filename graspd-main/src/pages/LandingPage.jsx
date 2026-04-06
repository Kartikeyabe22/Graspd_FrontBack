import { useEffect } from 'react'
import Nav from '../components/Nav'
import Hero from '../components/Hero'
import FeatureSection from '../components/FeatureSection'
import AiCanvasDemo from '../components/demos/AiCanvasDemo'
import CollabDemo from '../components/demos/CollabDemo'
import LiveTutorDemo from '../components/demos/LiveTutorDemo'
import Cta from '../components/Cta'
import Footer from '../components/Footer'

// ── SVG icons ──────────────────────────────────────────────────────────────
const IconStar = (color) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="2.5"/>
    <line x1="8" y1="1.5" x2="8" y2="4"/>
    <line x1="8" y1="12" x2="8" y2="14.5"/>
    <line x1="1.5" y1="8" x2="4" y2="8"/>
    <line x1="12" y1="8" x2="14.5" y2="8"/>
  </svg>
)

const CANVAS_BULLETS = [
  {
    icon: IconStar('#4ade80'),
    title: 'instant knowledge graph',
    desc: 'structured node-edge diagrams appear on the canvas in under 5 seconds. built from claude',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 2.5l2.5 2.5-7 7H4v-2.5l7-7z"/><line x1="9.5" y1="4" x2="12" y2="6.5"/>
      </svg>
    ),
    title: 'fully editable on canvas',
    desc: 'every generated node is a live tldraw shape. move, resize, reconnect, annotate. it\'s your canvas the moment it\'s drawn.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 8A5 5 0 1 1 8 3"/><polyline points="11 1 13 3 11 5"/><line x1="13" y1="3" x2="8" y2="3"/>
      </svg>
    ),
    title: 'go deeper on any node',
    desc: 'click any concept and ask for a deeper dive. the ai adds sub-branches without wiping what\'s already there.',
  },
]

const COLLAB_BULLETS = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>
      </svg>
    ),
    title: 'live cursors',
    desc: 'see exactly where every collaborator is on the canvas. named, colour-coded, always in sync. no lag, no reload.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h10v8H8.5L6 13.5V11H3V3z"/>
        <line x1="5" y1="6" x2="11" y2="6"/>
        <line x1="5" y1="8.5" x2="9" y2="8.5"/>
      </svg>
    ),
    title: 'pinned comment threads',
    desc: 'attach comments to any shape, region, or blank space. teammates see them instantly. @mention to notify. resolve to dismiss.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4" r="1.8"/>
        <circle cx="4" cy="8" r="1.8"/>
        <circle cx="12" cy="12" r="1.8"/>
        <line x1="5.7" y1="7.1" x2="10.3" y2="4.9"/>
        <line x1="5.7" y1="8.9" x2="10.3" y2="11.1"/>
      </svg>
    ),
    title: 'instant shareable link',
    desc: 'every canvas gets a permanent url. copy and send. collaborators jump in without any sign-up or setup.',
  },
]

const TUTOR_BULLETS = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5.5" y="1.5" width="5" height="8" rx="2.5"/>
        <path d="M2.5 8.5a5.5 5.5 0 0 0 11 0"/>
        <line x1="8" y1="14" x2="8" y2="11.5"/>
      </svg>
    ),
    title: 'voice-first interaction',
    desc: 'no typing needed. speak your question and the tutor responds out loud instantly, like having a teacher always in the room.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="8" height="6" rx="1.5"/>
        <rect x="6" y="7" width="8" height="6" rx="1.5"/>
      </svg>
    ),
    title: 'canvas-aware context',
    desc: 'the tutor sees what\'s on your canvas and tailors its explanation to exactly what you\'re looking at. no generic answers.',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12.5 L2 9 L5 6 L8 9 L11 4 L14 7"/>
        <line x1="2" y1="14" x2="14" y2="14"/>
      </svg>
    ),
    title: 'resources surface automatically',
    desc: 'as the tutor speaks, relevant youtube videos and articles appear alongside the canvas — curated to your exact topic.',
  },
]

export default function LandingPage() {
  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('on') }),
      { threshold: 0.06 }
    )
    document.querySelectorAll('.reveal, .reveal-l, .reveal-r').forEach((el) =>
      observer.observe(el)
    )
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Nav />

      <Hero />
      <div className="div" />

      <FeatureSection
        id="s1"
        eyebrowColor="var(--green)"
        eyebrowText="ai canvas generation"
        title="type a topic."
        titleAccent="get the full map."
        accentColor="var(--green)"
        description="describe anything and watch the ai build a fully connected knowledge graph directly on the canvas in seconds. nodes, edges, labels, all live, all editable."
        bullets={CANVAS_BULLETS}
        demo={<AiCanvasDemo />}
      />

      <FeatureSection
        id="s2"
        flip
        eyebrowColor="var(--blue)"
        eyebrowText="live collaboration"
        title="your team."
        titleAccent="same canvas."
        accentColor="var(--blue)"
        description="share a link. everyone joins the same infinite canvas in real time. see teammates draw, comment, and move around live. no accounts needed to join."
        bullets={COLLAB_BULLETS}
        demo={<CollabDemo />}
      />

      <FeatureSection
        id="s3"
        eyebrowColor="var(--green)"
        eyebrowText="live tutor"
        title="just speak."
        titleAccent="it explains."
        accentColor="var(--green)"
        description="your ai voice tutor is always on. ask anything about what's on the canvas. it explains out loud, adapts to your level, and surfaces every relevant resource in real time."
        bullets={TUTOR_BULLETS}
        demo={<LiveTutorDemo />}
      />

      <Cta />
      <Footer />
    </>
  )
}