import React, { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Edit2, Check, X } from 'lucide-react';

const defaultDepartments = [
  'Homelessness', 'Public Safety', 'E&S', 'CVPA',
  'CV Housing First', 'DCE', 'Transportation', 'Arts & Music',
  'CV Link', 'CV Sync', 'CVCC', 'Holiday',
  'Sick', 'Vacation'
];

const backgroundColors = {
  0: '#3D3520', 1: '#3D2320', 2: '#203D20', 3: '#20203D',
  4: '#3D2E20', 5: '#2E203D', 6: '#20303D', 7: '#3D2037',
  8: '#3D203D', 9: '#203D2E', 10: '#203D3A', 11: '#3D2626',
  12: '#2E3D20', 13: '#3D3520'
};

const DEFAULT_BG_COLOR = '#1E2124';
const TIMEZONE = 'America/Los_Angeles';

const createInitialTimers = (departments) => departments.reduce((acc, dept, index) => ({
  ...acc,
  [index]: { isActive: false, time: 0 }
}), {});

const getTodayDate = () => {
  return new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE }).format(new Date());
};

const initialState = {
  currentDate: getTodayDate(),
  timers: {},
  departments: defaultDepartments,
};

const isLocalStorageAvailable = () => {
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.error('localStorage is not available:', e);
    return false;
  }
};

const saveState = (state) => {
  if (isLocalStorageAvailable()) {
    try {
      const serializedState = JSON.stringify(state);
      localStorage.setItem('timeTrackerState', serializedState);
      console.log('State saved successfully');
    } catch (err) {
      console.error('Failed to save state to localStorage:', err);
    }
  }
};

const loadState = () => {
  if (isLocalStorageAvailable()) {
    try {
      const serializedState = localStorage.getItem('timeTrackerState');
      if (serializedState === null) {
        console.log('No saved state found in localStorage');
        return undefined;
      }
      const parsedState = JSON.parse(serializedState);
      console.log('Loaded state from localStorage');
      return parsedState;
    } catch (err) {
      console.error('Failed to load state from localStorage:', err);
      return undefined;
    }
  }
  return undefined;
};

function reducer(state, action) {
  let newState;
  switch (action.type) {
    case 'INIT_STATE':
      newState = action.payload;
      break;
    case 'INCREMENT_TIMER':
      newState = {
        ...state,
        timers: {
          ...state.timers,
          [state.currentDate]: {
            ...state.timers[state.currentDate],
            [action.payload]: {
              ...state.timers[state.currentDate]?.[action.payload],
              time: (state.timers[state.currentDate]?.[action.payload]?.time || 0) + 1
            }
          }
        }
      };
      break;
    case 'TOGGLE_TIMER':
      const currentDateTimers = state.timers[state.currentDate] || {};
      const newTimers = { ...currentDateTimers };
      Object.keys(newTimers).forEach(index => {
        if (parseInt(index) !== action.payload && newTimers[index]?.isActive) {
          newTimers[index] = { ...newTimers[index], isActive: false };
        }
      });
      newTimers[action.payload] = {
        ...newTimers[action.payload],
        isActive: !(newTimers[action.payload]?.isActive || false)
      };
      newState = {
        ...state,
        timers: {
          ...state.timers,
          [state.currentDate]: newTimers
        }
      };
      break;
    case 'ADJUST_TIME':
      const { index, direction } = action.payload;
      const currentTime = state.timers[state.currentDate]?.[index]?.time || 0;
      const currentMinutes = Math.floor(currentTime / 60);
      const roundedMinutes = Math.round(currentMinutes / 15) * 15;
      const adjustment = direction === 'up' ? 15 : -15;
      const newMinutes = Math.max(0, roundedMinutes + adjustment);
      newState = {
        ...state,
        timers: {
          ...state.timers,
          [state.currentDate]: {
            ...state.timers[state.currentDate],
            [index]: {
              ...state.timers[state.currentDate]?.[index],
              time: newMinutes * 60
            }
          }
        }
      };
      break;
    case 'CHANGE_DATE':
      newState = { ...state, currentDate: action.payload };
      break;
    case 'UPDATE_DEPARTMENT_NAME':
      const { index: deptIndex, name } = action.payload;
      const newDepartments = [...state.departments];
      newDepartments[deptIndex] = name;
      newState = { ...state, departments: newDepartments };
      break;
    case 'REORDER_DEPARTMENTS':
      const { fromIndex, toIndex } = action.payload;
      const reorderedDepartments = [...state.departments];
      const [movedDept] = reorderedDepartments.splice(fromIndex, 1);
      reorderedDepartments.splice(toIndex, 0, movedDept);
      
      // Update timer data to match new order
      const reorderedTimers = { ...state.timers };
      Object.keys(reorderedTimers).forEach(date => {
        const dayTimers = { ...reorderedTimers[date] };
        const newDayTimers = {};
        
        // Create mapping from old indices to new indices
        const indexMap = {};
        state.departments.forEach((_, oldIndex) => {
          let newIndex = oldIndex;
          if (oldIndex === fromIndex) {
            newIndex = toIndex;
          } else if (fromIndex < toIndex && oldIndex > fromIndex && oldIndex <= toIndex) {
            newIndex = oldIndex - 1;
          } else if (fromIndex > toIndex && oldIndex >= toIndex && oldIndex < fromIndex) {
            newIndex = oldIndex + 1;
          }
          indexMap[oldIndex] = newIndex;
        });
        
        // Apply the mapping
        Object.keys(dayTimers).forEach(oldKey => {
          const oldIndex = parseInt(oldKey);
          const newIndex = indexMap[oldIndex];
          newDayTimers[newIndex] = dayTimers[oldKey];
        });
        
        reorderedTimers[date] = newDayTimers;
      });
      
      newState = { ...state, departments: reorderedDepartments, timers: reorderedTimers };
      break;
    default:
      return state;
  }
  return newState;
}

