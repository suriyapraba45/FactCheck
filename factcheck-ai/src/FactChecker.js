import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_CLAIMS = [
  { lang: "EN", flag: "🇬🇧", text: "Drinking hot water cures COVID-19." },
  { lang: "HI", flag: "🇮🇳", text: "गर्म पानी पीने से कोरोना वायरस ठीक हो जाता है।" },
  { lang: "TA", flag: "🇮🇳", text: "வெங்காயம் சாப்பிட்டால் கொரோனா குணமாகும்." },
  { lang: "TE", flag: "🇮🇳", text: "వేప ఆకులు తింటే కరోనా నయమవుతుంది." },
  { lang: "BN", flag: "🇧🇩", text: "রসুন খেলে করোনাভাইরাস নিরাময় হয়।" },
];

const SYSTEM_PROMPT = `You are a WhatsApp-native AI fact-checker for Indian languages (Tamil, Telugu, Bengali, Hindi, and English).

Your task: receive text claims, fact-check them, and respond ONLY in valid JSON (no markdown, no backticks).

Rules:
1. Extract all factual claims from the input.
2. Verify each claim using your knowledge.
3. Respond in the SAME LANGUAGE as the input.
4. Return ONLY this JSON structure (no extra text):
{
  "verdict": "True" | "False" | "Mixed" | "Unverified",
  "confidence": <0-100>,
  "virality_score": <1-10>,
  "language_detected": "<language name>",
  "claims_found": ["<claim 1>", "<claim 2>"],
  "explanation": "<short plain-language reasoning>",
  "counter_message": "<WhatsApp-friendly correction in the SAME language as input — concise, max 2 sentences>"
}

Keep explanation and counter_message concise and WhatsApp-friendly.`;

const VERDICT_CONFIG = {
  True:       { color: "#25D366", bg: "#e6faf0", border: "#b2f0d0", emoji: "✅", label: "TRUE",       glow: "rgba(37,211,102,0.30)" },
  False:      { color: "#e53e3e", bg: "#fff0f0", border: "#ffc5c5", emoji: "❌", label: "FALSE",      glow: "rgba(229,62,62,0.28)"  },
  Mixed:      { color: "#d69e2e", bg: "#fffbeb", border: "#fde68a", emoji: "⚠️", label: "MIXED",      glow: "rgba(214,158,46,0.28)" },
  Unverified: { color: "#718096", bg: "#f7fafc", border: "#cbd5e0", emoji: "🔍", label: "UNVERIFIED", glow: "rgba(113,128,150,0.22)" },
};

const API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY || "";

// ─────────────────────────────────────────────────────────────────────────────
// TINY UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function ConfidenceBar({ value, color }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#aaa", marginBottom:3 }}>
        <span style={{ letterSpacing:".06em", fontWeight:800, textTransform:"uppercase" }}>Confidence</span>
        <span style={{ fontWeight:900, color }}>{value}%</span>
      </div>
      <div style={{ background:"#e8edf2", borderRadius:99, height:5, overflow:"hidden" }}>
        <div style={{
          width:`${value}%`,
          background:`linear-gradient(90deg,${color}88,${color})`,
          height:"100%", borderRadius:99,
          boxShadow:`0 0 8px ${color}77`,
          transition:"width 1.4s cubic-bezier(.16,1,.3,1)"
        }}/>
      </div>
    </div>
  );
}

function ViralityMeter({ score }) {
  const col = score >= 7 ? "#e53e3e" : score >= 4 ? "#d69e2e" : "#25D366";
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:4 }}>
      <span style={{ fontSize:10, color:"#aaa", fontWeight:800, letterSpacing:".06em", textTransform:"uppercase", marginRight:2, paddingBottom:1 }}>
        Virality
      </span>
      <div style={{ display:"flex", gap:3, alignItems:"flex-end" }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{
            width:5,
            height: i < score ? 6 + i * 1.4 : 5,
            borderRadius:3,
            background: i < score ? col : "#dde3ea",
            transition:`all .45s ease ${i * 55}ms`,
            boxShadow: i < score ? `0 0 5px ${col}99` : "none",
          }}/>
        ))}
      </div>
      <span style={{ fontSize:10, color:"#aaa", paddingBottom:1 }}>{score}/10</span>
    </div>
  );
}

