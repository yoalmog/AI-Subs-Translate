import React, { useState } from "react";
import {
  BookOpen,
  Upload,
  Plus,
  Trash2,
  X,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Download,
  Search,
} from "lucide-react";

export type GlossaryDictionary = Record<string, string>;

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  glossary: GlossaryDictionary;
  onUpdateGlossary: (glossary: GlossaryDictionary) => void;
}

export const GlossaryModal: React.FC<GlossaryModalProps> = ({
  isOpen,
  onClose,
  glossary,
  onUpdateGlossary,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  if (!isOpen) return null;

  const entries = Object.entries(glossary);
  const filteredEntries = entries.filter(
    ([term, trans]) =>
      term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(trans || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Add single term
  const handleAddTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim() || !newTranslation.trim()) return;

    const updated = {
      ...glossary,
      [newTerm.trim()]: newTranslation.trim(),
    };

    onUpdateGlossary(updated);
    setNewTerm("");
    setNewTranslation("");
    showNotification(`המונח "${newTerm.trim()}" נוסף בהצלחה למילון!`);
  };

  // Remove term
  const handleRemoveTerm = (termToRemove: string) => {
    const updated = { ...glossary };
    delete updated[termToRemove];
    onUpdateGlossary(updated);
    showNotification(`המונח "${termToRemove}" הוסר מהמילון.`);
  };

  // Handle Uploading JSON File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let newEntries: GlossaryDictionary = {};

        // Case 1: Simple Key-Value Object e.g. { "Term": "תרגום", "AI": "בינה מלאכותית" }
        if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof k === "string" && typeof v === "string") {
              newEntries[k.trim()] = v.trim();
            }
          }
        }
        // Case 2: Array of objects e.g. [ { "original": "Term", "translated": "תרגום" } ]
        else if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && typeof item === "object") {
              const orig = item.original || item.term || item.source || item.key;
              const trans = item.translated || item.translation || item.target || item.value;
              if (typeof orig === "string" && typeof trans === "string") {
                newEntries[orig.trim()] = trans.trim();
              }
            }
          });
        }

        const count = Object.keys(newEntries).length;
        if (count === 0) {
          showNotification("לא נמצאו מונחים תקינים בקובץ ה-JSON.", "error");
          return;
        }

        const merged = { ...glossary, ...newEntries };
        onUpdateGlossary(merged);
        showNotification(`נטענו בהצלחה ${count} מונחים חדשים ממילון ה-JSON!`);
      } catch (err) {
        console.error("Glossary JSON parse error:", err);
        showNotification("שגיאה בפענוח קובץ ה-JSON. ודא שהקובץ בפורמט JSON תקין.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Export Glossary as JSON
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(glossary, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitle_glossary.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  };

  // Clear all
  const handleClearAll = () => {
    if (confirm("האם אתה בטוח שברצונך למחוק את כל המונחים במילון?")) {
      onUpdateGlossary({});
      showNotification("מילון המונחים רוקן.");
    }
  };

  return (
    <div
      id="glossary-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto"
    >
      <div className="bg-[#141414] border border-[#262626] rounded-xl max-w-lg w-full p-4 sm:p-5 shadow-2xl relative flex flex-col gap-4 my-auto text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-rubik flex items-center gap-2">
                <span>מילון מונחים (Glossary)</span>
                {entries.length > 0 && (
                  <span className="bg-purple-950 text-purple-300 text-[10px] px-2 py-0.5 rounded-full border border-purple-500/40 font-mono font-bold">
                    {entries.length} מונחים
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400">
                הגדר תרגומים קבועים למונחים ספציפיים שה-AI יאכוף בתרגום
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-[#222222] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload JSON Button & Quick Actions */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="glossary-json-file-input"
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-md transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>העלה קובץ JSON</span>
            </label>
            <input
              id="glossary-json-file-input"
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileUpload}
            />

            {entries.length > 0 && (
              <button
                onClick={handleExportJson}
                className="px-2.5 py-1.5 bg-[#222222] hover:bg-[#2c2c2c] text-gray-300 text-xs font-semibold rounded-md border border-[#383838] transition flex items-center gap-1 cursor-pointer"
                title="הורד את מילון המונחים הנוכחי כקובץ JSON"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">הורד JSON</span>
              </button>
            )}
          </div>

          {entries.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-rose-400 hover:text-rose-300 transition cursor-pointer font-medium"
            >
              רוקן מילון
            </button>
          )}
        </div>

        {/* Toast notification */}
        {notification && (
          <div
            className={`p-2.5 rounded-lg text-xs flex items-center gap-2 animate-in fade-in ${
              notification.type === "success"
                ? "bg-green-950/70 border border-green-500/40 text-green-300"
                : "bg-rose-950/70 border border-rose-500/40 text-rose-300"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
        )}

        {/* Form: Add Single Term */}
        <form onSubmit={handleAddTerm} className="bg-[#0f0f0f] border border-[#242424] rounded-lg p-2.5 space-y-2">
          <label className="text-[11px] font-bold text-gray-300 block">הוסף מונח חדש ידנית:</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="מונח מקורי (למשל: AI)"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              className="flex-1 bg-[#181818] border border-[#333333] rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <span className="text-gray-500 text-xs">➔</span>
            <input
              type="text"
              placeholder="תרגום מבוקש (למשל: בינה מלאכותית)"
              value={newTranslation}
              onChange={(e) => setNewTranslation(e.target.value)}
              className="flex-1 bg-[#181818] border border-[#333333] rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!newTerm.trim() || !newTranslation.trim()}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded transition flex items-center gap-1 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>הוסף</span>
            </button>
          </div>
        </form>

        {/* Search filter if entries exist */}
        {entries.length > 5 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="חפש במילון..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#161616] border border-[#2b2b2b] rounded pr-8 pl-3 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        )}

        {/* Glossary Terms Table / List */}
        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-xs bg-[#0d0d0d] rounded-lg border border-[#202020]">
              <FileJson className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-400" />
              <p>אין מונחים במילון כעת.</p>
              <p className="text-[11px] text-gray-600 mt-1">
                העלה קובץ JSON פשוט כמו {"{ \"Term\": \"תרגום\" }"} או הוסף מונחים למעלה.
              </p>
            </div>
          ) : (
            filteredEntries.map(([term, trans]) => (
              <div
                key={term}
                className="bg-[#181818] border border-[#282828] hover:border-purple-500/40 rounded-lg px-3 py-2 flex items-center justify-between text-xs transition"
              >
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                  <span className="font-mono text-purple-300 font-bold truncate max-w-[140px] bg-[#0d0d0d] px-2 py-0.5 rounded border border-[#2a2a2a]">
                    {term}
                  </span>
                  <span className="text-gray-500">➔</span>
                  <span className="text-gray-200 font-medium truncate max-w-[160px]">
                    {trans}
                  </span>
                </div>

                <button
                  onClick={() => handleRemoveTerm(term)}
                  className="text-gray-500 hover:text-rose-400 p-1 transition cursor-pointer"
                  title="מחק מונח זה"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#222222] text-xs text-gray-500">
          <span>
            {entries.length > 0
              ? `ה-AI יתרגם אוטומטית לפי מונחים אלו`
              : "תרגום AI חופשי ללא הגבלת מונחים"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1c1c1c] hover:bg-[#282828] text-gray-300 rounded-md border border-[#333333] transition cursor-pointer"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
