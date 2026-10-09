import React, { useState, useEffect, useRef } from 'react';

export const SearchableSelect = ({
    id,
    label,
    kannadaLabel,
    placeholder,
    options = [],
    value = '',
    onChange,
    disabled = false,
    required = false,
    allowOther = false,
    otherValue = '',
    onOtherChange,
    otherPlaceholder = 'Enter custom name...'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);
    const searchInputRef = useRef(null);

    // Filter options based on search query
    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        } else {
            setSearchTerm('');
        }
    }, [isOpen]);

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    const isCustomSelected = value === '__OTHER__';

    return (
        <div className="form-group" style={{ position: 'relative', marginBottom: '14px' }} ref={wrapperRef}>
            {label && (
                <label 
                    htmlFor={id} 
                    style={{ 
                        fontSize: '0.8rem', 
                        color: '#94a3b8', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '6px'
                    }}
                >
                    <span>
                        {label} {kannadaLabel && <span style={{ color: '#64748b' }}>({kannadaLabel})</span>}
                        {required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                    </span>
                    {options.length > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            {options.length} available
                        </span>
                    )}
                </label>
            )}

            {/* Custom Trigger Button */}
            <div
                id={id}
                tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (!disabled) setIsOpen(true);
                    }
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: disabled ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.75)',
                    border: isOpen 
                        ? '1px solid #6366f1' 
                        : (value ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)'),
                    borderRadius: '8px',
                    color: disabled ? '#64748b' : (value ? '#f8fafc' : '#94a3b8'),
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s ease',
                    boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                    minHeight: '44px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '0.8rem', color: value ? '#818cf8' : '#64748b' }}></i>
                    <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {isCustomSelected 
                            ? (otherValue ? `Custom: ${otherValue}` : '➕ Custom Entry Selected') 
                            : (value || placeholder || '-- Select --')}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {value && !disabled && (
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                            title="Clear"
                            style={{
                                color: '#94a3b8',
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.05)',
                                cursor: 'pointer'
                            }}
                        >
                            ✕
                        </span>
                    )}
                    <i 
                        className={`fa-solid fa-chevron-down`} 
                        style={{ 
                            fontSize: '0.75rem', 
                            color: '#94a3b8',
                            transform: isOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s ease'
                        }}
                    ></i>
                </div>
            </div>

            {/* Dropdown Menu with Live Search Filter */}
            {isOpen && !disabled && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        marginTop: '4px',
                        background: '#0f172a',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '10px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)',
                        overflow: 'hidden',
                        animation: 'fadeIn 0.15s ease-out'
                    }}
                >
                    {/* Embedded Search Input */}
                    <div style={{ padding: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <i className="fa-solid fa-search" style={{ position: 'absolute', left: '10px', fontSize: '0.8rem', color: '#818cf8' }}></i>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={`Search among ${options.length} items...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: '100%',
                                    padding: '8px 10px 8px 30px',
                                    fontSize: '0.85rem',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => {
                                const isSelected = value === opt;
                                return (
                                    <div
                                        key={opt}
                                        onClick={() => handleSelect(opt)}
                                        style={{
                                            padding: '8px 12px',
                                            fontSize: '0.85rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                            color: isSelected ? '#a5b4fc' : '#e2e8f0',
                                            fontWeight: isSelected ? '600' : 'normal',
                                            transition: 'background 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <span>{opt}</span>
                                        {isSelected && <i className="fa-solid fa-check" style={{ color: '#818cf8', fontSize: '0.8rem' }}></i>}
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
                                No match found for "{searchTerm}"
                            </div>
                        )}

                        {/* Optional Custom Option Fallback */}
                        {allowOther && (
                            <div
                                onClick={() => handleSelect('__OTHER__')}
                                style={{
                                    marginTop: '4px',
                                    padding: '8px 12px',
                                    fontSize: '0.85rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                    color: isCustomSelected ? '#38bdf8' : '#38bdf8',
                                    background: isCustomSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.05)',
                                    fontWeight: '500'
                                }}
                            >
                                <i className="fa-solid fa-pen-to-square"></i>
                                <span>➕ Other / Type Custom Name</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Custom Input when Other is selected */}
            {allowOther && isCustomSelected && (
                <div style={{ marginTop: '8px' }}>
                    <input
                        type="text"
                        placeholder={otherPlaceholder}
                        value={otherValue}
                        onChange={(e) => onOtherChange && onOtherChange(e.target.value)}
                        required={required}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '9px 12px',
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.875rem'
                        }}
                    />
                </div>
            )}
        </div>
    );
};
