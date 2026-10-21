// src/App.jsx
import React, { useState, useEffect } from 'react';
import { fetchInitialData } from './services/quizService.js';
import { Header } from './components/navigation/Header.jsx';
import { BottomNav } from './components/navigation/BottomNav.jsx';
import { Icon } from '@iconify/react';
import { HomeView } from './views/HomeView.jsx';
import { ProfileView } from './views/ProfileView.jsx';
import { QuizModeModal } from './components/quiz/QuizModeModal.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import { Spinner } from './components/common/Spinner.jsx';

// Code-split heavy secondary views
const MyQuizzesView = React.lazy(() => import('./views/MyQuizzesView.jsx').then(m => ({ default: m.MyQuizzesView })));
const GroupHostView = React.lazy(() => import('./views/GroupHostView.jsx').then(m => ({ default: m.GroupHostView })));
const LeaderboardView = React.lazy(() => import('./views/LeaderboardView.jsx').then(m => ({ default: m.LeaderboardView })));
const ArenaView = React.lazy(() => import('./views/ArenaView.jsx').then(m => ({ default: m.ArenaView })));
const KiutView = React.lazy(() => import('./views/KiutView.jsx').then(m => ({ default: m.KiutView })));
const MistakesView = React.lazy(() => import('./views/MistakesView.jsx').then(m => ({ default: m.MistakesView })));
const QuizCreatorView = React.lazy(() => import('./views/QuizCreatorView.jsx').then(m => ({ default: m.QuizCreatorView })));
const TournamentView = React.lazy(() => import('./views/TournamentView.jsx').then(m => ({ default: m.TournamentView })));
const LiveRoomView = React.lazy(() => import('./views/LiveRoomView.jsx').then(m => ({ default: m.LiveRoomView })));
const QuizDetailView = React.lazy(() => import('./views/QuizDetailView.jsx').then(m => ({ default: m.QuizDetailView })));
import {
  NAV_HOME,
  NAV_MY_QUIZZES,
  NAV_GROUP_HOST,
  NAV_LEADERBOARD,
  NAV_PROFILE,
  VIEW_ARENA,
} from './constants/routes.js';
import { getCachedData, setCachedData, CACHE_KEYS } from './utils/cacheManager.js';

