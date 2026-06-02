"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const MODELS = [
  { id: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  fileName?: string;
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative my-2 rounded-lg overflow-hidden bg-black/40 border border-white/10">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10">
        <span className="text-[11px] text-white/40 font-mono">{lang || "code"}</span>
        <button onClick={copy} className="text-[11px] text-white/40 hover:text-white/70 transition-colors">
          {copied ? "Kopyalandı!" : "Kopyala"}
        </button>
      </div>
      <pre className="p-3 text-xs text-white/80 font-mono overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

function renderContent(content: string) {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++} className="whitespace-pre-wrap">
          {content.slice(lastIndex, match.index)}
        </span>
      );
    }
    parts.push(<CodeBlock key={key++} lang={match[1]} code={match[2].trim()} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(
      <span key={key++} className="whitespace-pre-wrap">
        {content.slice(lastIndex)}
      </span>
    );
  }
  return parts;
}

export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    e.target.value = "";
  }

  function removeFile() {
    setFile(null);
  }

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text && !file) return;
    if (loading) return;

    const userMsg: Message = {
      role: "user",
      content: text || (file ? `[${file.name}]` : ""),
      fileName: file?.name,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    const sentFile = file;
    setFile(null);
    setLoading(true);

    // Asistan placeholder
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const formData = new FormData();
      // messages as JSON — content only (no fileName)
      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));
      formData.append("messages", JSON.stringify(apiMessages));
      formData.append("model", model);
      if (sentFile) formData.append("file", sentFile);

      const res = await fetch("/api/admin/ai-chat", { method: "POST", body: formData });
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `Hata: ${errData.error ?? "İstek başarısız"}` },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: accumulated },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: `Hata: ${err.message ?? "Bilinmeyen hata"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, file, loading, messages, model]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    if (messages.length === 0) return;
    if (!confirm("Sohbet geçmişini temizlemek istediğinize emin misiniz?")) return;
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-0">
      {/* Üst bar */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-white/8 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-[#F57C28]/50"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#1a1a2e]">
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={clearChat}
          disabled={messages.length === 0}
          className="text-sm text-white/40 hover:text-white/70 disabled:opacity-30 transition-colors"
        >
          Temizle
        </button>
      </div>

      {/* Mesaj alanı */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pr-1">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-white/25 text-sm gap-2">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p>Muhasebe ve vergi konularında soru sorun</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                msg.role === "user"
                  ? "bg-[#F57C28] text-white"
                  : "bg-white/10 text-white/60"
              }`}
            >
              {msg.role === "user" ? "S" : "AI"}
            </div>

            {/* Balon */}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#F57C28]/20 text-white/90 rounded-tr-sm"
                  : "bg-white/7 text-white/85 rounded-tl-sm"
              }`}
            >
              {msg.fileName && (
                <div className="flex items-center gap-1.5 mb-2 text-xs text-white/50 border-b border-white/10 pb-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {msg.fileName}
                </div>
              )}
              {msg.content === "" && msg.role === "assistant" ? (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ) : (
                renderContent(msg.content)
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Giriş alanı */}
      <div className="flex-shrink-0 mt-4">
        {file && (
          <div className="flex items-center gap-2 mb-2 bg-white/5 rounded-lg px-3 py-2 text-xs text-white/60">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="flex-1 truncate">{file.name}</span>
            <button onClick={removeFile} className="text-white/40 hover:text-white/70 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 focus-within:border-[#F57C28]/40 transition-colors">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 pb-0.5"
            title="Dosya ekle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.xlsx,.xls,.txt,.csv,image/*"
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 bg-transparent text-white/90 text-sm resize-none focus:outline-none placeholder:text-white/25 max-h-40 overflow-y-auto"
            placeholder="Mesaj yazın... (Enter gönderin, Shift+Enter yeni satır)"
            style={{ fieldSizing: "content" } as any}
          />
          <button
            onClick={send}
            disabled={loading || (!input.trim() && !file)}
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#F57C28] hover:bg-[#e06b1a] disabled:opacity-30 disabled:bg-white/10 text-white flex items-center justify-center transition-colors pb-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[11px] text-white/20 mt-1.5">
          AI hatalı bilgi verebilir. Önemli konularda uzman görüşü alın.
        </p>
      </div>
    </div>
  );
}
