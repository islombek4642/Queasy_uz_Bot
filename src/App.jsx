// src/App.jsx
import React, { useState, useEffect } from 'react';
import { fetchInitialData } from './services/quizService.js';
import { Header } from './components/navigation/Header.jsx';
import { BottomNav } from './components/navigation/BottomNav.jsx';
import { HomeView } from './views/HomeView.jsx';
import { MyQuizzesView } from './views/MyQuizzesView.jsx';
import { GroupHostView } from './views/GroupHostView.jsx';
import { LeaderboardView } from './views/LeaderboardView.jsx';
import { ProfileView } from './views/ProfileView.jsx';
import { ArenaView } from './views/ArenaView.jsx';
import { KiutView } from './views/KiutView.jsx';
import { MistakesView } from './views/MistakesView.jsx';
import { QuizCreatorModal } from './components/quiz/QuizCreatorModal.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import {
  NAV_HOME,
  NAV_MY_QUIZZES,
  NAV_GROUP_HOST,
  NAV_LEADERBOARD,
  NAV_PROFILE,
  VIEW_ARENA,
} from './constants/routes.js';

export default function App() {
  const [initialData, setInitialData] = useState(null);
  const [activeTab, setActiveTab] = useState(NAV_HOME);
  const [showKiutView, setShowKiutView] = useState(false);
  const [showMistakesView, setShowMistakesView] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [activeCustomQuestions, setActiveCustomQuestions] = useState(null);
  const [activeCustomTitle, setActiveCustomTitle] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [editQuizId, setEditQuizId] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshData = () => {
    fetchInitialData()
      .then((data) => {
        setInitialData(data);
      })
      .catch((err) => {
        console.error('Failed to load initial data:', err);
      });
  };

  useEffect(() => {
    fetchInitialData()
      .then((data) => {
        setInitialData(data);
      })
      .catch((err) => {
        console.error('Failed to load initial data:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleStartQuiz = (quizId) => {
    setActiveCustomQuestions(null);
    setActiveCustomTitle(null);
    setActiveQuizId(quizId);
  };

  const handleStartMistakes = (mistakes, title = null) => {
    setActiveQuizId(null);
    setActiveCustomQuestions(mistakes);
    setActiveCustomTitle(title);
  };

  const handleExitArena = () => {
    setActiveQuizId(null);
    setActiveCustomQuestions(null);
    setActiveCustomTitle(null);
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
      <ArenaView
        quizId={activeQuizId}
        customQuestions={activeCustomQuestions}
        customTitle={activeCustomTitle}
        onExit={handleExitArena}
      />
    );
  }

  const renderActiveView = () => {
    if (showKiutView) {
      return (
        <KiutView
          onBack={() => setShowKiutView(false)}
          onStartQuiz={handleStartQuiz}
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

    switch (activeTab) {
      case NAV_MY_QUIZZES:
        return (
          <MyQuizzesView
            initialData={initialData}
            onStartQuiz={handleStartQuiz}
            onOpenCreator={handleOpenCreator}
            onEditQuiz={handleEditQuiz}
            onRefreshData={refreshData}
          />
        );
      case NAV_GROUP_HOST:
        return <GroupHostView />;
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
          {renderActiveView()}
        </ErrorBoundary>
      </main>
      <BottomNav
        activeTab={showKiutView ? null : activeTab}
        onSelectTab={(tab) => {
          setShowKiutView(false);
          setActiveTab(tab);
        }}
      />

      <QuizCreatorModal
        isOpen={showCreator}
        quizIdToEdit={editQuizId}
        onClose={() => {
          setShowCreator(false);
          setEditQuizId(null);
        }}
        onCreated={handleQuizCreated}
      />
    </div>
  );
}