export default function App() {
  const [initialData, setInitialData] = useState(() => getCachedData(CACHE_KEYS.INITIAL_DATA));
  const [activeTab, setActiveTab] = useState(NAV_HOME);
  const [showKiutView, setShowKiutView] = useState(false);
  const [showMistakesView, setShowMistakesView] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [activeCustomQuestions, setActiveCustomQuestions] = useState(null);
  const [activeCustomTitle, setActiveCustomTitle] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [editQuizId, setEditQuizId] = useState(null);
  const [inspectQuizId, setInspectQuizId] = useState(null);
  const [activeTournamentCode, setActiveTournamentCode] = useState(null);
  const [activeRoomCode, setActiveRoomCode] = useState(null);
  const [activeLiveRoomCode, setActiveLiveRoomCode] = useState(null);
  const [loading, setLoading] = useState(() => !getCachedData(CACHE_KEYS.INITIAL_DATA));

  // Quiz Mode Modal state
  const [modeModalQuizId, setModeModalQuizId] = useState(null);
  const [activeQuizMode, setActiveQuizMode] = useState('full');
  const [activeQuizRange, setActiveQuizRange] = useState(null);
  const [activeQuizRandomCount, setActiveQuizRandomCount] = useState(null);

  const refreshData = () => {
    fetchInitialData()
      .then((data) => {
        if (data && data.user) {
          setInitialData(data);
          setCachedData(CACHE_KEYS.INITIAL_DATA, data);
        }
      })
      .catch((err) => {
        console.error('Failed to load initial data:', err);
      });
  };


  useEffect(() => {
    // 1. Check deep-link start parameter (e.g. gt_12_abc123)
    try {
      const tgParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      const urlParams = new URLSearchParams(window.location.search);
      const startParam = tgParam || urlParams.get('startapp') || urlParams.get('tgWebAppStartParam');
      if (startParam && startParam.startsWith('gt_')) {
        setActiveTournamentCode(startParam);
      } else if (startParam && startParam.startsWith('room_')) {
        setActiveRoomCode(startParam.replace('room_', ''));
      }
    } catch (e) {
      console.error('Failed to parse start param:', e);
    }


    // 2. Fetch initial app data
    fetchInitialData()
      .then((data) => {
        if (data) {
          setInitialData(data);
          if (data.user) {
            setCachedData(CACHE_KEYS.INITIAL_DATA, data);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load initial data:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);


  const handleStartQuiz = (quizId) => {
    setModeModalQuizId(quizId);
  };

  const handleConfirmMode = ({ quizId, mode, range, randomCount }) => {
    setModeModalQuizId(null);
    setActiveCustomQuestions(null);
    setActiveCustomTitle(null);
    setActiveQuizId(quizId);
    setActiveQuizMode(mode);
    setActiveQuizRange(range);
    setActiveQuizRandomCount(randomCount);
  };

  const handleStartMistakes = (mistakes, title = null) => {
    setActiveQuizId(null);
    setActiveCustomQuestions(mistakes);
    setActiveCustomTitle(title);
    setActiveQuizMode('mistakes');
    setActiveQuizRange(null);
    setActiveQuizRandomCount(null);
  };

  const handleExitArena = () => {
    setActiveQuizId(null);
    setActiveCustomQuestions(null);
    setActiveCustomTitle(null);
    setActiveQuizMode('full');
    setActiveQuizRange(null);
    setActiveQuizRandomCount(null);
    refreshData();
  };

  const handleQuizCreated = (savedQuizId) => {
    setEditQuizId(null);
    refreshData();
    if (savedQuizId) {
      handleStartQuiz(savedQuizId);
    }
  };

  const handleOpenCreator = () => {
    setEditQuizId(null);
    setShowCreator(true);
  };

  const handleEditQuiz = (quizId) => {
    setEditQuizId(quizId);
    setShowCreator(true);
  };

  // If playing a quiz in arena, render arena in fullscreen (no bottom nav)
  if (activeQuizId || activeCustomQuestions) {
    return (
      <ErrorBoundary>
        <React.Suspense
          fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }} className="animate-fade-in">
              <Spinner size={38} />
            </div>
          }
        >
          <ArenaView
            quizId={activeQuizId}
            customQuestions={activeCustomQuestions}
            customTitle={activeCustomTitle}
            mode={activeQuizMode}
            range={activeQuizRange}
            randomCount={activeQuizRandomCount}
            tournamentShareCode={activeTournamentCode}
            liveRoomCode={activeLiveRoomCode}
            onExit={handleExitArena}
          />
        </React.Suspense>
      </ErrorBoundary>
    );
  }

  const renderActiveView = () => {
    if (activeRoomCode) {
      return (
        <LiveRoomView
          roomCode={activeRoomCode}
          onStartGame={(quizId, roomCode, modeConfig = {}) => {
            setActiveQuizId(quizId);
            setActiveQuizMode(modeConfig?.mode || 'full');
            setActiveQuizRange(modeConfig?.range || null);
            setActiveQuizRandomCount(modeConfig?.randomCount || null);
            setActiveLiveRoomCode(roomCode || activeRoomCode);
          }}
          onBack={() => {
            setActiveRoomCode(null);
            setActiveLiveRoomCode(null);
          }}
        />
      );
    }

    if (activeTournamentCode) {
      return (
        <TournamentView
          shareCode={activeTournamentCode}
          onStartTournament={(quizId, code, modeConfig = {}) => {
            setActiveQuizId(quizId);
            setActiveQuizMode(modeConfig?.mode || 'full');
            setActiveQuizRange(modeConfig?.range || null);
            setActiveQuizRandomCount(modeConfig?.randomCount || null);
            setActiveTournamentCode(code);
          }}
          onBack={() => {
            setActiveTournamentCode(null);
          }}
        />
      );
    }

    if (showKiutView) {
      return (
        <KiutView
          onBack={() => setShowKiutView(false)}
          onStartQuiz={handleStartQuiz}
          myQuizzes={initialData?.myQuizzes}
          onQuizSaved={refreshData}
        />
      );
    }

    if (showMistakesView) {
      return (
        <MistakesView
          onBack={() => setShowMistakesView(false)}
          onStartMistakesPractice={(questions, title) => {
            setShowMistakesView(false);
            handleStartMistakes(questions, title);
          }}
        />
      );
    }

    if (showCreator) {
      return (
        <QuizCreatorView
          quizIdToEdit={editQuizId}
          onBack={() => {
            setShowCreator(false);
            setEditQuizId(null);
          }}
          onCreated={handleQuizCreated}
        />
      );
    }

    if (inspectQuizId) {
      return (
        <QuizDetailView
          quizId={inspectQuizId}
          onBack={() => setInspectQuizId(null)}
          onStartQuiz={(qid) => {
            setInspectQuizId(null);
            handleStartQuiz(qid);
          }}
          onEditQuiz={(qid) => {
            setInspectQuizId(null);
            handleEditQuiz(qid);
          }}
        />
      );
    }

    switch (activeTab) {
      case NAV_MY_QUIZZES:
        return (
          <MyQuizzesView
            initialData={initialData}
            onStartQuiz={handleStartQuiz}
            onOpenCreator={handleOpenCreator}
            onEditQuiz={handleEditQuiz}
            onInspectQuiz={(qid) => setInspectQuizId(qid)}
            onRefreshData={refreshData}
          />
        );
      case NAV_GROUP_HOST:
        return (
          <GroupHostView
            onOpenTournament={(code) => setActiveTournamentCode(code)}
            onOpenLiveRoom={(code) => setActiveRoomCode(code)}
            onOpenCreator={() => setShowCreator(true)}
            onOpenKiut={() => setShowKiutView(true)}
          />
        );

      case NAV_LEADERBOARD:

        return <LeaderboardView />;
      case NAV_PROFILE:
        return <ProfileView initialData={initialData} />;
      case NAV_HOME:
      default:
        return (
          <HomeView
            initialData={initialData}
            onStartQuiz={handleStartQuiz}
            onNavigateToTab={(tab) => {
              setShowKiutView(false);
              setShowMistakesView(false);
              setShowCreator(false);
              setInspectQuizId(null);
              setEditQuizId(null);
              setActiveTab(tab);
            }}
            onOpenCreator={handleOpenCreator}
            onStartMistakesPractice={handleStartMistakes}
            onOpenKiut={() => setShowKiutView(true)}
            onOpenMistakes={() => setShowMistakesView(true)}
          />
        );
    }
  };

  return (
    <div className="app-shell" style={{ paddingBottom: '96px' }}>
      <Header userStats={initialData?.user} />
      <main style={{ flex: 1 }}>
        <ErrorBoundary>
          <React.Suspense
            fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }} className="animate-fade-in">
                <Spinner size={38} />
              </div>
            }
          >
            {renderActiveView()}
          </React.Suspense>
        </ErrorBoundary>
      </main>
      <BottomNav
        activeTab={showKiutView || showMistakesView || showCreator || inspectQuizId ? null : activeTab}
        onSelectTab={(tab) => {
          setShowKiutView(false);
          setShowMistakesView(false);
          setShowCreator(false);
          setInspectQuizId(null);
          setEditQuizId(null);
          setActiveTab(tab);
        }}
      />

      <QuizModeModal
        isOpen={Boolean(modeModalQuizId)}
        onClose={() => setModeModalQuizId(null)}
        quizId={modeModalQuizId}
        onConfirmMode={handleConfirmMode}
      />
    </div>
  );
}