const TimeTracker = () => {
  const [state, dispatch] = useReducer(reducer, initialState, (initial) => {
    const loadedState = loadState();
    if (loadedState) {
      const today = getTodayDate();
      loadedState.currentDate = today;
      
      // Ensure departments array exists
      if (!loadedState.departments) {
        loadedState.departments = defaultDepartments;
      }
      
      // If there are no timers for today, create them
      if (!loadedState.timers[today]) {
        console.log('Creating new timers for today');
        loadedState.timers[today] = createInitialTimers(loadedState.departments);
      }
      
      return loadedState;
    }
    return {
      ...initial,
      timers: {
        [initial.currentDate]: createInitialTimers(initial.departments)
      }
    };
  });

  const [editingIndex, setEditingIndex] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const lastUpdateTime = useRef(Date.now());

  useEffect(() => {
    saveState(state);
    
    // Add reset function to window for easy access
    window.resetToNewDepartments = () => {
      const newState = {
        currentDate: getTodayDate(),
        departments: defaultDepartments,
        timers: {}
      };
      newState.timers[newState.currentDate] = createInitialTimers(defaultDepartments);
      dispatch({ type: 'INIT_STATE', payload: newState });
      console.log('Reset to new departments!');
    };
  }, [state]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculateOptimalGrid = () => {
    const numItems = state.departments.length;
    const containerWidth = dimensions.width - 32; // Account for padding
    const containerHeight = dimensions.height - 100; // Account for header and padding
    
    let bestCols = 1;
    let bestRows = numItems;
    let bestScore = Infinity;

    // Try different column counts
    for (let cols = 1; cols <= Math.min(numItems, 6); cols++) { // Limit max columns to 6
      const rows = Math.ceil(numItems / cols);
      const itemWidth = (containerWidth - (cols - 1) * 8) / cols; // Account for gaps
      const itemHeight = (containerHeight - (rows - 1) * 8) / rows;
      
      if (itemWidth <= 0 || itemHeight <= 0) continue;
      
      const aspectRatio = itemWidth / itemHeight;
      
      // More restrictive aspect ratio range (1:1 to 2.5:1 instead of 16:9)
      if (aspectRatio >= 0.8 && aspectRatio <= 2.5) {
        // Prefer aspect ratios closer to 1.2-1.8 range (good for buttons)
        const idealRatio = dimensions.width > 768 ? 1.4 : 1.2; // Slightly different for mobile vs desktop
        let score = Math.abs(aspectRatio - idealRatio);
        
        // Penalize extreme column counts
        if (cols === 1 && numItems > 4) score += 0.5; // Avoid single column for many items
        if (cols > 4) score += 0.3; // Slightly penalize too many columns
        
        // Prefer grids that use space efficiently
        const efficiency = (numItems / (cols * rows));
        score += (1 - efficiency) * 0.2; // Small penalty for unused grid spots
        
        if (score < bestScore) {
          bestScore = score;
          bestCols = cols;
          bestRows = rows;
        }
      }
    }

    // Fallback: if no good aspect ratio found, use a reasonable default
    if (bestScore === Infinity) {
      if (numItems <= 4) {
        bestCols = 2;
      } else if (numItems <= 9) {
        bestCols = 3;
      } else {
        bestCols = 4;
      }
      bestRows = Math.ceil(numItems / bestCols);
    }

    return { cols: bestCols, rows: bestRows };
  };

  const { cols } = calculateOptimalGrid();

  useEffect(() => {
    const updateTimers = () => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastUpdateTime.current) / 1000);
      
      if (elapsedSeconds > 0) {
        const currentDateTimers = state.timers[state.currentDate];
        if (currentDateTimers) {
          Object.keys(currentDateTimers).forEach(index => {
            if (currentDateTimers[index]?.isActive) {
              for (let i = 0; i < elapsedSeconds; i++) {
                dispatch({ type: 'INCREMENT_TIMER', payload: parseInt(index) });
              }
            }
          });
        }
        lastUpdateTime.current = now;
      }
    };

    const intervalId = setInterval(updateTimers, 1000);
    return () => clearInterval(intervalId);
  }, [state.timers, state.currentDate]);

  const toggleTimer = useCallback((index) => {
    dispatch({ type: 'TOGGLE_TIMER', payload: index });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.match(/^F(\d+)$/)) {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(e.key.slice(1)) - 1;
        if (index >= 0 && index < state.departments.length) {
          toggleTimer(index);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [toggleTimer, state.departments.length]);

  const adjustTime = (index, direction) => {
    dispatch({ type: 'ADJUST_TIME', payload: { index, direction } });
  };

  const startEditing = (index, currentName) => {
    setEditingIndex(index);
    setEditingName(currentName);
  };

  const saveEdit = () => {
    if (editingName.trim()) {
      dispatch({ 
        type: 'UPDATE_DEPARTMENT_NAME', 
        payload: { index: editingIndex, name: editingName.trim() } 
      });
    }
    setEditingIndex(null);
    setEditingName('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingName('');
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add a small delay to prevent immediate toggling when starting drag
    setTimeout(() => {
      e.target.style.pointerEvents = 'none';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.pointerEvents = 'auto';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e) => {
    // Only clear if we're leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      dispatch({ 
        type: 'REORDER_DEPARTMENTS', 
        payload: { fromIndex: draggedIndex, toIndex: dropIndex } 
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: TIMEZONE
    }).format(date);
  };

  const changeDate = (direction) => {
    const currentDate = new Date(state.currentDate);
    currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    const newDate = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE }).format(currentDate);
    dispatch({ type: 'CHANGE_DATE', payload: newDate });
  };

  const increaseLuminosity = (color, amount) => {
    const hex = color.replace('#', '');
    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);
    
    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  return (
    <div 
      className="h-screen flex flex-col transition-colors duration-500 ease-in-out p-2 sm:p-4" 
      style={{ backgroundColor: DEFAULT_BG_COLOR, fontFamily: "'Chivo Mono', monospace" }}
    >
      <div className="flex justify-between items-center mb-2">
        <button onClick={() => changeDate('prev')}><ChevronLeft size={18} color="white" /></button>
        <h2 className="text-xs sm:text-sm text-white font-light">{formatDate(state.currentDate)}</h2>
        <button onClick={() => changeDate('next')}><ChevronRight size={18} color="white" /></button>
      </div>
      <div 
        className="flex-grow grid gap-2 auto-rows-fr"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`
        }}
      >
        {state.departments.map((dept, index) => {
          const activeColor = backgroundColors[index % Object.keys(backgroundColors).length];
          const lighterColor = increaseLuminosity(activeColor, 60);
          const isActive = state.timers[state.currentDate]?.[index]?.isActive || false;
          const hasTime = (state.timers[state.currentDate]?.[index]?.time || 0) > 0;
          const buttonBgColor = isActive ? lighterColor : activeColor;
          const isEditing = editingIndex === index;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index && draggedIndex !== index;
          
          return (
            <div 
              key={index} 
              className={`flex flex-col justify-between cursor-pointer rounded-lg overflow-hidden relative ${isDragging ? 'opacity-50 transform scale-95' : ''} ${isDragOver ? 'ring-2 ring-white/50' : ''}`}
              style={{
                background: isActive 
                  ? `linear-gradient(to bottom, ${lighterColor} 0%, ${activeColor} 100%)`
                  : 'transparent',
                border: isActive ? 'none' : `1px solid ${hasTime ? increaseLuminosity(activeColor, 20) : '#4A4A4A'}`,
                borderWidth: hasTime && !isActive ? '2px' : '1px',
                boxShadow: hasTime && !isActive ? `0 0 12px 2px ${buttonBgColor}80` : 'none',
                transition: isDragging ? 'none' : 'all 0.15s ease-in-out',
                transform: isDragOver ? 'scale(1.02)' : (isDragging ? 'scale(0.95)' : 'scale(1)')
              }}
              onClick={() => !isEditing && !isDragging && toggleTimer(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              draggable={!isEditing}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
            >

                <div className="flex justify-between items-baseline p-1 sm:p-2">
                <div className="flex items-center flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center w-full gap-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        className="bg-transparent border border-white/30 rounded px-1 text-white text-sm flex-1 min-w-0"
                        style={{ fontSize: 'inherit' }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                        className="p-1 hover:bg-white/20 rounded"
                      >
                        <Check size={12} color="white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                        className="p-1 hover:bg-white/20 rounded"
                      >
                        <X size={12} color="white" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <h2 
                        className="font-bold text-sm sm:text-base md:text-lg lg:text-xl truncate flex-1" 
                        style={{ color: isActive ? 'white' : increaseLuminosity(activeColor, 30) }}
                      >
                        {dept}
                      </h2>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(index, dept); }}
                        className="p-1 hover:bg-white/20 rounded transition-all duration-200"
                        style={{ 
                          opacity: hoveredIndex === index ? 0.7 : 0,
                          transition: 'opacity 0.2s ease-in-out'
                        }}
                      >
                        <Edit2 size={12} color={isActive ? 'white' : increaseLuminosity(activeColor, 30)} />
                      </button>
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <p className="text-xs sm:text-sm md:text-base lg:text-lg font-light ml-2" style={{ 
                    color: isActive ? 'white' : increaseLuminosity(activeColor, 30)
                  }}>
                    F{index + 1}
                  </p>
                )}
              </div>
              <div className="flex-grow flex items-center justify-center">
                <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl w-full text-center font-medium" style={{ 
                  color: increaseLuminosity(buttonBgColor, 100),
                  letterSpacing: '0.05em'
                }}>
                  {formatTime(state.timers[state.currentDate]?.[index]?.time || 0)}
                </p>
              </div>
              <div className="flex">
                <button 
                  onClick={(e) => { e.stopPropagation(); adjustTime(index, 'down'); }}
                  className="w-1/2 h-8 sm:h-10 md:h-12 flex items-center justify-center transition-all duration-300 hover:bg-opacity-20 active:bg-opacity-30 focus:outline-none"
                  style={{ 
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    transform: 'translateY(0)',
                    transition: 'transform 0.1s ease-in-out, background-color 0.3s ease-in-out'
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(2px)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <ChevronDown size={20} color={increaseLuminosity(buttonBgColor, 80)} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); adjustTime(index, 'up'); }}
                  className="w-1/2 h-8 sm:h-10 md:h-12 flex items-center justify-center transition-all duration-300 hover:bg-opacity-20 active:bg-opacity-30 focus:outline-none"
                  style={{ 
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    transform: 'translateY(0)',
                    transition: 'transform 0.1s ease-in-out, background-color 0.3s ease-in-out'
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(2px)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <ChevronUp size={20} color={increaseLuminosity(buttonBgColor, 80)} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimeTracker;
