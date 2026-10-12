// src/views/MyQuizzesView.jsx
import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { deleteQuiz } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { QuestionInspectorModal } from '../components/quiz/QuestionInspectorModal.jsx';

export function MyQuizzesView({ initialData, onStartQuiz, onOpenCreator, onEditQuiz, onRefreshData }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const myQuizzes = initialData?.myQuizzes || [];

  const [quizToDelete, setQuizToDelete] = useState(null);
  const [inspectQuizId, setInspectQuizId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedQuizId, setExpandedQuizId] = useState(null);

  const handleDeleteConfirm = async () => {
    if (!quizToDelete) return;
    setDeleting(true);
    try {
      const res = await deleteQuiz(quizToDelete.id);
      if (res && res.success) {
        haptic.notification('success');
        setQuizToDelete(null);
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Failed to delete quiz:', err);
      haptic.notification('error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{t('NAV_MY_QUIZZES')}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {myQuizzes.length} {t('NAV_MY_QUIZZES').toLowerCase()}
          </span>
        </div>

        {myQuizzes.length > 0 && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              haptic.selection();
              if (onOpenCreator) onOpenCreator();
            }}
            icon="solar:add-circle-bold"
          >
            {t('CREATE_QUIZ_TITLE')}
          </Button>
        )}
      </div>

      {myQuizzes.length === 0 ? (
        <Card style={{ padding: '32px 16px', textAlign: 'center' }}>
          <Icon icon="solar:document-add-bold-duotone" width="48" height="48" style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '6px' }}>{t('MY_QUIZZES_EMPTY')}</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {t('MY_QUIZZES_EMPTY_SUB')}
          </p>
          <Button variant="primary" size="md" onClick={onOpenCreator}>
            {t('CREATE_QUIZ_TITLE')}
          </Button>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {myQuizzes.map((quiz) => {
            const isExpanded = expandedQuizId === quiz.id;
            return (
              <Card key={quiz.id} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
                {/* Header area - click anywhere to expand/collapse */}
                <div
                  onClick={() => {
                    haptic.selection();
                    setExpandedQuizId(isExpanded ? null : quiz.id);
                  }}
                  style={{ minWidth: 0, cursor: 'pointer' }}
                >
                  <div
                    style={{
                      fontWeight: '800',
                      fontSize: '0.96rem',
                      color: 'var(--text-primary)',
                      whiteSpace: isExpanded ? 'normal' : 'nowrap',
                      overflow: isExpanded ? 'visible' : 'hidden',
                      textOverflow: isExpanded ? 'clip' : 'ellipsis',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      lineHeight: '1.35',
                    }}
                    title={quiz.title}
                  >
                    {quiz.title}
                  </div>
                  {quiz.description && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        whiteSpace: isExpanded ? 'normal' : 'nowrap',
                        overflow: isExpanded ? 'visible' : 'hidden',
                        textOverflow: isExpanded ? 'clip' : 'ellipsis',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {quiz.description}
                    </div>
                  )}
                </div>

                {/* Action Toolbar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--surface-border)',
                    marginTop: '2px',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Left: Badges + Secondary actions: Inspect, Edit, Delete */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge size="sm">{quiz.questionCount || 0} {t('QUESTIONS_COUNT')}</Badge>
                    <Badge size="sm" variant="warning">{quiz.timeLimit}s</Badge>

                    <button
                      onClick={() => {
                        haptic.selection();
                        setInspectQuizId(quiz.id);
                      }}
                      className="glass-pill"
                      style={{ padding: '6px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title={t('INSPECT_QUIZ_TITLE')}
                    >
                      <Icon icon="solar:eye-bold-duotone" width="16" height="16" />
                      <span className="hide-on-mobile-xs">{t('BTN_INSPECT')}</span>
                    </button>

                    <button
                      onClick={() => {
                        haptic.selection();
                        if (onEditQuiz) onEditQuiz(quiz.id);
                      }}
                      className="glass-pill"
                      style={{ padding: '6px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title={t('EDIT_QUIZ_TITLE')}
                    >
                      <Icon icon="solar:pen-bold-duotone" width="16" height="16" />
                      <span className="hide-on-mobile-xs">{t('BTN_EDIT')}</span>
                    </button>

                    <button
                      onClick={() => {
                        haptic.impact('medium');
                        setQuizToDelete(quiz);
                      }}
                      className="glass-pill"
                      style={{ padding: '6px 8px', fontSize: '0.78rem', color: 'var(--color-error)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title={t('DELETE_QUIZ_TITLE')}
                    >
                      <Icon icon="solar:trash-bin-trash-bold" width="16" height="16" />
                    </button>
                  </div>

                  {/* Primary: Start */}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      haptic.impact('medium');
                      onStartQuiz(quiz.id);
                    }}
                    icon="solar:play-bold"
                    style={{ padding: '7px 14px', fontSize: '0.82rem', flexShrink: 0 }}
                  >
                    {t('BTN_START_QUIZ')}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(quizToDelete)}
        onClose={() => setQuizToDelete(null)}
        title={t('CONFIRM_DELETE_TITLE')}
        confirmText={deleting ? t('SAVING') : t('BTN_CONFIRM_DELETE')}
        cancelText={t('BTN_EXIT')}
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        icon="solar:trash-bin-trash-bold"
      >
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {t('CONFIRM_DELETE_MSG', { title: quizToDelete?.title })}
        </p>
      </Modal>

      {/* Question Inspector Modal */}
      <QuestionInspectorModal
        isOpen={Boolean(inspectQuizId)}
        onClose={() => setInspectQuizId(null)}
        quizId={inspectQuizId}
        onStartQuiz={onStartQuiz}
      />
    </div>
  );
}
