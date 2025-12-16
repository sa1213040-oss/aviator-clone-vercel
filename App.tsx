import React, { useState, useEffect, useRef } from 'react';
// تمام امپورٹس کو GitHub پر موجود فائل ناموں سے میچ کیا گیا ہے (بڑے حروف - Upper-case)
import Header from './Header.tsx'; 
import HistoryBar from './HistoryBar.tsx'; 
import GameCanvas from './GameCanvas.tsx'; 
import BetPanel from './BetPanel.tsx'; 
import StatsPanel from './StatsPanel.tsx'; 
import FloatingSidebar from './FloatingSidebar.tsx'; 
import { GameStatus, MultiplierHistoryItem, UserBetHistoryItem } from './types';
import { X } from 'lucide-react';

// ==============================
// CRASH MULTIPLIER PLAN
// ==============================

const FORWARD_RUN = [
  1.41, 110.09, 3.26, 1.73, 1.18, 1.56, 1.29,
  6.84, 1.12, 1.67, 2.91, 1.38, 1.74, 1.21,
  10.56, 1.09, 1.42, 1.31, 1.88, 1.27,
  4.36, 1.63, 7.12, 1.19, 1.55, 1.14,
  32.03,
  1.48, 1.26, 1.71, 1.33, 2.46,
  1.09, 1.62, 1.37, 1.81, 1.24,
  5.94, 1.58, 3.11, 1.29, 1.74,
  110.07,
  1.17, 1.42, 1.66, 1.09, 1.83, 1.31,
  2.78, 1.54, 6.76,
  1.12, 1.39, 1.67,
  4.09, 1.22,
  18.44,
  1.58, 1.14, 1.72, 1.06,
  27.31,
  1.49, 1.25, 1.68,
  3.86, 1.33, 1.17
];