function Tick({ ts }) {
  return (
    <span style={{ fontSize:10, color:"#aaa", marginLeft:6, userSelect:"none", whiteSpace:"nowrap" }}>
      {ts} ✓✓
    </span>
  );
}

function Avatar({ letter, bg }) {
  return (
    <div style={{
      width:32, height:32, borderRadius:"50%",
      background: bg || "linear-gradient(135deg,#075E54,#25D366)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:14, fontWeight:800, color:"#fff", flexShrink:0,
      boxShadow:"0 2px 8px rgba(0,0,0,.22)"
    }}>{letter}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUBBLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function LoadingBubble() {
  return (
    <div style={{ display:"flex", gap:9, alignItems:"flex-end", padding:"4px 12px" }}>
      <Avatar letter="🔍"/>
      <div style={{
        background:"#fff", borderRadius:"3px 16px 16px 16px",
        padding:"13px 18px",
        boxShadow:"0 1px 5px rgba(0,0,0,.10)",
        display:"flex", alignItems:"center", gap:6
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width:9, height:9, borderRadius:"50%", background:"#25D366",
            animation:"waDot 1.4s infinite ease-in-out",
            animationDelay:`${i * 0.22}s`
          }}/>
        ))}
        <span style={{ fontSize:11, color:"#bbb", marginLeft:5, fontWeight:600 }}>Fact-checking…</span>
      </div>
    </div>
  );
}

function UserBubble({ text, ts }) {
  return (
    <div style={{ display:"flex", justifyContent:"flex-end", gap:9, alignItems:"flex-end", padding:"3px 12px" }}>
      <div style={{
        background:"linear-gradient(145deg,#d2f7c0,#dcf8c6)",
        borderRadius:"16px 3px 16px 16px",
        padding:"10px 14px",
        maxWidth:"73%",
        fontSize:14, lineHeight:1.58, color:"#1a1a1a",
        boxShadow:"0 1px 5px rgba(0,0,0,.10)",
        wordBreak:"break-word", whiteSpace:"pre-wrap",
      }}>
        {text}
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:4 }}>
          <Tick ts={ts}/>
        </div>
      </div>
      <Avatar letter="👤" bg="linear-gradient(135deg,#4facfe,#00f2fe)"/>
    </div>
  );
}

