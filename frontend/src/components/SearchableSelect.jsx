import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  Children,
  isValidElement,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';

/**
 * Helper to recursively extract options from React children (<option value="...">label</option>)
 */
function extractOptionsFromChildren(children) {
  const result = [];
  const traverse = (nodes) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === 'option') {
        const value = child.props.value !== undefined ? child.props.value : '';
        let label = child.props.children;
        if (Array.isArray(label)) {
          label = label
            .map((item) => (typeof item === 'string' || typeof item === 'number' ? item : ''))
            .join('');
        } else if (typeof label !== 'string' && typeof label !== 'number') {
          label = String(label ?? '');
        } else {
          label = String(label);
        }
        result.push({
          value,
          label,
          disabled: Boolean(child.props.disabled),
        });
      } else if (child.props?.children) {
        traverse(child.props.children);
      }
    });
  };
  traverse(children);
  return result;
}

/**
 * Compare option value with selected value safely across numbers/strings
 */
function isOptionSelected(optValue, val) {
  if (val === undefined || val === null) {
    return optValue === '' || optValue === undefined || optValue === null;
  }
  return String(optValue) === String(val);
}

export default function SearchableSelect({
  id,
  name,
  value,
  onChange,
  options,
  children,
  placeholder,
  searchPlaceholder = 'Ketik untuk mencari...',
  disabled = false,
  required = false,
  className = '',
  wrapperClassName = '',
  size = 'md',
  isClearable,
  noResultsText = 'Tidak ada hasil ditemukan',
  'aria-label': ariaLabel,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownCoords, setDropdownCoords] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    width: 240,
    openUpward: false,
  });

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const popoverRef = useRef(null);

  // Normalize options from either options prop or children
  const normalizedOptions = useMemo(() => {
    if (Array.isArray(options) && options.length > 0) {
      return options.map((opt) => {
        if (typeof opt === 'object' && opt !== null) {
          return {
            value: opt.value !== undefined ? opt.value : '',
            label: opt.label !== undefined ? String(opt.label) : String(opt.value ?? ''),
            sublabel: opt.sublabel,
            disabled: Boolean(opt.disabled),
          };
        }
        return {
          value: opt,
          label: String(opt),
          disabled: false,
        };
      });
    }
    if (children) {
      return extractOptionsFromChildren(children);
    }
    return [];
  }, [options, children]);

  // Current selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => isOptionSelected(opt.value, value));
  }, [normalizedOptions, value]);

  // Determine display label
  const displayLabel = useMemo(() => {
    if (selectedOption) {
      return selectedOption.label;
    }
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
    return placeholder || '-- Pilih --';
  }, [selectedOption, value, placeholder]);

  // Check if current display label looks like a placeholder
  const isDisplayPlaceholder = useMemo(() => {
    if (!selectedOption) return true;
    if (selectedOption.value === '' && selectedOption.label.trim().startsWith('--')) return true;
    return false;
  }, [selectedOption]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const terms = searchQuery.toLowerCase().trim().split(/\s+/);
    return normalizedOptions.filter((opt) => {
      const textToSearch = `${opt.label} ${opt.value ?? ''} ${opt.sublabel ?? ''}`.toLowerCase();
      return terms.every((term) => textToSearch.includes(term));
    });
  }, [normalizedOptions, searchQuery]);

  // Handle position detection relative to viewport via bounding rect
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const popoverHeight = 280;
    const openUp = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    const minWidth = Math.max(rect.width, 240);
    let left = rect.left;
    if (left + minWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - minWidth - 12);
    }
    if (left < 12) left = 12;

    setDropdownCoords({
      top: rect.bottom + 4,
      bottom: window.innerHeight - rect.top + 4,
      left,
      width: minWidth,
      openUpward: openUp,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleScrollOrResize = (e) => {
      // Abaikan jika scroll dilakukan di dalam daftar options popover sendiri
      if (popoverRef.current && popoverRef.current.contains(e.target)) {
        return;
      }
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true); // capture = true menangkap scroll di dalam modal/div

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  // Auto focus search input and set initial highlight when opened
  useEffect(() => {
    if (isOpen) {
      const selIdx = filteredOptions.findIndex((opt) => isOptionSelected(opt.value, value));
      setHighlightedIndex(selIdx >= 0 ? selIdx : 0);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // Scroll active option into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const el = document.getElementById(`${id || 'search-select'}-opt-${highlightedIndex}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen, id]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        (containerRef.current && containerRef.current.contains(e.target)) ||
        (popoverRef.current && popoverRef.current.contains(e.target))
      ) {
        return;
      }
      setIsOpen(false);
      setSearchQuery('');
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Select an option
  const handleSelect = (opt) => {
    if (opt.disabled) return;
    const newValue = opt.value;
    setIsOpen(false);
    setSearchQuery('');

    if (onChange) {
      const event = {
        target: {
          name,
          id,
          value: newValue,
        },
        currentTarget: {
          name,
          id,
          value: newValue,
        },
        value: newValue,
        toJSON: () => newValue,
        toString: () => String(newValue),
        valueOf: () => newValue,
        [Symbol.toPrimitive]: (hint) => (hint === 'number' ? Number(newValue) : String(newValue)),
      };
      onChange(event, newValue);
    }
  };

  // Clear selection
  const canClear = useMemo(() => {
    if (disabled) return false;
    if (isClearable !== undefined) return isClearable;
    // By default clearable if value is not empty and not strictly required without empty option
    const hasValue = value !== undefined && value !== null && value !== '';
    const hasEmptyOption = normalizedOptions.some((o) => o.value === '');
    return hasValue && (!required || hasEmptyOption);
  }, [disabled, isClearable, value, required, normalizedOptions]);

  const handleClear = (e) => {
    e.stopPropagation();
    e.preventDefault();
    handleSelect({ value: '', label: '' });
  };

  // Keyboard navigation on trigger button
  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setIsOpen(true);
      setSearchQuery(e.key);
    }
  };

  // Keyboard navigation inside search input
  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= filteredOptions.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? Math.max(0, filteredOptions.length - 1) : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const opt = filteredOptions[highlightedIndex];
        if (!opt.disabled) {
          handleSelect(opt);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  // Split className into wrapper sizing and trigger styling
  const { wrapperClasses, triggerClasses } = useMemo(() => {
    const wrap = [];
    const trig = [];
    const tokens = (className || '').split(/\s+/).filter(Boolean);

    for (const cls of tokens) {
      if (cls === 'input') continue; // Handled by trigger's base styles
      if (
        cls.startsWith('w-') ||
        cls.startsWith('min-w-') ||
        cls.startsWith('max-w-') ||
        cls.startsWith('flex-') ||
        cls === 'flex-1' ||
        cls === 'flex-auto' ||
        cls.startsWith('col-span-') ||
        cls.startsWith('sm:') ||
        cls.startsWith('md:') ||
        cls.startsWith('lg:')
      ) {
        wrap.push(cls);
      } else {
        trig.push(cls);
      }
    }
    return { wrapperClasses: wrap.join(' '), triggerClasses: trig.join(' ') };
  }, [className]);

  const isSmall = size === 'sm' || triggerClasses.includes('text-xs');

  return (
    <div
      ref={containerRef}
      className={`relative ${wrapperClasses || 'w-full'} ${wrapperClassName}`}
    >
      {/* Hidden input for HTML5 form validation */}
      {required && (
        <input
          type="text"
          name={name}
          tabIndex={-1}
          aria-hidden="true"
          required={required}
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={() => {}}
          onInvalid={(e) => {
            e.preventDefault();
            triggerRef.current?.focus();
            setIsOpen(true);
          }}
          style={{
            position: 'absolute',
            opacity: 0,
            width: '1px',
            height: '1px',
            margin: '-1px',
            padding: 0,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            border: 0,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Main Trigger Button */}
      <button
        ref={triggerRef}
        id={id}
        name={name}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`
          flex w-full items-center justify-between gap-2 rounded-lg border text-left transition-colors
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300 hover:border-slate-400'}
          ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white'}
          ${isSmall ? 'min-h-[34px] px-2.5 py-1.5 text-xs' : 'min-h-[38px] px-3 py-2 text-sm'}
          ${triggerClasses}
        `}
      >
        <span
          className={`block truncate ${
            disabled
              ? 'text-slate-400'
              : isDisplayPlaceholder
              ? 'text-slate-400'
              : 'text-slate-800 font-normal'
          }`}
        >
          {displayLabel}
        </span>

        <div className="flex shrink-0 items-center gap-1.5">
          {canClear && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClear(e);
                }
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Hapus pilihan"
              aria-label="Hapus pilihan"
            >
              <X className={isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </span>
          )}
          <ChevronDown
            className={`text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-500' : ''
            } ${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popover via Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: dropdownCoords.openUpward ? undefined : `${dropdownCoords.top}px`,
              bottom: dropdownCoords.openUpward ? `${dropdownCoords.bottom}px` : undefined,
              left: `${dropdownCoords.left}px`,
              width: `${dropdownCoords.width}px`,
              zIndex: 999999,
            }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Box Header */}
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/90 p-2 backdrop-blur-sm">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Bersihkan pencarian"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Options List */}
            <div
              ref={listRef}
              role="listbox"
              className="max-h-60 overflow-y-auto p-1 focus:outline-none"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-slate-500">
                  <Search className="mx-auto mb-1.5 h-4 w-4 text-slate-300" />
                  <p className="font-medium text-slate-600">{noResultsText}</p>
                  {searchQuery && (
                    <p className="mt-0.5 truncate px-2 text-[11px] text-slate-400">
                      Tidak ada hasil untuk &ldquo;{searchQuery}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = isOptionSelected(opt.value, value);
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={`${opt.value}-${idx}`}
                      id={`${id || 'search-select'}-opt-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                      className={`
                        group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors
                        ${opt.disabled ? 'cursor-not-allowed opacity-40' : ''}
                        ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-medium'
                            : isHighlighted
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }
                      `}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="truncate">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="truncate text-[10px] text-slate-400">{opt.sublabel}</div>
                        )}
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

