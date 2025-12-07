"use client";

import { useEffect, useState, useMemo } from "react";

type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "neutral";

interface AvatarProps {
  state: AvatarState;
  score?: number;
  username?: string; // NEW: Used to generate unique color
}

export default function Avatar3D({ state, score, username = "default" }: AvatarProps) {
  const [blink, setBlink] = useState(false);

  // Generate unique Hue (0-360) based on username
  const hue = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 360);
  }, [username]);

  // Blinking Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 200);
    }, 4000); // Blink every 4s
    return () => clearInterval(timer);
  }, []);

  // Mouth Shape Logic
  const getMouthPath = () => {
    if (state === "speaking") return "M 30 65 Q 50 85 70 65 Q 50 95 30 65"; // Open talking
    if (state === "happy" || (score && score >= 80)) return "M 30 65 Q 50 85 70 65"; // Big smile
    if (state === "listening") return "M 35 70 Q 50 75 65 70"; // Concentrating small mouth
    return "M 30 70 Q 50 80 70 70"; // Neutral smile
  };

  // Animation Classes
  const getContainerClass = () => {
    if (state === "listening") return "translate-x-2"; // Lean forward
    if (state === "thinking") return "animate-pulse";
    if (state === "happy") return "animate-bounce"; 
    return "";
  };

  return (
    <div className={`relative w-32 h-32 transition-all duration-500 ${getContainerClass()}`}>
      {/* 3D HEAD SHAPE (Dynamic HSL Gradient) */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          // Dynamic color based on user hue
          background: `radial-gradient(circle at 30% 30%, hsl(${hue}, 90%, 85%), hsl(${hue}, 70%, 50%), hsl(${hue}, 90%, 20%))`,
          boxShadow: "0 10px 25px rgba(0,0,0,0.5), inset 0 5px 10px rgba(255,255,255,0.4)",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* FACE CONTAINER */}
        <div style={{ position: "absolute", top: "25%", left: "15%", width: "70%", height: "60%" }}>
          
          {/* EYES */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            {/* Left Eye */}
            <div style={{ width: "24px", height: blink ? "2px" : "28px", background: "white", borderRadius: "50%", position: "relative", transition: "height 0.1s" }}>
              <div style={{ position: "absolute", right: "5px", top: "8px", width: "8px", height: "8px", background: "#0f172a", borderRadius: "50%" }} />
            </div>
            {/* Right Eye */}
            <div style={{ width: "24px", height: blink ? "2px" : "28px", background: "white", borderRadius: "50%", position: "relative", transition: "height 0.1s" }}>
              <div style={{ position: "absolute", right: "5px", top: "8px", width: "8px", height: "8px", background: "#0f172a", borderRadius: "50%" }} />
            </div>
          </div>

          {/* CHEEKS (Blush) */}
          {state === "happy" && (
            <>
              <div style={{ position: "absolute", top: "45%", left: "-5px", width: "15px", height: "10px", background: "rgba(255,100,100,0.3)", borderRadius: "50%", filter: "blur(2px)" }} />
              <div style={{ position: "absolute", top: "45%", right: "-5px", width: "15px", height: "10px", background: "rgba(255,100,100,0.3)", borderRadius: "50%", filter: "blur(2px)" }} />
            </>
          )}

          {/* MOUTH (SVG) */}
          <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: "absolute", top: "-10px", left: 0 }}>
             <path
               d={getMouthPath()}
               fill={state === "speaking" ? "#333" : "transparent"}
               stroke="#0f172a"
               strokeWidth="4"
               strokeLinecap="round"
               style={{ transition: "d 0.3s ease" }}
             />
          </svg>
        </div>
      </div>

      {/* SHADOW */}
      <div style={{
          position: "absolute", bottom: "-15px", left: "20%", width: "60%", height: "15px",
          background: "black", borderRadius: "50%", opacity: 0.2, filter: "blur(5px)", zIndex: 0
      }} />
      
      {/* STATUS BADGE */}
      <div style={{
          position:"absolute", top:0, right: -10, 
          background: state === "listening" ? "#ef4444" : "#22c55e",
          color: "white", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "99px",
          border: "2px solid #0f172a", fontWeight: "bold"
      }}>
          {state === "listening" ? "EARS OPEN" : "COACH"}
      </div>
    </div>
  );
}