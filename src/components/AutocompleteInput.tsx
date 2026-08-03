import React, { useState, useEffect, useRef, useId } from 'react';

export interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  id?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  maxSuggestions?: number;
  onSelect?: (selected: string) => void;
  minSearchLength?: number;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  options,
  placeholder = '',
  className = '',
  id,
  type = 'text',
  required = false,
  disabled = false,
  maxSuggestions = 8,
  onSelect,
  minSearchLength = 1,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const inputId = id || generatedId;

  // Filter options based on user input
  const query = value.trim().toLowerCase();
  const filteredOptions = query.length >= minSearchLength
    ? options
        .filter((option) => option.toLowerCase().includes(query))
        .slice(0, maxSuggestions)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Reset highlight index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  const handleSelectOption = (option: string) => {
    onChange(option);
    if (onSelect) {
      onSelect(option);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredOptions.length === 0) {
      if (e.key === 'ArrowDown' && filteredOptions.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          e.preventDefault();
          handleSelectOption(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (query.length >= minSearchLength && filteredOptions.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        className={className}
      />

      {/* Autocomplete Dropdown List */}
      {isOpen && filteredOptions.length > 0 && (
        <ul
          className="absolute z-[100] left-0 right-0 top-full mt-1.5 bg-[#0F172A] border border-white/15 rounded-xl shadow-[0_15px_35px_rgba(0,0,0,0.8)] overflow-y-auto max-h-56 p-1 text-xs select-none space-y-0.5 animate-fadeIn"
          role="listbox"
        >
          {filteredOptions.map((option, idx) => {
            const isHighlighted = idx === highlightedIndex;
            return (
              <li
                key={option}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before select
                  handleSelectOption(option);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                  isHighlighted
                    ? 'bg-[#34F5AA]/20 text-[#34F5AA] font-bold'
                    : 'text-gray-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="truncate">{option}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