function ResultBubble({ result, ts }) {
  const cfg = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.Unverified;
  return (
    <div style={{ display:"flex", gap:9, alignItems:"flex-end", padding:"3px 12px" }}>
      <Avatar letter="🔍"/>
      <div style={{
        background:"#fff",
        borderRadius:"3px 18px 18px 18px",
        overflow:"hidden",
        maxWidth:"80%",
        boxShadow:`0 3px 14px rgba(0,0,0,.10), 0 0 0 1.5px ${cfg.border}`,
        animation:"bubbleIn .38s cubic-bezier(.16,1,.3,1)"
      }}>

        {/* ── verdict header strip ── */}
        <div style={{
          background:`linear-gradient(100deg,${cfg.bg} 0%,#fff 100%)`,
          borderBottom:`2px solid ${cfg.border}`,
          padding:"11px 15px",
          display:"flex", alignItems:"center", gap:11
        }}>
          <span style={{ fontSize:26, lineHeight:1, filter:`drop-shadow(0 0 6px ${cfg.glow})` }}>
            {cfg.emoji}
          </span>
          <div style={{ flex:1 }}>
            <div style={{
              fontWeight:900, fontSize:16,
              color: cfg.color,
              letterSpacing:".05em",
              textShadow:`0 0 22px ${cfg.glow}`
            }}>{cfg.label}</div>
            <div style={{ fontSize:10, color:"#aaa", marginTop:1, display:"flex", gap:6, alignItems:"center" }}>
              <span>🌐 {result.language_detected}</span>
              {result.fromCache && (
                <span style={{ background:"#e2e8f0", borderRadius:4, padding:"1px 6px", fontWeight:700, color:"#666" }}>
                  📦 CACHED
                </span>
              )}
            </div>
          </div>
          <div style={{
            background: cfg.color, color:"#fff",
            borderRadius:10, padding:"3px 10px",
            fontSize:11, fontWeight:900, letterSpacing:".04em",
            boxShadow:`0 2px 8px ${cfg.glow}`
          }}>{result.confidence}%</div>
        </div>

        {/* ── body ── */}
        <div style={{ padding:"13px 15px", display:"flex", flexDirection:"column", gap:11 }}>
          <ConfidenceBar value={result.confidence} color={cfg.color}/>
          <ViralityMeter score={result.virality_score}/>

          {result.claims_found?.length > 0 && (
            <div>
              <div style={{
                fontSize:9.5, color:"#aaa", fontWeight:800,
                letterSpacing:".07em", textTransform:"uppercase", marginBottom:6
              }}>Claims Detected</div>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {result.claims_found.map((c, i) => (
                  <div key={i} style={{
                    background:"#f7fafc", borderRadius:9,
                    padding:"7px 11px", fontSize:12.5, color:"#2d3748",
                    borderLeft:`3px solid ${cfg.color}`,
                    lineHeight:1.5
                  }}>{c}</div>
                ))}
              </div>
            </div>
          )}

          <div style={{
            fontSize:13, color:"#4a5568", lineHeight:1.65,
            background:"#f8fafc", borderRadius:10, padding:"9px 12px",
            borderLeft:"3px solid #e2e8f0"
          }}>
            {result.explanation}
          </div>

          {result.counter_message && (
            <div style={{
              background:"linear-gradient(135deg,#d2f7c0,#c5f0ba)",
              borderRadius:11, padding:"11px 13px",
              fontSize:13, color:"#1a1a1a", lineHeight:1.65,
              borderLeft:"3px solid #25D366",
              boxShadow:"inset 0 0 0 1px rgba(37,211,102,.18)"
            }}>
              <span style={{ marginRight:6 }}>📤</span>
              <strong style={{ color:"#075E54" }}>Share: </strong>
              {result.counter_message}
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <Tick ts={ts}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBubble({ text, ts }) {
  return (
    <div style={{ display:"flex", gap:9, alignItems:"flex-end", padding:"3px 12px" }}>
      <Avatar letter="⚠️"/>
      <div style={{
        background:"#fff0f0", borderRadius:"3px 16px 16px 16px",
        padding:"10px 14px", fontSize:13, color:"#c53030",
        boxShadow:"0 1px 5px rgba(0,0,0,.09)", maxWidth:"78%", lineHeight:1.55
      }}>
        {text}<Tick ts={ts}/>
      </div>
    </div>
  );
}

function SamplePill({ s, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(s.text)}
      onKeyDown={e => e.key === "Enter" && onClick(s.text)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#e6f9ef" : "#fff",
        border:`1.5px solid ${hov ? "#b2f0d0" : "#e2e8f0"}`,
        borderRadius:13, padding:"9px 13px",
        fontSize:12.5, color:"#2d3748",
        cursor:"pointer", display:"flex", gap:9, alignItems:"flex-start",
        transition:"all .18s ease",
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? "0 6px 16px rgba(0,0,0,.09)" : "0 1px 3px rgba(0,0,0,.05)",
        lineHeight:1.5, maxWidth:"82%",
        outline:"none"
      }}
    >
      <span style={{
        fontSize:9.5, fontWeight:900,
        background: hov ? "#dcf8c6" : "#f0f4f8",
        borderRadius:5, padding:"2px 7px",
        whiteSpace:"nowrap", marginTop:1,
        color:"#075E54", letterSpacing:".05em",
        transition:"background .18s", flexShrink:0
      }}>{s.flag} {s.lang}</span>
      {s.text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function FactChecker() {
  const [input, setText]           = useState("");
  const [messages, setMessages]    = useState([]);
  const [loading, setLoading]      = useState(false);
  const [history, setHistory]      = useState([]);   // {input, result}[]
  const [showSamples, setShowSamples] = useState(true);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  const chatRef     = useRef(null);
  const textareaRef = useRef(null);

  const now = () => new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });

  // auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior:"smooth" });
    }
  }, [messages, loading]);

  const checkFact = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (!API_KEY) {
      setApiKeyMissing(true);
      return;
    }

    setShowSamples(false);
    setText("");
    const ts = now();
    setMessages(prev => [...prev, { type:"user", text, ts }]);
    setLoading(true);

    // cache hit
    const cached = history.find(h => h.input.trim().toLowerCase() === text.toLowerCase());
    if (cached) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          type:"result",
          result:{ ...cached.result, fromCache:true },
          ts: now()
        }]);
        setLoading(false);
      }, 500);
      return;
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role:"user", content:text }]
        })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `HTTP ${res.status}`);
      }

      const data  = await res.json();
      const raw   = data.content?.map(b => b.text || "").join("") || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      setMessages(prev => [...prev, { type:"result", result:parsed, ts:now() }]);
      setHistory(prev => [{ input:text, result:parsed }, ...prev.slice(0, 49)]);
    } catch (e) {
      console.error("FactCheck error:", e);
      setMessages(prev => [...prev, {
        type:"error",
        text:`Could not complete fact-check: ${e.message}. Please try again.`,
        ts: now()
      }]);
    }
    setLoading(false);
  }, [input, loading, history]);

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); checkFact(); }
  }

  const waBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='%23b2bec3' fill-opacity='0.12'%3E%3Cpath d='M0 40 L40 0 L80 40 L40 80Z'/%3E%3C/g%3E%3C/svg%3E")`;

  return (
    <>
      {/* ── global keyframes ── */}
      <style>{`
        @keyframes waDot {
          0%,80%,100% { transform:scale(0.55); opacity:.45; }
          40%          { transform:scale(1.15); opacity:1;   }
        }
        @keyframes bubbleIn {
          from { opacity:0; transform:translateY(10px) scale(.96); }
          to   { opacity:1; transform:none; }
        }
        @keyframes fadeSlide {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:none; }
        }
        @keyframes livePulse {
          0%,100% { box-shadow:0 0 0 0 rgba(37,211,102,.5); }
          50%      { box-shadow:0 0 0 6px rgba(37,211,102,0); }
        }
        * { box-sizing:border-box; }
        textarea:focus { outline:none; }
      `}</style>

      {/* ── page background ── */}
      <div style={{
        minHeight:"100vh",
        background:"linear-gradient(155deg,#060d1a 0%,#0d2236 55%,#071520 100%)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"'Nunito', system-ui, sans-serif",
        padding:"20px 12px",
        position:"relative", overflow:"hidden"
      }}>
        {/* ambient glow blobs */}
        <div style={{
          position:"absolute", width:480, height:480, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(37,211,102,.09),transparent 65%)",
          top:"-5%", left:"-8%", pointerEvents:"none"
        }}/>
        <div style={{
          position:"absolute", width:400, height:400, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(7,94,84,.15),transparent 65%)",
          bottom:"-6%", right:"-6%", pointerEvents:"none"
        }}/>

        {/* ── phone shell ── */}
        <div style={{
          width:400, maxWidth:"100%",
          borderRadius:46,
          overflow:"hidden",
          boxShadow:"0 60px 150px rgba(0,0,0,.75), 0 0 0 2px rgba(255,255,255,.07), inset 0 1px 0 rgba(255,255,255,.10)",
          background:"#ededed",
          animation:"fadeSlide .65s cubic-bezier(.16,1,.3,1)"
        }}>

          {/* status bar */}
          <div style={{
            background:"#054d45",
            padding:"9px 22px 5px",
            display:"flex", justifyContent:"space-between", alignItems:"center"
          }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,.65)", fontWeight:700, letterSpacing:".02em" }}>
              {new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
            </span>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
                <rect x="0" y="5" width="3" height="6" rx="1" fill="rgba(255,255,255,.6)"/>
                <rect x="4" y="3" width="3" height="8" rx="1" fill="rgba(255,255,255,.7)"/>
                <rect x="8" y="1" width="3" height="10" rx="1" fill="rgba(255,255,255,.8)"/>
                <rect x="12" y="0" width="3" height="11" rx="1" fill="white"/>
              </svg>
              <svg width="16" height="12" viewBox="0 0 24 12" fill="none">
                <path d="M12 2C15.3 2 18.3 3.4 20.4 5.6L22 4C19.5 1.5 16 0 12 0S4.5 1.5 2 4l1.6 1.6C5.7 3.4 8.7 2 12 2z" fill="rgba(255,255,255,.55)"/>
                <path d="M12 6c2.2 0 4.2.9 5.7 2.3L19.3 7C17.4 5.1 15 4 12 4s-5.4 1.1-7.3 3l1.6 1.3C7.8 6.9 9.8 6 12 6z" fill="rgba(255,255,255,.75)"/>
                <path d="M12 10c1.1 0 2.1.4 2.8 1.1L16.5 9.5C15.4 8.6 13.8 8 12 8s-3.4.6-4.5 1.5l1.7 1.6C9.9 10.4 10.9 10 12 10z" fill="white"/>
                <circle cx="12" cy="12" r="1.5" fill="white"/>
              </svg>
              <div style={{ display:"flex", gap:1 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:5, height:10, borderRadius:2, background:`rgba(255,255,255,${0.45 + i*0.2})` }}/>
                ))}
                <div style={{ width:3, height:10, borderRadius:2, background:"rgba(255,255,255,.15)", marginLeft:1 }}/>
              </div>
            </div>
          </div>

          {/* ── WhatsApp header ── */}
          <div style={{
            background:"linear-gradient(90deg,#075E54 0%,#128C7E 100%)",
            padding:"10px 14px 13px",
            display:"flex", alignItems:"center", gap:11,
            boxShadow:"0 2px 10px rgba(0,0,0,.22)"
          }}>
            <span style={{ color:"rgba(255,255,255,.75)", fontSize:20, cursor:"pointer", marginRight:1, lineHeight:1 }}>‹</span>

            <div style={{
              width:44, height:44, borderRadius:"50%",
              background:"linear-gradient(135deg,#25D366,#075E54)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, boxShadow:"0 2px 10px rgba(0,0,0,.28)", flexShrink:0
            }}>🔍</div>

            <div style={{ flex:1, overflow:"hidden" }}>
              <div style={{ color:"#fff", fontWeight:900, fontSize:16, letterSpacing:".01em", whiteSpace:"nowrap" }}>
                FactCheck AI
              </div>
              <div style={{ display:"flex", gap:4, marginTop:2, flexWrap:"wrap" }}>
                {["Tamil","Telugu","Bengali","Hindi","English"].map(l => (
                  <span key={l} style={{
                    fontSize:9, color:"rgba(255,255,255,.6)",
                    background:"rgba(255,255,255,.11)",
                    borderRadius:4, padding:"1px 6px", fontWeight:800, letterSpacing:".03em"
                  }}>{l}</span>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
              <div style={{
                background:"#25D366", color:"#fff",
                borderRadius:99, padding:"2px 10px",
                fontSize:9.5, fontWeight:900, letterSpacing:".09em",
                animation:"livePulse 2s infinite"
              }}>● LIVE</div>
              {history.length > 0 && (
                <div style={{ fontSize:9.5, color:"rgba(255,255,255,.5)", fontWeight:800 }}>
                  {history.length} cached
                </div>
              )}
            </div>
          </div>

          {/* ── chat area ── */}
          <div
            ref={chatRef}
            style={{
              background:"#e5ddd5",
              backgroundImage: waBg,
              minHeight:380, maxHeight:468,
              overflowY:"auto",
              padding:"10px 0 8px",
              display:"flex", flexDirection:"column"
            }}
          >
            {/* date pill */}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
              <div style={{
                background:"rgba(220,240,255,.88)", borderRadius:8,
                padding:"3px 12px", fontSize:11, color:"#546878",
                fontWeight:800, letterSpacing:".04em",
                backdropFilter:"blur(4px)"
              }}>
                {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short"})}
              </div>
            </div>

            {/* intro bubble */}
            <div style={{ display:"flex", gap:9, alignItems:"flex-end", padding:"2px 12px 8px" }}>
              <Avatar letter="🔍"/>
              <div style={{
                background:"#fff", borderRadius:"3px 16px 16px 16px",
                padding:"11px 15px", maxWidth:"80%",
                boxShadow:"0 1px 5px rgba(0,0,0,.09)",
                fontSize:13.5, color:"#333", lineHeight:1.6
              }}>
                👋 Send me any claim in <strong>Tamil, Telugu, Bengali, Hindi, or English</strong> and I'll fact-check it instantly.
                <Tick ts={now()}/>
              </div>
            </div>

            {/* API key warning */}
            {apiKeyMissing && (
              <div style={{ margin:"4px 12px 8px", background:"#fff3cd", borderRadius:10, padding:"10px 14px", fontSize:12.5, color:"#856404", lineHeight:1.6, border:"1px solid #ffc107" }}>
                ⚠️ <strong>API key missing.</strong> Set <code>REACT_APP_ANTHROPIC_API_KEY</code> in your <code>.env</code> file and restart. See README for details.
              </div>
            )}

            {/* samples */}
            {showSamples && (
              <div style={{ padding:"4px 12px 10px" }}>
                <div style={{
                  fontSize:10, color:"#999", fontWeight:800,
                  textAlign:"center", marginBottom:9,
                  letterSpacing:".07em", textTransform:"uppercase"
                }}>— Try a sample claim —</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-start" }}>
                  {SAMPLE_CLAIMS.map((s, i) => (
                    <SamplePill key={i} s={s} onClick={t => {
                      setText(t);
                      textareaRef.current?.focus();
                    }}/>
                  ))}
                </div>
              </div>
            )}

            {/* message thread */}
            {messages.map((m, i) => {
              if (m.type === "user")   return <UserBubble   key={i} text={m.text}     ts={m.ts}/>;
              if (m.type === "result") return <ResultBubble key={i} result={m.result} ts={m.ts}/>;
              if (m.type === "error")  return <ErrorBubble  key={i} text={m.text}     ts={m.ts}/>;
              return null;
            })}

            {loading && <LoadingBubble/>}
          </div>

          {/* ── input row ── */}
          <div style={{
            background:"#f0f0f0",
            padding:"8px 10px 10px",
            display:"flex", gap:8, alignItems:"flex-end",
            borderTop:"1px solid #ddd"
          }}>
            <button
              aria-label="Emoji"
              style={{
                width:40, height:40, borderRadius:"50%", border:"none",
                background:"transparent", fontSize:22, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0, color:"#888", transition:"transform .15s"
              }}
              onMouseEnter={e => e.currentTarget.style.transform="scale(1.15)"}
              onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
            >😊</button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a claim to fact-check…"
              rows={1}
              style={{
                flex:1, borderRadius:24, border:"none",
                padding:"10px 15px", fontSize:13.5, resize:"none",
                background:"#fff", color:"#1a1a1a", lineHeight:1.48,
                fontFamily:"inherit", boxShadow:"0 1px 4px rgba(0,0,0,.09)",
                maxHeight:110, overflowY:"auto"
              }}
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px";
              }}
            />

            <button
              onClick={checkFact}
              disabled={loading || !input.trim()}
              aria-label="Send"
              style={{
                width:44, height:44, borderRadius:"50%", border:"none",
                background: (loading || !input.trim())
                  ? "#c8c8c8"
                  : "linear-gradient(135deg,#25D366,#128C7E)",
                color:"#fff", fontSize:19,
                cursor: (loading || !input.trim()) ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0, transition:"all .2s ease",
                boxShadow: (loading || !input.trim()) ? "none" : "0 3px 12px rgba(37,211,102,.45)",
              }}
              onMouseEnter={e => {
                if (!loading && input.trim()) e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {loading ? "⏳" : "➤"}
            </button>
          </div>

          {/* footer */}
          <div style={{
            background:"#e8f5e9", padding:"5px 16px",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            borderTop:"1px solid #d4edda"
          }}>
            <span style={{ fontSize:10.5, color:"#666" }}>
              🔒 End-to-end encrypted · Powered by Claude
            </span>
            {history.length > 0 && (
              <span style={{
                fontSize:10.5, color:"#075E54", fontWeight:800,
                background:"#c8e6c9", borderRadius:6, padding:"2px 8px"
              }}>
                {history.length} fact{history.length > 1 ? "s" : ""} cached
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