const REVERSE_VARIANT_RUN = [
  1.17, 1.33, 3.86, 1.68, 1.25,
  27.31,
  1.06, 1.72, 1.14, 1.58,
  18.44,
  1.22, 4.09,
  1.67, 1.39, 1.12,
  6.76, 1.54,
  2.78,
  1.31, 1.83, 1.09, 1.66, 1.42, 1.17,
  110.07,
  1.74, 1.29, 3.11, 1.58,
  5.94,
  1.24, 1.81, 1.37, 1.62, 1.09,
  2.46,
  1.33, 1.71, 1.26, 1.48,
  32.03,
  1.14, 1.55, 1.19,
  7.12,
  1.63, 4.36,
  1.27, 1.88, 1.31, 1.42, 1.09,
  10.56,
  1.21, 1.74, 1.38, 2.91,
  1.67, 1.12, 6.84,
  1.29, 1.56, 1.18, 1.73,
  3.26, 1.09, 1.41
];

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState<number>(500.00);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.WAITING);
  const [multiplier, setMultiplier] = useState<number>(1.00);
  const [showLowBalance, setShowLowBalance] = useState(false);
  
  // User Count Synchronization State
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [activeUsers, setActiveUsers] = useState<number>(0);

  // State for the Cash Out Notification Modal
  const [winNotification, setWinNotification] = useState<{amount: number, multiplier: number} | null>(null);
  
  // User Bet History State (Real data)
  const [myBets, setMyBets] = useState<UserBetHistoryItem[]>([]);

  // Initial History matching the requested screenshot
  const [history, setHistory] = useState<MultiplierHistoryItem[]>([
    { value: 1.86, color: 'blue' },
    { value: 1.51, color: 'blue' },
    { value: 1.02, color: 'blue' },
    { value: 17.28, color: 'pink' }, 
    { value: 17.70, color: 'pink' },
    { value: 1.51, color: 'blue' },
    { value: 2.63, color: 'purple' },
  ]);

  const animationFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lowBalanceTimeoutRef = useRef<number>(0);
  const winNotificationTimeoutRef = useRef<number>(0);
  const userDropIntervalRef = useRef<number>(0);

  // Sequence Logic Refs
  const sequenceIndexRef = useRef<number>(0);
  const isReverseRunRef = useRef<boolean>(false);
  const targetCrashPointRef = useRef<number>(1.00);

  // Audio Refs
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const crashRef = useRef<HTMLAudioElement | null>(null);
  const winRef = useRef<HTMLAudioElement | null>(null);
  const countdownRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef<boolean>(false); // Track if audio context is unlocked

  // Helper to safely play audio
  const safePlayAudio = (audio: HTMLAudioElement | null) => {
    if (!audio || !audioEnabledRef.current) return;
    
    // Reset time to start
    audio.currentTime = 0;
    
    audio.play().catch(e => {
        // Ignore NotAllowedError (Autoplay policy) as it's expected if sync fails
        if (e.name !== 'NotAllowedError') {
            console.error("Audio playback error:", e);
        }
    });
  };

  // ============================================
  // AUDIO INITIALIZATION LOGIC (UPDATED PATHS)
  // ============================================
  useEffect(() => {
    // 1. Initialize Audio Objects with Correct Paths (Removed leading '/')
    const bgm = new Audio('bgm/bgm.mp3'); 
    bgm.loop = true;
    bgm.volume = 0.3; // Lower volume for background
    bgmRef.current = bgm;

    const crash = new Audio('crash/crash.mp3'); 
    crash.volume = 0.6;
    crashRef.current = crash;

    const win = new Audio('win/win.mp3'); 
    win.volume = 0.7;
    winRef.current = win;

    const countdown = new Audio('countdown/ready.mp3'); 
    countdown.volume = 0.6;
    countdownRef.current = countdown;

    // 2. Define Interaction Handler
    const enableAudioOnInteraction = () => {
      audioEnabledRef.current = true;
      
      if (bgmRef.current && bgmRef.current.paused) {
        bgmRef.current.play().catch((err) => {
            // Suppress autoplay errors here too, just in case
            if (err.name !== 'NotAllowedError') {
               console.warn("BGM playback failed even after interaction:", err);
            }
        });
      }

      // 3. Remove listeners once audio is enabled
      window.removeEventListener('click', enableAudioOnInteraction);
      window.removeEventListener('touchstart', enableAudioOnInteraction);
      window.removeEventListener('keydown', enableAudioOnInteraction);
    };

    // 4. Attempt Autoplay Immediately
    bgm.play()
      .then(() => {
        // If autoplay works immediately, mark audio as enabled
        audioEnabledRef.current = true;
      })
      .catch(() => {
        console.log("Autoplay blocked. Waiting for user interaction to start BGM.");
        // 5. Fallback: Add Listeners for First Interaction
        window.addEventListener('click', enableAudioOnInteraction);
        window.addEventListener('touchstart', enableAudioOnInteraction);
        window.addEventListener('keydown', enableAudioOnInteraction);
      });

    // Cleanup
    return () => {
      window.removeEventListener('click', enableAudioOnInteraction);
      window.removeEventListener('touchstart', enableAudioOnInteraction);
      window.removeEventListener('keydown', enableAudioOnInteraction);
      
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current = null;
      }
      crashRef.current = null;
      winRef.current = null;
      countdownRef.current = null;
    };
  }, []);

  // Splash Screen Logic (3 Seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Balance Handlers
  const handlePlaceBet = (amount: number): boolean => {
      if (balance >= amount) {
          setBalance(prev => prev - amount);
          return true;
      }
      
      // Trigger Low Balance Notification
      setShowLowBalance(true);
      if (lowBalanceTimeoutRef.current) clearTimeout(lowBalanceTimeoutRef.current);
      lowBalanceTimeoutRef.current = window.setTimeout(() => {
          setShowLowBalance(false);
      }, 3000);
      
      return false;
  };

  const handleWin = (amount: number, multiplier: number, betAmount: number) => {
      setBalance(prev => prev + amount);
      
      // Play Win Sound
      safePlayAudio(winRef.current);
      
      // Trigger Cash Out Notification Modal
      setWinNotification({ amount, multiplier });
      if (winNotificationTimeoutRef.current) clearTimeout(winNotificationTimeoutRef.current);
      winNotificationTimeoutRef.current = window.setTimeout(() => {
          setWinNotification(null);
      }, 4000);

      // Add WIN to history
      const newBet: UserBetHistoryItem = {
          id: Date.now() + Math.random(),
          time: new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit'}),
          betAmount: betAmount,
          multiplier: multiplier,
          winAmount: amount,
          result: 'win'
      };
      setMyBets(prev => [newBet, ...prev]);
  };

  const handleLoss = (betAmount: number) => {
      // Add LOSS to history
      const newBet: UserBetHistoryItem = {
          id: Date.now() + Math.random(),
          time: new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit'}),
          betAmount: betAmount,
          multiplier: 0,
          winAmount: 0,
          result: 'loss'
      };
      setMyBets(prev => [newBet, ...prev]);
  };

  const handleRefund = (amount: number) => {
      setBalance(prev => prev + amount);
  };

  // Game Loop Simulation
  useEffect(() => {
    if (isLoading) return;

    const runGame = () => {
      // 1. Determine Crash Point from Sequence
      let currentArray = isReverseRunRef.current ? REVERSE_VARIANT_RUN : FORWARD_RUN;
      let currentIndex = sequenceIndexRef.current;

      // Safety check if index out of bounds
      if (currentIndex >= currentArray.length) {
          currentIndex = 0;
          isReverseRunRef.current = !isReverseRunRef.current;
          currentArray = isReverseRunRef.current ? REVERSE_VARIANT_RUN : FORWARD_RUN;
          sequenceIndexRef.current = 0;
      }

      const nextCrash = currentArray[currentIndex];
      targetCrashPointRef.current = nextCrash;

      // Advance Sequence for next round
      sequenceIndexRef.current += 1;
      if (sequenceIndexRef.current >= currentArray.length) {
          sequenceIndexRef.current = 0;
          isReverseRunRef.current = !isReverseRunRef.current;
      }

      // 2. Waiting Phase
      setGameStatus(GameStatus.WAITING);
      setMultiplier(1.00);

      // Play Countdown Sound
      safePlayAudio(countdownRef.current);
      
      // Initialize Users
      const startUsers = Math.floor(Math.random() * (4000 - 2000) + 2000); 
      setTotalUsers(startUsers);
      setActiveUsers(startUsers); 

      setTimeout(() => {
        // 3. Flying Phase
        setGameStatus(GameStatus.FLYING);
        startTimeRef.current = Date.now();
        
        if (userDropIntervalRef.current) clearInterval(userDropIntervalRef.current);
        userDropIntervalRef.current = window.setInterval(() => {
            setActiveUsers(prev => {
                if (prev <= 15) return Math.max(6, prev - (Math.random() > 0.8 ? 1 : 0)); 
                const dropRate = 0.015; 
                const drop = Math.ceil(prev * dropRate * Math.random());
                return Math.max(12, prev - drop);
            });
        }, 200);

        const animate = () => {
          const now = Date.now();
          const elapsed = (now - startTimeRef.current) / 1000;
          
          // SPEED UPDATE: "2 points slow"
          const nextMultiplier = 1 + (0.04 * elapsed) + (0.004 * Math.pow(elapsed, 2)); 
          
          setMultiplier(nextMultiplier);

          // Check against Deterministic Crash Point
          if (nextMultiplier >= targetCrashPointRef.current) {  
              crash(targetCrashPointRef.current);
              return;
          }
            
          animationFrameRef.current = requestAnimationFrame(animate);

        };
        
        animationFrameRef.current = requestAnimationFrame(animate);

      }, 5000); 
    };

    const crash = (finalValue: number) => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (userDropIntervalRef.current) clearInterval(userDropIntervalRef.current);
        
        setGameStatus(GameStatus.CRASHED);
        // Ensure displayed multiplier matches exactly the crash point
        setMultiplier(finalValue);

        // Play Crash Sound
        safePlayAudio(crashRef.current);
        
        const newItem: MultiplierHistoryItem = {
            value: finalValue,
            // STRICT Color Logic:
            // < 2.0 = Blue
            // 2.0 - 9.99 = Purple
            // >= 10.0 = Pink
            color: finalValue < 2 ? 'blue' : finalValue < 10 ? 'purple' : 'pink'
        };
        setHistory(prev => [newItem, ...prev].slice(0, 15));

        setTimeout(runGame, 3000); 
    };

    runGame();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (userDropIntervalRef.current) clearInterval(userDropIntervalRef.current);
    };
  }, [isLoading]); 

  if (isLoading) {
    return (
      <div 
        className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center font-sans"
      >
        <span className="text-white text-xl font-normal tracking-wide">Connection...</span>
        <div className="absolute bottom-10 bg-white text-black px-8 py-3 rounded-full shadow-2xl max-w-[90%] mx-4">
            <p className="text-[11px] font-medium text-center leading-tight">
                Drag from top and swipe from the left or right edge to exit full screen.
            </p>
        </div>
      </div>
    );
  }

  return (
    <div 
        className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden max-w-[350px] mx-auto shadow-2xl border-x border-gray-900 relative"
    >
      <FloatingSidebar />
      
      {/* Low Balance Notification Modal */}
      <div 
        className={`absolute top-16 left-1/2 transform -translate-x-1/2 z-50 w-[90%] transition-all duration-300 ${showLowBalance ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center justify-between bg-[#1a0b0b] border border-[#ff0000]/50 rounded-full px-4 py-3 shadow-[0_0_20px_rgba(255,0,0,0.2)]">
            <span className="text-gray-200 font-sans text-sm font-medium ml-2">Not enough balance</span>
            <button 
                onClick={(e) => { e.stopPropagation(); setShowLowBalance(false); }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 transition-colors"
            >
                <X size={14} />
            </button>
        </div>
      </div>

      {/* Cash Out Notification Modal */}
      <div 
        className={`absolute top-24 left-1/2 transform -translate-x-1/2 z-50 w-[95%] transition-all duration-300 ${winNotification ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center justify-between bg-[#0f2816] border border-green-500/30 rounded-2xl p-2.5 shadow-[0_0_30px_rgba(34,197,94,0.3)] overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-950/80 via-green-900/40 to-transparent pointer-events-none"></div>
            <div className="flex flex-col pl-2 z-10">
                <span className="text-gray-300 text-xs font-medium tracking-wide">You have cashed out!</span>
                <span className="text-white font-black text-xl">{winNotification?.multiplier.toFixed(2)}x</span>
            </div>
            <div className="flex items-center gap-3 z-10">
                <div className="relative bg-[#2d7a36] rounded-full px-5 py-1.5 flex flex-col items-center justify-center min-w-[100px] border border-green-400/30 shadow-lg">
                    <div className="absolute -left-1 top-1 text-green-300/40 transform -rotate-12 select-none">★</div>
                    <div className="absolute -right-1 bottom-1 text-green-300/40 transform rotate-12 text-xs select-none">★</div>
                    <span className="text-green-100 text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5 opacity-90">Win PKR</span>
                    <span className="text-white font-black text-lg leading-none drop-shadow-sm">{winNotification?.amount.toFixed(2)}</span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); setWinNotification(null); }}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
      </div>

      <Header 
        balance={balance}
      />
      <HistoryBar history={history} />
      
      <main className="flex-1 overflow-y-auto p-2 pb-20 no-scrollbar">
        <GameCanvas 
            status={gameStatus} 
            multiplier={multiplier} 
            totalUsers={totalUsers} 
            activeUsers={activeUsers} 
        />
        
        <div className="flex flex-col space-y-2">
            <BetPanel 
                initialAmount={16.00} 
                currency="PKR" 
                gameStatus={gameStatus} 
                currentMultiplier={multiplier}
                onPlaceBet={handlePlaceBet}
                onWin={handleWin}
                onLoss={handleLoss}
                onRefund={handleRefund}
            />
            <BetPanel 
                initialAmount={16.00} 
                currency="PKR" 
                gameStatus={gameStatus} 
                currentMultiplier={multiplier}
                onPlaceBet={handlePlaceBet}
                onWin={handleWin}
                onLoss={handleLoss}
                onRefund={handleRefund}
            />
        </div>

        <StatsPanel 
            gameStatus={gameStatus} 
            currentMultiplier={multiplier} 
            totalBetsCount={totalUsers} 
            activeBetsCount={activeUsers} 
            userHistory={myBets} 
        />
      </main>
    </div>
  );
};

export default App;
