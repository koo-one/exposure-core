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
  const isDefault = value === "all" || value === "default";
  const displayLabel = isDefault ? label : selectedOption?.label || value;

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
          "flex items-center gap-2 px-3 py-1.5 border rounded-full transition-all duration-200 group",
          isOpen || !isDefault
            ? "bg-black text-white border-black shadow-lg shadow-black/10"
            : "bg-white border-black/10 hover:border-black/30 text-black",
        )}
      >
        <div className="flex items-center gap-1.5">
          {icon && (
            <div
              className={cn(
                "shrink-0 transition-colors",
                isOpen || !isDefault
                  ? "text-white"
                  : "text-black/40 group-hover:text-black",
              )}
            >
              {icon}
            </div>
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
            {displayLabel}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            isOpen || !isDefault
              ? "text-white/60"
              : "text-black/20 group-hover:text-black/40",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 max-h-64 overflow-y-auto bg-white border border-black/10 rounded-xl shadow-2xl shadow-black/10 z-50 py-1.5 custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-black/[0.03] transition-colors group"
            >
              <span
                className={cn(
                  "text-[10px] uppercase tracking-widest font-bold transition-colors",
                  value === option.value
                    ? "text-black"
                    : "text-black/40 group-hover:text-black/70",
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
