"use client";

import { useEffect, useRef, useState } from "react";
import Avatar3D from "./components/Avatar3D";

// --- CONSTANTS & HELPERS ---
const READ_TEXT = "I would like to order a cup of chai and a sandwich, please.";

const SCENARIOS: Record<string, { label: string; prompt: string }> = {
  cafe: { label: "Ordering at a Café", prompt: "Imagine you are at a café ordering your favorite drink." },
  intro: { label: "Self Introduction", prompt: "Imagine you just met someone new. Introduce yourself." },
  phone: { label: "Phone Call", prompt: "Imagine you are calling a friend to invite them out." },
};

type LanguageCode = "en" | "hi" | "te" | "kn";
const LANGUAGES: Record<LanguageCode, { label: string; sttCode: string; ttsCode: string }> = {
  en: { label: "English", sttCode: "en-US", ttsCode: "en-IN" },
  hi: { label: "Hindi", sttCode: "hi-IN", ttsCode: "hi-IN" },
  te: { label: "Telugu", sttCode: "te-IN", ttsCode: "te-IN" },
  kn: { label: "Kannada", sttCode: "kn-IN", ttsCode: "kn-IN" },
};

interface Session {
  id: number; userId: string; mode: string; transcript: string; score: number; confidenceScore?: number; fluentSentence: string; tips: string; coachTone: string; createdAt: string; duration?: number;
}
interface UserProfile {
  username: string; xp: number; level: number; streak: number; badges: string[]; stats: { totalSessions: number; totalSeconds: number; dailyMinutes: number; };
}

// --- STYLES ---
const glassCard = {
  background: "rgba(30, 30, 35, 0.6)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "24px",
  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
};

const gradientText = {
  background: "linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

// --- COMPONENTS ---
const ActivityRing = ({ progress, color, icon, label }: { progress: number; color: string; icon: string; label: string }) => {
  const radius = 30;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(progress, 100) / 100) * circumference;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      <div style={{ position: "relative", width: radius * 2, height: radius * 2 }}>
        <svg height={radius * 2} width={radius * 2} style={{ transform: "rotate(-90deg)" }}>
          <circle stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="transparent" r={normalizedRadius} cx={radius} cy={radius} />
          <circle stroke={color} strokeWidth={stroke} strokeDasharray={circumference + " " + circumference} style={{ strokeDashoffset, transition: "stroke-dashoffset 1s ease-in-out" }} strokeLinecap="round" fill="transparent" r={normalizedRadius} cx={radius} cy={radius} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>{icon}</div>
      </div>
      <div style={{ textAlign: "center" }}><span style={{ fontSize: "0.75rem", color: "#9ca3af", fontWeight: 500 }}>{label}</span></div>
    </div>
  );
};

const Badge = ({ name, earned }: { name: string; earned: boolean }) => {
  const icons: Record<string, string> = { "First Step": "🚀", "Consistency Champion": "🔥", "Smooth Speaker": "💧", "Calm Voice": "🧘", "XP Hunter": "⚡" };
  return (
    <div style={{ ...glassCard, opacity: earned ? 1 : 0.4, padding: "10px", display: "flex", flexDirection: "column", alignItems: "center", width: "70px", height: "70px", justifyContent: "center", border: earned ? "1px solid rgba(34, 197, 94, 0.3)" : glassCard.border }}>
      <span style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{icons[name] || "🏅"}</span>
      <span style={{ fontSize: "0.55rem", textAlign: "center", lineHeight: 1.1, color: "#d1d5db" }}>{name}</span>
    </div>
  );
};

