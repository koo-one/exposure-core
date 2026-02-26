"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  label: string;
  value: string;
}

interface FilterPillProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}

export function FilterPill({
  label,
  value,
  options,
  onChange,
  icon,
}: FilterPillProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 bg-[#0A0A0A]/[0.03] border border-black/5 rounded-full transition-all hover:bg-black/5",
          isOpen && "border-black/20 bg-black/5",
        )}
      >
        <span className="text-[11px] font-medium text-black/40 whitespace-nowrap">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {icon && <div className="shrink-0">{icon}</div>}
          <span className="text-[11px] font-bold text-black uppercase tracking-wider">
            {selectedOption?.label || value}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-black/20 transition-transform duration-200",
            isOpen && "rotate-180 text-black/40",
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 max-h-80 overflow-y-auto bg-white border border-black/10 rounded-xl shadow-2xl shadow-black/10 z-50 py-2 custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-black/[0.03] transition-colors"
            >
              <span
                className={cn(
                  "text-[11px] uppercase tracking-wider font-bold",
                  value === option.value ? "text-black" : "text-black/50",
                )}
              >
                {option.label}
              </span>
              {value === option.value && (
                <Check className="w-3 h-3 text-[#00FF85]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
