import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

//  Knowledge Graph Generator
const GRAPH_SYSTEM_PROMPT = `You are an expert knowledge graph generator for an educational canvas app called graspd. Your job is to create EXTREMELY detailed, comprehensive, and thorough knowledge graphs.

When given a topic, you must return ONLY a valid JSON object — no markdown, no backticks, no explanation, nothing else.

The JSON must follow this exact structure:
{
  "topic": "the topic name",
  "nodes": [
    { "id": "1", "label": "Concept Name", "type": "core" },
    { "id": "2", "label": "Sub Concept",  "type": "sub"  },
    { "id": "3", "label": "Detail Point", "type": "detail" }
  ],
  "edges": [
    { "from": "1", "to": "2" },
    { "from": "1", "to": "3" }
  ]
}

Node types:
- "core"   → exactly ONE per graph, the central topic
- "sub"    → major categories, themes, components, or pillars of the topic (aim for 6-10 sub nodes)
- "detail" → specific facts, mechanisms, examples, people, dates, formulas, causes, effects, subtypes — one node per distinct idea (aim for 3-6 detail nodes per sub node)

CRITICAL RULES FOR DEPTH AND DETAIL:
- Generate between 25 and 50 nodes total. Never less than 25.
- Every sub node must have at least 3 detail nodes connected to it
- detail nodes should capture SPECIFIC information: exact names, dates, formulas, mechanisms, people, events, examples, subtypes, consequences — not vague summaries
- Labels must be concise but information-dense: "ATP Synthesis via Chemiosmosis" not just "Energy", "Robespierre's Reign of Terror 1793" not just "Terror", "O(n log n) Time Complexity" not just "Fast"
- Never use vague labels like "Overview", "Introduction", "Details", "More Info", "Examples"
- Capture ALL major aspects of the topic: history, mechanisms, people, applications, types, causes, effects, controversies, modern relevance — whatever is applicable
- Think like a professor writing a comprehensive lecture outline, not a student making a quick summary
- If the topic is a process, capture every step. If it is a concept, capture every dimension. If it is historical, capture causes, key figures, events, consequences, legacy.

LABEL FORMATTING:
- Max 5 words per label
- Be specific and information-dense
- Use proper nouns, technical terms, dates where relevant
- Abbreviations are fine if universally understood (e.g. "DNA", "HTTP", "CPU")

Return ONLY the raw JSON, nothing else.`

export async function generateKnowledgeGraph(topic) {
  const prompt = `${GRAPH_SYSTEM_PROMPT}

Topic: ${topic}

Remember: generate at least 25 nodes. Be exhaustive. Capture every important concept, mechanism, person, date, example, and application related to this topic. Do not summarize — expand.`

  const result = await model.generateContent(prompt)
  const text   = result.response.text()
  const clean  = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}


// ── Chat System ───────────────────────────────────────────────────────────
const CHAT_SYSTEM_PROMPT = `You are graspd's AI tutor — an intelligent, friendly learning assistant embedded inside an infinite canvas app.

You can see what concepts are currently on the student's canvas (provided as context). Use this to give targeted, relevant answers.

You always respond with ONLY a valid JSON object — no markdown, no backticks, nothing else.

Response format:
{
  "type": "explanation | generation | recommendation",
  "message": "your conversational response here, can use \\n for line breaks",
  "resources": [
    { "kind": "youtube", "title": "descriptive title", "url": "https://youtube.com/..." },
    { "kind": "article", "title": "descriptive title", "url": "https://..." }
  ],
  "graph": null
}

Rules:
- "type" must be one of: explanation, generation, recommendation
- "message" is always required — be clear, warm, educational. Use \\n\\n for paragraphs.
- "resources" is an array — include 2 to 3 real, relevant resources when helpful. Use real URLs only. If you are not sure of the exact URL, omit that resource.
- "graph" is null UNLESS the student asks you to draw, generate, expand, or create a diagram/flowchart/map on the canvas. In that case, set graph to this exact structure:
  {
    "topic": "topic name",
    "nodes": [
      { "id": "1", "label": "Concept", "type": "core" },
      { "id": "2", "label": "Sub", "type": "sub" },
      { "id": "3", "label": "Detail", "type": "detail" }
    ],
    "edges": [
      { "from": "1", "to": "2" }
    ]
  }

Behaviour rules:
- If student asks to explain a concept → type: explanation, give a clear explanation, include resources
- If student asks for recommendations, resources, videos, articles → type: recommendation, focus on resources
- If student asks to draw/generate/expand/create/flowchart/map → type: generation, set graph field, message confirms what you drew
- Always tailor your answer to what is currently on the canvas when relevant
- Keep message concise but complete — students are learning, not reading essays
- Tone: smart, friendly, encouraging. Not robotic.`

export async function sendChatMessage(userMessage, canvasShapes, conversationHistory) {
  // Build canvas context string from current shapes
  const canvasContext = canvasShapes
    .filter(s => s.type === 'geo' || s.type === 'text' || s.type === 'note')
    .map(s => {
      const text = s.props?.richText?.children?.[0]?.children?.[0]?.text
        ?? s.props?.text
        ?? ''
      return text
    })
    .filter(Boolean)
    .join(', ')

  // Build the full prompt with canvas context + history + new message
  const contextBlock = canvasContext
    ? `[Canvas currently shows: ${canvasContext}]\n\n`
    : '[Canvas is empty]\n\n'

  // Format conversation history for Gemini
  const historyText = conversationHistory
    .slice(-6) // last 3 exchanges
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n')

  const fullPrompt = `${CHAT_SYSTEM_PROMPT}

${contextBlock}${historyText ? `Conversation so far:\n${historyText}\n\n` : ''}Student: ${userMessage}`

  const result = await model.generateContent(fullPrompt)
  const text = result.response.text()
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
export async function sendChatMessageWithFile(userMessage, file, canvasShapes, conversationHistory) {
  // Convert file to base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const canvasContext = canvasShapes
    .filter(s => s.type === 'geo' || s.type === 'text' || s.type === 'note')
    .map(s => s.props?.richText?.children?.[0]?.children?.[0]?.text ?? s.props?.text ?? '')
    .filter(Boolean)
    .join(', ')

  const contextBlock = canvasContext
    ? `[Canvas currently shows: ${canvasContext}]\n\n`
    : '[Canvas is empty]\n\n'

  const historyText = conversationHistory
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n')

  const textPrompt = `${CHAT_SYSTEM_PROMPT}

${contextBlock}${historyText ? `Conversation so far:\n${historyText}\n\n` : ''}Student uploaded a file and says: "${userMessage}"

Analyse the uploaded file carefully. Explain what it shows, identify all key concepts, and if appropriate generate a knowledge graph of those concepts.`

  const result = await model.generateContent([
    textPrompt,
    {
      inlineData: {
        mimeType: file.type,
        data:     base64,
      },
    },
  ])

  const text  = result.response.text()
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}