const backendBase = "http://localhost:4000";

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Auth
  const [newUserName, setNewUserName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loginTarget, setLoginTarget] = useState<string | null>(null);
  const [loginPassword, setLoginPassword] = useState("");

  const [mode, setMode] = useState<"free_talk" | "read_aloud" | "scenario">("free_talk");
  const [scenarioKey, setScenarioKey] = useState<keyof typeof SCENARIOS>("cafe");
  const [language, setLanguage] = useState<LanguageCode>("en");
  
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [serverSession, setServerSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [localScore, setLocalScore] = useState<number | null>(null);
  
  // UI State
  const [metronomeActive, setMetronomeActive] = useState(false);
  const [bpm, setBpm] = useState(60);
  const [beat, setBeat] = useState(false);
  const [avatarState, setAvatarState] = useState<any>("idle");
  const [avatarMessage, setAvatarMessage] = useState("Ready when you are!");

  // Challenge State
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const [challengeFailed, setChallengeFailed] = useState(false);
  const [failReason, setFailReason] = useState("");
  const [hasStartedSpeaking, setHasStartedSpeaking] = useState(false);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const metronomeRef = useRef<any>(null);
  const challengeTickerRef = useRef<any>(null);
  const transcriptRef = useRef(""); 
  const lastSpeechTimeRef = useRef<number>(0);

  useEffect(() => { fetch(`${backendBase}/users`).then(r => r.json()).then(d => setAllUsers(d.users || [])); }, []);
  useEffect(() => { if (currentUser) fetch(`${backendBase}/sessions/${currentUser}`).then(r => r.json()).then(d => setSessions(d.sessions || [])); }, [currentUser]);

  useEffect(() => {
    if (metronomeActive) {
      const ms = 60000 / bpm;
      metronomeRef.current = setInterval(() => setBeat(p => !p), ms);
    } else { clearInterval(metronomeRef.current); setBeat(false); }
    return () => clearInterval(metronomeRef.current);
  }, [metronomeActive, bpm]);

  useEffect(() => {
    if (isChallengeMode && !challengeFailed) { setAvatarState("listening"); setAvatarMessage("Don't stop! Keep going!"); return; }
    if (listening) { setAvatarState("listening"); setAvatarMessage("Listening..."); }
    else if (loadingAI) { setAvatarState("thinking"); setAvatarMessage("Analyzing..."); }
    else if (serverSession) {
      if (serverSession.score >= 80) { setAvatarState("happy"); setAvatarMessage("Great flow!"); }
      else { setAvatarState("neutral"); setAvatarMessage("Good effort!"); }
    } else { setAvatarState("idle"); setAvatarMessage("Hi there!"); }
  }, [listening, loadingAI, serverSession, isChallengeMode, challengeFailed]);

  // Auth Handlers
  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newPassword.trim()) { alert("Enter username and password"); return; }
    try {
        const res = await fetch(`${backendBase}/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: newUserName, password: newPassword }) });
        if (res.ok) { await fetch(`${backendBase}/users`).then(r => r.json()).then(d => setAllUsers(d.users || [])); setCurrentUser(newUserName); setNewUserName(""); setNewPassword(""); } 
        else { const data = await res.json(); alert(data.error); }
    } catch (e) { console.error(e); }
  };

  const handleLogin = async () => {
    if (!loginTarget || !loginPassword) return;
    try {
        const res = await fetch(`${backendBase}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: loginTarget, password: loginPassword }) });
        if (res.ok) { setCurrentUser(loginTarget); setLoginTarget(null); setLoginPassword(""); } 
        else { alert("Wrong password!"); }
    } catch (e) { console.error(e); }
  };

  // Challenge Logic
  const sendChallengeHeartbeat = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${backendBase}/challenge/tick`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: currentUser, transcript: transcriptRef.current }) });
      const data = await res.json();
      if (data.status === "fail") failChallenge(data.reason);
    } catch (e) { console.error(e); }
  };

  const startChallenge = async () => {
    if (!currentUser) return;
    setIsChallengeMode(true); setChallengeFailed(false); setTranscript(""); transcriptRef.current = "";
    await fetch(`${backendBase}/challenge/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: currentUser }) });
    startRecording();
    challengeTickerRef.current = setInterval(sendChallengeHeartbeat, 500);
  };

  const exitChallenge = () => { setIsChallengeMode(false); setChallengeFailed(false); stopRecording(); clearInterval(challengeTickerRef.current); };
  const failChallenge = (reason: string) => { clearInterval(challengeTickerRef.current); stopRecording(); setChallengeFailed(true); setFailReason(reason); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); };

  // Speech Logic
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionImpl = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) return;
    const rec = new SpeechRecognitionImpl();
    rec.continuous = true; rec.interimResults = true; rec.lang = LANGUAGES[language].sttCode;
    rec.onresult = (event: any) => {
      let full = ""; for (let i = 0; i < event.results.length; i++) full += event.results[i][0].transcript + " ";
      const text = full.trim();
      setTranscript(text);
      transcriptRef.current = text; 
      const words = text.split(/\s+/).filter(Boolean);
      let repeats = 0; for(let i=1; i<words.length; i++) if(words[i].toLowerCase() === words[i-1].toLowerCase()) repeats++;
      setLocalScore(Math.max(30, 100 - (repeats*10)));
    };
    recognitionRef.current = rec;
  }, [language]);

  const startRecording = async () => {
    setTranscript(""); setServerSession(null); setAudioBlob(null); setLocalScore(null);
    if (recognitionRef.current) recognitionRef.current.start();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => { setAudioBlob(new Blob(chunksRef.current, { type: "audio/mp3" })); stream.getTracks().forEach(track => track.stop()); };
      mediaRecorder.start(); mediaRecorderRef.current = mediaRecorder;
      setListening(true); setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (err) { alert("Mic Error"); }
  };

  const stopRecording = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    clearInterval(timerRef.current); setListening(false);
  };

  const toggleListening = () => { listening ? stopRecording() : startRecording(); };

  const handleAnalyze = async () => {
    if (!transcript.trim() || !currentUser) return;
    setLoadingAI(true);
    try {
      const res = await fetch(`${backendBase}/coach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript, mode, userId: currentUser, duration: recordingDuration, language }) });
      const data = await res.json();
      setServerSession(data.session); setUserProfile(data.userProfile); setSessions(p => [data.session, ...p]);
    } catch (e) { console.error(e); }
    setLoadingAI(false);
  };

  const clearTranscript = () => { setTranscript(""); setLocalScore(null); if (listening) stopRecording(); };
  const speakText = (text: string) => { if (!text) return; const u = new SpeechSynthesisUtterance(text); u.rate = 0.9; u.lang = LANGUAGES[language].ttsCode; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); };
  const allBadges = ["First Step", "Consistency Champion", "Smooth Speaker", "Calm Voice", "XP Hunter"];

  // --- LOGIN SCREEN ---
  if (!currentUser) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom right, #000000, #111827)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ ...glassCard, width: "100%", maxWidth: "420px", padding: "3rem", textAlign: "center", position:"relative" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "0.5rem", ...gradientText }}>Stutter Coach</h1>
        <p style={{ color: "#9ca3af", marginBottom: "2.5rem" }}>Your personal AI fluency companion.</p>
        {loadingUsers ? <p>Loading...</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {allUsers.map(u => (
              <button key={u} onClick={() => setLoginTarget(u)} style={{ ...glassCard, borderRadius:"16px", padding: "0.8rem 1.2rem", color: "white", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "1rem", transition:"all 0.2s" }} onMouseOver={e=>e.currentTarget.style.transform="scale(1.02)"} onMouseOut={e=>e.currentTarget.style.transform="scale(1)"}>
                 <div style={{ transform: "scale(0.5)", width:"32px", height:"32px", display:"flex", alignItems:"center", justifyContent:"center" }}><Avatar3D state="idle" username={u} /></div>
                 <span style={{ fontSize: "1.1rem", fontWeight:500 }}>{u}</span>
              </button>
            ))}
            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection:"column", gap: "0.8rem" }}>
              <input type="text" placeholder="New Profile Name" value={newUserName} onChange={e => setNewUserName(e.target.value)} style={{ padding: "0.8rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "white", outline:"none" }} />
              <input type="password" placeholder="Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: "0.8rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "white", outline:"none" }} />
              <button onClick={handleCreateUser} style={{ padding: "0.8rem 1.5rem", background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight:600 }}>Create Profile</button>
            </div>
          </div>
        )}
        {loginTarget && (
            <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(10px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderRadius:"24px", zIndex:50 }}>
                <h3 style={{marginBottom:"1rem", fontSize:"1.2rem"}}>Enter Password for {loginTarget}</h3>
                <input type="password" autoFocus placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} style={{ padding: "0.8rem", width:"80%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "white", outline:"none", marginBottom:"1rem" }} />
                <div style={{display:"flex", gap:"1rem"}}>
                    <button onClick={handleLogin} style={{ padding: "0.6rem 1.5rem", background: "#22c55e", color: "white", border: "none", borderRadius: "99px", cursor: "pointer", fontWeight:600 }}>Enter</button>
                    <button onClick={() => { setLoginTarget(null); setLoginPassword(""); }} style={{ padding: "0.6rem 1.5rem", background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: "99px", cursor: "pointer" }}>Cancel</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );

  // --- CHALLENGE OVERLAY ---
  if (isChallengeMode) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: challengeFailed ? "#7f1d1d" : "black", transition: "background 0.3s ease", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {challengeFailed ? (
          <div style={{ textAlign: "center", animation: "shake 0.5s" }}>
            <h1 style={{ fontSize: "5rem", fontWeight: 900, color: "white", marginBottom: "1rem", letterSpacing:"-2px" }}>FAILED</h1>
            <p style={{ fontSize: "1.5rem", color: "#fca5a5", marginBottom: "3rem", background:"rgba(0,0,0,0.3)", padding:"10px 20px", borderRadius:"99px" }}>{failReason}</p>
            <div style={{display:"flex", gap:"1rem", justifyContent:"center"}}>
               <button onClick={startChallenge} style={{ padding: "1rem 3rem", fontSize: "1.2rem", fontWeight: "bold", background: "white", color: "#7f1d1d", borderRadius: "99px", border: "none", cursor: "pointer", boxShadow:"0 10px 30px rgba(0,0,0,0.3)" }}>Try Again</button>
               <button onClick={exitChallenge} style={{ padding: "1rem 3rem", fontSize: "1.2rem", fontWeight: "bold", background: "transparent", border: "2px solid rgba(255,255,255,0.3)", color: "white", borderRadius: "99px", cursor: "pointer" }}>Exit</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", width:"100%", maxWidth:"800px" }}>
             <h2 style={{ color: "#d1d5db", marginBottom: "4rem", fontSize:"1.5rem", letterSpacing:"1px", textTransform:"uppercase" }}>Don't stop talking.</h2>
             <div style={{ width: "180px", height: "180px", borderRadius: "50%", background: transcript ? "#22c55e" : "#ef4444", boxShadow: transcript ? "0 0 60px #22c55e" : "0 0 60px #ef4444", animation: "pulse 1.5s infinite", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem", margin: "0 auto", transition: "all 0.3s ease" }}>{transcript ? "🗣️" : "🎙"}</div>
             <div style={{ marginTop:"4rem", minHeight:"100px" }}>{!transcript ? (<p style={{fontSize:"1.5rem", color:"white", opacity:0.7, animation:"fadeIn 1s"}}>Start speaking to begin the timer...</p>) : (<p style={{ fontSize: "1.5rem", color: "white", lineHeight:1.6, textShadow:"0 2px 10px rgba(0,0,0,0.5)" }}>"{transcript}"</p>)}</div>
             <button onClick={exitChallenge} style={{ marginTop: "4rem", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#aaa", padding: "0.8rem 2rem", borderRadius: "99px", cursor: "pointer" }}>Give Up</button>
          </div>
        )}
        <style jsx>{`@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } } @keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }`}</style>
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, #1e1b4b, #000000)", color: "white", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "2.5fr 1.5fr", gap: "2rem" }}>
        
        {/* LEFT COLUMN */}
        <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
             <div><h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Hello, {currentUser}</h1><p style={{ color: "rgba(255,255,255,0.6)" }}>Let's find your flow today.</p></div>
             <button onClick={() => setCurrentUser(null)} style={{ ...glassCard, borderRadius:"99px", padding: "0.5rem 1rem", fontSize: "0.8rem", cursor: "pointer" }}>Switch Profile</button>
          </header>

          <div style={{ ...glassCard, padding: "1.5rem", display: "flex", alignItems: "center", gap: "2rem", position: "relative", overflow: "hidden" }}>
             <div style={{ position: "absolute", top:0, left:0, width:"100%", height:"100%", background:"linear-gradient(90deg, rgba(59,130,246,0.1), transparent)", pointerEvents:"none" }} />
             <div style={{ transform: "scale(1.2) translateY(10px)" }}><Avatar3D state={avatarState} score={serverSession?.score} username={currentUser || "default"} /></div>
             <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>{avatarMessage}</h2>
                <div style={{ display: "flex", gap: "0.5rem" }}><span style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "99px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)" }}>AI Coach Active</span>{listening && <span style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "99px", background: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5" }}>Mic Live</span>}</div>
             </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
             <div style={{ ...glassCard, padding: "1.5rem", display:"flex", flexDirection:"column", justifyContent:"center" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"1rem" }}><span style={{fontWeight:600}}>Metronome</span><div style={{ width:"12px", height:"12px", borderRadius:"50%", background: beat ? "#10b981" : "#374151", boxShadow: beat ? "0 0 10px #10b981" : "none", transition:"all 0.1s" }} /></div>
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}><input type="range" min="40" max="120" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} disabled={!metronomeActive} style={{ flex:1, accentColor:"#8b5cf6" }} /><span style={{fontSize:"0.8rem", opacity:0.7, width:"30px"}}>{bpm}</span><button onClick={()=>setMetronomeActive(!metronomeActive)} style={{ padding:"6px 12px", borderRadius:"8px", border:"none", background: metronomeActive ? "#ef4444" : "#8b5cf6", color:"white", fontSize:"0.8rem", cursor:"pointer" }}>{metronomeActive ? "Stop" : "Start"}</button></div>
             </div>
             <div style={{ ...glassCard, padding: "1.5rem", display:"flex", flexDirection:"column", justifyContent:"center", gap:"10px" }}>
                <span style={{fontWeight:600}}>Practice Mode</span>
                <div style={{ display:"flex", gap:"8px" }}>
                   {["free_talk", "read_aloud", "scenario"].map((m) => (
                      <button key={m} onClick={()=>setMode(m as any)} style={{ flex:1, padding:"6px", borderRadius:"8px", border:"none", background: mode === m ? "white" : "rgba(255,255,255,0.1)", color: mode === m ? "black" : "white", fontSize:"0.75rem", cursor:"pointer", textTransform:"capitalize" }}>{m.replace("_", " ")}</button>
                   ))}
                </div>
             </div>
          </div>

          <div style={{ ...glassCard, padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", border: "1px solid rgba(255,255,255,0.15)" }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                   <select value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)} style={{ background: "rgba(0,0,0,0.3)", color: "white", padding: "0.4rem 1rem", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.2)" }}>{Object.entries(LANGUAGES).map(([code, info]) => <option key={code} value={code}>{info.label}</option>)}</select>
                </div>
                <div style={{display:"flex", alignItems:"center", gap:"1rem"}}>
                    {listening && <span style={{fontSize:"0.9rem", fontFamily:"monospace", color:"#f87171"}}>00:{recordingDuration < 10 ? `0${recordingDuration}` : recordingDuration}</span>}
                    <button onClick={startChallenge} style={{ background: "#dc2626", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "99px", fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer", display:"flex", alignItems:"center", gap:"5px" }}>🔥 Live Challenge</button>
                </div>
             </div>

             {mode === "read_aloud" && <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" }}><p style={{fontSize:"1.1rem", fontStyle:"italic", opacity:0.9, textAlign:"center"}}>"{READ_TEXT}"</p></div>}
             {mode === "scenario" && <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" }}><div style={{ display:"flex", justifyContent:"center", gap:"0.5rem", marginBottom:"1rem" }}>{Object.keys(SCENARIOS).map(k => (<button key={k} onClick={() => setScenarioKey(k as any)} style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem", borderRadius: "99px", background: scenarioKey === k ? "#3b82f6" : "rgba(255,255,255,0.1)", color: "white", border: "none", cursor: "pointer" }}>{SCENARIOS[k].label}</button>))}</div><p style={{fontSize:"1.1rem", fontStyle:"italic", opacity:0.9, textAlign:"center"}}>"{SCENARIOS[scenarioKey].prompt}"</p></div>}

             <div style={{ height: "100px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed rgba(255,255,255,0.1)", borderRadius: "16px", background: "rgba(0,0,0,0.2)" }}>
                {transcript ? <p style={{fontSize:"1.1rem", textAlign:"center", padding:"1rem"}}>{transcript}</p> : <p style={{color:"rgba(255,255,255,0.3)"}}>{listening ? "Listening..." : "Tap the mic to start speaking"}</p>}
             </div>

             <div style={{ display: "flex", justifyContent: "center" }}>
                <button onClick={toggleListening} style={{ width: "70px", height: "70px", borderRadius: "50%", background: listening ? "#ef4444" : "linear-gradient(135deg, #3b82f6, #8b5cf6)", border: "none", boxShadow: listening ? "0 0 20px rgba(239,68,68,0.5)" : "0 0 20px rgba(139, 92, 246, 0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", transition: "all 0.3s" }}>{listening ? "⏹" : "🎤"}</button>
             </div>

             <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginTop: "0.5rem" }}>
                 <button onClick={handleAnalyze} disabled={loadingAI || !transcript.trim()} style={{ width:"100%", padding: "1rem", borderRadius: "16px", background: loadingAI || !transcript.trim() ? "rgba(255,255,255,0.1)" : "white", color: loadingAI || !transcript.trim() ? "rgba(255,255,255,0.3)" : "black", border: "none", fontWeight: 700, cursor: loadingAI || !transcript.trim() ? "not-allowed" : "pointer" }}>{loadingAI ? "Analyzing Speech..." : "Get Feedback"}</button>
                 <button onClick={clearTranscript} style={{ width:"100%", padding: "0.8rem", borderRadius: "16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", cursor: "pointer" }}>Clear Text</button>
             </div>
          </div>

          {serverSession && (
             <div style={{ ...glassCard, padding: "1.5rem", animation: "fadeIn 0.5s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                   <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Analysis Results</h2>
                   <div style={{ display: "flex", gap: "1rem" }}>
                      <div style={{ textAlign: "right" }}><span style={{fontSize:"0.7rem", display:"block", opacity:0.6}}>FLUENCY</span><span style={{fontSize:"1.2rem", fontWeight:700, color: serverSession.score >= 80 ? "#4ade80" : "#f87171"}}>{serverSession.score}%</span></div>
                      <div style={{ textAlign: "right" }}><span style={{fontSize:"0.7rem", display:"block", opacity:0.6}}>CONFIDENCE</span><span style={{fontSize:"1.2rem", fontWeight:700, color: "#60a5fa"}}>{serverSession.confidenceScore}%</span></div>
                   </div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "12px", marginBottom: "1rem" }}>
                   <div style={{display:"flex", justifyContent:"space-between", marginBottom:"5px"}}><span style={{fontSize:"0.75rem", opacity:0.5, letterSpacing:"1px"}}>CORRECTION</span><button onClick={()=>speakText(serverSession.fluentSentence)} style={{background:"none", border:"none", cursor:"pointer", fontSize:"1rem"}}>🔊</button></div>
                   <p style={{fontSize:"1.1rem", lineHeight:1.5}}>{serverSession.fluentSentence}</p>
                </div>
                {serverSession.tips && (<div style={{ padding: "1rem", borderRadius: "12px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}><span style={{fontSize:"0.75rem", color:"#34d399", fontWeight:700, display:"block", marginBottom:"4px"}}>COACH TIP</span><p style={{fontSize:"0.9rem", color:"#a7f3d0"}}>{serverSession.tips}</p></div>)}
             </div>
          )}
        </section>

        {/* RIGHT COLUMN */}
        <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
           <div style={{ ...glassCard, padding: "2rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.5rem" }}>Daily Activity</h2>
              <div style={{ display: "flex", justifyContent: "space-around" }}><ActivityRing progress={(userProfile?.stats.dailyMinutes || 0) / 5 * 100} color="#f472b6" icon="🎙" label="Minutes" /><ActivityRing progress={((userProfile?.xp || 0) % 100)} color="#60a5fa" icon="⚡" label="XP Goal" /><ActivityRing progress={100} color="#34d399" icon="🔥" label="Streak" /></div>
              <div style={{ marginTop: "2rem", display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "16px" }}><div style={{textAlign:"center"}}><span style={{display:"block", fontSize:"1.2rem", fontWeight:700}}>{userProfile?.level || 1}</span><span style={{fontSize:"0.7rem", opacity:0.6}}>LEVEL</span></div><div style={{textAlign:"center"}}><span style={{display:"block", fontSize:"1.2rem", fontWeight:700}}>{userProfile?.xp || 0}</span><span style={{fontSize:"0.7rem", opacity:0.6}}>TOTAL XP</span></div><div style={{textAlign:"center"}}><span style={{display:"block", fontSize:"1.2rem", fontWeight:700}}>{userProfile?.streak || 0}</span><span style={{fontSize:"0.7rem", opacity:0.6}}>DAYS</span></div></div>
           </div>
           <div style={{ ...glassCard, padding: "1.5rem" }}><h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Achievements</h2><div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem" }}>{allBadges.map(b => <Badge key={b} name={b} earned={userProfile?.badges.includes(b) || false} />)}</div></div>
           <div style={{ ...glassCard, padding: "1.5rem", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}><h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>History</h2><div style={{ overflowY: "auto", paddingRight: "5px", display: "flex", flexDirection: "column", gap: "10px" }}>{sessions.length === 0 ? <p style={{opacity:0.5, fontSize:"0.9rem"}}>No sessions recorded yet.</p> : sessions.map(s => (<div key={s.id} style={{ padding: "1rem", borderRadius: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ overflow: "hidden" }}><p style={{ fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>{s.transcript}</p><span style={{ fontSize: "0.7rem", opacity: 0.5 }}>{new Date(s.createdAt).toLocaleDateString()} • {s.mode}</span></div><div style={{ textAlign: "right" }}><span style={{ display: "block", fontWeight: 700, color: s.score >= 80 ? "#4ade80" : "#f87171" }}>{s.score}</span><span style={{ fontSize: "0.6rem", opacity: 0.6 }}>SCORE</span></div></div>))}</div></div>
        </section>
      </div>
      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }`}</style>
    </main>
  );
}